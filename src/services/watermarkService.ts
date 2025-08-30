/**
 * 视频水印服务
 * 为免费用户的视频添加域名水印（修复版，支持音频）
 */

export interface WatermarkOptions {
  text?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  fontSize?: number
  fontFamily?: string
  color?: string
  opacity?: number
  padding?: number
}

export class WatermarkService {
  private static readonly DEFAULT_OPTIONS: Required<WatermarkOptions> = {
    text: 'veo3video.me',
    position: 'bottom-right',
    fontSize: 20,
    fontFamily: 'Arial, sans-serif',
    color: '#ffffff',
    opacity: 0.7,
    padding: 20
  }

  /**
   * 为视频添加水印（修复版，保留音频）
   */
  static async addWatermarkToVideo(
    videoUrl: string, 
    options: WatermarkOptions = {}
  ): Promise<Blob> {
    const config = { ...this.DEFAULT_OPTIONS, ...options }
    console.log('[Watermark] 开始处理视频:', videoUrl)
    
    return new Promise((resolve, reject) => {
      // 创建video元素
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true // 处理时静音，但仍获取音频流
      video.preload = 'metadata'
      video.style.display = 'none' // 隐藏视频元素
      
      // 添加超时机制（30秒）
      const timeoutId = setTimeout(() => {
        console.error('[Watermark] 处理超时')
        cleanup()
        reject(new Error('视频处理超时（30秒）'))
      }, 30000)
      
      const cleanup = () => {
        clearTimeout(timeoutId)
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      
      video.onloadedmetadata = () => {
        console.log('[Watermark] 视频元数据加载完成')
        console.log('[Watermark] 视频信息:', {
          width: video.videoWidth,
          height: video.videoHeight, 
          duration: video.duration
        })
        
        try {
          // 创建canvas
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            cleanup()
            reject(new Error('无法创建Canvas上下文'))
            return
          }

          // 设置canvas尺寸
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          console.log('[Watermark] Canvas尺寸设置:', canvas.width, 'x', canvas.height)
          
          // 获取视频流（包含音频）
          let videoStream: MediaStream
          try {
            videoStream = video.captureStream()
            console.log('[Watermark] 获取视频流成功，轨道数:', {
              video: videoStream.getVideoTracks().length,
              audio: videoStream.getAudioTracks().length
            })
          } catch (streamError) {
            console.error('[Watermark] 获取视频流失败:', streamError)
            cleanup()
            reject(new Error('无法获取视频流'))
            return
          }
          
          // 获取canvas流（匹配原视频帧率）
          const fps = Math.min(30, video.videoWidth > 1920 ? 25 : 30) // 大尺寸视频降低帧率
          const canvasStream = canvas.captureStream(fps)
          console.log('[Watermark] Canvas流设置:', { fps, 轨道数: canvasStream.getVideoTracks().length })
          
          // 合并音视频流
          const audioTracks = videoStream.getAudioTracks()
          const videoTracks = canvasStream.getVideoTracks()
          
          const combinedStream = new MediaStream([
            ...videoTracks,  // 带水印的视频
            ...audioTracks   // 原始音频
          ])
          
          console.log('[Watermark] 合并流完成:', {
            video: combinedStream.getVideoTracks().length,
            audio: combinedStream.getAudioTracks().length,
            totalTracks: combinedStream.getTracks().length
          })
          
          // 选择编码格式
          const bestFormat = this.getBestVideoFormat()
          console.log('[Watermark] 使用编码格式:', bestFormat)
          
          // 创建MediaRecorder，优化画质设置
          const videoBitrate = Math.min(
            8000000, // 最大8Mbps
            Math.max(
              2500000, // 最小2.5Mbps
              video.videoWidth * video.videoHeight * 0.1 // 根据分辨率动态调整
            )
          )
          
          const mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: bestFormat.mimeType,
            videoBitsPerSecond: videoBitrate,
            audioBitsPerSecond: 192000 // 高质量音频 192kbps
          })
          
          console.log('[Watermark] MediaRecorder设置:', {
            视频比特率: (videoBitrate / 1000000).toFixed(1) + 'Mbps',
            音频比特率: '192kbps',
            编码: bestFormat.mimeType
          })
          
          const chunks: BlobPart[] = []
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data)
              console.log('[Watermark] 录制数据:', event.data.size, 'bytes')
            }
          }
          
          mediaRecorder.onstop = () => {
            console.log('[Watermark] 录制停止，总块数:', chunks.length)
            const outputType = bestFormat.extension === 'mp4' ? 'video/mp4' : 'video/webm'
            const blob = new Blob(chunks, { type: outputType })
            console.log('[Watermark] 最终blob:', { 
              size: blob.size, 
              type: blob.type,
              sizeMB: (blob.size / 1024 / 1024).toFixed(2) + 'MB'
            })
            cleanup()
            resolve(blob)
          }
          
