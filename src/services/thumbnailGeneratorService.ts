/**
 * 增强版视频缩略图生成服务
 * 支持服务端生成、客户端提取、多层缓存和智能回退
 */

export interface ThumbnailOptions {
  timestamp?: number // 截图时间点（秒）
  quality?: 'high' | 'medium' | 'low' // 质量等级
  width?: number // 输出宽度
  height?: number // 输出高度
  blurRadius?: number // 模糊半径
  format?: 'jpeg' | 'webp' | 'png' // 输出格式
  forceServerGeneration?: boolean // 强制使用服务端生成
  enableMultiFrame?: boolean // 是否生成多帧缩略图
}

export interface VideoThumbnail {
  originalUrl: string
  blurredUrl: string
  width: number
  height: number
  fileSize: number
  format: string
  generatedAt: Date
  generationMethod: 'server' | 'client' | 'cached'
}

export interface ThumbnailGenerationResult {
  success: boolean
  thumbnails?: {
    normal: string
    blur: string
    metadata: {
      width: number
      height: number
      format: string
      fileSize: number
      generationMethod: 'server' | 'client'
      timestamp: number
    }
  }
  error?: string
  fallbackUsed?: boolean
}

class ThumbnailGeneratorService {
  private readonly SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  private readonly SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  private readonly STORAGE_BUCKET = 'thumbnails'
  
  // 缓存配置
  private thumbnailCache = new Map<string, VideoThumbnail>()
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24小时
  private readonly MAX_CACHE_SIZE = 100
  
