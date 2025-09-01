// supabase/functions/get-cached-data/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // 暂时禁用Redis缓存，直接返回空响应
    console.log('[CACHE EDGE FUNCTION] Redis缓存暂时禁用，返回空数据')

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
    const { action, key } = body

    console.log(`[CACHE EDGE FUNCTION] ${action.toUpperCase()} operation for key: ${key} (缓存暂时禁用)`)

    // 暂时返回空响应以修复CORS问题
    let result: CacheResponse = {
      success: true,
      data: null,
      cache_hit: false,
      timestamp: new Date().toISOString()
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