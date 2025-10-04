import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.418.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MigrationRequest {
  videoId: string
  forceRemigrate?: boolean
}

interface MigrationResult {
  success: boolean
  videoId: string
  r2Url?: string
  r2Key?: string
  error?: string
  skipped?: boolean
  reason?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    console.log('[ServerMigration] 开始服务端迁移...')
    const { videoId, forceRemigrate = false }: MigrationRequest = await req.json()

    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'videoId is required' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 初始化Supabase客户端（使用service role key获取完整权限）
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 获取视频信息
    console.log(`[ServerMigration] 获取视频信息: ${videoId}`)
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, r2_key, migration_status, original_video_url, title')
      .eq('id', videoId)
      .single()

    if (fetchError || !video) {
      console.error(`[ServerMigration] 视频获取失败:`, fetchError)
      return new Response(
        JSON.stringify({
          success: false,
          videoId,
          error: `视频不存在: ${fetchError?.message}`
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[ServerMigration] 视频信息: ${video.title}, 状态: ${video.migration_status}`)

    // 2. 检查是否需要迁移
    if (!forceRemigrate && video.migration_status === 'completed' && video.r2_url) {
      console.log(`[ServerMigration] 视频已完成迁移，跳过: ${videoId}`)
      return new Response(
        JSON.stringify({
          success: true,
          videoId,
          r2Url: video.r2_url,
          skipped: true,
          reason: '已完成迁移'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!video.video_url) {
      console.error(`[ServerMigration] 视频URL为空: ${videoId}`)
      return new Response(
        JSON.stringify({
          success: false,
          videoId,
          error: '视频URL为空'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. 更新状态为下载中
    await updateMigrationStatus(supabase, videoId, 'downloading')

    // 4. 下载原始视频
    console.log(`[ServerMigration] 下载视频: ${video.video_url}`)
    const videoResponse = await fetch(video.video_url)
    if (!videoResponse.ok) {
      await updateMigrationStatus(supabase, videoId, 'failed')
      const error = `下载失败: ${videoResponse.status} ${videoResponse.statusText}`
      console.error(`[ServerMigration] ${error}`)
      return new Response(
        JSON.stringify({
          success: false,
          videoId,
          error
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const videoBuffer = await videoResponse.arrayBuffer()
    console.log(`[ServerMigration] 下载完成: ${videoBuffer.byteLength} bytes`)

    // 5. 更新状态为上传中
    await updateMigrationStatus(supabase, videoId, 'uploading')

    // 6. 初始化R2客户端并上传
    console.log(`[ServerMigration] 上传到R2...`)
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: Deno.env.get('VITE_CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
        secretAccessKey: Deno.env.get('VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
      },
    })

    const key = `videos/${videoId}.mp4`
    const uploadCommand = new PutObjectCommand({
      Bucket: Deno.env.get('VITE_CLOUDFLARE_R2_BUCKET_NAME') || 'ai-video-storage',
      Key: key,
      Body: new Uint8Array(videoBuffer),
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000', // 1年缓存
      Metadata: {
        uploadedAt: new Date().toISOString(),
        videoId: videoId,
        source: 'server-migration',
        originalUrl: video.video_url
      }
    })

    try {
      await r2Client.send(uploadCommand)
      console.log(`[ServerMigration] R2上传成功: ${key}`)
    } catch (uploadError) {
      await updateMigrationStatus(supabase, videoId, 'failed')
      console.error(`[ServerMigration] R2上传失败:`, uploadError)
      return new Response(
        JSON.stringify({
          success: false,
          videoId,
          error: `R2上传失败: ${uploadError.message}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 7. 生成公开访问URL
    const publicDomain = Deno.env.get('VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN')
    const publicUrl = publicDomain 
      ? `https://${publicDomain}/${key}`
      : `https://pub-${Deno.env.get('VITE_CLOUDFLARE_ACCOUNT_ID')}.r2.dev/${key}`

    // 8. 更新数据库记录
    console.log(`[ServerMigration] 更新数据库记录...`)
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        r2_url: publicUrl,
        r2_key: key,
        migration_status: 'completed',
        r2_uploaded_at: new Date().toISOString(),
        original_video_url: video.original_video_url || video.video_url,
        // 立即切换到R2 URL
        video_url: publicUrl
      })
      .eq('id', videoId)

    if (updateError) {
      console.error(`[ServerMigration] 数据库更新失败:`, updateError)
      return new Response(
        JSON.stringify({
          success: false,
          videoId,
          error: `数据库更新失败: ${updateError.message}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[ServerMigration] 服务端迁移成功: ${videoId} -> ${publicUrl}`)

    // 9. 验证文件可访问性（可选）
    try {
      const verifyResponse = await fetch(publicUrl, { method: 'HEAD' })
      const accessible = verifyResponse.ok
      console.log(`[ServerMigration] 文件可访问性验证: ${accessible ? '成功' : '失败'}`)
    } catch (verifyError) {
      console.warn(`[ServerMigration] 文件可访问性验证失败:`, verifyError)
    }

    const result: MigrationResult = {
      success: true,
      videoId,
      r2Url: publicUrl,
      r2Key: key
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[ServerMigration] 迁移异常:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '服务端迁移失败'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * 更新迁移状态的辅助函数
 */
async function updateMigrationStatus(supabase: any, videoId: string, status: string): Promise<void> {
  try {
    await supabase
      .from('videos')
      .update({ migration_status: status })
      .eq('id', videoId)
    console.log(`[ServerMigration] 状态更新: ${videoId} -> ${status}`)
  } catch (error) {
    console.error(`[ServerMigration] 状态更新失败: ${videoId}`, error)
  }
}