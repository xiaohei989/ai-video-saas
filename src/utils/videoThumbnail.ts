import { createCorsVideo } from './videoUrlProxy'
import { generateOptimizedThumbnail } from './webpThumbnailOptimizer'
import { supabase } from '@/lib/supabase'
import { getR2PublicDomain, generateR2Url } from '@/config/cdnConfig'

// 🌟 超高质量缩略图配置 - 提升到专业级质量标准
const OPTIMAL_THUMBNAIL_CONFIG = {
  width: 960,           // 🚀 升级分辨率：640 -> 960 (1.5倍提升)
  height: 540,          // 🚀 升级分辨率：360 -> 540 (1.5倍提升，保持16:9)
  quality: 0.95,        // 🌟 提高质量：0.90 -> 0.95 (专业级质量)
  format: 'auto' as const,       // WebP优先，JPEG回退
  frameTime: 0.1,       // 0.1秒处截取，快速获取画面
  version: 'v2'         // 🔥 版本号：用于避免CDN缓存冲突
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
    // 🔧 使用缩略图生成模式，启用严格的CORS设置
    const video = createCorsVideo(videoUrl, true)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    // 视频属性已在 createCorsVideo 中设置
    
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
        
        // 上传到R2（使用版本化文件名）
        const r2Url = await uploadThumbnailToR2(thumbnailDataUrl, videoId, config.version)
        
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
 * 同步生成高清与低清（模糊）两种缩略图并上传
 * 返回两种URL，供前端渐进式加载
 */
export async function extractAndUploadThumbnailsBoth(
  videoUrl: string,
  videoId: string,
  options: {
    frameTime?: number
  } = {}
): Promise<{ fullUrl: string; blurUrl: string }> {
  const config = { ...OPTIMAL_THUMBNAIL_CONFIG, ...options }
  
  return new Promise((resolve, reject) => {
    const video = createCorsVideo(videoUrl, true)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }

    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      video.currentTime = Math.min(config.frameTime, video.duration)
    })

    video.addEventListener('seeked', async () => {
      try {
        // 高清图
        const fullDataUrl = await generateOptimizedThumbnail(video, {
          quality: config.quality,
          format: config.format,
          maxWidth: config.width,
          maxHeight: config.height
        })
        // 低清模糊图
        const blurDataUrl = await generateOptimizedThumbnail(video, {
          quality: 0.4,
          format: 'webp',
          maxWidth: 48,
          maxHeight: 48
        })

        // 上传：高清与模糊统一存储到 R2（version: v2 / blur）
        const [fullUrl, blurUrl] = await Promise.all([
          uploadThumbnailToR2(fullDataUrl, videoId, 'v2'),
          uploadThumbnailToR2(blurDataUrl, videoId, 'blur')
        ])

        video.remove(); canvas.remove()
        resolve({ fullUrl, blurUrl })
      } catch (err) {
        video.remove(); canvas.remove()
        reject(err)
      }
    })

    video.addEventListener('error', (e) => {
      reject(new Error(`Failed to load video: ${e}`))
    })

    video.load()
  })
}

/**
 * 仅生成并上传模糊缩略图（前端生成 + Supabase Storage 直传）
 */
export async function extractAndUploadBlurOnly(
  videoUrl: string,
  videoId: string,
  options: { frameTime?: number; size?: number; quality?: number } = {}
): Promise<string> {
  const frameTime = options.frameTime ?? OPTIMAL_THUMBNAIL_CONFIG.frameTime
  const size = options.size ?? 48
  const quality = options.quality ?? 0.4

  return new Promise((resolve, reject) => {
    const video = createCorsVideo(videoUrl, true)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    video.addEventListener('loadedmetadata', () => {
      // 先设置为源尺寸，待会儿绘制时压缩
      canvas.width = Math.min(video.videoWidth, size)
      canvas.height = Math.min(video.videoHeight, size)
      video.currentTime = Math.min(frameTime, video.duration)
    })
    video.addEventListener('seeked', async () => {
      try {
        // 按目标尺寸保持比例
        const ratio = Math.max(video.videoWidth, video.videoHeight) / size
        const w = Math.max(1, Math.round(video.videoWidth / ratio))
        const h = Math.max(1, Math.round(video.videoHeight / ratio))
        canvas.width = w
        canvas.height = h
        ctx.drawImage(video, 0, 0, w, h)
        const blurDataUrl = canvas.toDataURL('image/webp', quality)
        const url = await uploadThumbnailToR2(blurDataUrl, videoId, 'blur')
        video.remove(); canvas.remove()
        resolve(url)
      } catch (e) {
        video.remove(); canvas.remove()
        reject(e)
      }
    })
    video.addEventListener('error', (e) => reject(new Error(`Failed to load video: ${e}`)))
    video.load()
  })
}

