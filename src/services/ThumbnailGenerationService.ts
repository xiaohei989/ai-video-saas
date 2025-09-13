/**
 * 视频缩略图生成服务
 * 负责在视频生成完成后自动生成和保存缩略图
 * 现已更新为使用本地提取，避免服务器压力
 */

import { localThumbnailExtractor, type ThumbnailSet } from './LocalThumbnailExtractor'
import { thumbnailCacheService } from './ThumbnailCacheService'
import type { Database } from '@/lib/supabase'

type Video = Database['public']['Tables']['videos']['Row']

interface ThumbnailGenerationTask {
  videoId: string
  videoUrl: string
  retryCount: number
  lastAttempt: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

class ThumbnailGenerationService {
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAYS = [1000, 5000, 15000] // 1s, 5s, 15s
  private processingQueue = new Map<string, ThumbnailGenerationTask>()
  private isProcessing = false

  /**
   * 视频完成时触发本地缩略图提取（高优先级，立即执行）
   */
  async onVideoCompleted(videoId: string, videoUrl: string): Promise<void> {
    console.log(`[ThumbnailGeneration] 视频完成，立即开始本地提取缩略图: ${videoId}`)
    
    try {
      // 检查是否已有真实缩略图
      const hasRealThumbnail = await thumbnailCacheService.hasRealThumbnail(videoId)
      if (hasRealThumbnail) {
        console.log(`[ThumbnailGeneration] 视频已有真实缩略图，跳过: ${videoId}`)
        return
      }

      // 添加到处理队列（高优先级）
      this.processingQueue.set(videoId, {
        videoId,
        videoUrl,
        retryCount: 0,
        lastAttempt: new Date(),
        status: 'processing'
      })

      // 立即开始本地提取（不等待，高优先级）
      await this.extractLocalThumbnailImmediate(videoId, videoUrl)
    } catch (error) {
      console.error(`[ThumbnailGeneration] 启动本地缩略图提取失败: ${videoId}`, error)
      await this.markThumbnailFailed(videoId, error instanceof Error ? error.message : '启动失败')
    }
  }

  /**
   * 立即执行本地缩略图提取（高优先级，绕过并发限制）
   */
  private async extractLocalThumbnailImmediate(videoId: string, videoUrl: string): Promise<void> {
    console.log(`[ThumbnailGeneration] 高优先级立即提取: ${videoId}`)
    
    try {
      // 直接使用ThumbnailCacheService进行提取，它内部有优化
      const result = await thumbnailCacheService.extractAndCacheRealThumbnail(videoId, videoUrl)
      
      if (result) {
        // 标记任务完成
        const task = this.processingQueue.get(videoId)
        if (task) {
          task.status = 'completed'
          this.processingQueue.delete(videoId)
        }
        
        console.log(`[ThumbnailGeneration] 立即提取真实缩略图成功: ${videoId}`)
        
        // 触发缩略图就绪事件
        this.notifyThumbnailReady(videoId, result)
      } else {
        throw new Error('立即提取失败，返回null')
      }
    } catch (error) {
      console.error(`[ThumbnailGeneration] 立即提取失败，尝试标准流程: ${videoId}`, error)
      // 回退到标准提取流程
      await this.extractLocalThumbnail(videoId, videoUrl)
    }
  }

  /**
   * 执行本地缩略图提取
   */
  private async extractLocalThumbnail(videoId: string, videoUrl: string): Promise<void> {
    console.log(`[ThumbnailGeneration] 开始本地提取: ${videoId}`)
    
    try {
      // 使用本地提取器提取第一秒的帧
      const thumbnailSet = await localThumbnailExtractor.extractFirstSecondFrame(
        videoId, 
        videoUrl, 
        {
          frameTime: 1.0,  // 第一秒
          quality: 0.8,    // 高质量
          maxWidth: 640,
          maxHeight: 360,
          enableBlur: true
        }
      )

      if (thumbnailSet) {
        // 使用ThumbnailCacheService保存到本地缓存
        const result = await thumbnailCacheService.extractAndCacheRealThumbnail(videoId, videoUrl)
        
        if (result) {
          // 标记任务完成
          const task = this.processingQueue.get(videoId)
          if (task) {
            task.status = 'completed'
            this.processingQueue.delete(videoId)
          }
          
          console.log(`[ThumbnailGeneration] 本地缩略图提取成功: ${videoId}`)
          
          // 触发缩略图就绪事件
          this.notifyThumbnailReady(videoId, result)
        } else {
          throw new Error('保存到本地缓存失败')
        }
      } else {
        throw new Error('提取视频帧失败')
      }
    } catch (error) {
      console.error(`[ThumbnailGeneration] 本地提取失败: ${videoId}`, error)
      await this.handleLocalExtractionFailure(videoId, error)
    }
  }

