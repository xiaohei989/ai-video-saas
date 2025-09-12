// supabase/functions/get-cached-data/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Redis } from 'https://deno.land/x/upstash_redis@v1.22.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CacheRequest {
  action: 'get' | 'set' | 'delete' | 'exists'
  key: string
  value?: any
  ttl?: number // TTL in seconds
}

interface CacheResponse {
  success: boolean
  data?: any
  error?: string
  cache_hit?: boolean
  timestamp: string
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 初始化Redis连接
    let redis: Redis | null = null;
    const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
    const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
    
    if (redisUrl && redisToken) {
      try {
        redis = new Redis({
          url: redisUrl,
          token: redisToken,
        });
        console.log('[CACHE EDGE FUNCTION] Redis初始化成功');
      } catch (error) {
        console.warn('[CACHE EDGE FUNCTION] Redis初始化失败，使用fallback模式:', error.message);
      }
    } else {
      console.warn('[CACHE EDGE FUNCTION] Redis配置不完整，使用fallback模式');
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

    const body: CacheRequest = await req.json()
    const { action, key, value, ttl } = body

    console.log(`[CACHE EDGE FUNCTION] ${action.toUpperCase()} operation for key: ${key}`)

    let result: CacheResponse = {
      success: false,
      timestamp: new Date().toISOString()
    }

    if (redis) {
      // Redis可用 - 执行正常缓存操作
      switch (action) {
        case 'get':
          try {
            const data = await redis.get(key)
            let parsedData = null
            if (data !== null && data !== undefined) {
              try {
                parsedData = JSON.parse(data as string)
              } catch (parseError) {
                // 如果不是有效JSON，直接返回字符串值
                parsedData = data
              }
            }
            result = {
              success: true,
              data: parsedData,
              cache_hit: data !== null,
              timestamp: new Date().toISOString()
            }
          } catch (error) {
            console.error(`[CACHE EDGE FUNCTION] GET错误:`, error)
            result = {
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }
          break

        case 'set':
          try {
            const serializedValue = JSON.stringify(value)
            if (ttl && ttl > 0) {
              await redis.set(key, serializedValue, { ex: ttl })
            } else {
              await redis.set(key, serializedValue)
            }
            result = {
              success: true,
              timestamp: new Date().toISOString()
            }
          } catch (error) {
            console.error(`[CACHE EDGE FUNCTION] SET错误:`, error)
            result = {
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }
          break

        case 'delete':
          try {
            const deleted = await redis.del(key)
            result = {
              success: true,
              data: { deleted: deleted > 0 },
              timestamp: new Date().toISOString()
            }
          } catch (error) {
            console.error(`[CACHE EDGE FUNCTION] DELETE错误:`, error)
            result = {
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }
          break

        case 'exists':
          try {
            const exists = await redis.exists(key)
            result = {
              success: true,
              data: { exists: exists > 0 },
              timestamp: new Date().toISOString()
            }
          } catch (error) {
            console.error(`[CACHE EDGE FUNCTION] EXISTS错误:`, error)
            result = {
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            }
          }
          break

        default:
          result = {
            success: false,
            error: 'Invalid action',
            timestamp: new Date().toISOString()
          }
      }
    } else {
      // Redis不可用 - 返回fallback响应
      console.log(`[CACHE EDGE FUNCTION] Redis不可用，返回fallback响应 for ${action}`)
      
      switch (action) {
        case 'get':
          result = {
            success: true,
            data: null,
            cache_hit: false,
            timestamp: new Date().toISOString()
          }
          break
        case 'set':
          result = {
            success: true,
            timestamp: new Date().toISOString()
          }
          break
        case 'delete':
          result = {
            success: true,
            data: { deleted: false },
            timestamp: new Date().toISOString()
          }
          break
        case 'exists':
          result = {
            success: true,
            data: { exists: false },
            timestamp: new Date().toISOString()
          }
          break
        default:
          result = {
            success: false,
            error: 'Invalid action',
            timestamp: new Date().toISOString()
          }
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[CACHE EDGE FUNCTION] Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})