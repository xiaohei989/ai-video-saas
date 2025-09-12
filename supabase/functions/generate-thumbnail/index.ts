import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface ThumbnailRequest {
  videoUrl: string
  frameTime?: number
  quality?: 'high' | 'medium' | 'low'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { videoUrl, frameTime = 0.33, quality = 'medium' }: ThumbnailRequest = await req.json()

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing videoUrl parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[THUMBNAIL SERVICE] 生成缩略图请求: ${videoUrl}`)

    // 使用FFmpeg或其他服务端工具生成缩略图
    const thumbnailResult = await generateServerThumbnail(videoUrl, frameTime, quality)

    if (thumbnailResult.success) {
      return new Response(
        JSON.stringify({ 
          success: true,
          thumbnail: thumbnailResult.thumbnail,
          cacheKey: thumbnailResult.cacheKey
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: thumbnailResult.error,
          fallback: getServerDefaultThumbnail(quality)
        }),
        { 
          status: 200, // 返回200但包含错误信息和fallback
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  } catch (error) {
    console.error('[THUMBNAIL SERVICE] 处理请求失败:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        fallback: getServerDefaultThumbnail('medium')
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/**
 * 服务端缩略图生成
 */
async function generateServerThumbnail(
  videoUrl: string, 
  frameTime: number, 
  quality: 'high' | 'medium' | 'low'
): Promise<{
  success: boolean
  thumbnail?: string
  cacheKey?: string
  error?: string
}> {
  try {
    // TODO: 使用FFmpeg或其他服务端工具
    // 这里先实现一个简化版本，返回默认缩略图
    
    console.log(`[THUMBNAIL SERVICE] 尝试获取视频元数据: ${videoUrl}`)
    
    // 检查视频URL是否可访问
    const videoResponse = await fetch(videoUrl, { method: 'HEAD' })
    
    if (!videoResponse.ok) {
      return {
        success: false,
        error: `Video URL不可访问: ${videoResponse.status}`
      }
    }

    // 生成缓存键
    const cacheKey = generateCacheKey(videoUrl, quality)
    
    // 这里应该使用FFmpeg等工具提取缩略图
    // 暂时返回成功状态和占位图
    const thumbnail = getServerDefaultThumbnail(quality)
    
    return {
      success: true,
      thumbnail,
      cacheKey
    }
  } catch (error) {
    console.error('[THUMBNAIL SERVICE] 生成缩略图失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 生成缓存键
 */
function generateCacheKey(videoUrl: string, quality: string): string {
  const hash = simpleHash(videoUrl)
  return `${hash}_${quality}_server`
}

/**
 * 简单哈希函数
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * 服务端默认缩略图
 */
function getServerDefaultThumbnail(quality: 'high' | 'medium' | 'low'): string {
  const dimensions = {
    high: { width: 480, height: 270 },
    medium: { width: 320, height: 180 },
    low: { width: 240, height: 135 }
  }
  
  const { width, height } = dimensions[quality]
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="serverBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#serverBg)"/>
      <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height) * 0.15}" fill="rgba(255,255,255,0.9)"/>
      <polygon points="${width/2-10},${height/2-8} ${width/2-10},${height/2+8} ${width/2+8},${height/2}" fill="#4f46e5"/>
      <text x="${width/2}" y="${height*0.8}" font-family="Arial, sans-serif" font-size="${Math.max(10, width/25)}" fill="white" text-anchor="middle">服务端生成</text>
    </svg>
  `
  return `data:image/svg+xml;base64,${btoa(svg)}`
}