  /**
   * 处理本地提取失败
   */
  private async handleLocalExtractionFailure(videoId: string, error: any): Promise<void> {
    const task = this.processingQueue.get(videoId)
    if (!task) return

    task.retryCount++
    task.lastAttempt = new Date()

    if (task.retryCount < this.MAX_RETRIES) {
      console.log(`[ThumbnailGeneration] 重试本地提取 (${task.retryCount}/${this.MAX_RETRIES}): ${videoId}`)
      
      // 延迟重试
      const delay = this.RETRY_DELAYS[task.retryCount - 1] || 15000
      setTimeout(() => {
        this.extractLocalThumbnail(videoId, task.videoUrl)
      }, delay)
    } else {
      console.error(`[ThumbnailGeneration] 本地提取彻底失败: ${videoId}`)
      task.status = 'failed'
      this.processingQueue.delete(videoId)
    }
  }


  /**
   * 触发缩略图就绪事件
   */
  private notifyThumbnailReady(videoId: string, thumbnails: { normal: string; blur: string }): void {
    const event = new CustomEvent('thumbnailReady', {
      detail: { videoId, thumbnails }
    })
    window.dispatchEvent(event)
    console.log(`[ThumbnailGeneration] 已发送缩略图就绪事件: ${videoId}`)
  }

