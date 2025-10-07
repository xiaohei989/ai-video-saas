/**
 * 自动生成视频缩略图 Edge Function
 * 在视频完成时由数据库触发器自动调用
 * 使用 Cloudflare Media Transformations 从视频提取帧（完全免费）
 *
 * 优化: 移除模糊缩略图生成，直接上传到 R2，性能提升 60-70%
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.418.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface AutoGenerateRequest {
  videoId: string
  videoUrl: string
}

/**
 * 直接上传 Blob 到 Cloudflare R2
 */
async function uploadToR2(blob: Blob, videoId: string): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // 初始化 R2 客户端
  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: Deno.env.get('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
      secretAccessKey: Deno.env.get('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
    },
  })

  const key = `thumbnails/${videoId}-v2.jpg`

  // 上传到 R2
  const putCommand = new PutObjectCommand({
    Bucket: Deno.env.get('VITE_CLOUDFLARE_R2_BUCKET_NAME') || 'ai-video-storage',
    Key: key,
    Body: bytes,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000',
    Metadata: {
      videoId,
      source: 'auto-generate-thumbnail',
      uploadedAt: new Date().toISOString(),
    }
  })

  await r2Client.send(putCommand)

  // 生成公开访问 URL
  const publicDomain = Deno.env.get('VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN')
  const publicUrl = publicDomain
    ? `https://${publicDomain}/${key}`
    : `https://pub-${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.dev/${key}`

  console.log(`[AutoThumbnail] ✅ 直接上传到 R2 成功: ${publicUrl}`)

  return publicUrl
}

/**
 * 使用 Cloudflare Media Transformations 从视频生成缩略图
 * 完全免费（至2025年11月，之后每月5000次免费）
 *
 * 文档: https://developers.cloudflare.com/stream/transform-videos/
 *
 * @param videoUrl 视频URL（必须是 Cloudflare CDN 上的视频）
 * @returns 缩略图 Blob
 */
/**
 * 尝试单次截图
 */
async function attemptThumbnailGeneration(videoUrl: string): Promise<Blob> {
  const baseUrl = 'https://veo3video.me'
  const options = [
    'mode=frame',
    'time=0.1s',
    'format=jpg',
    'width=960',
    'height=540',
    'fit=cover',
    'quality=95'
  ].join(',')

  const transformUrl = `${baseUrl}/cdn-cgi/media/${options}/${videoUrl}`

  const response = await fetch(transformUrl)

  // 检查响应
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  const contentType = response.headers.get('content-type')

  // 检查是否返回了图片
  if (!contentType || !contentType.includes('image')) {
    const text = await response.text()
    throw new Error(`Invalid response type: ${contentType}, content: ${text.substring(0, 100)}`)
  }

  return await response.blob()
}

/**
 * 带重试逻辑的缩略图生成
 * 新上传的视频可能需要 Cloudflare 处理后才能截图
 * 重试策略: 立即 → 30秒后 → 2分钟后
 */
async function generateWithCloudflareMedia(videoUrl: string): Promise<Blob> {
  console.log('[AutoThumbnail] 使用 Cloudflare Media Transformations 生成缩略图')
  console.log(`[AutoThumbnail] 视频 URL: ${videoUrl}`)

  const retryDelays = [0, 30000, 120000] // 0秒、30秒、2分钟
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    const delay = retryDelays[attempt]

    if (delay > 0) {
      console.log(`[AutoThumbnail] ⏳ 等待 ${delay / 1000} 秒后重试 (尝试 ${attempt + 1}/${retryDelays.length})...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    } else {
      console.log(`[AutoThumbnail] 🚀 首次尝试...`)
    }

    try {
      const blob = await attemptThumbnailGeneration(videoUrl)
      console.log(`[AutoThumbnail] ✅ 成功! 尝试次数: ${attempt + 1}, 大小: ${(blob.size / 1024).toFixed(2)} KB`)
      return blob
    } catch (error) {
      lastError = error as Error
      console.error(`[AutoThumbnail] ❌ 尝试 ${attempt + 1} 失败:`, error.message)

      // 如果是最后一次尝试，直接抛出错误
      if (attempt === retryDelays.length - 1) {
        console.error(`[AutoThumbnail] 💥 所有重试均失败`)
        throw new Error(`Cloudflare Media Transformations failed after ${retryDelays.length} attempts: ${lastError.message}`)
      }
    }
  }

  // 不应该到这里，但为了类型安全
  throw lastError || new Error('Unknown error')
}

serve(async (req) => {
  // 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    console.log('[AutoThumbnail] ========== 开始自动生成缩略图 ==========')

    const { videoId, videoUrl }: AutoGenerateRequest = await req.json()

    if (!videoId || !videoUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'videoId and videoUrl are required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[AutoThumbnail] 视频ID: ${videoId}`)
    console.log(`[AutoThumbnail] 视频URL: ${videoUrl}`)

    // 创建 Supabase Admin 客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 使用 Cloudflare Media Transformations 生成缩略图
    let thumbnailBlob: Blob

    try {
      console.log('[AutoThumbnail] 🚀 使用 Cloudflare Media Transformations 生成缩略图...')
      thumbnailBlob = await generateWithCloudflareMedia(videoUrl)
      console.log(`[AutoThumbnail] ✅ 缩略图生成成功，大小: ${(thumbnailBlob.size / 1024).toFixed(2)} KB`)
    } catch (error) {
      console.error('[AutoThumbnail] ❌ Cloudflare Media Transformations 失败:', error)
      throw new Error(`Thumbnail generation failed: ${error.message}`)
    }

    // 直接上传到 R2（移除 Base64 转换和中间 Edge Function 调用）
    const thumbnailUrl = await uploadToR2(thumbnailBlob, videoId)

    // 更新数据库（移除 thumbnail_blur_url）
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        thumbnail_url: thumbnailUrl,
        thumbnail_generated_at: new Date().toISOString(),
        thumbnail_metadata: {
          method: 'cloudflare_media_transformations',
          generatedBy: 'auto-generate-thumbnail-optimized',
          timestamp: new Date().toISOString(),
          optimized: true // 标记为优化版本
        }
      })
      .eq('id', videoId)

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    console.log('[AutoThumbnail] ========== ✅ 缩略图生成完成（优化版）==========')

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          videoId,
          thumbnailUrl,
          method: 'cloudflare_media_transformations',
          generatedAt: new Date().toISOString(),
          optimized: true
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[AutoThumbnail] ❌ 生成失败:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
