import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.418.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface RequestBody {
  videoId: string
  thumbnailUrl: string
  width?: number
  quality?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { videoId, thumbnailUrl, width = 48, quality = 30 }: RequestBody = await req.json()

    if (!videoId || !thumbnailUrl) {
      return new Response(JSON.stringify({ error: 'videoId and thumbnailUrl are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 构造 Cloudflare Transform 小图 URL（CORS 不影响 Edge 环境）
    let transformUrl = thumbnailUrl
    try {
      const url = new URL(thumbnailUrl)
      const path = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`
      if (url.hostname.includes('cdn.veo3video.me')) {
        transformUrl = `${url.protocol}//${url.host}/cdn-cgi/image/w=${width},q=${quality},f=webp${path}`
      }
    } catch {
      // 保留原始 URL（若不是完整 URL 则会失败，下方 fetch 会报错）
    }

    // 拉取小图数据
    const resp = await fetch(transformUrl, {
      method: 'GET',
      headers: { 'Accept': 'image/*;q=0.8' },
    })
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Fetch thumbnail failed: ${resp.status} ${resp.statusText}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const buf = new Uint8Array(await resp.arrayBuffer())

    // 上传到 R2: thumbnails/<id>-blur.webp
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
        secretAccessKey: Deno.env.get('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
      },
    })

    const key = `thumbnails/${videoId}-blur.webp`
    const put = new PutObjectCommand({
      Bucket: Deno.env.get('VITE_CLOUDFLARE_R2_BUCKET_NAME') || 'ai-video-storage',
      Key: key,
      Body: buf,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000',
      Metadata: {
        videoId,
        source: 'generate-blur-thumbnail',
        uploadedAt: new Date().toISOString(),
      }
    })
    await r2Client.send(put)

    const publicDomain = Deno.env.get('VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN')
    const publicUrl = publicDomain
      ? `https://${publicDomain}/${key}`
      : `https://pub-${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.dev/${key}`

    return new Response(JSON.stringify({ success: true, data: { publicUrl, key } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

