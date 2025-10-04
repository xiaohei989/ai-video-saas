import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.418.0'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.418.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface ThumbnailUploadRequest {
  videoId: string
  contentType?: string
  fileSize?: number
  expiresIn?: number
  base64Data?: string
  directUpload?: boolean
  version?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { 
      videoId, 
      contentType = 'image/webp', 
      fileSize = 0,
      expiresIn = 3600,
      base64Data,
      directUpload = false,
      version = 'v1'
    }: ThumbnailUploadRequest = await req.json()

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[UploadThumbnail] 处理缩略图上传请求: videoId=${videoId}, contentType=${contentType}, fileSize=${fileSize}, directUpload=${directUpload}`)

    // 初始化R2客户端
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
        secretAccessKey: Deno.env.get('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
      },
    })

    // 根据内容类型确定文件扩展名
    const getFileExtension = (contentType: string): string => {
      switch (contentType) {
        case 'image/webp':
          return 'webp'
        case 'image/jpeg':
        case 'image/jpg':
          return 'jpg'
        case 'image/png':
          return 'png'
        default:
          return 'webp' // 默认使用webp
      }
    }

    const extension = getFileExtension(contentType)
    // 🔥 使用版本化文件名避免CDN缓存冲突
    const key = version && version !== 'v1' 
      ? `thumbnails/${videoId}-${version}.${extension}`
      : `thumbnails/${videoId}.${extension}`

    // 生成最终的公开访问URL
    const publicDomain = Deno.env.get('VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN')
    const publicUrl = publicDomain 
      ? `https://${publicDomain}/${key}`
      : `https://pub-${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.dev/${key}`

    // 如果是直接上传模式，服务端处理上传
    if (directUpload && base64Data) {
      try {
        console.log(`[UploadThumbnail] 服务端直接上传模式`)
        
        // 将Base64数据转换为Uint8Array
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        
        // 直接上传到R2
        const command = new PutObjectCommand({
          Bucket: Deno.env.get('VITE_CLOUDFLARE_R2_BUCKET_NAME') || 'ai-video-storage',
          Key: key,
          Body: binaryData,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000', // 1年缓存
          Metadata: {
            uploadedAt: new Date().toISOString(),
            videoId: videoId,
            source: 'thumbnail-upload-direct',
            fileSize: binaryData.length.toString()
          }
        })

        await r2Client.send(command)
        
        console.log(`[UploadThumbnail] 直接上传成功: ${publicUrl}`)

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              publicUrl,
              key,
              contentType,
              uploadedAt: new Date().toISOString()
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
        
      } catch (uploadError) {
        console.error(`[UploadThumbnail] 直接上传失败:`, uploadError)
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Direct upload failed: ${uploadError.message}`
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // 原有的预签名URL模式
    const command = new PutObjectCommand({
      Bucket: Deno.env.get('VITE_CLOUDFLARE_R2_BUCKET_NAME') || 'ai-video-storage',
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1年缓存
      Metadata: {
        uploadedAt: new Date().toISOString(),
        videoId: videoId,
        source: 'thumbnail-upload',
        fileSize: fileSize.toString()
      }
    })

    // 生成预签名URL
    const signedUrl = await getSignedUrl(r2Client, command, { 
      expiresIn: expiresIn // 默认1小时有效期
    })

    console.log(`[UploadThumbnail] 预签名URL生成成功`)
    console.log(`[UploadThumbnail] 公开URL: ${publicUrl}`)
    console.log(`[UploadThumbnail] 文件路径: ${key}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          signedUrl,
          publicUrl,
          key,
          contentType,
          expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[UploadThumbnail] 生成预签名URL失败:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})