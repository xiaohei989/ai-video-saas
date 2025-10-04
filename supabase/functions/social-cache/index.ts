// supabase/functions/social-cache/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Redis } from 'https://esm.sh/@upstash/redis@1.28.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface SocialCacheRequest {
  action: 'check_likes' | 'add_like' | 'remove_like' | 'get_popular_templates' | 'update_popular_templates'
  user_id?: string
  template_id?: string
  template_ids?: string[]
  templates?: Array<{ id: string, score: number }>
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const body: SocialCacheRequest = await req.json()
    console.log(`[SOCIAL CACHE] ${body.action} operation`)

    switch (body.action) {
      case 'check_likes':
        return await checkUserLikes(redis, body.user_id!, body.template_ids || [])

      case 'add_like':
        return await addTemplateLike(redis, body.user_id!, body.template_id!)

      case 'remove_like':
        return await removeTemplateLike(redis, body.user_id!, body.template_id!)

      case 'get_popular_templates':
        return await getPopularTemplates(redis)

      case 'update_popular_templates':
        return await updatePopularTemplates(redis, body.templates || [])

      default:
        return new Response(
          JSON.stringify({ error: 'Unsupported action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

  } catch (error) {
    console.error('[SOCIAL CACHE] Unexpected error:', error)
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
 * 批量检查用户点赞状态
 */
async function checkUserLikes(redis: Redis, userId: string, templateIds: string[]) {
  try {
    const pipeline = redis.pipeline()
    
    // 批量检查每个模板的点赞状态
    templateIds.forEach(templateId => {
      const key = `template:${templateId}:likes`
      pipeline.sismember(key, userId)
    })
    
    const results = await pipeline.exec()
    const likeStatus: Record<string, boolean> = {}
    
    templateIds.forEach((templateId, index) => {
      likeStatus[templateId] = results[index] === 1
    })

    console.log(`[SOCIAL CACHE] Checked ${templateIds.length} templates for user ${userId}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: { likes: likeStatus },
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
 * 添加模板点赞
 */
async function addTemplateLike(redis: Redis, userId: string, templateId: string) {
  try {
    const templateKey = `template:${templateId}:likes`
    const userKey = `user:${userId}:liked_templates`
    
    // 检查是否已经点赞
    const alreadyLiked = await redis.sismember(templateKey, userId)
    if (alreadyLiked) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Already liked',
          data: { already_liked: true }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 使用事务添加点赞
    const pipeline = redis.pipeline()
    pipeline.sadd(templateKey, userId)
    pipeline.expire(templateKey, 86400) // 24小时过期
    pipeline.sadd(userKey, templateId)
    pipeline.expire(userKey, 86400)
    
    await pipeline.exec()
    
    console.log(`[SOCIAL CACHE] Added like: ${userId} -> ${templateId}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: { liked: true },
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
 * 移除模板点赞
 */
async function removeTemplateLike(redis: Redis, userId: string, templateId: string) {
  try {
    const templateKey = `template:${templateId}:likes`
    const userKey = `user:${userId}:liked_templates`
    
    // 检查是否已经点赞
    const isLiked = await redis.sismember(templateKey, userId)
    if (!isLiked) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Not liked yet',
          data: { was_liked: false }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 使用事务移除点赞
    const pipeline = redis.pipeline()
    pipeline.srem(templateKey, userId)
    pipeline.srem(userKey, templateId)
    
    await pipeline.exec()
    
    console.log(`[SOCIAL CACHE] Removed like: ${userId} -> ${templateId}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: { unliked: true },
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
 * 获取热门模板排行榜
 */
async function getPopularTemplates(redis: Redis) {
  try {
    const key = 'popular_templates'
    const templates = await redis.zrevrange(key, 0, 19, { withScores: true })
    
    const popularTemplates: Array<{ id: string, score: number }> = []
    
    if (Array.isArray(templates)) {
      for (let i = 0; i < templates.length; i += 2) {
        popularTemplates.push({
          id: templates[i],
          score: parseFloat(templates[i + 1])
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { templates: popularTemplates },
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
 * 更新热门模板排行榜
 */
async function updatePopularTemplates(redis: Redis, templates: Array<{ id: string, score: number }>) {
  try {
    const key = 'popular_templates'
    
    // 清空现有排行榜
    await redis.del(key)
    
    // 批量添加到有序集合
    if (templates.length > 0) {
      const zadd_args: (string | number)[] = []
      
      templates.forEach(template => {
        zadd_args.push(template.score, template.id)
      })
      
      await redis.zadd(key, ...zadd_args)
      await redis.expire(key, 300) // 5分钟过期
    }

    console.log(`[SOCIAL CACHE] Updated popular templates ranking: ${templates.length} templates`)

    return new Response(
      JSON.stringify({
        success: true,
        data: { updated_count: templates.length },
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