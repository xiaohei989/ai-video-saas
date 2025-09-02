/**
 * 视频生成进度管理器
 * 在内存中管理进度数据，避免频繁的数据库操作
 */

import i18n from '@/i18n/config'

export interface VideoProgress {
  progress: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  statusText?: string
  updatedAt: Date
  videoUrl?: string
  error?: string
  startedAt?: Date
  elapsedTime?: number // 秒
  estimatedRemainingTime?: number // 秒
  // API提供商信息
  apiProvider?: 'qingyun' | 'apicore' // 使用的API提供商
  qingyunTaskId?: string // 青云API任务ID
  apicoreTaskId?: string // APICore任务ID
  pollingAttempts?: number // 轮询次数
  lastPollingStatus?: string // 最后轮询状态
}

class ProgressManager {
  private progressMap = new Map<string, VideoProgress>()
  private subscribers = new Map<string, Set<(progress: VideoProgress) => void>>()
  private debounceTimers = new Map<string, NodeJS.Timeout>() // 防抖定时器
  private pendingSyncTasks = new Set<string>() // 待同步到数据库的任务
  
  constructor() {
    this.loadFromLocalStorage()
  }

  /**
   * 更新视频进度
   */
  updateProgress(videoId: string, data: Partial<VideoProgress>) {
    const now = new Date()
    const existing = this.progressMap.get(videoId) || {
      progress: 0,
      status: 'pending' as const,
      updatedAt: now,
      startedAt: now
    }

    // 如果是第一次设置或状态从 pending 变为其他状态，记录开始时间
    const startedAt = existing.startedAt || (data.status && data.status !== 'pending' ? now : existing.startedAt)
    
    // 计算耗时
    const elapsedTime = startedAt ? Math.round((now.getTime() - startedAt.getTime()) / 1000) : 0
    
    // 估计剩余时间（基于当前进度）
    let estimatedRemainingTime: number | undefined
    if (data.progress && data.progress > 0 && data.progress < 100 && elapsedTime > 0) {
      const estimatedTotal = (elapsedTime / data.progress) * 100
      estimatedRemainingTime = Math.max(0, Math.round(estimatedTotal - elapsedTime))
    }

    const updated: VideoProgress = {
      ...existing,
      ...data,
      updatedAt: now,
      startedAt,
      elapsedTime,
      estimatedRemainingTime
    }

    this.progressMap.set(videoId, updated)
    
    // 立即保存到 localStorage
    this.saveToLocalStorage()
    
    // 检查是否需要同步到数据库（重要状态变化或进度变化超过5%）
    const shouldSyncToDatabase = 
      data.status === 'completed' || data.status === 'failed' || // 最终状态立即同步
      data.status !== existing.status || // 状态变化
      (data.progress && Math.abs(data.progress - existing.progress) >= 5) || // 进度变化超过5%
      !existing.updatedAt || // 新建任务
      (now.getTime() - existing.updatedAt.getTime()) > 30000 // 超过30秒未同步

    if (shouldSyncToDatabase) {
      if (data.status === 'completed' || data.status === 'failed') {
        // 最终状态立即同步，不使用防抖
        this.saveToDatabase(videoId)
      } else {
        // 其他情况使用防抖
        this.debouncedSaveToDatabase(videoId)
      }
    }
    
    // 通知订阅者
    this.notifySubscribers(videoId, updated)
    
    console.log(`[PROGRESS MANAGER] Updated ${videoId}: ${updated.progress}% (${updated.status}) - Elapsed: ${elapsedTime}s`)
  }

  /**
   * 获取视频进度
   */
  getProgress(videoId: string): VideoProgress | null {
    return this.progressMap.get(videoId) || null
  }

  /**
   * 智能获取视频进度，为处理中的视频提供合理的默认值
   */
  getProgressWithFallback(videoId: string, videoStatus?: string): VideoProgress | null {
    const existing = this.progressMap.get(videoId)
    
    // 如果有现有数据且未过期，返回现有数据
    if (existing) {
      const now = new Date()
      const dataAge = now.getTime() - existing.updatedAt.getTime()
      const isExpired = dataAge > 30 * 60 * 1000 // 30分钟，延长以支持长时间任务
      
      if (!isExpired) {
        return existing
      } else {
        // 清理过期数据
        this.progressMap.delete(videoId)
      }
    }
    
    // 为处理中的视频提供合理的初始进度
    if (videoStatus === 'processing' || videoStatus === 'pending') {
      const fallbackProgress: VideoProgress = {
        progress: videoStatus === 'processing' ? 15 : 5, // processing: 15%, pending: 5%
        status: videoStatus as 'processing' | 'pending',
        statusText: videoStatus === 'processing' ? i18n.t('videoCreator.processing') : i18n.t('videoCreator.preparing'),
        updatedAt: new Date(),
        startedAt: new Date()
      }
      
      // 将fallback进度存储到内存中
      this.progressMap.set(videoId, fallbackProgress)
      console.log(`[PROGRESS MANAGER] Created fallback progress for ${videoId}: ${fallbackProgress.progress}%`)
      
      return fallbackProgress
    }
    
    return null
  }

