/**
 * 本地缩略图提取器
 * 在视频生成完成后直接在前端提取真实视频帧
 */

import { extractVideoThumbnail } from '@/utils/videoThumbnail'
import thumbnailGenerator from './thumbnailGeneratorService'

export interface ThumbnailSet {
  normal: string
  blur: string
  timestamp: number
  source: 'local-extract'
  quality: 'real-frame'
}

export interface ExtractionOptions {
  frameTime?: number // 提取的时间点（秒），默认1.0秒
  quality?: number   // JPEG质量 0-1，默认0.8
  maxWidth?: number  // 最大宽度，默认640
  maxHeight?: number // 最大高度，默认360
  enableBlur?: boolean // 是否生成模糊版本，默认true
}

class LocalThumbnailExtractor {
  private extractionQueue = new Map<string, Promise<ThumbnailSet | null>>()
  private readonly MAX_CONCURRENT_EXTRACTIONS = 3
  private activeExtractions = 0

  /**
   * 提取第一秒的视频帧
   */
  async extractFirstSecondFrame(
    videoId: string,
    videoUrl: string,
    options: ExtractionOptions & { highPriority?: boolean } = {}
  ): Promise<ThumbnailSet | null> {
    const {
      frameTime = 1.0,
      quality = 0.8,
      maxWidth = 640,
      maxHeight = 360,
      enableBlur = true,
      highPriority = false
    } = options

    console.log(`[LocalThumbnailExtractor] 开始提取视频帧: ${videoId} at ${frameTime}s ${highPriority ? '(高优先级)' : ''}`)

    // 检查是否已在处理队列中
    if (this.extractionQueue.has(videoId)) {
      console.log(`[LocalThumbnailExtractor] 视频正在处理中，等待结果: ${videoId}`)
      return this.extractionQueue.get(videoId)!
    }

    // 高优先级请求绕过并发限制
    if (!highPriority && this.activeExtractions >= this.MAX_CONCURRENT_EXTRACTIONS) {
      console.log(`[LocalThumbnailExtractor] 并发限制，延迟处理: ${videoId}`)
      await this.waitForSlot()
    }

    // 创建提取Promise并加入队列
    const extractionPromise = this.performExtraction(videoId, videoUrl, {
      frameTime,
      quality,
      maxWidth,
      maxHeight,
      enableBlur
    })

    this.extractionQueue.set(videoId, extractionPromise)

    try {
      const result = await extractionPromise
      return result
    } finally {
      // 清理队列
      this.extractionQueue.delete(videoId)
    }
  }

  /**
   * 高优先级立即提取（用于视频刚完成时）
   */
  async extractImmediately(
    videoId: string,
    videoUrl: string,
    options: ExtractionOptions = {}
  ): Promise<ThumbnailSet | null> {
    return this.extractFirstSecondFrame(videoId, videoUrl, {
      ...options,
      highPriority: true
    })
  }

  /**
   * 执行实际的提取操作
   */
  private async performExtraction(
    videoId: string,
    videoUrl: string,
    options: Required<ExtractionOptions>
  ): Promise<ThumbnailSet | null> {
    this.activeExtractions++

    try {
      console.log(`[LocalThumbnailExtractor] 开始提取视频帧: ${videoId}`)

      // 提取正常版本
      const normalFrame = await this.extractOptimizedFrame(videoUrl, options)
      
      let blurFrame = ''
      if (options.enableBlur) {
        // 生成模糊版本
        blurFrame = await this.generateBlurVersion(normalFrame)
      }

      const thumbnailSet: ThumbnailSet = {
        normal: normalFrame,
        blur: blurFrame,
        timestamp: Date.now(),
        source: 'local-extract',
        quality: 'real-frame'
      }

      console.log(`[LocalThumbnailExtractor] 视频帧提取成功: ${videoId}`)
      return thumbnailSet

    } catch (error) {
      console.error(`[LocalThumbnailExtractor] 视频帧提取失败: ${videoId}`, error)
      return null
    } finally {
      this.activeExtractions--
    }
  }

