/**
 * 视频生成队列管理服务
 * 负责管理视频生成任务的队列、并发限制和调度
 */

import { supabase } from '@/lib/supabase'
import supabaseVideoService from './supabaseVideoService'
import creditService from './creditService'
import redisCacheIntegrationService from './RedisCacheIntegrationService'
import type { Database } from '@/lib/supabase'

type Video = Database['public']['Tables']['videos']['Row']
type SubscriptionTier = 'free' | 'basic' | 'pro' | 'premium' | 'basic-annual' | 'pro-annual' | 'enterprise-annual'

// 将年度计划映射到对应的基础计划以获取并发限制
const mapAnnualToBaseTier = (tier: SubscriptionTier): SubscriptionTier => {
  if (tier === 'basic-annual') return 'basic'
  if (tier === 'pro-annual') return 'pro'  
  if (tier === 'enterprise-annual') return 'premium'
  return tier
}

export interface QueueJob {
  id: string
  userId: string
  videoRecordId: string
  priority: number
  queuedAt: Date
  estimatedWaitMinutes?: number
}

export interface SubmitJobRequest {
  userId: string
  videoData: {
    templateId?: string
    title?: string
    description?: string
    prompt?: string
    parameters?: Record<string, any>
    creditsUsed: number
    isPublic?: boolean
  }
  priority?: number
}

export interface SubmitJobResult {
  status: 'processing' | 'queued'
  videoRecordId: string
  queuePosition?: number
  estimatedWaitMinutes?: number
}

export interface UserSubmitStatus {
  canSubmit: boolean
  reason?: string
  activeCount?: number
  maxAllowed?: number
  tier?: SubscriptionTier
}

class VideoQueueService {
  private systemMaxConcurrent: number
  private queueCheckInterval: number
  private intervalId?: NodeJS.Timeout
  
  // 用户并发限制配置
  private userConcurrentLimits: Record<SubscriptionTier, number> = {
    free: 1,
    basic: 3,
    pro: 5,
    premium: 10
  }

  // 内存队列状态（启动时从数据库恢复）
  private queuedJobs = new Map<string, QueueJob>()
  private activeJobs = new Map<string, string>() // jobId -> userId

  constructor() {
    // 从环境变量读取配置
    this.systemMaxConcurrent = parseInt(process.env.VITE_SYSTEM_MAX_CONCURRENT_VIDEOS || '20')
    this.queueCheckInterval = parseInt(process.env.VITE_QUEUE_CHECK_INTERVAL || '5000')
    
    // 读取用户并发限制配置（如果有环境变量覆盖）
    this.userConcurrentLimits.free = parseInt(process.env.VITE_USER_CONCURRENT_FREE || '1')
    this.userConcurrentLimits.basic = parseInt(process.env.VITE_USER_CONCURRENT_BASIC || '3')
    this.userConcurrentLimits.pro = parseInt(process.env.VITE_USER_CONCURRENT_PRO || '5')
    this.userConcurrentLimits.premium = parseInt(process.env.VITE_USER_CONCURRENT_PREMIUM || '10')

  }

  /**
   * 初始化队列服务（从数据库恢复状态）
   */
  async initialize(): Promise<void> {
    try {
      
      // 检查数据库是否支持队列功能
      const hasQueueSupport = await this.checkQueueSupport()
      
      if (!hasQueueSupport) {
        console.warn('[QUEUE SERVICE] Database does not support queue features yet. Running in fallback mode.')
        // 仍然启动队列处理器，但不从数据库恢复状态
        this.startQueueProcessor()
        return
      }
      
      // 恢复处理中的任务
      await this.restoreActiveJobs()
      
      // 恢复排队中的任务
      await this.restoreQueuedJobs()
      
      // 启动队列处理定时器
      this.startQueueProcessor()
      
    } catch (error) {
      console.error('[QUEUE SERVICE] Failed to initialize:', error)
      console.log('[QUEUE SERVICE] Starting in fallback mode...')
      this.startQueueProcessor()
    }
  }

  /**
   * 检查数据库是否支持队列功能
   */
  private async checkQueueSupport(): Promise<boolean> {
    try {
      // 尝试查询队列字段
      const { error } = await supabase
        .from('videos')
        .select('queue_position')
        .limit(1)

      // 如果没有错误，说明字段存在
      if (!error) {
        return true
      }

      // 检查是否是字段不存在的错误
      if (error.code === '42703' || error.message?.includes('does not exist')) {
        console.warn('[QUEUE SERVICE] Queue fields not found in database')
        return false
      }

      // 其他错误也认为不支持
      console.warn('[QUEUE SERVICE] Database query error:', error)
      return false
    } catch (error) {
      console.warn('[QUEUE SERVICE] Failed to check queue support:', error)
      return false
    }
  }

