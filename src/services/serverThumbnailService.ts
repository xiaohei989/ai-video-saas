/**
 * 服务端缩略图生成服务
 * 当客户端缩略图提取失败时使用
 */

import { supabase } from '@/lib/supabase'

interface ServerThumbnailResponse {
  success: boolean
  thumbnail?: string
  cacheKey?: string
  error?: string
  fallback?: string
}

class ServerThumbnailService {
  private readonly FUNCTION_NAME = 'generate-thumbnail'
  
  /**
   * 请求服务端生成缩略图
   */
  async generateThumbnail(
    videoUrl: string,
    options: {
      frameTime?: number
      quality?: 'high' | 'medium' | 'low'
    } = {}
  ): Promise<string> {
    const { frameTime = 0.33, quality = 'medium' } = options
    
    try {
      console.log(`[SERVER THUMBNAIL] 请求服务端生成缩略图: ${videoUrl}`)
      
      const { data, error } = await supabase.functions.invoke(this.FUNCTION_NAME, {
        body: {
          videoUrl,
          frameTime,
          quality
        }
      })

      if (error) {
        console.error('[SERVER THUMBNAIL] Edge Function调用失败:', error)
        throw new Error(`Server thumbnail generation failed: ${error.message}`)
      }

      const response: ServerThumbnailResponse = data

      if (response.success && response.thumbnail) {
        console.log(`[SERVER THUMBNAIL] 服务端缩略图生成成功`)
        return response.thumbnail
      } else {
        console.warn(`[SERVER THUMBNAIL] 服务端生成失败，使用fallback: ${response.error}`)
        return response.fallback || this.getDefaultServerThumbnail(quality)
      }
    } catch (error) {
      console.error('[SERVER THUMBNAIL] 服务端缩略图请求失败:', error)
      return this.getDefaultServerThumbnail(quality)
    }
  }

  /**
   * 批量生成缩略图
   */
  async generateBatchThumbnails(
    videoUrls: string[],
    quality: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    
    const promises = videoUrls.map(async (url) => {
      try {
        const thumbnail = await this.generateThumbnail(url, { quality })
        results.set(url, thumbnail)
      } catch (error) {
        console.error(`[SERVER THUMBNAIL] 批量生成失败 ${url}:`, error)
        results.set(url, this.getDefaultServerThumbnail(quality))
      }
    })

    await Promise.allSettled(promises)
    return results
  }

  /**
   * 默认服务端缩略图
   */
  private getDefaultServerThumbnail(quality: 'high' | 'medium' | 'low'): string {
    const dimensions = {
      high: { width: 480, height: 270 },
      medium: { width: 320, height: 180 },
      low: { width: 240, height: 135 }
    }
    
    const { width, height } = dimensions[quality]
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fallbackBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#fallbackBg)"/>
        <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height) * 0.12}" fill="rgba(255,255,255,0.9)"/>
        <polygon points="${width/2-8},${height/2-6} ${width/2-8},${height/2+6} ${width/2+6},${height/2}" fill="#6366f1"/>
        <text x="${width/2}" y="${height*0.85}" font-family="Arial, sans-serif" font-size="${Math.max(9, width/30)}" fill="rgba(255,255,255,0.8)" text-anchor="middle">视频缩略图</text>
      </svg>
    `
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  /**
   * 检查服务是否可用
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke(this.FUNCTION_NAME, {
        body: { videoUrl: 'test' }
      })
      
      return !error
    } catch {
      return false
    }
  }
}

// 创建单例实例
export const serverThumbnailService = new ServerThumbnailService()
export default serverThumbnailService