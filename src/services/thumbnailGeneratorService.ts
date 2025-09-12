/**
 * 视频缩略图生成服务
 * 用于从视频文件生成静态缩略图和模糊版本
 */

export interface ThumbnailOptions {
  timestamp?: number // 截图时间点（秒）
  quality?: number // 图片质量 (1-31, 数字越小质量越高)
  width?: number // 输出宽度
  height?: number // 输出高度
  blurRadius?: number // 模糊半径
}

export interface VideoThumbnail {
  originalPath: string
  blurredPath: string
  width: number
  height: number
  fileSize: number
}

class ThumbnailGeneratorService {
  /**
   * 从视频URL生成缩略图路径
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
   * 检查缩略图是否存在
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
    
    // 如果缩略图不存在，使用fallback
    const fallback = fallbackImage || '/logo.png'
    if (import.meta.env.DEV) {
      console.log(`[ThumbnailGenerator] ⚠️ 缩略图不存在，使用fallback: ${fallback}`)
    }
    return {
      normal: fallback,
      blur: fallback
    }
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