  /**
   * 恢复处理中的任务状态
   */
  private async restoreActiveJobs(): Promise<void> {
    try {
      const { data: activeVideos, error } = await supabase
        .from('videos')
        .select('id, user_id')
        .eq('status', 'processing')
        .eq('is_deleted', false)

      if (error) {
        console.error('[QUEUE SERVICE] Failed to restore active jobs:', error)
        return
      }

      if (activeVideos) {
        for (const video of activeVideos) {
          this.activeJobs.set(video.id, video.user_id)
        }
      }
    } catch (error) {
      console.error('[QUEUE SERVICE] Error restoring active jobs:', error)
    }
  }

  /**
   * 恢复排队中的任务状态
   */
  private async restoreQueuedJobs(): Promise<void> {
    try {
      const { data: queuedVideos, error } = await supabase
        .from('videos')
        .select('id, user_id, queue_position, queue_entered_at')
        .eq('status', 'pending')
        .eq('is_deleted', false)
        .not('queue_position', 'is', null)
        .order('queue_position')

      if (error) {
        // 如果是字段不存在的错误，静默处理
        if (error.code === '42703' || error.message?.includes('does not exist')) {
          console.log('[QUEUE SERVICE] Queue fields not available, skipping queued jobs restoration')
          return
        }
        console.error('[QUEUE SERVICE] Failed to restore queued jobs:', error)
        return
      }

      if (queuedVideos) {
        for (const video of queuedVideos) {
          const job: QueueJob = {
            id: video.id,
            userId: video.user_id,
            videoRecordId: video.id,
            priority: 0, // 默认优先级
            queuedAt: new Date(video.queue_entered_at || Date.now()),
          }
          this.queuedJobs.set(video.id, job)
        }
      }
    } catch (error) {
      console.error('[QUEUE SERVICE] Error restoring queued jobs:', error)
    }
  }

