// supabase/functions/batch-update-counters/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Redis } from 'https://deno.land/x/upstash_redis@v1.31.6/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CounterEvent {
  type: 'template_like' | 'template_comment' | 'template_view' | 'template_usage' | 'template_share'
  template_id: string
  user_id: string
  delta: number // +1 或 -1
  timestamp: number
  metadata?: Record<string, any>
}

interface BatchCounterUpdate {
  template_id: string
  like_delta: number
  comment_delta: number
  view_delta: number
  usage_delta: number
  share_delta: number
  event_count: number
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 初始化服务
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const redis = new Redis({
      url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
      token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
    })

    if (req.method === 'POST') {
      const body = await req.json()
      
      if (body.action === 'publish_event') {
        // 发布计数器事件到Redis Stream
        return await publishCounterEvent(redis, body.event)
      } else if (body.action === 'process_batch') {
        // 批量处理计数器事件
        return await processBatchCounters(redis, supabaseAdmin)
      }
    }

    if (req.method === 'GET') {
      // 获取计数器处理状态
      return await getCounterProcessingStatus(redis)
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[COUNTER EDGE FUNCTION] Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/**
 * 发布计数器事件到Redis Stream
 */
async function publishCounterEvent(redis: Redis, event: CounterEvent) {
  try {
    const streamKey = 'counter_events'
    
    const eventData = {
      type: event.type,
      template_id: event.template_id,
      user_id: event.user_id,
      delta: event.delta.toString(),
      timestamp: event.timestamp.toString(),
      metadata: event.metadata ? JSON.stringify(event.metadata) : ''
    }

    const messageId = await redis.xadd(streamKey, '*', eventData)
    
    console.log(`[COUNTER EDGE] Published event: ${event.type} for template ${event.template_id}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        data: { message_id: messageId, event_type: event.type },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('[COUNTER EDGE] Publish event failed:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

/**
 * 批量处理计数器事件
 */
async function processBatchCounters(redis: Redis, supabaseAdmin: any) {
  try {
    const streamKey = 'counter_events'
    const consumerGroup = 'counter_processors'
    const consumerName = `processor_${Date.now()}`
    
    // 确保消费者组存在
    try {
      await redis.xgroup('CREATE', streamKey, consumerGroup, '0', 'MKSTREAM')
    } catch (error) {
      // 消费者组可能已存在，继续
    }

    // 读取待处理的事件
    const results = await redis.xreadgroup(
      'GROUP', consumerGroup, consumerName,
      'COUNT', 50,
      'BLOCK', 1000,
      'STREAMS', streamKey, '>'
    )

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: { processed: 0, message: 'No events to process' },
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const [, messages] = results[0]
    const messageIds: string[] = []
    const eventsByTemplate = new Map<string, CounterEvent[]>()

    // 解析事件
    for (const [messageId, fields] of messages) {
      messageIds.push(messageId)
      
      const event = parseEventFromFields(fields)
      if (!eventsByTemplate.has(event.template_id)) {
        eventsByTemplate.set(event.template_id, [])
      }
      eventsByTemplate.get(event.template_id)!.push(event)
    }

    // 批量更新数据库
    const batchUpdates: BatchCounterUpdate[] = []
    for (const [templateId, events] of eventsByTemplate) {
      const batchUpdate = aggregateCounterEvents(templateId, events)
      batchUpdates.push(batchUpdate)
    }

    // 执行数据库更新
    for (const update of batchUpdates) {
      await updateTemplateCountersInDB(supabaseAdmin, update)
    }

    // 确认消息处理完成
    if (messageIds.length > 0) {
      await redis.xack(streamKey, consumerGroup, ...messageIds)
    }

    console.log(`[COUNTER EDGE] Processed ${batchUpdates.length} template updates`)

    return new Response(
      JSON.stringify({
        success: true,
        data: { 
          processed: batchUpdates.length,
          events: messageIds.length,
          templates_updated: batchUpdates.map(u => u.template_id)
        },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[COUNTER EDGE] Batch processing failed:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

/**
 * 获取计数器处理状态
 */
async function getCounterProcessingStatus(redis: Redis) {
  try {
    const streamKey = 'counter_events'
    const consumerGroup = 'counter_processors'
    
    const streamLength = await redis.xlen(streamKey)
    const pendingInfo = await redis.xpending(streamKey, consumerGroup)
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          stream_length: streamLength,
          pending_messages: Array.isArray(pendingInfo) ? pendingInfo[0] : 0,
          consumer_group: consumerGroup
        },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

/**
 * 解析Redis Stream字段为事件对象
 */
function parseEventFromFields(fields: string[]): CounterEvent {
  const fieldMap: Record<string, string> = {}
  
  for (let i = 0; i < fields.length; i += 2) {
    fieldMap[fields[i]] = fields[i + 1]
  }

  return {
    type: fieldMap.type as CounterEvent['type'],
    template_id: fieldMap.template_id,
    user_id: fieldMap.user_id,
    delta: parseInt(fieldMap.delta),
    timestamp: parseInt(fieldMap.timestamp),
    metadata: fieldMap.metadata ? JSON.parse(fieldMap.metadata) : undefined
  }
}

/**
 * 聚合同一模板的计数器事件
 */
function aggregateCounterEvents(templateId: string, events: CounterEvent[]): BatchCounterUpdate {
  const update: BatchCounterUpdate = {
    template_id: templateId,
    like_delta: 0,
    comment_delta: 0,
    view_delta: 0,
    usage_delta: 0,
    share_delta: 0,
    event_count: events.length
  }

  for (const event of events) {
    switch (event.type) {
      case 'template_like':
        update.like_delta += event.delta
        break
      case 'template_comment':
        update.comment_delta += event.delta
        break
      case 'template_view':
        update.view_delta += event.delta
        break
      case 'template_usage':
        update.usage_delta += event.delta
        break
      case 'template_share':
        update.share_delta += event.delta
        break
    }
  }

  return update
}

/**
 * 更新数据库中的模板计数器
 */
async function updateTemplateCountersInDB(supabaseAdmin: any, update: BatchCounterUpdate) {
  const { template_id, like_delta, comment_delta, view_delta, usage_delta, share_delta } = update

  // 使用SQL原始查询确保原子性
  const { error } = await supabaseAdmin.rpc('update_template_counters_atomic', {
    p_template_id: template_id,
    p_like_delta: like_delta,
    p_comment_delta: comment_delta,
    p_view_delta: view_delta,
    p_usage_delta: usage_delta,
    p_share_delta: share_delta
  })

  if (error) {
    console.error(`[COUNTER EDGE] Failed to update counters for template ${template_id}:`, error)
    throw error
  }

  console.log(`[COUNTER EDGE] Updated template ${template_id} counters successfully`)
}