  /**
   * 处理缩略图生成队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    
    this.isProcessing = true
    
    try {
      for (const [videoId, task] of this.processingQueue.entries()) {
        if (task.status !== 'processing') continue
        
        try {
          await this.generateThumbnailForVideo(task)
        } catch (error) {
          console.error(`[ThumbnailGeneration] 处理任务失败: ${videoId}`, error)
          await this.handleTaskFailure(task, error)
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 为单个视频生成缩略图
   */
  private async generateThumbnailForVideo(task: ThumbnailGenerationTask): Promise<void> {
    const { videoId, videoUrl } = task
    
    console.log(`[ThumbnailGeneration] 开始生成缩略图: ${videoId}`)
    
    try {
      // 直接使用ThumbnailCacheService生成真实缩略图，避免fallback到logo
      const result = await thumbnailCacheService.extractAndCacheRealThumbnail(videoId, videoUrl)

      if (result) {
        // 构建兼容的结果格式用于保存到数据库
        const compatibleResult = {
          success: true,
          thumbnails: {
            normal: result.normal,
            blur: result.blur,
            metadata: {
              width: 640,
              height: 360,
              format: 'jpeg',
              fileSize: 0,
              generationMethod: 'real-frame' as const,
              timestamp: Date.now()
            }
          }
        }
        
        // 保存到数据库
        await this.saveThumbnailUrls(videoId, compatibleResult)
        
        // 标记完成
        task.status = 'completed'
        this.processingQueue.delete(videoId)
        
        console.log(`[ThumbnailGeneration] 真实缩略图生成成功: ${videoId}`)
        
        // 触发缩略图就绪事件
        this.notifyThumbnailReady(videoId, result)
      } else {
        throw new Error('真实缩略图提取失败')
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * 保存缩略图URL到数据库
   */
  private async saveThumbnailUrls(
    videoId: string, 
    result: ThumbnailGenerationResult
  ): Promise<void> {
    if (!result.success || !result.thumbnails) {
      throw new Error('无效的缩略图生成结果')
    }

    const metadata = {
      ...result.thumbnails.metadata,
      generatedAt: new Date().toISOString(),
      fallbackUsed: result.fallbackUsed || false
    }

    const updateData = {
      thumbnail_url: result.thumbnails.normal,
      thumbnail_blur_url: result.thumbnails.blur,
      thumbnail_generation_status: 'completed' as const,
      thumbnail_metadata: metadata
    }

    console.log(`[ThumbnailGeneration] 保存缩略图URL到数据库: ${videoId}`, updateData)

    const updateResult = await supabaseVideoService.updateVideoAsSystem(videoId, updateData)
    
    if (!updateResult) {
      throw new Error('数据库更新失败')
    }

    console.log(`[ThumbnailGeneration] 缩略图URL保存成功: ${videoId}`)
  }

  /**
   * 处理任务失败
   */
  private async handleTaskFailure(task: ThumbnailGenerationTask, error: unknown): Promise<void> {
    const { videoId, retryCount } = task
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    
    console.error(`[ThumbnailGeneration] 任务失败: ${videoId}, 重试次数: ${retryCount}`, errorMessage)
    
    if (retryCount < this.MAX_RETRIES) {
      // 增加重试计数
      task.retryCount++
      task.lastAttempt = new Date()
      
      // 延迟重试
      const delay = this.RETRY_DELAYS[retryCount] || 15000
      console.log(`[ThumbnailGeneration] 将在${delay}ms后重试: ${videoId}`)
      
      setTimeout(() => {
        this.processQueue()
      }, delay)
    } else {
      // 重试次数用完，标记失败
      await this.markThumbnailFailed(videoId, errorMessage)
      task.status = 'failed'
      this.processingQueue.delete(videoId)
    }
  }

  /**
   * 标记缩略图生成失败
   */
  private async markThumbnailFailed(videoId: string, errorMessage: string): Promise<void> {
    try {
      await supabaseVideoService.updateVideoAsSystem(videoId, {
        thumbnail_generation_status: 'failed',
        thumbnail_metadata: {
          error: errorMessage,
          failedAt: new Date().toISOString()
        }
      })
      
      console.error(`[ThumbnailGeneration] 缩略图生成最终失败: ${videoId} - ${errorMessage}`)
    } catch (updateError) {
      console.error(`[ThumbnailGeneration] 更新失败状态也失败: ${videoId}`, updateError)
    }
  }

  /**
   * 重新生成缩略图（手动触发）
   */
  async regenerateThumbnail(videoId: string): Promise<void> {
    console.log(`[ThumbnailGeneration] 手动重新生成缩略图: ${videoId}`)
    
    try {
      const video = await supabaseVideoService.getVideo(videoId)
      if (!video) {
        throw new Error('视频不存在')
      }

      if (!video.video_url) {
        throw new Error('视频URL不存在')
      }

      if (video.status !== 'completed') {
        throw new Error('视频未完成，无法生成缩略图')
      }

      // 重置状态并重新生成
      await supabaseVideoService.updateVideoAsSystem(videoId, {
        thumbnail_generation_status: 'pending'
      })

      await this.onVideoCompleted(videoId, video.video_url)
    } catch (error) {
      console.error(`[ThumbnailGeneration] 手动重新生成失败: ${videoId}`, error)
      await this.markThumbnailFailed(
        videoId, 
        error instanceof Error ? error.message : '手动重新生成失败'
      )
    }
  }

  /**
   * 批量处理缺少缩略图的视频
   */
  async processMissingThumbnails(userId?: string): Promise<void> {
    console.log('[ThumbnailGeneration] 开始批量处理缺少缩略图的视频')
    
    try {
      // 查询需要生成缩略图的视频
      const result = await supabaseVideoService.getUserVideos(userId || '', {
        status: 'completed'
      })

      const videosNeedingThumbnails = result.videos.filter(video => 
        video.video_url && 
        (!video.thumbnail_url || video.thumbnail_generation_status === 'failed')
      )

      console.log(`[ThumbnailGeneration] 找到${videosNeedingThumbnails.length}个需要生成缩略图的视频`)

      // 批量处理
      for (const video of videosNeedingThumbnails) {
        await this.onVideoCompleted(video.id, video.video_url!)
        
        // 添加延迟避免过载
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error('[ThumbnailGeneration] 批量处理失败:', error)
    }
  }

  /**
   * 获取处理统计信息
   */
  getStats() {
    const tasks = Array.from(this.processingQueue.values())
    return {
      queueSize: tasks.length,
      processing: tasks.filter(t => t.status === 'processing').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      isProcessing: this.isProcessing
    }
  }
}

// 导出单例
export const thumbnailGenerationService = new ThumbnailGenerationService()
export default thumbnailGenerationService