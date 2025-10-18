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
  isRealProgress?: boolean // 标识是否为真实API进度
  isProgressStagnant?: boolean // 标识API进度是否停滞
  lastProgressValue?: number // 上次进度值
  lastProgressChangeTime?: Date // 上次进度变化时间
  // API提供商信息
  apiProvider?: 'apicore' | 'wuyin' // 使用的API提供商
  apicoreTaskId?: string // APICore任务ID
  wuyinTaskId?: string // Wuyin任务ID
  pollingAttempts?: number // 轮询次数
  lastPollingStatus?: string // 最后轮询状态
}

class ProgressManager {
  private progressMap = new Map<string, VideoProgress>()
  private subscribers = new Map<string, Set<(progress: VideoProgress) => void>>()
  private debounceTimers = new Map<string, NodeJS.Timeout>() // 防抖定时器
  private pendingSyncTasks = new Set<string>() // 待同步到数据库的任务
  private progressUpdateTimer: NodeJS.Timeout | null = null // 进度更新定时器
  
  constructor() {
    this.loadFromLocalStorage()
    this.startProgressUpdateTimer()
  }

  /**
   * 启动进度更新定时器，每2秒更新一次模拟进度
   */
  private startProgressUpdateTimer() {
    if (this.progressUpdateTimer) {
      clearInterval(this.progressUpdateTimer)
    }
    
    this.progressUpdateTimer = setInterval(async () => {
      const now = new Date()
      
      // 遍历所有处理中的任务，仅为需要模拟的任务更新进度
      for (const [videoId, progress] of this.progressMap.entries()) {
        if ((progress.status === 'processing' || progress.status === 'pending') && 
            progress.startedAt && 
            progress.progress < 99) {
          
          // 检查是否应该跳过模拟更新
          const hasRecentRealUpdate = progress.isRealProgress && 
            (now.getTime() - progress.updatedAt.getTime() < 10000)
          
          // 如果有真实API更新但未停滞，跳过模拟
          if (hasRecentRealUpdate && !progress.isProgressStagnant) {
            continue
          }
          
          // 如果API进度停滞，使用时间模拟继续增长
          if (progress.isProgressStagnant) {
            // // console.log(`[PROGRESS MANAGER] ⏰ API停滞，启用时间模拟：${videoId} 从${progress.progress}%继续`)
          }
          
          const elapsedTime = Math.floor((now.getTime() - progress.startedAt.getTime()) / 1000)
          
          // 获取视频质量信息
          let quality: 'fast' | 'pro' = 'fast'
          try {
            const { default: supabaseVideoService } = await import('./supabaseVideoService')
            const video = await supabaseVideoService.getVideo(videoId)
            quality = video?.metadata?.quality || video?.parameters?.quality || 'fast'
          } catch {
            // 使用默认值
          }
          
          let newProgress = this.calculateSmoothedProgress(elapsedTime, progress.status, quality)

          // 如果API停滞，确保进度不低于当前值
          if (progress.isProgressStagnant && newProgress < progress.progress) {
            newProgress = Math.min(progress.progress + 1, 99) // 至少增长1%
            // // console.log(`[PROGRESS MANAGER] 🚀 停滞模拟增长：${videoId} ${progress.progress}% → ${newProgress}%`)
          }

          // 🔧 FIX: 使用统一的 updateProgress 入口,确保所有进度更新都经过单调递增检查
          if (Math.abs(newProgress - progress.progress) >= 1) {
            this.updateProgress(videoId, {
              progress: newProgress,
              status: progress.status,
              elapsedTime,
              estimatedRemainingTime: this.calculateRemainingTime(elapsedTime, newProgress, quality),
              statusText: this.getProgressStatusText(newProgress, progress.status)
              // 注意: 不传递 apiProvider/taskId,让 updateProgress 知道这是时间模拟
            })
          }
        }
      }
    }, 2000) // 每2秒更新一次
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

    // 🔧 FIX: 严格的进度非回退保护 - 适用于所有进度更新
    if (data.progress !== undefined && data.progress < existing.progress && existing.progress > 5) {
      // 🔧 FIX: 判断进度来源,增强日志可读性
      const isFromAPI = !!(data.wuyinTaskId || data.apicoreTaskId || data.apiProvider);
      const source = isFromAPI ? (data.apiProvider || 'API') : 'time-simulation';

      // 记录回退详情,用于诊断移动端进度跳动问题
      const rejectReason = {
        videoId,
        source,  // 🔧 NEW: 进度来源
        attemptedProgress: data.progress,
        currentProgress: existing.progress,
        diff: existing.progress - data.progress,  // 🔧 NEW: 回退幅度
        timeSinceLastUpdate: Math.round((now.getTime() - existing.updatedAt.getTime()) / 1000) + 's'
      };
      console.log(`[PROGRESS MANAGER] 🚫 拒绝进度回退 (${source}):`, rejectReason);

      updated.progress = existing.progress // 强制保持现有进度

      // 保持其他字段的更新，只是不回退进度值
      updated.lastProgressValue = existing.lastProgressValue
      updated.lastProgressChangeTime = existing.lastProgressChangeTime
      updated.isProgressStagnant = existing.isProgressStagnant

      // 🔧 FIX: 清理 localStorage 中可能的错误值
      this.saveToLocalStorage();
    } else if (data.progress !== undefined) {
      // 正常的进度更新（增长或相等）
      if (data.wuyinTaskId || data.apicoreTaskId || data.apiProvider) {
        updated.isRealProgress = true

        // 检测API进度是否停滞
        const progressChanged = data.progress !== existing.lastProgressValue
        if (progressChanged) {
          updated.lastProgressValue = data.progress
          updated.lastProgressChangeTime = now
          updated.isProgressStagnant = false

          // 🔧 FIX: 添加详细的进度更新日志,用于诊断
          const updateDetails = {
            videoId,
            from: existing.progress,
            to: data.progress,
            source: data.apiProvider || 'unknown',
            taskId: data.wuyinTaskId || data.apicoreTaskId,
            elapsedTime: Math.round((now.getTime() - (existing.startedAt?.getTime() || now.getTime())) / 1000)
          };
          console.log(`[PROGRESS MANAGER] 📈 API进度更新:`, updateDetails);
        } else {
          // 相同进度值，检查停滞时间
          const lastChangeTime = existing.lastProgressChangeTime || existing.updatedAt
          // 确保 lastChangeTime 是 Date 对象
          const lastChangeDate = lastChangeTime instanceof Date ? lastChangeTime : new Date(lastChangeTime)
          const stagnantTime = now.getTime() - lastChangeDate.getTime()
          
          if (stagnantTime > 30000) { // 30秒停滞
            if (!existing.isProgressStagnant) {
              // // console.log(`[PROGRESS MANAGER] 🚨 检测到API进度停滞: ${videoId} ${data.progress}% 已持续 ${Math.round(stagnantTime/1000)}秒`)
            }
            updated.isProgressStagnant = true
          }
          
          updated.lastProgressValue = existing.lastProgressValue || data.progress
          updated.lastProgressChangeTime = existing.lastProgressChangeTime || now
        }
      } else {
        // console.log(`[PROGRESS MANAGER] 模拟进度更新: ${videoId} ${existing.progress}% → ${data.progress}%`)
      }
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
  async getProgressWithFallback(videoId: string, videoStatus?: string, videoQuality?: 'fast' | 'pro'): Promise<VideoProgress | null> {
    const existing = this.progressMap.get(videoId)
    
    // 如果有现有数据且未过期，更新进度并返回
    if (existing) {
      const now = new Date()
      const dataAge = now.getTime() - existing.updatedAt.getTime()
      const isExpired = dataAge > 30 * 60 * 1000 // 30分钟，延长以支持长时间任务
      
      if (!isExpired) {
        // 如果是模拟进度且状态为处理中，继续更新进度
        if ((existing.status === 'processing' || existing.status === 'pending') && existing.startedAt) {
          const elapsedTime = Math.floor((now.getTime() - existing.startedAt.getTime()) / 1000)
          
          // 获取视频质量信息用于进度计算
          let quality = videoQuality
          if (!quality) {
            try {
              const { default: supabaseVideoService } = await import('./supabaseVideoService')
              const video = await supabaseVideoService.getVideo(videoId)
              quality = video?.metadata?.quality || video?.parameters?.quality || 'fast'
            } catch {
              quality = 'fast'
            }
          }
          
          const simulatedProgress = this.calculateSmoothedProgress(elapsedTime, existing.status, quality || 'pro')
          
          // 只有进度有显著变化时才更新
          if (Math.abs(simulatedProgress - existing.progress) >= 1) {
            const updatedProgress: VideoProgress = {
              ...existing,
              progress: simulatedProgress,
              elapsedTime,
              estimatedRemainingTime: this.calculateRemainingTime(elapsedTime, simulatedProgress, quality || 'pro'),
              statusText: this.getProgressStatusText(simulatedProgress, existing.status),
              updatedAt: now
            }
            
            this.progressMap.set(videoId, updatedProgress)
            this.notifySubscribers(videoId, updatedProgress)
            
            return updatedProgress
          }
        }
        
        return existing
      } else {
        // 清理过期数据
        this.progressMap.delete(videoId)
      }
    }
    
    // 为处理中的视频提供合理的初始进度
    if (videoStatus === 'processing' || videoStatus === 'pending') {
      // 获取视频质量信息
      let quality = videoQuality
      if (!quality) {
        try {
          const { default: supabaseVideoService } = await import('./supabaseVideoService')
          const video = await supabaseVideoService.getVideo(videoId)
          quality = video?.metadata?.quality || video?.parameters?.quality || 'fast'
        } catch {
          quality = 'fast'
        }
      }
      
      const fallbackProgress: VideoProgress = {
        progress: videoStatus === 'processing' ? 15 : 5,
        status: videoStatus as 'processing' | 'pending',
        statusText: videoStatus === 'processing' ? i18n.t('videoCreator.processing') : i18n.t('videoCreator.preparing'),
        updatedAt: new Date(),
        startedAt: new Date()
      }
      
      // 将fallback进度存储到内存中
      this.progressMap.set(videoId, fallbackProgress)
      // console.log(`[PROGRESS MANAGER] Created fallback progress for ${videoId}: ${fallbackProgress.progress}% (${quality} quality)`)
      
      return fallbackProgress
    }
    
    return null
  }

  /**
   * 基于时间和质量模式计算平滑进度
   */
  private calculateSmoothedProgress(elapsedSeconds: number, status: 'processing' | 'pending', quality: 'fast' | 'pro'): number {
    if (status === 'pending') {
      // pending状态：前30秒内从5%增长到15%
      const pendingDuration = 30
      const pendingProgress = Math.min(5 + (elapsedSeconds / pendingDuration) * 10, 15)
      return Math.floor(pendingProgress)
    }
    
    // processing状态：根据质量模式使用不同的时间曲线
    const timePoints = quality === 'fast'
      ? { total: 120, stages: [[20, 25], [60, 60], [100, 90], [120, 99]] }  // 快速模式：2分钟
      : { total: 300, stages: [[60, 15], [180, 50], [240, 80], [300, 99]] } // 高质量模式：5分钟
    
    // 使用分段线性插值计算进度
    let progress = 15 // 起始进度
    
    for (let i = 0; i < timePoints.stages.length; i++) {
      const [time, targetProgress] = timePoints.stages[i]
      const prevTime = i === 0 ? 0 : timePoints.stages[i - 1][0]
      const prevProgress = i === 0 ? 15 : timePoints.stages[i - 1][1]
      
      if (elapsedSeconds <= time) {
        // 在当前时间段内，使用线性插值
        const timeRatio = (elapsedSeconds - prevTime) / (time - prevTime)
        progress = prevProgress + (targetProgress - prevProgress) * timeRatio
        break
      }
    }
    
    // 添加小幅随机波动，模拟真实API响应
    const randomVariation = (Math.random() - 0.5) * 2 // ±1%的随机变化
    progress = Math.max(5, Math.min(99, progress + randomVariation))
    
    return Math.floor(progress)
  }

  /**
   * 计算剩余时间
   */
  private calculateRemainingTime(elapsedSeconds: number, currentProgress: number, quality: 'fast' | 'pro'): number {
    const expectedTotalTime = quality === 'fast' ? 120 : 300 // 秒
    
    if (currentProgress <= 5) return expectedTotalTime
    if (currentProgress >= 95) return Math.max(10, expectedTotalTime - elapsedSeconds)
    
    // 基于当前进度估算剩余时间
    const estimatedTotal = (elapsedSeconds / currentProgress) * 100
    const remaining = Math.max(0, estimatedTotal - elapsedSeconds)
    
    // 限制剩余时间不超过预期总时间
    return Math.min(remaining, expectedTotalTime - elapsedSeconds)
  }

  /**
   * 根据进度获取状态文本
   */
  private getProgressStatusText(progress: number, status: 'processing' | 'pending'): string {
    if (status === 'pending') return i18n.t('videoCreator.preparing')
    
    if (progress < 30) return i18n.t('videoCreator.generating')
    if (progress < 70) return i18n.t('videoCreator.processing') 
    if (progress < 95) return i18n.t('videoCreator.almostComplete')
    return i18n.t('videoCreator.finalizing')
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
        // console.log(`[PROGRESS MANAGER] Expired progress data for ${videoId}, age: ${Math.round(dataAge/1000)}s`)
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
          // console.error('[PROGRESS MANAGER] Error in subscriber callback:', error)
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
    // console.log(`[PROGRESS MANAGER] Cleared progress for ${videoId}`)
  }

  /**
   * 停止进度更新定时器
   */
  stopProgressUpdateTimer() {
    if (this.progressUpdateTimer) {
      clearInterval(this.progressUpdateTimer)
      this.progressUpdateTimer = null
      // console.log(`[PROGRESS MANAGER] Progress update timer stopped`)
    }
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
    // console.log(`[PROGRESS MANAGER] 🔄 启动状态同步检查定时器`)
    
    // 每30秒检查一次状态一致性
    const syncInterval = setInterval(async () => {
      try {
        const result = await this.validateStateConsistency(userId)
        if (result.fixed > 0) {
          // console.log(`[PROGRESS MANAGER] 🔧 定期同步修复了 ${result.fixed} 个状态不一致`)
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
      // console.log(`[PROGRESS MANAGER] 🔒 状态同步定时器已停止`)
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
   * 🔧 FIX: 增强验证机制,避免移动端加载过期数据导致进度跳动
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
            startedAt: progressData.startedAt ? new Date(progressData.startedAt) : undefined,
            lastProgressChangeTime: progressData.lastProgressChangeTime ? new Date(progressData.lastProgressChangeTime) : undefined
          }

          // 🔧 FIX: 更严格的过期检查 - 移动端30分钟内数据才有效
          const now = Date.now();
          const dataAge = now - progress.updatedAt.getTime();
          const maxAge = 30 * 60 * 1000; // 30分钟

          // 检查进度值的合理性
          const isProgressValid = progress.progress >= 0 && progress.progress <= 100;
          const isNotExpired = dataAge < maxAge;
          const isActiveStatus = progress.status === 'processing' || progress.status === 'pending';

          if (isProgressValid && isNotExpired && isActiveStatus) {
            this.progressMap.set(videoId, progress)
            console.log(`[PROGRESS MANAGER] ✅ 从 localStorage 恢复: ${videoId} (${progress.progress}%, age: ${Math.round(dataAge/1000)}s)`)
          } else {
            const skipReason = !isProgressValid ? '进度值无效' :
                              !isNotExpired ? '数据过期' :
                              !isActiveStatus ? '状态非处理中' : '未知原因';
            console.log(`[PROGRESS MANAGER] ⏭️ 跳过 localStorage 数据: ${videoId} (${skipReason}, progress: ${progress.progress}%, age: ${Math.round(dataAge/1000)}s)`);
          }
        }
      }
    } catch (error) {
      console.error('[PROGRESS MANAGER] Failed to load from localStorage:', error)
    }
  }

  /**
   * 保存进度数据到 localStorage
   * 🔧 FIX: 添加二次验证,确保只保存有效的进度数据
   */
  private saveToLocalStorage() {
    try {
      const data: Record<string, any> = {}
      let savedCount = 0;
      let skippedCount = 0;

      for (const [videoId, progress] of this.progressMap.entries()) {
        // 只保存处理中和等待中的任务
        if (progress.status === 'processing' || progress.status === 'pending') {
          // 🔧 FIX: 验证进度值的合理性
          const isProgressValid = progress.progress >= 0 && progress.progress <= 100;
          const hasValidTimestamp = progress.updatedAt && !isNaN(progress.updatedAt.getTime());

          if (isProgressValid && hasValidTimestamp) {
            data[videoId] = {
              ...progress,
              updatedAt: progress.updatedAt.toISOString(),
              startedAt: progress.startedAt?.toISOString(),
              lastProgressChangeTime: progress.lastProgressChangeTime?.toISOString()
            }
            savedCount++;
          } else {
            console.warn(`[PROGRESS MANAGER] ⚠️ 跳过无效进度保存: ${videoId} (progress: ${progress.progress}, timestamp: ${hasValidTimestamp})`);
            skippedCount++;
          }
        }
      }

      localStorage.setItem('videoProgress', JSON.stringify(data))

      if (savedCount > 0 || skippedCount > 0) {
        console.log(`[PROGRESS MANAGER] 💾 localStorage 保存完成: ${savedCount}个有效, ${skippedCount}个跳过`);
      }
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
        wuyinTaskId: progress.wuyinTaskId,
        apicoreTaskId: progress.apicoreTaskId,
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
    // console.log(`[PROGRESS MANAGER] 💾 开始批量同步 ${this.pendingSyncTasks.size} 个任务到数据库`)
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
    // console.log(`[PROGRESS MANAGER] ✅ 批量同步完成`)
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
    // 避免未使用参数警告
    void userId
    // console.log(`[PROGRESS MANAGER] 🔍 开始状态一致性检查...`)
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
            // console.log(`[PROGRESS MANAGER] 🧹 清理已删除视频的进度数据: ${videoId}`)
            this.clearProgress(videoId)
            result.fixed++
            continue
          }
          
          // 检查状态一致性
          const dbStatus = dbVideo.status
          const memStatus = progress.status
          
          if (dbStatus !== memStatus) {
            // console.log(`[PROGRESS MANAGER] 🔄 状态不一致: ${videoId} 内存[${memStatus}] vs 数据库[${dbStatus}]`)
            
            // 如果数据库显示已完成但内存还在处理中
            if (dbStatus === 'completed' && (memStatus === 'processing' || memStatus === 'pending')) {
              if (dbVideo.video_url) {
                // console.log(`[PROGRESS MANAGER] ✅ 同步完成状态: ${videoId}`)
                this.markAsCompleted(videoId, dbVideo.video_url)
                result.fixed++
              }
            }
            // 如果数据库显示失败但内存还在处理中
            else if (dbStatus === 'failed' && (memStatus === 'processing' || memStatus === 'pending')) {
              // console.log(`[PROGRESS MANAGER] ❌ 同步失败状态: ${videoId}`)
              this.markAsFailed(videoId, dbVideo.error_message || '任务失败')
              result.fixed++
            }
          }
          
        } catch (error) {
          const errorMsg = `State check failed for ${String(videoId)}: ${String(error)}`
          console.error(`[PROGRESS MANAGER] ❌ 状态检查出错:`, errorMsg)
          result.errors.push(errorMsg)
        }
      }
      
      // console.log(`[PROGRESS MANAGER] ✅ 状态一致性检查完成: 检查${result.checked}个，修复${result.fixed}个，错误${result.errors.length}个`)
      
    } catch (error) {
      const errorMsg = `State consistency check failed: ${String(error)}`
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
            wuyinTaskId: progressData.wuyinTaskId,
            apicoreTaskId: progressData.apicoreTaskId,
            pollingAttempts: progressData.pollingState?.attempts,
            lastPollingStatus: progressData.pollingState?.lastStatus,
            lastProgressChangeTime: progressData.lastProgressChangeTime ? new Date(progressData.lastProgressChangeTime) : undefined
          }
          
          // 检查数据是否过期（2小时）
          const isExpired = Date.now() - progress.updatedAt.getTime() > 2 * 60 * 60 * 1000
          if (!isExpired) {
            this.progressMap.set(video.id, progress)
            restoredCount++
            // console.log(`[PROGRESS MANAGER] Restored from database: ${video.id} (${progress.progress}%)`)
          }
        }
      }
      
      // console.log(`[PROGRESS MANAGER] Restored ${restoredCount} tasks from database`)
      return restoredCount
    } catch (error) {
      // console.error('[PROGRESS MANAGER] Failed to restore from database:', error)
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