          mediaRecorder.onerror = (event) => {
            console.error('[Watermark] MediaRecorder错误:', event)
            cleanup()
            reject(new Error('录制过程中发生错误'))
          }
          
          mediaRecorder.onstart = () => {
            console.log('[Watermark] MediaRecorder开始录制')
          }
          
          // 帧绘制函数
          const drawFrame = () => {
            // 检查视频状态
            if (video.paused || video.ended || video.currentTime >= video.duration) {
              console.log('[Watermark] 视频播放完成，停止录制')
              mediaRecorder.stop()
              return
            }
            
            // 清空canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            
            // 绘制当前视频帧
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            
            // 绘制水印
            this.drawWatermark(ctx, canvas, config)
            
            // 请求下一帧
            requestAnimationFrame(drawFrame)
          }
          
          // 开始处理
          console.log('[Watermark] 启动MediaRecorder...')
          mediaRecorder.start(1000) // 每1秒一个数据块，减少内存占用
          
          // 播放视频（静音以避免用户听到声音）
          console.log('[Watermark] 开始播放视频（静音模式）...')
          video.volume = 0 // 确保完全静音
          video.play()
            .then(() => {
              console.log('[Watermark] 视频播放成功，开始绘制帧')
              drawFrame()
            })
            .catch(error => {
              console.error('[Watermark] 视频播放失败:', error)
              cleanup()
              reject(new Error(`视频播放失败: ${error.message}`))
            })
            
        } catch (error) {
          console.error('[Watermark] 流处理失败:', error)
          cleanup()
          reject(error)
        }
      }
      
      video.onerror = (event) => {
        console.error('[Watermark] 视频加载错误:', event)
        cleanup()
        reject(new Error('视频加载失败'))
      }
      
      video.onloadstart = () => {
        console.log('[Watermark] 开始加载视频')
      }
      
      // 设置视频源并开始加载
      video.src = videoUrl
      video.load()
    })
  }

  /**
   * 在Canvas上绘制水印
   */
  private static drawWatermark(
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    config: Required<WatermarkOptions>
  ) {
    // 保存当前绘图状态
    ctx.save()
    
    // 设置字体
    ctx.font = `${config.fontSize}px ${config.fontFamily}`
    ctx.fillStyle = config.color
    ctx.globalAlpha = config.opacity
    
    // 添加文字阴影效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 2
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1
    
    // 测量文字尺寸
    const textMetrics = ctx.measureText(config.text)
    const textWidth = textMetrics.width
    const textHeight = config.fontSize
    
    // 计算文字位置
    let x: number
    let y: number
    
    switch (config.position) {
      case 'bottom-right':
        x = canvas.width - textWidth - config.padding
        y = canvas.height - config.padding
        break
      case 'bottom-left':
        x = config.padding
        y = canvas.height - config.padding
        break
      case 'top-right':
        x = canvas.width - textWidth - config.padding
        y = textHeight + config.padding
        break
      case 'top-left':
        x = config.padding
        y = textHeight + config.padding
        break
      default:
        x = canvas.width - textWidth - config.padding
        y = canvas.height - config.padding
        break
    }
    
    // 绘制水印文字
    ctx.fillText(config.text, x, y)
    
    // 恢复绘图状态
    ctx.restore()
  }

  /**
   * 检查浏览器是否支持水印功能
   */
  static isSupported(): boolean {
    return !!(
      window.MediaRecorder &&
      HTMLCanvasElement.prototype.captureStream &&
      CanvasRenderingContext2D
    )
  }

  /**
   * 获取浏览器支持的最佳视频格式
   */
  static getBestVideoFormat(): { format: string; extension: string; mimeType: string } {
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      return { format: 'MP4', extension: 'mp4', mimeType: 'video/mp4' }
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      return { format: 'MP4 (H264)', extension: 'mp4', mimeType: 'video/webm;codecs=h264' }
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      return { format: 'WebM (VP8)', extension: 'webm', mimeType: 'video/webm;codecs=vp8' }
    } else {
      return { format: 'WebM', extension: 'webm', mimeType: 'video/webm' }
    }
  }

  /**
   * 创建下载链接
   */
  static createDownloadUrl(blob: Blob, filename: string = 'video-with-watermark.mp4'): string {
    const url = URL.createObjectURL(blob)
    
    // 创建下载链接
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    // 清理URL对象
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 100)
    
    return url
  }
}

export default WatermarkService