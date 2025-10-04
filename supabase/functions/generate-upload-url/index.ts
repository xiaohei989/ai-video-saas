import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.418.0'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.418.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { videoId, contentType = 'video/mp4', expiresIn = 3600 } = await req.json()

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 初始化R2客户端
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
        secretAccessKey: Deno.env.get('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
      },
    })

    // 生成R2上传Key
    const key = `videos/${videoId}.mp4`

    // 创建上传命令
    const command = new PutObjectCommand({
      Bucket: Deno.env.get('VITE_CLOUDFLARE_R2_BUCKET_NAME') || 'ai-video-storage',
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1年缓存
      Metadata: {
        uploadedAt: new Date().toISOString(),
        videoId: videoId,
        source: 'presigned-url'
      }
    })

    // 生成预签名URL
    const signedUrl = await getSignedUrl(r2Client, command, { 
      expiresIn: expiresIn // 默认1小时有效期
    })

    // 生成最终的公开访问URL
    const publicDomain = Deno.env.get('VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN')
    const publicUrl = publicDomain 
      ? `https://${publicDomain}/${key}`
      : `https://pub-${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.dev/${key}`

    console.log(`[PreSignedURL] 生成成功 - videoId: ${videoId}`)
    console.log(`[PreSignedURL] 公开URL: ${publicUrl}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          signedUrl,
          publicUrl,
          key,
          expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[PreSignedURL] 生成失败:', error)
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
})