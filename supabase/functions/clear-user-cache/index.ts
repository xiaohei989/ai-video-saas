// supabase/functions/clear-user-cache/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Redis } from 'https://deno.land/x/upstash_redis@v1.22.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ClearCacheRequest {
  user_ids: string[]
  reason?: string
}

interface ClearCacheResponse {
  success: boolean
  cleared_keys: string[]
  error?: string
  timestamp: string
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // 初始化Redis连接
    const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
    const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
    
    if (!redisUrl || !redisToken) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Redis configuration not available',
          cleared_keys: [],
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200,  // 不影响主流程
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    const body: ClearCacheRequest = await req.json()
    const { user_ids, reason } = body

    console.log(`[CLEAR CACHE] 清理用户缓存，用户数量: ${user_ids.length}, 原因: ${reason || 'unspecified'}`)

    const clearedKeys: string[] = []
    
    // 为每个用户清理所有相关缓存
    for (const userId of user_ids) {
      const keysToDelete = [
        `user:${userId}:profile`,
        `user:${userId}:credits`,
        `user:${userId}:subscription`,
        `user:${userId}:stats`
      ]
      
      for (const key of keysToDelete) {
        try {
          await redis.del(key)
          clearedKeys.push(key)
          console.log(`[CLEAR CACHE] 删除缓存键: ${key}`)
        } catch (error) {
          console.error(`[CLEAR CACHE] 删除缓存键失败 ${key}:`, error)
        }
      }
    }

    const response: ClearCacheResponse = {
      success: true,
      cleared_keys: clearedKeys,
      timestamp: new Date().toISOString()
    }

    console.log(`[CLEAR CACHE] 缓存清理完成，共清理 ${clearedKeys.length} 个缓存键`)

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[CLEAR CACHE] 清理缓存时发生错误:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        cleared_keys: [],
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,  // 不影响主流程
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})