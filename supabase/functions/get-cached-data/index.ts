// supabase/functions/get-cached-data/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Redis } from 'https://deno.land/x/upstash_redis@v1.31.6/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // 初始化Upstash Redis连接
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

    const body: CacheRequest = await req.json()
    const { action, key, value, ttl } = body

    console.log(`[CACHE EDGE FUNCTION] ${action.toUpperCase()} operation for key: ${key}`)

    let result: CacheResponse = {
      success: false,
      timestamp: new Date().toISOString()
    }

    switch (action) {
      case 'get':
        try {
          const data = await redis.get(key)
          result = {
            success: true,
            data: data ? JSON.parse(data) : null,
            cache_hit: data !== null,
            timestamp: new Date().toISOString()
          }
          console.log(`[CACHE EDGE FUNCTION] GET ${key}: ${data ? 'HIT' : 'MISS'}`)
        } catch (error) {
          result = {
            success: false,
            error: `Get operation failed: ${error.message}`,
            cache_hit: false,
            timestamp: new Date().toISOString()
          }
        }
        break

      case 'set':
        try {
          const serializedValue = JSON.stringify(value)
          
          if (ttl && ttl > 0) {
            await redis.setex(key, ttl, serializedValue)
          } else {
            await redis.set(key, serializedValue)
          }
          
          result = {
            success: true,
            data: { key, ttl: ttl || 'no_expiry' },
            timestamp: new Date().toISOString()
          }
          console.log(`[CACHE EDGE FUNCTION] SET ${key} with TTL: ${ttl || 'none'}`)
        } catch (error) {
          result = {
            success: false,
            error: `Set operation failed: ${error.message}`,
            timestamp: new Date().toISOString()
          }
        }
        break

      case 'delete':
        try {
          const deletedCount = await redis.del(key)
          result = {
            success: true,
            data: { deleted_count: deletedCount },
            timestamp: new Date().toISOString()
          }
          console.log(`[CACHE EDGE FUNCTION] DELETE ${key}: ${deletedCount} keys deleted`)
        } catch (error) {
          result = {
            success: false,
            error: `Delete operation failed: ${error.message}`,
            timestamp: new Date().toISOString()
          }
        }
        break

      case 'exists':
        try {
          const exists = await redis.exists(key)
          result = {
            success: true,
            data: { exists: exists === 1 },
            timestamp: new Date().toISOString()
          }
          console.log(`[CACHE EDGE FUNCTION] EXISTS ${key}: ${exists === 1}`)
        } catch (error) {
          result = {
            success: false,
            error: `Exists operation failed: ${error.message}`,
            timestamp: new Date().toISOString()
          }
        }
        break

      default:
        result = {
          success: false,
          error: `Unsupported action: ${action}`,
          timestamp: new Date().toISOString()
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