  /**
   * 生成视频缩略图（主入口方法）
   */
  async generateVideoThumbnail(
    videoId: string, 
    videoUrl: string, 
    options: ThumbnailOptions = {}
  ): Promise<ThumbnailGenerationResult> {
    try {
      console.log(`[ThumbnailGenerator] 开始生成缩略图: ${videoId}`)
      
      // 1. 检查缓存
      const cached = this.getCachedThumbnail(videoUrl)
      if (cached) {
        console.log(`[ThumbnailGenerator] 使用缓存缩略图: ${videoId}`)
        return {
          success: true,
          thumbnails: {
            normal: cached.originalUrl,
            blur: cached.blurredUrl,
            metadata: {
              width: cached.width,
              height: cached.height,
              format: cached.format,
              fileSize: cached.fileSize,
              generationMethod: cached.generationMethod,
              timestamp: cached.generatedAt.getTime()
            }
          }
        }
      }
      
      // 2. 尝试服务端生成
      if (!options.forceServerGeneration) {
        const serverResult = await this.generateServerThumbnail(videoId, videoUrl, options)
        if (serverResult.success) {
          return serverResult
        }
        console.warn(`[ThumbnailGenerator] 服务端生成失败，回退到客户端: ${serverResult.error}`)
      }
      
      // 3. 客户端生成备选方案
      const clientResult = await this.generateClientThumbnail(videoUrl, options)
      if (clientResult.success) {
        return clientResult
      }
      
      // 4. 使用静态回退
      return this.getFallbackThumbnail(videoUrl)
      
    } catch (error) {
      console.error(`[ThumbnailGenerator] 生成缩略图失败: ${videoId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        fallbackUsed: true,
        ...this.getFallbackThumbnail(videoUrl)
      }
    }
  }

  /**
   * 服务端缩略图生成
   */
  private async generateServerThumbnail(
    videoId: string, 
    videoUrl: string, 
    options: ThumbnailOptions
  ): Promise<ThumbnailGenerationResult> {
    try {
      const response = await fetch(`${this.SUPABASE_URL}/functions/v1/generate-thumbnail`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          videoUrl,
          options: {
            timestamp: options.timestamp || 1,
            quality: options.quality || 'medium',
            width: options.width || 640,
            height: options.height || 360,
            format: options.format || 'jpeg',
            blurRadius: options.blurRadius || 20
          }
        })
      })

      if (!response.ok) {
        throw new Error(`服务端生成失败: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success && result.thumbnails) {
        // 缓存结果
        this.setCachedThumbnail(videoUrl, {
          originalUrl: result.thumbnails.normal,
          blurredUrl: result.thumbnails.blur,
          width: result.metadata.width,
          height: result.metadata.height,
          fileSize: result.metadata.fileSize,
          format: result.metadata.format,
          generatedAt: new Date(),
          generationMethod: 'server'
        })
        
        return {
          success: true,
          thumbnails: result.thumbnails
        }
      }
      
      throw new Error(result.error || '服务端返回失败')
      
    } catch (error) {
      console.error(`[ThumbnailGenerator] 服务端生成失败:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '服务端生成失败'
      }
    }
  }

  /**
   * 客户端缩略图生成
   */
  private async generateClientThumbnail(
    videoUrl: string, 
    options: ThumbnailOptions
  ): Promise<ThumbnailGenerationResult> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true
      
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.removeEventListener('error', onError)
        video.remove()
      }

      const onError = () => {
        cleanup()
        resolve({
          success: false,
          error: '视频加载失败或CORS限制'
        })
      }

      const onLoadedMetadata = () => {
        try {
          const timestamp = options.timestamp || Math.min(1, video.duration * 0.1)
          video.currentTime = timestamp
          
          video.addEventListener('seeked', () => {
            try {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              
              if (!ctx) {
                throw new Error('Canvas context 不支持')
              }
              
              // 设置canvas尺寸
              canvas.width = options.width || video.videoWidth
              canvas.height = options.height || video.videoHeight
              
              // 绘制视频帧
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              
              // 生成普通版本
              const normalDataUrl = canvas.toDataURL('image/jpeg', 0.8)
              
              // 生成模糊版本
              ctx.filter = `blur(${options.blurRadius || 20}px)`
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              const blurDataUrl = canvas.toDataURL('image/jpeg', 0.6)
              
              // 缓存结果
              this.setCachedThumbnail(videoUrl, {
                originalUrl: normalDataUrl,
                blurredUrl: blurDataUrl,
                width: canvas.width,
                height: canvas.height,
                fileSize: normalDataUrl.length + blurDataUrl.length,
                format: 'jpeg',
                generatedAt: new Date(),
                generationMethod: 'client'
              })
              
              cleanup()
              resolve({
                success: true,
                thumbnails: {
                  normal: normalDataUrl,
                  blur: blurDataUrl,
                  metadata: {
                    width: canvas.width,
                    height: canvas.height,
                    format: 'jpeg',
                    fileSize: normalDataUrl.length + blurDataUrl.length,
                    generationMethod: 'client',
                    timestamp: Date.now()
                  }
                }
              })
            } catch (error) {
              cleanup()
              resolve({
                success: false,
                error: error instanceof Error ? error.message : '客户端生成失败'
              })
            }
          })
        } catch (error) {
          cleanup()
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'seek失败'
          })
        }
      }

      video.addEventListener('loadedmetadata', onLoadedMetadata)
      video.addEventListener('error', onError)
      video.src = videoUrl
      video.load()
      
      // 超时处理
      setTimeout(() => {
        cleanup()
        resolve({
          success: false,
          error: '客户端生成超时'
        })
      }, 10000) // 10秒超时
    })
  }

  /**
   * 获取回退缩略图（使用SVG占位符而不是logo）
   */
  private getFallbackThumbnail(videoUrl: string): ThumbnailGenerationResult {
    // 首先尝试从视频路径生成静态缩略图路径（模板系统的逻辑）
    const videoName = videoUrl.split('/').pop()?.replace('.mp4', '') || 'video'
    const fallbackNormal = `/templates/thumbnails/${videoName}-thumbnail.jpg`
    const fallbackBlur = `/templates/thumbnails/${videoName}-thumbnail-blur.jpg`
    
    // TODO: 可以在这里检查静态文件是否存在，如果不存在则使用SVG
    // 目前直接返回静态路径，让UI层处理fallback
    
    return {
      success: true,
      thumbnails: {
        normal: fallbackNormal,
        blur: fallbackBlur,
        metadata: {
          width: 640,
          height: 360,
          format: 'jpeg',
          fileSize: 0,
          generationMethod: 'server', // 静态文件视为服务端提供
          timestamp: Date.now()
        }
      },
      fallbackUsed: true
    }
  }

  /**
   * 从视频URL生成缩略图路径（保持向后兼容）
   */
  generateThumbnailPath(videoSrc: string, options: ThumbnailOptions = {}): { normal: string; blur: string } {
    // 从视频路径生成缩略图路径
    const videoName = videoSrc.split('/').pop()?.replace('.mp4', '') || 'video'
    
    return {
      normal: `/templates/thumbnails/${videoName}-thumbnail.jpg`,
      blur: `/templates/thumbnails/${videoName}-thumbnail-blur.jpg`
    }
  }

  /**
   * 缓存管理方法
   */
  private getCachedThumbnail(videoUrl: string): VideoThumbnail | null {
    const cached = this.thumbnailCache.get(videoUrl)
    if (cached) {
      const age = Date.now() - cached.generatedAt.getTime()
      if (age < this.CACHE_EXPIRY) {
        return cached
      } else {
        this.thumbnailCache.delete(videoUrl)
      }
    }
    return null
  }

  private setCachedThumbnail(videoUrl: string, thumbnail: VideoThumbnail): void {
    // 如果缓存已满，删除最旧的条目
    if (this.thumbnailCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.thumbnailCache.keys().next().value
      if (oldestKey) {
        this.thumbnailCache.delete(oldestKey)
      }
    }
    
    this.thumbnailCache.set(videoUrl, thumbnail)
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.thumbnailCache.clear()
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.thumbnailCache.size,
      maxSize: this.MAX_CACHE_SIZE
    }
  }

  /**
   * 检查缩略图是否存在（向后兼容）
   */
  async checkThumbnailExists(thumbnailPath: string): Promise<boolean> {
    try {
      const response = await fetch(thumbnailPath, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5秒超时
      })
      return response.ok
    } catch (error) {
      // 静默处理HTTP/2协议错误和网络错误
      if (import.meta.env.DEV && !(error instanceof Error && error.name === 'AbortError')) {
        console.warn(`[ThumbnailGenerator] 缩略图检查失败: ${thumbnailPath}`, error)
      }
      return false
    }
  }

  /**
   * 获取视频的最佳缩略图配置
   */
  async getBestThumbnail(videoSrc: string, fallbackImage?: string): Promise<{ normal: string; blur: string }> {
    const thumbnailPaths = this.generateThumbnailPath(videoSrc)
    
    if (import.meta.env.DEV) {
      console.log(`[ThumbnailGenerator] 检查缩略图路径:`, thumbnailPaths)
    }
    
    // 检查缩略图是否存在
    const normalExists = await this.checkThumbnailExists(thumbnailPaths.normal)
    const blurExists = await this.checkThumbnailExists(thumbnailPaths.blur)
    
    if (import.meta.env.DEV) {
      console.log(`[ThumbnailGenerator] 缩略图存在状态: normal=${normalExists}, blur=${blurExists}`)
    }
    
    if (normalExists && blurExists) {
      if (import.meta.env.DEV) {
        console.log(`[ThumbnailGenerator] ✅ 使用生成的缩略图: ${thumbnailPaths.normal}`)
      }
      return thumbnailPaths
    }
    
    // 如果缩略图不存在，生成SVG占位符而不是显示logo
    if (import.meta.env.DEV) {
      console.log(`[ThumbnailGenerator] ⚠️ 缩略图不存在，生成SVG占位符`)
    }
    
    // 生成高质量的SVG占位符
    const svgPlaceholder = this.generateSVGPlaceholder()
    return {
      normal: svgPlaceholder,
      blur: svgPlaceholder
    }
  }

  /**
   * 生成SVG占位符
   */
  private generateSVGPlaceholder(): string {
    const svg = `
      <svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="placeholderBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
          </linearGradient>
          <radialGradient id="playBg" cx="50%" cy="50%" r="25%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.9);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(255,255,255,0.7);stop-opacity:1" />
          </radialGradient>
        </defs>
        <rect width="640" height="360" fill="url(#placeholderBg)"/>
        <circle cx="320" cy="180" r="60" fill="url(#playBg)"/>
        <polygon points="300,160 300,200 340,180" fill="#4f46e5"/>
        <text x="320" y="250" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.9)" text-anchor="middle" font-weight="500">Video Preview</text>
      </svg>
    `
    
    // 转换为 base64 data URL
    const encoded = btoa(svg.trim())
    return `data:image/svg+xml;base64,${encoded}`
  }

  /**
   * 从Canvas生成缩略图（客户端）
   */
  generateThumbnailFromVideo(video: HTMLVideoElement, options: ThumbnailOptions = {}): Promise<{ normal: string; blur: string }> {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Canvas context not supported'))
          return
        }
        
        // 设置canvas尺寸
        canvas.width = options.width || video.videoWidth
        canvas.height = options.height || video.videoHeight
        
        // 绘制视频帧
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // 生成普通版本
        const normalDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        // 生成模糊版本
        ctx.filter = `blur(${options.blurRadius || 20}px)`
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const blurDataUrl = canvas.toDataURL('image/jpeg', 0.6)
        
        resolve({
          normal: normalDataUrl,
          blur: blurDataUrl
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 预加载缩略图
   */
  preloadThumbnail(thumbnailPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = reject
      img.src = thumbnailPath
    })
  }

  /**
   * 批量预加载多个缩略图
   */
  async preloadThumbnails(thumbnailPaths: string[]): Promise<void> {
    const promises = thumbnailPaths.map(path => this.preloadThumbnail(path))
    await Promise.allSettled(promises)
  }
}

export const thumbnailGenerator = new ThumbnailGeneratorService()
export default thumbnailGenerator