  /**
   * 获取用户的订阅等级（优先使用缓存）
   */
  private async getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
    try {
      // 优先使用Redis缓存集成服务
      return await redisCacheIntegrationService.getUserSubscription(userId)
    } catch (error) {
      console.error('[QUEUE SERVICE] Error getting user subscription from cache, falling back to direct DB query:', error)
      
      // 回退到直接数据库查询
      try {
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('tier')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        if (error) {
          if (error.code === '42P01' || error.code === '42703' || 
              error.message?.includes('does not exist') ||
              error.message?.includes('relation') ||
              error.status === 404) {
            console.log('[QUEUE SERVICE] Subscriptions table not available, defaulting to free tier')
            return 'free'
          }
          console.warn('[QUEUE SERVICE] Error getting user subscription:', error)
          return 'free'
        }

        return (subscription?.tier as SubscriptionTier) || 'free'
      } catch (dbError) {
        console.error('[QUEUE SERVICE] Database fallback also failed:', dbError)
        return 'free'
      }
    }
  }

  /**
   * 获取用户的并发限制
   */
  private async getUserConcurrentLimit(userId: string): Promise<number> {
    const tier = await this.getUserSubscriptionTier(userId)
    const baseTier = mapAnnualToBaseTier(tier)
    return this.userConcurrentLimits[baseTier]
  }

  /**
   * 获取用户当前活跃的任务数
   */
  private getUserActiveCount(userId: string): number {
    let count = 0
    for (const activeUserId of this.activeJobs.values()) {
      if (activeUserId === userId) {
        count++
      }
    }
    return count
  }

  /**
   * 检查用户是否可以提交新任务
   */
  async canUserSubmit(userId: string): Promise<UserSubmitStatus> {
    const userActiveCount = this.getUserActiveCount(userId)
    const userMaxAllowed = await this.getUserConcurrentLimit(userId)
    const tier = await this.getUserSubscriptionTier(userId)

    if (userActiveCount >= userMaxAllowed) {
      let reason = ''
      const baseTier = mapAnnualToBaseTier(tier)
      
      if (baseTier === 'free') {
        reason = `您已达到免费用户限制（${userMaxAllowed}个并发视频）。升级订阅可同时生成更多视频！`
      } else if (baseTier === 'basic') {
        reason = `您已达到基础订阅限制（${userMaxAllowed}个并发视频）。升级到专业版可同时生成5个视频！`
      } else if (baseTier === 'pro') {
        reason = `您已达到专业订阅限制（${userMaxAllowed}个并发视频）。升级到高级版可同时生成10个视频！`
      } else {
        reason = `您已达到并发限制（${userMaxAllowed}个视频），请等待当前视频完成`
      }

      return {
        canSubmit: false,
        reason,
        activeCount: userActiveCount,
        maxAllowed: userMaxAllowed,
        tier
      }
    }

    return {
      canSubmit: true,
      activeCount: userActiveCount,
      maxAllowed: userMaxAllowed,
      tier
    }
  }

  /**
   * 提交新的视频生成任务
   */
  async submitJob(request: SubmitJobRequest): Promise<SubmitJobResult> {
    console.log('[QUEUE SERVICE] Submitting job for user:', request.userId)

    // 检查用户是否可以提交
    const submitStatus = await this.canUserSubmit(request.userId)
    if (!submitStatus.canSubmit) {
      throw new Error(submitStatus.reason || 'Cannot submit job')
    }

    // 检查用户是否有足够积分
    const hasEnoughCredits = await creditService.hasEnoughCredits(request.userId, request.videoData.creditsUsed)
    if (!hasEnoughCredits) {
      throw new Error('积分余额不足，无法生成视频')
    }

    // 先扣除积分
    const creditResult = await creditService.consumeCredits(
      request.userId,
      request.videoData.creditsUsed,
      `生成视频: ${request.videoData.title || '无标题'}`,
      undefined, // 视频ID稍后更新
      'video_generation'
    )

    if (!creditResult.success) {
      throw new Error(creditResult.error || '积分扣除失败')
    }

    console.log(`[QUEUE SERVICE] Credits consumed successfully: ${request.videoData.creditsUsed}, new balance: ${creditResult.newBalance}`)

    // 创建视频记录
    const videoRecord = await supabaseVideoService.createVideo({
      userId: request.userId,
      templateId: request.videoData.templateId,
      title: request.videoData.title,
      description: request.videoData.description,
      prompt: request.videoData.prompt,
      parameters: request.videoData.parameters,
      creditsUsed: request.videoData.creditsUsed,
      status: 'pending',
      isPublic: request.videoData.isPublic
    })

    if (!videoRecord) {
      // 如果创建视频记录失败，需要退还积分
      console.error('[QUEUE SERVICE] Video record creation failed, refunding credits')
      await creditService.addCredits(
        request.userId,
        request.videoData.creditsUsed,
        'refund',
        `视频记录创建失败，退还积分: ${request.videoData.title || '无标题'}`,
        undefined,
        'video_creation_failed'
      )
      throw new Error('Failed to create video record')
    }

    // 更新积分交易记录的reference_id为实际的视频ID
    try {
      await supabase
        .from('credit_transactions')
        .update({ reference_id: videoRecord.id })
        .eq('user_id', request.userId)
        .eq('type', 'consume')
        .eq('reference_type', 'video_generation')
        .is('reference_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
    } catch (error) {
      console.warn('[QUEUE SERVICE] Failed to update credit transaction reference_id:', error)
    }

    // 检查是否可以立即开始处理
    if (this.canStartProcessing()) {
      // 立即开始处理
      await this.startProcessing(videoRecord.id, request.userId)
      
      return {
        status: 'processing',
        videoRecordId: videoRecord.id
      }
    } else {
      // 加入队列
      const queuePosition = await this.addToQueue(videoRecord.id, request.userId, request.priority || 0)
      const estimatedWaitMinutes = this.estimateWaitTime(queuePosition)

      return {
        status: 'queued',
        videoRecordId: videoRecord.id,
        queuePosition,
        estimatedWaitMinutes
      }
    }
  }

  /**
   * 检查是否可以立即开始处理
   */
  private canStartProcessing(): boolean {
    return this.activeJobs.size < this.systemMaxConcurrent
  }

  /**
   * 立即开始处理视频
   */
  private async startProcessing(videoId: string, userId: string): Promise<void> {
    console.log(`[QUEUE SERVICE] Starting processing for video: ${videoId}`)

    // 添加到活跃任务
    this.activeJobs.set(videoId, userId)

    // 更新数据库状态
    await supabaseVideoService.updateVideo(videoId, {
      status: 'processing',
      processing_started_at: new Date().toISOString()
    })

    // 异步启动实际的视频生成过程
    this.startActualVideoGeneration(videoId, userId).catch((error) => {
      console.error(`[QUEUE SERVICE] Failed to start video generation for ${videoId}:`, error)
      this.jobFailed(videoId)
    })

    console.log(`[QUEUE SERVICE] Video ${videoId} started processing`)
  }

  /**
   * 启动实际的视频生成过程
   */
  private async startActualVideoGeneration(videoId: string, userId: string): Promise<void> {
    try {
      // 获取视频记录详细信息
      const video = await supabaseVideoService.getVideo(videoId)
      if (!video) {
        throw new Error(`Video record not found: ${videoId}`)
      }

      // 动态导入veo3Service以避免循环依赖
      const veo3Service = (await import('./veo3Service')).default

      // 调用视频生成API
      const response = await veo3Service.generateVideo({
        prompt: video.prompt || '',
        template: video.template_id || '',
        parameters: video.parameters || {},
        userId: userId,
        credits: video.credits_used || 0,
        aspectRatio: '16:9',
        model: 'fast', // 可以根据用户订阅等级动态设置
        videoRecordId: videoId
      })

      console.log(`[QUEUE SERVICE] Video generation started successfully: ${videoId}, veo3JobId: ${response.id}`)

      // 订阅生成进度更新
      console.log(`[QUEUE SERVICE] 开始订阅视频生成状态: ${videoId}, jobId: ${response.id}`)
      const unsubscribe = veo3Service.subscribeToStatus(response.id, (update) => {
        console.log(`[QUEUE SERVICE] 收到状态更新: ${videoId}`, update)
        
        if (update.type === 'complete') {
          console.log(`[QUEUE SERVICE] ✅ 视频生成完成回调触发: ${videoId}`)
          console.log(`[QUEUE SERVICE] 完成数据:`, update.data)
          this.jobCompleted(videoId)
          unsubscribe()
        } else if (update.type === 'error') {
          console.error(`[QUEUE SERVICE] ❌ 视频生成失败回调触发: ${videoId}`, update.data)
          this.jobFailed(videoId)
          unsubscribe()
        } else if (update.type === 'progress') {
          console.log(`[QUEUE SERVICE] 📊 进度更新: ${videoId}, 进度: ${update.data?.progress}%`)
        }
      })

    } catch (error) {
      console.error(`[QUEUE SERVICE] Error in video generation: ${videoId}`, error)
      throw error
    }
  }

  /**
   * 添加任务到队列
   */
  private async addToQueue(videoId: string, userId: string, priority: number): Promise<number> {
    const now = new Date()
    const queuePosition = this.queuedJobs.size + 1

    const job: QueueJob = {
      id: videoId,
      userId,
      videoRecordId: videoId,
      priority,
      queuedAt: now
    }

    this.queuedJobs.set(videoId, job)

    // 更新数据库
    await supabaseVideoService.updateVideo(videoId, {
      queue_position: queuePosition,
      queue_entered_at: now.toISOString()
    })

    console.log(`[QUEUE SERVICE] Added video ${videoId} to queue at position ${queuePosition}`)
    return queuePosition
  }

  /**
   * 估算等待时间（分钟）
   */
  private estimateWaitTime(queuePosition: number): number {
    // 假设平均每个视频生成需要3分钟
    const averageProcessingTime = 3
    const parallelProcessing = Math.min(this.systemMaxConcurrent, queuePosition)
    
    return Math.ceil((queuePosition * averageProcessingTime) / parallelProcessing)
  }

  /**
   * 启动队列处理定时器
   */
  private startQueueProcessor(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }

    this.intervalId = setInterval(() => {
      this.processQueue()
    }, this.queueCheckInterval)

  }

  /**
   * 处理队列（定时器调用）
   */
  private async processQueue(): Promise<void> {
    try {
      // 检查系统容量
      const availableSlots = this.systemMaxConcurrent - this.activeJobs.size
      if (availableSlots <= 0) {
        return
      }

      // 获取排序后的队列
      const sortedQueue = Array.from(this.queuedJobs.values())
        .sort((a, b) => {
          // 优先级高的先处理，如果优先级相同则按时间排序
          if (a.priority !== b.priority) {
            return b.priority - a.priority
          }
          return a.queuedAt.getTime() - b.queuedAt.getTime()
        })

      let processed = 0
      for (const job of sortedQueue) {
        if (processed >= availableSlots) {
          break
        }

        // 检查用户并发限制
        const userActiveCount = this.getUserActiveCount(job.userId)
        const userLimit = await this.getUserConcurrentLimit(job.userId)

        if (userActiveCount < userLimit) {
          // 可以开始处理
          await this.startJobFromQueue(job)
          processed++
        }
      }

      // 更新队列位置
      if (processed > 0) {
        await this.updateQueuePositions()
      }
    } catch (error) {
      console.error('[QUEUE SERVICE] Error processing queue:', error)
    }
  }

  /**
   * 从队列中开始处理任务
   */
  private async startJobFromQueue(job: QueueJob): Promise<void> {
    console.log(`[QUEUE SERVICE] Starting queued job: ${job.id}`)

    // 从队列中移除
    this.queuedJobs.delete(job.id)

    // 添加到活跃任务
    this.activeJobs.set(job.id, job.userId)

    // 更新数据库状态
    await supabaseVideoService.updateVideo(job.videoRecordId, {
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      queue_position: null,
      queue_started_at: new Date().toISOString()
    })

    // 异步启动实际的视频生成过程
    this.startActualVideoGeneration(job.id, job.userId).catch((error) => {
      console.error(`[QUEUE SERVICE] Failed to start video generation for queued job ${job.id}:`, error)
      this.jobFailed(job.id)
    })

    console.log(`[QUEUE SERVICE] Job ${job.id} moved from queue to processing`)
  }

  /**
   * 更新队列中所有任务的位置
   */
  private async updateQueuePositions(): Promise<void> {
    const jobs = Array.from(this.queuedJobs.values())
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return a.queuedAt.getTime() - b.queuedAt.getTime()
      })

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      const newPosition = i + 1

      await supabaseVideoService.updateVideo(job.videoRecordId, {
        queue_position: newPosition
      })
    }
  }

  /**
   * 任务完成时调用（清理状态）
   */
  async jobCompleted(videoId: string): Promise<void> {
    console.log(`[QUEUE SERVICE] Job completed: ${videoId}`)
    
    // 从活跃任务中移除
    this.activeJobs.delete(videoId)
    
    // 触发队列处理
    setTimeout(() => {
      this.processQueue()
    }, 1000)
  }

  /**
   * 任务失败时调用（清理状态）
   */
  async jobFailed(videoId: string): Promise<void> {
    console.log(`[QUEUE SERVICE] Job failed: ${videoId}`)
    
    // 从活跃任务中移除
    this.activeJobs.delete(videoId)
    
    // 获取视频信息以便退还积分
    try {
      const video = await supabaseVideoService.getVideo(videoId)
      if (video && video.credits_used && video.credits_used > 0) {
        console.log(`[QUEUE SERVICE] Refunding credits for failed job: ${video.credits_used} credits`)
        
        const refundResult = await creditService.addCredits(
          video.user_id,
          video.credits_used,
          'refund',
          `视频生成失败，退还积分: ${video.title || videoId}`,
          videoId,
          'video_generation_failed'
        )
        
        if (refundResult.success) {
          console.log(`[QUEUE SERVICE] Credits refunded successfully. New balance: ${refundResult.newBalance}`)
        } else {
          console.error(`[QUEUE SERVICE] Failed to refund credits: ${refundResult.error}`)
        }
      }
    } catch (error) {
      console.error(`[QUEUE SERVICE] Error while processing failed job refund:`, error)
    }
    
    // 触发队列处理
    setTimeout(() => {
      this.processQueue()
    }, 1000)
  }

  /**
   * 获取用户的队列状态
   */
  async getUserQueueStatus(userId: string): Promise<{
    activeCount: number
    maxAllowed: number
    queuedJobs: Array<{
      videoId: string
      position: number
      estimatedWaitMinutes: number
    }>
  }> {
    const activeCount = this.getUserActiveCount(userId)
    const maxAllowed = await this.getUserConcurrentLimit(userId)
    
    const userQueuedJobs = Array.from(this.queuedJobs.values())
      .filter(job => job.userId === userId)
      .map((job, index) => ({
        videoId: job.id,
        position: index + 1,
        estimatedWaitMinutes: this.estimateWaitTime(index + 1)
      }))

    return {
      activeCount,
      maxAllowed,
      queuedJobs: userQueuedJobs
    }
  }

  /**
   * 停止队列处理器
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      console.log('[QUEUE SERVICE] Queue processor stopped')
    }
  }
}

// 创建单例实例
export const videoQueueService = new VideoQueueService()

export default videoQueueService