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
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    // 设置视频属性
    // 只对外部URL设置crossOrigin，避免本地文件的CORS问题
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      video.crossOrigin = 'anonymous'
    }
    video.muted = true
    video.playsInline = true
    
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
    
    // 错误处理
    video.addEventListener('error', (e) => {
      reject(new Error(`Failed to load video: ${e}`))
    })
    
    // 设置视频源
    video.src = videoUrl
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