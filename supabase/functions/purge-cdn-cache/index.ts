import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PurgeCacheRequest {
  urls: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    })
  }

  try {
    const { urls }: PurgeCacheRequest = await req.json()

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('urls array is required')
    }

    console.log('[purge-cdn-cache] 清理CDN缓存:', urls)

    // 获取Cloudflare配置
    const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN')
    const CF_ZONE_ID = Deno.env.get('CLOUDFLARE_ZONE_ID')

    if (!CF_API_TOKEN || !CF_ZONE_ID) {
      console.warn('[purge-cdn-cache] 缺少Cloudflare配置，跳过CDN清理')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'CDN清理已跳过（配置缺失）',
          urls: urls
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 调用Cloudflare API清理缓存
    const purgeResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: urls
      })
    })

    const purgeResult = await purgeResponse.json()

    if (!purgeResponse.ok || !purgeResult.success) {
      throw new Error(`Cloudflare API错误: ${JSON.stringify(purgeResult)}`)
    }

    console.log('[purge-cdn-cache] CDN缓存清理成功')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'CDN缓存清理成功',
        urls: urls,
        cloudflareResponse: purgeResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[purge-cdn-cache] 错误:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})