  /**
   * 提取优化的视频帧
   */
  private async extractOptimizedFrame(
    videoUrl: string,
    options: Required<ExtractionOptions>
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
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.preload = 'metadata'

      // 监听元数据加载完成
      video.addEventListener('loadedmetadata', () => {
        // 计算最优尺寸（保持宽高比）
        const { width, height } = this.calculateOptimalSize(
          video.videoWidth,
          video.videoHeight,
          options.maxWidth,
          options.maxHeight
        )

        canvas.width = width
        canvas.height = height

        // 跳转到指定时间点
        video.currentTime = Math.min(options.frameTime, video.duration)
      })

      // 监听跳转完成
      video.addEventListener('seeked', () => {
        try {
          // 绘制当前帧到画布
          context.drawImage(video, 0, 0, canvas.width, canvas.height)

          // 转换为高质量JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', options.quality)

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
        console.error(`[LocalThumbnailExtractor] 视频加载失败: ${videoUrl}`, e)
        reject(new Error(`Video loading failed: ${videoUrl}`))
      })

      // 超时处理
      const timeout = setTimeout(() => {
        video.remove()
        canvas.remove()
        reject(new Error('Video extraction timeout'))
      }, 30000) // 30秒超时

      video.addEventListener('seeked', () => {
        clearTimeout(timeout)
      })

      // 开始加载视频
      video.src = videoUrl
    })
  }

  /**
   * 计算最优尺寸
   */
  private calculateOptimalSize(
    videoWidth: number,
    videoHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = videoWidth / videoHeight

    let width = videoWidth
    let height = videoHeight

    // 如果超过最大宽度，按宽度缩放
    if (width > maxWidth) {
      width = maxWidth
      height = Math.round(width / aspectRatio)
    }

    // 如果超过最大高度，按高度缩放
    if (height > maxHeight) {
      height = maxHeight
      width = Math.round(height * aspectRatio)
    }

    // 确保尺寸为偶数（有利于视频编码）
    width = Math.round(width / 2) * 2
    height = Math.round(height / 2) * 2

    return { width, height }
  }

  /**
   * 生成模糊版本
   */
  private async generateBlurVersion(imageData: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Cannot get canvas context'))
          return
        }

        canvas.width = img.width
        canvas.height = img.height

        // 应用模糊效果
        ctx.filter = 'blur(8px) brightness(0.9)'
        ctx.drawImage(img, 0, 0)

        const blurredDataUrl = canvas.toDataURL('image/jpeg', 0.6)
        resolve(blurredDataUrl)
      }

      img.onerror = () => reject(new Error('Failed to load image for blur'))
      img.src = imageData
    })
  }

  /**
   * 等待提取槽位可用
   */
  private async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.activeExtractions < this.MAX_CONCURRENT_EXTRACTIONS) {
          resolve()
        } else {
          setTimeout(checkSlot, 500) // 500ms后重试
        }
      }
      checkSlot()
    })
  }

  /**
   * 批量提取（用于处理现有视频）
   */
  async batchExtract(
    videos: Array<{ id: string; url: string }>,
    options: ExtractionOptions = {}
  ): Promise<void> {
    console.log(`[LocalThumbnailExtractor] 开始批量提取 ${videos.length} 个视频的缩略图`)

    for (const video of videos) {
      try {
        // 检查是否已有缓存
        const hasCache = thumbnailGenerator.getFromMemoryCache(video.url)
        if (hasCache) {
          console.log(`[LocalThumbnailExtractor] 跳过已有缓存的视频: ${video.id}`)
          continue
        }

        // 提取并缓存
        const thumbnails = await this.extractFirstSecondFrame(video.id, video.url, options)
        if (thumbnails) {
          await thumbnailGenerator.ensureThumbnailCached(video.url, video.id)
        }

        // 添加间隔避免过载
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`[LocalThumbnailExtractor] 批量提取失败: ${video.id}`, error)
      }
    }

    console.log(`[LocalThumbnailExtractor] 批量提取完成`)
  }

  /**
   * 获取提取状态
   */
  getExtractionStatus(): {
    activeExtractions: number
    queueLength: number
    maxConcurrent: number
  } {
    return {
      activeExtractions: this.activeExtractions,
      queueLength: this.extractionQueue.size,
      maxConcurrent: this.MAX_CONCURRENT_EXTRACTIONS
    }
  }
}

// 创建单例实例
export const localThumbnailExtractor = new LocalThumbnailExtractor()
export default localThumbnailExtractor