/**
 * 将模糊缩略图上传到 Supabase Storage (public bucket)
 * 生成路径：thumbnails_blur/<videoId>.webp
 */
//（已废弃）uploadBlurToStorage：改为统一上传到 R2。

/**
 * 将Base64缩略图上传到R2存储
 * @param thumbnailDataUrl Base64格式的缩略图
 * @param videoId 视频ID
 * @param version 版本号（用于避免CDN缓存冲突）
 * @returns Promise<string> 返回R2 CDN访问URL
 */
async function uploadThumbnailToR2(thumbnailDataUrl: string, videoId: string, version: string = 'v2'): Promise<string> {
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
        version, // 🔥 新增：版本号用于生成不同的文件名
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
    // 🔧 使用缩略图生成模式，启用严格的CORS设置
    const video = createCorsVideo(videoUrl, true)
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
        // 🌟 使用专业级 WebP 缩略图生成
        const thumbnailUrl = await generateOptimizedThumbnail(video, {
          quality: OPTIMAL_THUMBNAIL_CONFIG.quality,    // 🌟 专业级质量：0.95
          format: 'auto',   // 自动选择最佳格式
          maxWidth: OPTIMAL_THUMBNAIL_CONFIG.width,     // 🚀 超高分辨率：960
          maxHeight: OPTIMAL_THUMBNAIL_CONFIG.height    // 🚀 超高分辨率：540
        })
        
        // 清理资源
        video.remove()
        canvas.remove()
        
        resolve(thumbnailUrl)
      } catch (error) {
        // 如果 WebP 生成失败，回退到原始方法
        console.warn('[VIDEO THUMBNAIL] WebP 生成失败，使用 WebP 回退:', error)
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          // 🚀 使用统一的高质量WebP配置
          const dataUrl = canvas.toDataURL('image/webp', OPTIMAL_THUMBNAIL_CONFIG.quality)
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
          originalUrl = generateR2Url(videoUrl.replace('/api/r2', ''))
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
      if (videoUrl.includes(getR2PublicDomain())) {
        console.warn(`[VIDEO THUMBNAIL] 检测到CDN域名问题，使用高质量备用缩略图`)
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
    // 🔧 使用缩略图生成模式，启用严格的CORS设置
    const video = createCorsVideo(videoUrl, true)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    const thumbnails: string[] = []
    
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    video.addEventListener('loadedmetadata', async () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const interval = video.duration / count
      
      for (let i = 0; i < count; i++) {
        const time = i * interval
        
        await new Promise<void>((seekResolve) => {
          const handleSeeked = () => {
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            thumbnails.push(canvas.toDataURL('image/webp', 0.8))
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
    
    // video.src 已经在 createCorsVideo 中设置
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
    // 🔧 使用缩略图生成模式，启用严格的CORS设置
    const video = createCorsVideo(videoUrl, true)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    video.addEventListener('loadedmetadata', () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      video.currentTime = Math.min(frameTime, video.duration)
    })
    
    video.addEventListener('seeked', () => {
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        // 🚀 使用统一的高质量WebP配置
        const dataUrl = canvas.toDataURL('image/webp', OPTIMAL_THUMBNAIL_CONFIG.quality)
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
    
    // video.src 已经在 createCorsVideo 中设置
    video.load()
  })
}

/**
 * 获取增强的默认缩略图
 * 🌟 升级到专业级配置：960x540分辨率
 */
function getEnhancedDefaultThumbnail(): string {
  const width = OPTIMAL_THUMBNAIL_CONFIG.width
  const height = OPTIMAL_THUMBNAIL_CONFIG.height
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <circle cx="${width/2}" cy="${height/2}" r="50" fill="rgba(255,255,255,0.9)"/>
      <polygon points="${width/2-25},${height/2-25} ${width/2-25},${height/2+25} ${width/2+25},${height/2}" fill="#667eea"/>
      <text x="${width/2}" y="${height/2+80}" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">Video</text>
    </svg>
  `
  // 使用安全的 base64 编码方法处理 Unicode 字符
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}
