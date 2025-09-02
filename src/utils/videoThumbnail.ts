import { getProxyVideoUrl, createCorsVideo } from './videoUrlProxy'

/**
 * 从视频中提取缩略图
 * @param videoUrl 视频URL
 * @param frameTime 提取的时间点（秒），默认为第10帧（约0.33秒）
 * @returns Promise<string> 返回base64格式的图片数据
 */
export async function extractVideoThumbnail(
  videoUrl: string,
  frameTime: number = 0.33
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
    video.addEventListener('seeked', () => {
      try {
        // 绘制当前帧到画布
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // 转换为base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        
        // 清理资源
        video.remove()
        canvas.remove()
        
        resolve(dataUrl)
      } catch (error) {
        reject(error)
      }
    })
    
    // 增强错误处理，包括CORS错误
    video.addEventListener('error', (e) => {
      console.error(`[VIDEO THUMBNAIL] 视频加载失败: ${videoUrl}`, e)
      
      // 如果是CORS错误，尝试使用备用方案
      if (videoUrl.includes('filesystem.site') || videoUrl.includes('heyoo.oss')) {
        console.warn(`[VIDEO THUMBNAIL] 检测到第三方域名CORS问题，使用备用缩略图`)
        // 返回一个默认的视频图标或占位图
        resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuinhumikTwvdGV4dD48L3N2Zz4=')
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
    
    // 只对外部URL设置crossOrigin，避免本地文件的CORS问题
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      video.crossOrigin = 'anonymous'
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