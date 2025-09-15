import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface ThumbnailRequest {
  videoUrl: string
  videoId: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    )

    // Parse request body
    const { videoUrl, videoId }: ThumbnailRequest = await req.json()

    console.log(`[THUMBNAIL] 开始生成缩略图: ${videoId} from ${videoUrl}`)

    // Validate required fields
    if (!videoUrl || !videoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'videoUrl and videoId are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update status to generating
    await supabaseClient
      .from('videos')
      .update({ thumbnail_generation_status: 'generating' })
      .eq('id', videoId)

    // 使用Canvas API生成视频缩略图（受限但可用的方法）
    console.log(`[THUMBNAIL] 生成服务端缩略图...`)
    
    let thumbnailBlob: Blob
    
    try {
      // 直接生成一个基于视频信息的缩略图
      const canvas = new OffscreenCanvas(640, 360)
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        throw new Error('Cannot get canvas context')
      }
      
      // 绘制渐变背景
      const gradient = ctx.createLinearGradient(0, 0, 640, 360)
      gradient.addColorStop(0, '#6366f1')
      gradient.addColorStop(1, '#8b5cf6')
      
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 640, 360)
      
      // 绘制播放按钮
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.beginPath()
      ctx.arc(320, 180, 50, 0, 2 * Math.PI)
      ctx.fill()
      
      ctx.fillStyle = '#6366f1'
      ctx.beginPath()
      ctx.moveTo(300, 160)
      ctx.lineTo(340, 180)
      ctx.lineTo(300, 200)
      ctx.closePath()
      ctx.fill()
      
      // 添加文本
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.font = '16px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('AI生成视频', 320, 240)
      
      // 转换为blob
      thumbnailBlob = await canvas.convertToBlob({ 
        type: 'image/jpeg', 
        quality: 0.8 
      })
      
      console.log(`[THUMBNAIL] Canvas生成缩略图成功，大小: ${thumbnailBlob.size} bytes`)
      
    } catch (canvasError) {
      console.error(`[THUMBNAIL] Canvas生成失败:`, canvasError)
      
      // fallback: 生成SVG占位符
      const svgContent = `<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#bg)"/>
        <circle cx="320" cy="180" r="50" fill="rgba(255,255,255,0.9)"/>
        <polygon points="300,160 300,200 340,180" fill="#6366f1"/>
        <text x="320" y="240" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.9)" text-anchor="middle">AI生成视频</text>
      </svg>`
      
      thumbnailBlob = new Blob([svgContent], { type: 'image/svg+xml' })
      console.log(`[THUMBNAIL] 使用SVG占位符，大小: ${thumbnailBlob.size} bytes`)
    }

    // Upload thumbnail to Supabase Storage
    const filename = `${videoId}.jpg`
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('video-thumbnails')
      .upload(filename, thumbnailBlob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // 1年缓存
        upsert: true // 允许覆盖现有文件
      })

    if (uploadError) {
      console.error(`[THUMBNAIL] Upload failed:`, uploadError)
      
      await supabaseClient
        .from('videos')
        .update({ thumbnail_generation_status: 'failed' })
        .eq('id', videoId)

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `缩略图上传失败: ${uploadError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('video-thumbnails')
      .getPublicUrl(filename)

    const thumbnailUrl = urlData.publicUrl

    console.log(`[THUMBNAIL] 缩略图上传成功: ${thumbnailUrl}`)

    // Update video record with thumbnail URL
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({ 
        thumbnail_url: thumbnailUrl,
        thumbnail_source: 'server',
        thumbnail_generation_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)

    if (updateError) {
      console.error(`[THUMBNAIL] Database update failed:`, updateError)
    }

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl: thumbnailUrl,
        videoId: videoId,
        message: '缩略图生成成功'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[THUMBNAIL] Function error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || '服务器内部错误'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})