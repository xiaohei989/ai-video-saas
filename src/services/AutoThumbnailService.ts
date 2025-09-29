/**
 * 自动缩略图补充服务
 * 在页面加载后静默检测并生成缺失的视频缩略图
 */

import { supabaseVideoService } from './supabaseVideoService'
import { supabase } from '@/lib/supabase'

interface Video {
  id: string
  status: string
  video_url: string | null
  thumbnail_url: string | null
  title?: string
  created_at: string
}

interface ProcessingStats {
  total: number
  processed: number
  succeeded: number
  failed: number
  skipped: number
}

class AutoThumbnailService {
  private isProcessing = false
  private processingVideos = new Set<string>()
  private maxConcurrent = 5 // 桌面端默认并发数
  private processingDelay = 2000 // 处理间隔2秒
  
  constructor() {
    // 检测移动端，降低并发数
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (isMobile) {
      this.maxConcurrent = 3
      this.processingDelay = 3000 // 移动端延长间隔
    }
  }

  /**
   * 检测并自动补充缺失的缩略图
   * @param userId 用户ID
   * @param videoList 当前视频列表（可选，用于避免重复查询）
   * @returns Promise<ProcessingStats>
   */
  async autoFillMissingThumbnails(
    userId: string,
    videoList?: Video[]
  ): Promise<ProcessingStats> {
    if (this.isProcessing) {
      return { total: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0 }
    }

    this.isProcessing = true
    
    const stats: ProcessingStats = {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    }

    try {
      
      // 获取需要处理的视频列表
      const videosToProcess = await this.getVideosNeedingThumbnails(userId, videoList)
      
      if (videosToProcess.length === 0) {
        return stats
      }

      stats.total = videosToProcess.length

      // 按创建时间排序，优先处理最新的视频
      videosToProcess.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // 分批处理，避免一次性处理太多
      const batchSize = Math.min(this.maxConcurrent, videosToProcess.length)
      const batches = this.chunkArray(videosToProcess, batchSize)

      for (const batch of batches) {
        const batchPromises = batch.map(video => this.processSingleVideo(video, stats))
        
        try {
          await Promise.allSettled(batchPromises)
        } catch (error) {
        }

        // 批次间添加延迟，避免性能影响
        if (batches.indexOf(batch) < batches.length - 1) {
          await this.delay(this.processingDelay)
        }
      }

      
    } catch (error) {
    } finally {
      this.isProcessing = false
      this.processingVideos.clear()
    }

    return stats
  }

  /**
   * 获取需要生成缩略图的视频列表
   */
  private async getVideosNeedingThumbnails(
    userId: string,
    videoList?: Video[]
  ): Promise<Video[]> {
    let videos: Video[]

    if (videoList && videoList.length > 0) {
      // 使用传入的视频列表
      videos = videoList
    } else {
      // 从数据库查询
      const { data, error } = await supabase
        .from('videos')
        .select('id, status, video_url, thumbnail_url, title, created_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20) // 限制查询数量

      if (error) {
        return []
      }

      videos = data || []
    }

    // 筛选需要生成缩略图的视频
    return videos.filter(video => this.needsThumbnail(video))
  }

  /**
   * 判断视频是否需要生成缩略图
   */
  private needsThumbnail(video: Video): boolean {
    // 必须是已完成状态且有视频URL
    if (video.status !== 'completed' || !video.video_url) {
      return false
    }

    // 没有缩略图URL
    if (!video.thumbnail_url) {
      return true
    }

    // 排除SVG占位符
    if (video.thumbnail_url.startsWith('data:image/svg+xml')) {
      return true
    }

    return false
  }

  /**
   * 处理单个视频的缩略图生成
   */
  private async processSingleVideo(video: Video, stats: ProcessingStats): Promise<void> {
    if (this.processingVideos.has(video.id)) {
      stats.skipped++
      return
    }

    this.processingVideos.add(video.id)

    try {
      
      const success = await supabaseVideoService.autoGenerateThumbnailOnComplete(video as any)
      
      if (success) {
        stats.succeeded++
      } else {
        stats.failed++
      }
      
    } catch (error) {
      stats.failed++
    } finally {
      stats.processed++
      this.processingVideos.delete(video.id)
    }
  }

  /**
   * 数组分块工具函数
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * 延迟工具函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取当前处理状态
   */
  getProcessingStatus(): {
    isProcessing: boolean
    processingCount: number
    maxConcurrent: number
  } {
    return {
      isProcessing: this.isProcessing,
      processingCount: this.processingVideos.size,
      maxConcurrent: this.maxConcurrent
    }
  }

  /**
   * 停止所有处理任务
   */
  stop(): void {
    this.isProcessing = false
    this.processingVideos.clear()
  }
}

// 创建单例实例
export const autoThumbnailService = new AutoThumbnailService()

export default autoThumbnailService