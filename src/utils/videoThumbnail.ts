import { createCorsVideo } from './videoUrlProxy'
import { generateOptimizedThumbnail } from './webpThumbnailOptimizer'

/**
 * 从视频中提取缩略图
 * @param videoUrl 视频URL
 * @param frameTime 提取的时间点（秒），优化为0.2秒以获得更好的画面
 * @returns Promise<string> 返回base64格式的图片数据
 */
export async function extractVideoThumbnail(
  videoUrl: string,
  frameTime: number = 0.2
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 🔧 使用CORS安全的视频元素
    const video = createCorsVideo(videoUrl)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    // 视频属性已在createCorsVideo中设置
    video.muted = true
    
    // 监听视频加载元数据
    video.addEventListener('loadedmetadata', () => {
      // 设置画布尺寸与视频相同
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // 跳转到指定时间点
      video.currentTime = Math.min(frameTime, video.duration)
    })
    
    // 监听跳转完成
    video.addEventListener('seeked', async () => {
      try {
        // 🚀 使用优化的 WebP 缩略图生成
        const thumbnailUrl = await generateOptimizedThumbnail(video, {
          quality: 0.8,
          format: 'auto',  // 自动选择最佳格式
          maxWidth: 320,
          maxHeight: 180
        })
        
        // 清理资源
        video.remove()
        canvas.remove()
        
        resolve(thumbnailUrl)
      } catch (error) {
        // 如果 WebP 生成失败，回退到原始方法
        console.warn('[VIDEO THUMBNAIL] WebP 生成失败，使用 JPEG 回退:', error)
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          video.remove()
          canvas.remove()
          resolve(dataUrl)
        } catch (fallbackError) {
          reject(fallbackError)
        }
      }
    })
    
    // 增强错误处理，包括CORS和代理错误
    video.addEventListener('error', async (e) => {
      console.error(`[VIDEO THUMBNAIL] 视频加载失败: ${videoUrl}`, e)
      
      // 如果是代理请求失败，尝试直接访问原始URL
      if (videoUrl.startsWith('/api/r2/')) {
        console.warn(`[VIDEO THUMBNAIL] 代理请求失败，尝试直接访问原始URL`)
        
        let originalUrl = videoUrl
        if (videoUrl.startsWith('/api/r2/')) {
          originalUrl = `https://cdn.veo3video.me${videoUrl.replace('/api/r2', '')}`
        }
        
        try {
          // 尝试使用原始URL重新提取缩略图
          const directThumbnail = await extractVideoThumbnailDirect(originalUrl, frameTime)
          resolve(directThumbnail)
          return
        } catch (directError) {
          console.error(`[VIDEO THUMBNAIL] 直接访问也失败: ${originalUrl}`, directError)
        }
      }
      
      // 根据不同域名提供不同的备用缩略图
      if (videoUrl.includes('cdn.veo3video.me')) {
        console.warn(`[VIDEO THUMBNAIL] 检测到第三方域名问题，使用高质量备用缩略图`)
        resolve(getEnhancedDefaultThumbnail())
        return
      }
      
      reject(new Error(`Failed to load video: ${e}`))
    })
    
    // 视频源已在createCorsVideo中设置
    video.load()
  })
}

/**
 * 批量提取视频缩略图（用于生成预览序列）
 * @param videoUrl 视频URL
 * @param count 提取数量
 * @returns Promise<string[]> 返回base64图片数组
 */
export async function extractVideoThumbnails(
  videoUrl: string,
  count: number = 5
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    const thumbnails: string[] = []
    
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    // 对需要CORS处理的URL设置crossOrigin
    if (videoUrl.includes('cdn.veo3video.me') || 
        (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
      video.crossOrigin = 'anonymous'
      video.setAttribute('crossorigin', 'anonymous')
    }
    video.muted = true
    video.playsInline = true
    
    video.addEventListener('loadedmetadata', async () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const interval = video.duration / count
      
      for (let i = 0; i < count; i++) {
        const time = i * interval
        
        await new Promise<void>((seekResolve) => {
          const handleSeeked = () => {
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            thumbnails.push(canvas.toDataURL('image/jpeg', 0.6))
            video.removeEventListener('seeked', handleSeeked)
            seekResolve()
          }
          
          video.addEventListener('seeked', handleSeeked)
          video.currentTime = time
        })
      }
      
      video.remove()
      canvas.remove()
      resolve(thumbnails)
    })
    
    video.addEventListener('error', (e) => {
      reject(new Error(`Failed to load video: ${e}`))
    })
    
    video.src = videoUrl
    video.load()
  })
}

/**
 * 创建视频预览动画（悬停时显示多个缩略图）
 */
export class VideoPreviewAnimation {
  private thumbnails: string[] = []
  private currentIndex = 0
  private intervalId: number | null = null
  
  constructor(private element: HTMLImageElement) {}
  
  async loadThumbnails(videoUrl: string, count: number = 5) {
    this.thumbnails = await extractVideoThumbnails(videoUrl, count)
    if (this.thumbnails.length > 0) {
      this.element.src = this.thumbnails[0]
    }
  }
  
  start(intervalMs: number = 500) {
    if (this.thumbnails.length === 0) return
    
    this.stop()
    this.intervalId = window.setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.thumbnails.length
      this.element.src = this.thumbnails[this.currentIndex]
    }, intervalMs)
  }
  
  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.thumbnails.length > 0) {
      this.currentIndex = 0
      this.element.src = this.thumbnails[0]
    }
  }
  
  dispose() {
    this.stop()
    this.thumbnails = []
  }
}

/**
 * 直接访问原始URL提取缩略图（不使用代理）
 */
async function extractVideoThumbnailDirect(
  videoUrl: string,
  frameTime: number = 0.2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    // 对需要CORS处理的URL设置crossOrigin
    if (videoUrl.includes('cdn.veo3video.me') || 
        (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
      video.crossOrigin = 'anonymous'
      video.setAttribute('crossorigin', 'anonymous')
    }
    video.muted = true
    video.playsInline = true
    
    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      video.currentTime = Math.min(frameTime, video.duration)
    })
    
    video.addEventListener('seeked', () => {
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        video.remove()
        canvas.remove()
        resolve(dataUrl)
      } catch (error) {
        reject(error)
      }
    })
    
    video.addEventListener('error', (e) => {
      reject(new Error(`Direct access failed: ${e}`))
    })
    
    video.src = videoUrl
    video.load()
  })
}

/**
 * 获取增强的默认缩略图
 */
function getEnhancedDefaultThumbnail(): string {
  const svg = `
    <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#bg)"/>
      <circle cx="160" cy="90" r="25" fill="rgba(255,255,255,0.9)"/>
      <polygon points="150,75 150,105 175,90" fill="#667eea"/>
      <text x="160" y="130" font-family="Arial, sans-serif" font-size="12" fill="white" text-anchor="middle">Video</text>
    </svg>
  `
  // 使用安全的 base64 编码方法处理 Unicode 字符
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}