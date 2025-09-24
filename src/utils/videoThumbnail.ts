import { createCorsVideo } from './videoUrlProxy'
import { generateOptimizedThumbnail } from './webpThumbnailOptimizer'
import { supabase } from '@/lib/supabase'

// 高质量缩略图配置 - 提升到与模板缩略图相近的质量
const OPTIMAL_THUMBNAIL_CONFIG = {
  width: 640,           // 提高分辨率：320 -> 640
  height: 360,          // 提高分辨率：180 -> 360  
  quality: 0.90,        // 提高质量：0.75 -> 0.90
  format: 'auto' as const,       // WebP优先，JPEG回退
  frameTime: 0.1        // 0.1秒处截取，快速获取画面
}

/**
 * 提取视频缩略图并上传到R2存储
 * @param videoUrl 视频URL
 * @param videoId 视频ID
 * @param options 可选配置
 * @returns Promise<string> 返回R2 CDN访问URL
 */
export async function extractAndUploadThumbnail(
  videoUrl: string,
  videoId: string,
  options: {
    frameTime?: number
    quality?: number
    format?: 'webp' | 'jpeg' | 'auto'
  } = {}
): Promise<string> {
  const config = { ...OPTIMAL_THUMBNAIL_CONFIG, ...options }
  
  console.log(`[ThumbnailUpload] 开始提取和上传缩略图: ${videoId}`)
  console.log(`[ThumbnailUpload] 配置:`, config)
  
  return new Promise((resolve, reject) => {
    const video = createCorsVideo(videoUrl)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    video.muted = true
    
    // 监听视频加载元数据
    video.addEventListener('loadedmetadata', () => {
      // 设置画布尺寸
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      // 跳转到指定时间点
      video.currentTime = Math.min(config.frameTime, video.duration)
    })
    
    // 监听跳转完成
    video.addEventListener('seeked', async () => {
      try {
        console.log(`[ThumbnailUpload] 开始生成缩略图: ${videoId}`)
        
        // 生成优化的缩略图
        const thumbnailDataUrl = await generateOptimizedThumbnail(video, {
          quality: config.quality,
          format: config.format,
          maxWidth: config.width,
          maxHeight: config.height
        })
        
        // 清理资源
        video.remove()
        canvas.remove()
        
        console.log(`[ThumbnailUpload] 缩略图生成成功，开始上传到R2: ${videoId}`)
        
        // 上传到R2
        const r2Url = await uploadThumbnailToR2(thumbnailDataUrl, videoId)
        
        console.log(`[ThumbnailUpload] 上传成功: ${videoId} -> ${r2Url}`)
        resolve(r2Url)
        
      } catch (error) {
        console.error(`[ThumbnailUpload] 处理失败: ${videoId}`, error)
        
        // 清理资源
        video.remove()
        canvas.remove()
        
        reject(error)
      }
    })
    
    // 错误处理
    video.addEventListener('error', (e) => {
      console.error(`[ThumbnailUpload] 视频加载失败: ${videoId}`, e)
      reject(new Error(`Failed to load video: ${e}`))
    })
    
    // 开始加载
    video.load()
  })
}

/**
 * 将Base64缩略图上传到R2存储
 * @param thumbnailDataUrl Base64格式的缩略图
 * @param videoId 视频ID
 * @returns Promise<string> 返回R2 CDN访问URL
 */
async function uploadThumbnailToR2(thumbnailDataUrl: string, videoId: string): Promise<string> {
  try {
    // 将DataURL转换为Blob
    const blob = await dataUrlToBlob(thumbnailDataUrl)
    
    // 将Blob转换为Base64
    const reader = new FileReader()
    const base64Data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1]) // 移除data:image/webp;base64,前缀
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    
    // 使用统一的supabase客户端调用Edge Function - 直接上传模式
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-thumbnail', {
      body: {
        videoId,
        base64Data,
        contentType: blob.type,
        fileSize: blob.size,
        directUpload: true // 关键：使用直接上传模式
      }
    })
    
    if (uploadError) {
      throw new Error(`上传失败: ${uploadError.message}`)
    }
    
    if (!uploadData?.success) {
      throw new Error(`上传响应异常: ${uploadData?.error || '未知错误'}`)
    }
    
    const publicUrl = uploadData.data.publicUrl
    console.log(`[ThumbnailUpload] R2上传成功: ${videoId} -> ${publicUrl}`)
    return publicUrl
    
  } catch (error) {
    console.error(`[ThumbnailUpload] R2上传失败: ${videoId}`, error)
    throw error
  }
}

/**
 * 将DataURL转换为Blob
 * @param dataUrl Base64数据URL
 * @returns Promise<Blob>
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

/**
 * 从视频中提取缩略图
 * @param videoUrl 视频URL
 * @param frameTime 提取的时间点（秒），优化为0.1秒以获得快速画面
 * @returns Promise<string> 返回base64格式的图片数据
 */
export async function extractVideoThumbnail(
  videoUrl: string,
  frameTime: number = 0.1
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
        // 🚀 使用高质量 WebP 缩略图生成
        const thumbnailUrl = await generateOptimizedThumbnail(video, {
          quality: 0.90,    // 提高质量：0.8 -> 0.90
          format: 'auto',   // 自动选择最佳格式
          maxWidth: 640,    // 提高分辨率：320 -> 640
          maxHeight: 360    // 提高分辨率：180 -> 360
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
  frameTime: number = 0.1
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