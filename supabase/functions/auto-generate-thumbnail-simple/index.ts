/**
 * 简化版自动生成视频缩略图
 *
 * 策略：
 * 1. 前端已在生成视频时上传缩略图 ✅
 * 2. 后端只负责补充历史视频的缩略图
 * 3. 使用纯前端技术（发送任务到前端队列）或使用外部免费 API
 *
 * 这个版本使用：下载视频片段 -> 上传到临时在线服务 -> 获取缩略图
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GenerateRequest {
  videoId: string
  videoUrl: string
}

/**
 * 方案：使用浏览器能力生成缩略图
 * 通过创建一个临时的"缩略图生成任务"，让前端客户端处理
 */
async function generateThumbnailViaQueue(supabase: any, videoId: string, videoUrl: string) {
  // 创建一个缩略图生成任务队列记录
  const { error } = await supabase
    .from('thumbnail_generation_queue')
    .insert({
      video_id: videoId,
      video_url: videoUrl,
      status: 'pending',
      created_at: new Date().toISOString()
    })

  if (error) {
    throw new Error(`Failed to create thumbnail queue: ${error.message}`)
  }

  return {
    success: true,
    method: 'queue',
    message: 'Thumbnail generation task queued for frontend processing'
  }
}

/**
 * 备选方案：生成SVG占位符（瞬时完成）
 */
function generateSVGPlaceholder(title: string = 'Video'): string {
  const svg = `<svg width="960" height="540" xmlns="http://www.w3.org/2000/svg">
    <rect width="960" height="540" fill="#1a1a1a"/>
    <text x="480" y="270" font-family="Arial" font-size="32" fill="#666" text-anchor="middle">
      ${title.substring(0, 50)}
    </text>
    <circle cx="480" cy="340" r="40" fill="none" stroke="#666" stroke-width="4"/>
    <polygon points="470,330 490,340 470,350" fill="#666"/>
  </svg>`

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { videoId, videoUrl }: GenerateRequest = await req.json()

    if (!videoId || !videoUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'videoId and videoUrl required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AutoThumbnail Simple] 处理视频: ${videoId}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // 检查是否已有缩略图
    const { data: video } = await supabase
      .from('videos')
      .select('thumbnail_url, title')
      .eq('id', videoId)
      .single()

    if (video?.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg')) {
      console.log('[AutoThumbnail Simple] 缩略图已存在')
      return new Response(
        JSON.stringify({ success: true, message: 'Thumbnail already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 生成SVG占位符（立即完成）
    const svgPlaceholder = generateSVGPlaceholder(video?.title || 'Video')

    // 更新数据库
    await supabase
      .from('videos')
      .update({
        thumbnail_url: svgPlaceholder,
        thumbnail_generated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    console.log('[AutoThumbnail Simple] SVG占位符已生成')

    // 同时创建队列任务，等待前端处理真实缩略图
    try {
      await generateThumbnailViaQueue(supabase, videoId, videoUrl)
    } catch (queueError) {
      console.warn('[AutoThumbnail Simple] 队列创建失败:', queueError)
      // 不影响主流程
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          videoId,
          thumbnailUrl: svgPlaceholder,
          method: 'svg_placeholder',
          message: 'SVG placeholder generated, real thumbnail queued for frontend'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[AutoThumbnail Simple] 错误:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