  /**
   * 订阅视频进度更新
   */
  subscribe(videoId: string, callback: (progress: VideoProgress) => void): () => void {
    if (!this.subscribers.has(videoId)) {
      this.subscribers.set(videoId, new Set())
    }
    
    this.subscribers.get(videoId)!.add(callback)
    
    // 如果已有进度数据，检查是否有效并立即调用回调
    const existing = this.progressMap.get(videoId)
    if (existing) {
      // 检查数据是否过期（超过30分钟视为过期）
      const now = new Date()
      const dataAge = now.getTime() - existing.updatedAt.getTime()
      const isExpired = dataAge > 30 * 60 * 1000 // 30分钟，延长以支持长时间任务
      
      if (!isExpired) {
        callback(existing)
      } else {
        console.log(`[PROGRESS MANAGER] Expired progress data for ${videoId}, age: ${Math.round(dataAge/1000)}s`)
        // 清理过期数据
        this.progressMap.delete(videoId)
      }
    }
    
    // 返回取消订阅函数
    return () => {
      const subs = this.subscribers.get(videoId)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) {
          this.subscribers.delete(videoId)
        }
      }
    }
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(videoId: string, progress: VideoProgress) {
    const subscribers = this.subscribers.get(videoId)
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(progress)
        } catch (error) {
          console.error('[PROGRESS MANAGER] Error in subscriber callback:', error)
        }
      })
    }
  }

  /**
   * 清理完成或失败的视频进度
   */
  clearProgress(videoId: string) {
    this.progressMap.delete(videoId)
    this.subscribers.delete(videoId)
    console.log(`[PROGRESS MANAGER] Cleared progress for ${videoId}`)
  }

  /**
   * 批量设置视频为完成状态
   */
  markAsCompleted(videoId: string, videoUrl?: string) {
    this.updateProgress(videoId, {
      status: 'completed',
      progress: 100,
      videoUrl,
      statusText: i18n.t('videoCreator.completed')
    })
    
    // 不要立即清理进度数据，让UI有时间更新
    // 延迟清理，给UI更多时间来响应状态变化
    setTimeout(() => {
      console.log(`[PROGRESS MANAGER] Delayed cleanup for completed video: ${videoId}`)
      this.clearProgress(videoId)
    }, 5000) // 减少到5秒，但确保UI先更新
  }

  /**
   * 标记为失败
   */
  markAsFailed(videoId: string, error: string) {
    this.updateProgress(videoId, {
      status: 'failed',
      progress: 0,
      error
    })
    
    // 延迟清理
    setTimeout(() => {
      this.clearProgress(videoId)
    }, 10000)
  }

  /**
   * 定期清理过期数据（1小时）
   */
  startCleanupTimer() {
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - 60 * 60 * 1000) // 1小时前
      
      for (const [videoId, progress] of this.progressMap.entries()) {
        if (progress.updatedAt < cutoffTime) {
          this.clearProgress(videoId)
        }
      }
    }, 300000) // 每5分钟清理一次
  }

  /**
   * 启动状态同步检查定时器
   */
  startStateSyncTimer(userId: string) {
    console.log(`[PROGRESS MANAGER] 🔄 启动状态同步检查定时器`)
    
    // 每30秒检查一次状态一致性
    const syncInterval = setInterval(async () => {
      try {
        const result = await this.validateStateConsistency(userId)
        if (result.fixed > 0) {
          console.log(`[PROGRESS MANAGER] 🔧 定期同步修复了 ${result.fixed} 个状态不一致`)
        }
      } catch (error) {
        console.error(`[PROGRESS MANAGER] ❌ 定期状态同步检查失败:`, error)
      }
    }, 30000)

    // 保存定时器引用以便清理
    if (typeof window !== 'undefined') {
      (window as any).__progressSyncTimer = syncInterval
    }
    
    return () => {
      clearInterval(syncInterval)
      console.log(`[PROGRESS MANAGER] 🔒 状态同步定时器已停止`)
    }
  }

  /**
   * 获取所有活跃的进度
   */
  getAllActiveProgress(): Map<string, VideoProgress> {
    return new Map(this.progressMap)
  }

  /**
   * 从 localStorage 加载进度数据
   */
  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('videoProgress')
      if (stored) {
        const data = JSON.parse(stored) as Record<string, any>
        
        // 转换数据并检查是否过期
        for (const [videoId, progressData] of Object.entries(data)) {
          const progress: VideoProgress = {
            ...progressData,
            updatedAt: new Date(progressData.updatedAt),
            startedAt: progressData.startedAt ? new Date(progressData.startedAt) : undefined
          }
          
          // 检查数据是否过期（2小时，延长以支持长时间任务）
          const isExpired = Date.now() - progress.updatedAt.getTime() > 2 * 60 * 60 * 1000
          if (!isExpired && (progress.status === 'processing' || progress.status === 'pending')) {
            this.progressMap.set(videoId, progress)
            console.log(`[PROGRESS MANAGER] Restored from localStorage: ${videoId} (${progress.progress}%)`)
          }
        }
      }
    } catch (error) {
      console.error('[PROGRESS MANAGER] Failed to load from localStorage:', error)
    }
  }

  /**
   * 保存进度数据到 localStorage
   */
  private saveToLocalStorage() {
    try {
      const data: Record<string, any> = {}
      for (const [videoId, progress] of this.progressMap.entries()) {
        // 只保存处理中和等待中的任务
        if (progress.status === 'processing' || progress.status === 'pending') {
          data[videoId] = {
            ...progress,
            updatedAt: progress.updatedAt.toISOString(),
            startedAt: progress.startedAt?.toISOString()
          }
        }
      }
      localStorage.setItem('videoProgress', JSON.stringify(data))
    } catch (error) {
      console.error('[PROGRESS MANAGER] Failed to save to localStorage:', error)
    }
  }

  /**
   * 防抖保存到数据库
   */
  private debouncedSaveToDatabase(videoId: string) {
    // 清除之前的定时器
    if (this.debounceTimers.has(videoId)) {
      clearTimeout(this.debounceTimers.get(videoId)!)
    }
    
    // 设置新的定时器
    const timer = setTimeout(() => {
      this.saveToDatabase(videoId)
      this.debounceTimers.delete(videoId)
    }, 5000) // 5秒防抖
    
    this.debounceTimers.set(videoId, timer)
    this.pendingSyncTasks.add(videoId)
  }

  /**
   * 保存进度数据到数据库
   */
  private async saveToDatabase(videoId: string) {
    try {
      const progress = this.progressMap.get(videoId)
      if (!progress) return

      // 动态导入 supabaseVideoService 避免循环依赖
      const { default: supabaseVideoService } = await import('./supabaseVideoService')
      
      // 构建进度数据
      const progressData = {
        percentage: progress.progress,
        statusText: progress.statusText,
        lastUpdate: progress.updatedAt.toISOString(),
        elapsedTime: progress.elapsedTime,
        estimatedDuration: progress.estimatedRemainingTime ? progress.elapsedTime! + progress.estimatedRemainingTime : undefined,
        qingyunTaskId: progress.qingyunTaskId,
        pollingState: {
          attempts: progress.pollingAttempts,
          lastStatus: progress.lastPollingStatus
        }
      }

      // 获取当前视频数据
      const video = await supabaseVideoService.getVideo(videoId)
      if (video) {
        const updatedMetadata = {
          ...video.metadata,
          progressData
        }

        // 更新数据库
        await supabaseVideoService.updateVideo(videoId, { metadata: updatedMetadata })
        console.log(`[PROGRESS MANAGER] Saved to database: ${videoId} (${progress.progress}%)`)
        
        this.pendingSyncTasks.delete(videoId)
      }
    } catch (error) {
      console.error(`[PROGRESS MANAGER] Failed to save to database: ${videoId}`, error)
    }
  }

  /**
   * 立即保存所有待同步的任务到数据库
   */
  async flushToDatabase() {
    console.log(`[PROGRESS MANAGER] 💾 开始批量同步 ${this.pendingSyncTasks.size} 个任务到数据库`)
    const promises: Promise<void>[] = []
    for (const videoId of this.pendingSyncTasks) {
      // 清除防抖定时器
      if (this.debounceTimers.has(videoId)) {
        clearTimeout(this.debounceTimers.get(videoId)!)
        this.debounceTimers.delete(videoId)
      }
      promises.push(this.saveToDatabase(videoId))
    }
    
    await Promise.all(promises)
    console.log(`[PROGRESS MANAGER] ✅ 批量同步完成`)
  }

  /**
   * 状态一致性检查和修复机制
   * 确保内存、数据库、API三层状态同步
   */
  async validateStateConsistency(userId: string): Promise<{
    checked: number
    fixed: number
    errors: string[]
  }> {
    console.log(`[PROGRESS MANAGER] 🔍 开始状态一致性检查...`)
    const result = { checked: 0, fixed: 0, errors: [] }
    
    try {
      // 动态导入避免循环依赖
      const { default: supabaseVideoService } = await import('./supabaseVideoService')
      
      // 检查内存中的所有进度数据
      for (const [videoId, progress] of this.progressMap.entries()) {
        result.checked++
        
        try {
          // 获取数据库中的最新状态
          const dbVideo = await supabaseVideoService.getVideo(videoId)
          
          if (!dbVideo) {
            console.log(`[PROGRESS MANAGER] 🧹 清理已删除视频的进度数据: ${videoId}`)
            this.clearProgress(videoId)
            result.fixed++
            continue
          }
          
          // 检查状态一致性
          const dbStatus = dbVideo.status
          const memStatus = progress.status
          
          if (dbStatus !== memStatus) {
            console.log(`[PROGRESS MANAGER] 🔄 状态不一致: ${videoId} 内存[${memStatus}] vs 数据库[${dbStatus}]`)
            
            // 如果数据库显示已完成但内存还在处理中
            if (dbStatus === 'completed' && (memStatus === 'processing' || memStatus === 'pending')) {
              if (dbVideo.video_url) {
                console.log(`[PROGRESS MANAGER] ✅ 同步完成状态: ${videoId}`)
                this.markAsCompleted(videoId, dbVideo.video_url)
                result.fixed++
              }
            }
            // 如果数据库显示失败但内存还在处理中
            else if (dbStatus === 'failed' && (memStatus === 'processing' || memStatus === 'pending')) {
              console.log(`[PROGRESS MANAGER] ❌ 同步失败状态: ${videoId}`)
              this.markAsFailed(videoId, dbVideo.error_message || '任务失败')
              result.fixed++
            }
          }
          
        } catch (error) {
          const errorMsg = `State check failed for ${videoId}: ${error}`
          console.error(`[PROGRESS MANAGER] ❌ 状态检查出错:`, errorMsg)
          result.errors.push(errorMsg)
        }
      }
      
      console.log(`[PROGRESS MANAGER] ✅ 状态一致性检查完成: 检查${result.checked}个，修复${result.fixed}个，错误${result.errors.length}个`)
      
    } catch (error) {
      const errorMsg = `State consistency check failed: ${error}`
      console.error(`[PROGRESS MANAGER] 💥 状态一致性检查失败:`, errorMsg)
      result.errors.push(errorMsg)
    }
    
    return result
  }

  /**
   * 从数据库恢复进度数据
   */
  async restoreFromDatabase(userId: string) {
    try {
      // 动态导入避免循环依赖
      const { default: supabaseVideoService } = await import('./supabaseVideoService')
      
      // 获取用户所有处理中的视频
      const result = await supabaseVideoService.getUserVideos(userId, {
        status: 'processing'
      })
      
      const processingVideos = result.videos
      
      // 也检查 pending 状态的视频
      const pendingResult = await supabaseVideoService.getUserVideos(userId, {
        status: 'pending'  
      })
      
      const allVideos = [...processingVideos, ...pendingResult.videos]
      
      let restoredCount = 0
      for (const video of allVideos) {
        if (video.metadata?.progressData) {
          const progressData = video.metadata.progressData
          const progress: VideoProgress = {
            progress: progressData.percentage || 0,
            status: video.status as VideoProgress['status'],
            statusText: progressData.statusText || (video.status === 'processing' ? i18n.t('videoCreator.processing') : i18n.t('videoCreator.preparing')),
            updatedAt: new Date(progressData.lastUpdate),
            startedAt: video.processing_started_at ? new Date(video.processing_started_at) : new Date(),
            elapsedTime: progressData.elapsedTime,
            estimatedRemainingTime: progressData.estimatedDuration ? progressData.estimatedDuration - progressData.elapsedTime! : undefined,
            qingyunTaskId: progressData.qingyunTaskId,
            pollingAttempts: progressData.pollingState?.attempts,
            lastPollingStatus: progressData.pollingState?.lastStatus
          }
          
          // 检查数据是否过期（2小时）
          const isExpired = Date.now() - progress.updatedAt.getTime() > 2 * 60 * 60 * 1000
          if (!isExpired) {
            this.progressMap.set(video.id, progress)
            restoredCount++
            console.log(`[PROGRESS MANAGER] Restored from database: ${video.id} (${progress.progress}%)`)
          }
        }
      }
      
      console.log(`[PROGRESS MANAGER] Restored ${restoredCount} tasks from database`)
      return restoredCount
    } catch (error) {
      console.error('[PROGRESS MANAGER] Failed to restore from database:', error)
      return 0
    }
  }
}

// 导出单例实例
export const progressManager = new ProgressManager()

// 启动清理定时器
progressManager.startCleanupTimer()

// 监听页面关闭事件，立即保存所有待同步的数据
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // 同步调用，确保数据保存
    progressManager.flushToDatabase()
  })

  // 监听页面可见性变化
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // 页面隐藏时保存数据
      progressManager.flushToDatabase()
    }
  })
}

export default progressManager