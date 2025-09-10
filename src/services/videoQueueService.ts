/**
 * 视频生成队列管理服务
 * 负责管理视频生成任务的队列、并发限制和调度
 */

import { supabase } from '@/lib/supabase'
import supabaseVideoService from './supabaseVideoService'
import creditService from './creditService'
import redisCacheIntegrationService from './RedisCacheIntegrationService'
import aiContentService from './aiContentService'
import type { Database } from '@/lib/supabase'

type Video = Database['public']['Tables']['videos']['Row']
type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise' | 'basic-annual' | 'pro-annual' | 'enterprise-annual'

// 将年度计划映射到对应的基础计划以获取并发限制
const mapAnnualToBaseTier = (tier: SubscriptionTier): SubscriptionTier => {
  if (tier === 'basic-annual') return 'basic'
  if (tier === 'pro-annual') return 'pro'  
  if (tier === 'enterprise-annual') return 'enterprise'
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
    aspectRatio?: '16:9' | '9:16'
    quality?: 'fast' | 'pro'
    apiProvider?: 'qingyun' | 'apicore'
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
  private cleanupIntervalId?: NodeJS.Timeout
  
  // 用户并发限制配置（基础配置，年度订阅映射到对应基础版本）
  private userConcurrentLimits: Record<SubscriptionTier, number> = {
    free: 1,
    basic: 3,
    pro: 5,
    enterprise: 10,
    'basic-annual': 3,      // 基础年度 = 基础月度
    'pro-annual': 5,        // 专业年度 = 专业月度  
    'enterprise-annual': 10 // 企业年度 = 企业月度
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
    this.userConcurrentLimits.enterprise = parseInt(process.env.VITE_USER_CONCURRENT_ENTERPRISE || '10')

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
        .select('id, user_id, processing_started_at, veo3_job_id')
        .eq('status', 'processing')
        .eq('is_deleted', false)

      if (error) {
        console.error('[QUEUE SERVICE] Failed to restore active jobs:', error)
        return
      }

      if (activeVideos) {
        const now = Date.now()
        const TASK_TIMEOUT_MS = 30 * 60 * 1000 // 30分钟超时

        for (const video of activeVideos) {
          const startedAt = video.processing_started_at ? new Date(video.processing_started_at).getTime() : now
          const isTimeout = (now - startedAt) > TASK_TIMEOUT_MS

          if (isTimeout) {
            // 僵尸任务：处理超时，直接标记为失败
            console.warn(`[QUEUE SERVICE] 🧟 检测到僵尸任务: ${video.id}, 已处理 ${Math.round((now - startedAt) / 60000)} 分钟`)
            
            try {
              await this.cleanupZombieTask(video.id, video.user_id, video.veo3_job_id)
            } catch (cleanupError) {
              console.error(`[QUEUE SERVICE] 清理僵尸任务失败 ${video.id}:`, cleanupError)
            }
          } else {
            // 正常任务：添加到activeJobs并尝试恢复
            this.activeJobs.set(video.id, video.user_id)
            console.log(`[QUEUE SERVICE] ✅ 恢复活跃任务: ${video.id}, 已处理 ${Math.round((now - startedAt) / 60000)} 分钟`)
            
            // 如果有veo3_job_id，尝试恢复任务状态跟踪
            if (video.veo3_job_id) {
              this.restoreTaskStatusTracking(video.id, video.user_id, video.veo3_job_id).catch(error => {
                console.error(`[QUEUE SERVICE] 恢复任务状态跟踪失败 ${video.id}:`, error)
              })
            }
          }
        }
        
      }
    } catch (error) {
      console.error('[QUEUE SERVICE] Error restoring active jobs:', error)
    }
  }

  /**
   * 恢复任务状态跟踪
   */
  private async restoreTaskStatusTracking(videoId: string, userId: string, veo3JobId: string): Promise<void> {
    console.log(`[QUEUE SERVICE] 🔄 开始恢复任务状态跟踪: ${videoId} -> ${veo3JobId}`)
    
    try {
      const veo3Service = (await import('./veo3Service')).default
      
      // 尝试通过veo3Service恢复任务
      const restored = await veo3Service.restoreJob(veo3JobId, videoId)
      
      if (restored) {
        console.log(`[QUEUE SERVICE] ✅ veo3任务状态跟踪恢复成功: ${veo3JobId}`)
      } else {
        console.warn(`[QUEUE SERVICE] ⚠️ veo3任务恢复返回false，可能任务已完成或失败: ${veo3JobId}`)
        
        // 如果veo3Service返回false，可能任务已经完成但数据库未更新
        // 给veo3Service一些时间来更新状态，然后检查
        setTimeout(async () => {
          try {
            const currentVideo = await supabaseVideoService.getVideo(videoId)
            if (currentVideo && currentVideo.status === 'processing') {
              console.warn(`[QUEUE SERVICE] ⚠️ 任务 ${videoId} 在veo3恢复后仍为processing状态，可能需要人工干预`)
              
              // 等待更长时间后如果还是processing，将其标记为失败
              setTimeout(async () => {
                const laterVideo = await supabaseVideoService.getVideo(videoId)
                if (laterVideo && laterVideo.status === 'processing') {
                  console.error(`[QUEUE SERVICE] ❌ 任务 ${videoId} 恢复失败，标记为失败`)
                  await this.jobFailed(videoId)
                }
              }, 60000) // 等待1分钟
            }
          } catch (error) {
            console.error(`[QUEUE SERVICE] ❌ 检查恢复后任务状态时出错 ${videoId}:`, error)
          }
        }, 10000) // 等待10秒
      }
    } catch (error) {
      console.error(`[QUEUE SERVICE] ❌ 恢复任务状态跟踪异常 ${videoId}:`, error)
      
      // 如果恢复失败，可能任务已经不存在或有问题，设定超时后清理
      setTimeout(async () => {
        try {
          const video = await supabaseVideoService.getVideo(videoId)
          if (video && video.status === 'processing') {
            console.warn(`[QUEUE SERVICE] ⚠️ 任务 ${videoId} 恢复失败且仍为processing，将清理`)
            await this.cleanupZombieTask(videoId, userId, veo3JobId)
          }
        } catch (cleanupError) {
          console.error(`[QUEUE SERVICE] ❌ 延迟清理失败恢复任务时出错 ${videoId}:`, cleanupError)
        }
      }, 300000) // 5分钟后清理
    }
  }

  /**
   * 清理僵尸任务
   */
  private async cleanupZombieTask(videoId: string, userId: string, veo3JobId?: string): Promise<void> {
    console.log(`[QUEUE SERVICE] 🧹 开始清理僵尸任务: ${videoId}`)
    
    try {
      // 1. 退还积分
      const video = await supabaseVideoService.getVideo(videoId)
      if (video && video.credits_used && video.credits_used > 0) {
        console.log(`[QUEUE SERVICE] 💰 退还僵尸任务积分: ${video.credits_used}`)
        
        const refundResult = await creditService.addCredits(
          userId,
          video.credits_used,
          'refund',
          `僵尸任务超时，退还积分: ${video.title || videoId}`,
          videoId,
          'zombie_task_timeout'
        )
        
        if (refundResult.success) {
          console.log(`[QUEUE SERVICE] ✅ 僵尸任务积分退还成功: ${refundResult.newBalance}`)
        } else {
          console.error(`[QUEUE SERVICE] ❌ 僵尸任务积分退还失败: ${refundResult.error}`)
        }
      }
      
      // 2. 更新数据库状态为失败
      await supabaseVideoService.updateVideo(videoId, {
        status: 'failed',
        error_message: '任务处理超时，已自动清理',
        processing_completed_at: new Date().toISOString()
      })
      
      // 3. 确保从activeJobs中移除
      this.activeJobs.delete(videoId)
      
      // 4. 清理用户订阅缓存，确保下次检查获取最新状态
      try {
        const redisCacheIntegrationService = (await import('./RedisCacheIntegrationService')).default
        await redisCacheIntegrationService.clearUserSubscriptionCache(userId)
      } catch (cacheError) {
        console.warn(`[QUEUE SERVICE] 清理缓存时出错:`, cacheError)
      }
      
      console.log(`[QUEUE SERVICE] ✅ 僵尸任务清理完成: ${videoId}`)
      
    } catch (error) {
      console.error(`[QUEUE SERVICE] ❌ 清理僵尸任务时出错 ${videoId}:`, error)
      // 即使清理失败，也要从activeJobs中移除，避免永久阻塞
      this.activeJobs.delete(videoId)
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
   * 获取用户当前活跃的任务数（改进版：先清理无效任务）
   */
  private async getUserActiveCount(userId: string): Promise<number> {
    // 先清理可能的无效任务
    await this.cleanupInvalidActiveTasks(userId)
    
    let count = 0
    for (const activeUserId of this.activeJobs.values()) {
      if (activeUserId === userId) {
        count++
      }
    }
    return count
  }

  /**
   * 清理无效的活跃任务（数据库已完成但内存未清理的任务）
   */
  private async cleanupInvalidActiveTasks(userId: string): Promise<void> {
    try {
      // 获取该用户在activeJobs中的所有任务ID
      const userActiveJobIds = []
      for (const [jobId, activeUserId] of this.activeJobs.entries()) {
        if (activeUserId === userId) {
          userActiveJobIds.push(jobId)
        }
      }

      if (userActiveJobIds.length === 0) {
        return
      }

      // 查询这些任务在数据库中的实际状态
      const { data: actualVideos, error } = await supabase
        .from('videos')
        .select('id, status')
        .in('id', userActiveJobIds)

      if (error) {
        console.warn('[QUEUE SERVICE] Failed to query video status for cleanup:', error)
        return
      }

      // 清理已完成或失败的任务
      if (actualVideos) {
        for (const video of actualVideos) {
          if (video.status === 'completed' || video.status === 'failed') {
            console.log(`[QUEUE SERVICE] 🧹 清理无效活跃任务: ${video.id} (状态: ${video.status})`)
            this.activeJobs.delete(video.id)
          }
        }
      }

      // 清理数据库中不存在的任务
      const existingVideoIds = new Set(actualVideos?.map(v => v.id) || [])
      for (const jobId of userActiveJobIds) {
        if (!existingVideoIds.has(jobId)) {
          console.log(`[QUEUE SERVICE] 🧹 清理数据库中不存在的任务: ${jobId}`)
          this.activeJobs.delete(jobId)
        }
      }

    } catch (error) {
      console.error('[QUEUE SERVICE] Error during cleanup:', error)
    }
  }

  /**
   * 检查用户是否可以提交新任务
   */
  async canUserSubmit(userId: string): Promise<UserSubmitStatus> {
    const userActiveCount = await this.getUserActiveCount(userId)
    const userMaxAllowed = await this.getUserConcurrentLimit(userId)
    const tier = await this.getUserSubscriptionTier(userId)

    if (userActiveCount >= userMaxAllowed) {
      let reason = ''
      const baseTier = mapAnnualToBaseTier(tier)
      
      // 添加调试信息
      console.warn(`[QUEUE SERVICE] 🚫 并发限制检查失败:`, {
        userId,
        tier: tier,
        baseTier: baseTier,
        activeCount: userActiveCount,
        maxAllowed: userMaxAllowed,
        activeJobsSize: this.activeJobs.size,
        timestamp: new Date().toISOString()
      })
      
      // 记录当前用户的活跃任务ID（用于调试）
      const userTaskIds = []
      for (const [taskId, taskUserId] of this.activeJobs.entries()) {
        if (taskUserId === userId) {
          userTaskIds.push(taskId)
        }
      }
      console.warn(`[QUEUE SERVICE] 🔍 用户活跃任务ID:`, userTaskIds)
      
      if (baseTier === 'free') {
        reason = `您已达到免费用户限制（${userActiveCount}/${userMaxAllowed}个并发视频）。升级订阅可同时生成更多视频！`
      } else if (baseTier === 'basic') {
        reason = `您已达到基础订阅限制（${userActiveCount}/${userMaxAllowed}个并发视频）。升级到专业版可同时生成5个视频！`
      } else if (baseTier === 'pro') {
        reason = `您已达到专业订阅限制（${userActiveCount}/${userMaxAllowed}个并发视频）。升级到高级版可同时生成10个视频！`
      } else {
        reason = `您已达到并发限制（${userActiveCount}/${userMaxAllowed}个视频），请等待当前视频完成`
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

    // 🎯 新增：在创建视频记录前先生成AI标题和简介
    console.log(`[QUEUE SERVICE] 📝 开始为视频生成AI标题和简介...`)
    const aiMetadata = await this.generateVideoMetadataSync(request.videoData, request.userId, 8000)
    
    // 创建视频记录时使用AI生成的标题和简介
    const videoRecord = await supabaseVideoService.createVideo({
      userId: request.userId,
      templateId: request.videoData.templateId,
      title: aiMetadata.title,  // 使用AI生成的标题
      description: aiMetadata.description,  // 使用AI生成的简介
      prompt: request.videoData.prompt,
      parameters: request.videoData.parameters,
      creditsUsed: request.videoData.creditsUsed,
      status: 'pending',
      isPublic: request.videoData.isPublic,
      aspectRatio: request.videoData.aspectRatio || '16:9',
      quality: request.videoData.quality || 'fast',
      apiProvider: request.videoData.apiProvider || 'qingyun'
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

    // 检查是否使用了智能默认值（而非AI生成的值）
    const isUsingSmartDefault = aiMetadata.title.includes('Epic') || 
                                aiMetadata.title.includes('Amazing') || 
                                aiMetadata.title.includes('Incredible') ||
                                aiMetadata.title.includes('Adventure') ||
                                aiMetadata.title.includes('Showcase') ||
                                aiMetadata.title.includes('Story')
    
    if (isUsingSmartDefault) {
      console.log(`[QUEUE SERVICE] 🔄 检测到使用了智能默认标题，启动异步AI更新`)
      // 延迟1秒后开始异步更新，避免立即重试
      setTimeout(() => {
        this.generateVideoMetadataAsync(videoRecord.id, request.videoData, request.userId, true)
      }, 1000)
    } else {
      console.log(`[QUEUE SERVICE] ✅ 使用AI生成的标题和简介，无需异步更新`)
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
      // 从视频记录中获取配置参数，如果没有则使用默认值
      const aspectRatio = (video.parameters?.aspectRatio as '16:9' | '9:16') || '16:9'
      const quality = (video.parameters?.quality as 'fast' | 'pro') || import.meta.env.VITE_DEFAULT_VIDEO_QUALITY as 'fast' | 'pro' || 'fast'
      const apiProvider = (video.parameters?.apiProvider as 'qingyun' | 'apicore') || import.meta.env.VITE_PRIMARY_VIDEO_API as 'qingyun' | 'apicore' || 'qingyun'
      
      console.log(`[QUEUE SERVICE] 视频生成参数: aspectRatio=${aspectRatio}, quality=${quality}, apiProvider=${apiProvider}`)
      
      const response = await veo3Service.generateVideo({
        prompt: video.prompt || '',
        template: video.template_id || '',
        parameters: video.parameters || {},
        userId: userId,
        credits: video.credits_used || 0,
        aspectRatio: aspectRatio,
        model: quality,
        apiProvider: apiProvider,
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

    // 同时启动定期清理机制
    this.startPeriodicCleanup()
  }

  /**
   * 启动定期清理机制
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
    }

    // 每5分钟执行一次全局清理
    this.cleanupIntervalId = setInterval(() => {
      this.performGlobalCleanup()
    }, 5 * 60 * 1000) // 5分钟

  }

  /**
   * 执行全局清理
   */
  private async performGlobalCleanup(): Promise<void> {
    try {
      const beforeCount = this.activeJobs.size
      console.log(`[QUEUE SERVICE] 🧹 开始全局清理，当前活跃任务数: ${beforeCount}`)

      // 获取所有活跃任务的用户ID
      const userIds = new Set(this.activeJobs.values())
      
      // 为每个用户清理无效任务
      for (const userId of userIds) {
        await this.cleanupInvalidActiveTasks(userId)
      }

      const afterCount = this.activeJobs.size
      const cleanedCount = beforeCount - afterCount

      if (cleanedCount > 0) {
        console.log(`[QUEUE SERVICE] ✅ 全局清理完成，清理了 ${cleanedCount} 个无效任务，剩余 ${afterCount} 个活跃任务`)
      } else {
        console.log(`[QUEUE SERVICE] ✅ 全局清理完成，无需清理任务，维持 ${afterCount} 个活跃任务`)
      }
    } catch (error) {
      console.error('[QUEUE SERVICE] ❌ 全局清理过程中出错:', error)
    }
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
        const userActiveCount = await this.getUserActiveCount(job.userId)
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
    
    try {
      // 验证数据库状态是否已正确更新为completed
      const video = await supabaseVideoService.getVideo(videoId)
      if (video) {
        if (video.status !== 'completed') {
          console.warn(`[QUEUE SERVICE] ⚠️ 任务 ${videoId} 完成但数据库状态不正确: ${video.status}`)
          
          // 尝试修正数据库状态
          if (video.video_url) {
            console.log(`[QUEUE SERVICE] 🔄 修正数据库状态为completed: ${videoId}`)
            await supabaseVideoService.updateVideo(videoId, {
              status: 'completed',
              processing_completed_at: new Date().toISOString()
            })
          } else {
            console.warn(`[QUEUE SERVICE] ⚠️ 任务 ${videoId} 没有video_url，可能未真正完成`)
          }
        } else {
          console.log(`[QUEUE SERVICE] ✅ 任务 ${videoId} 数据库状态正确`)
        }
      } else {
        console.error(`[QUEUE SERVICE] ❌ 无法获取任务 ${videoId} 的数据库记录`)
      }
    } catch (error) {
      console.error(`[QUEUE SERVICE] ❌ 验证任务完成状态时出错 ${videoId}:`, error)
    }
    
    // 从活跃任务中移除
    this.activeJobs.delete(videoId)
    
    // 清理相关用户的缓存，确保并发计数准确
    try {
      const video = await supabaseVideoService.getVideo(videoId)
      if (video) {
        const redisCacheIntegrationService = (await import('./RedisCacheIntegrationService')).default
        await redisCacheIntegrationService.clearUserSubscriptionCache(video.user_id)
      }
    } catch (cacheError) {
      console.warn(`[QUEUE SERVICE] 任务完成后清理缓存时出错:`, cacheError)
    }
    
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
    
    try {
      // 验证并更新数据库状态为失败
      const video = await supabaseVideoService.getVideo(videoId)
      if (video) {
        if (video.status !== 'failed') {
          console.log(`[QUEUE SERVICE] 🔄 更新数据库状态为failed: ${videoId}`)
          await supabaseVideoService.updateVideo(videoId, {
            status: 'failed',
            error_message: '视频生成失败',
            processing_completed_at: new Date().toISOString()
          })
        } else {
          console.log(`[QUEUE SERVICE] ✅ 任务 ${videoId} 数据库状态已为failed`)
        }
        
        // 退还积分
        if (video.credits_used && video.credits_used > 0) {
          console.log(`[QUEUE SERVICE] 💰 退还失败任务积分: ${video.credits_used} credits`)
          
          const refundResult = await creditService.addCredits(
            video.user_id,
            video.credits_used,
            'refund',
            `视频生成失败，退还积分: ${video.title || videoId}`,
            videoId,
            'video_generation_failed'
          )
          
          if (refundResult.success) {
            console.log(`[QUEUE SERVICE] ✅ 积分退还成功. New balance: ${refundResult.newBalance}`)
          } else {
            console.error(`[QUEUE SERVICE] ❌ 积分退还失败: ${refundResult.error}`)
          }
        }
      } else {
        console.error(`[QUEUE SERVICE] ❌ 无法获取失败任务 ${videoId} 的数据库记录`)
      }
    } catch (error) {
      console.error(`[QUEUE SERVICE] ❌ 处理失败任务时出错 ${videoId}:`, error)
    }
    
    // 从活跃任务中移除
    this.activeJobs.delete(videoId)
    
    // 清理相关用户的缓存，确保并发计数准确
    try {
      const video = await supabaseVideoService.getVideo(videoId)
      if (video) {
        const redisCacheIntegrationService = (await import('./RedisCacheIntegrationService')).default
        await redisCacheIntegrationService.clearUserSubscriptionCache(video.user_id)
      }
    } catch (cacheError) {
      console.warn(`[QUEUE SERVICE] 任务失败后清理缓存时出错:`, cacheError)
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
    const activeCount = await this.getUserActiveCount(userId)
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
   * 手动清理用户的僵尸任务
   */
  async cleanupUserZombieTasks(userId: string): Promise<{
    cleaned: number
    errors: string[]
  }> {
    console.log(`[QUEUE SERVICE] 🔧 开始手动清理用户僵尸任务: ${userId}`)
    
    const result = {
      cleaned: 0,
      errors: [] as string[]
    }
    
    try {
      // 查找该用户所有处理中的任务
      const { data: processingVideos, error } = await supabase
        .from('videos')
        .select('id, user_id, processing_started_at, veo3_job_id, title')
        .eq('user_id', userId)
        .eq('status', 'processing')
        .eq('is_deleted', false)
        
      if (error) {
        result.errors.push(`查询用户任务失败: ${error.message}`)
        return result
      }
      
      if (!processingVideos || processingVideos.length === 0) {
        console.log(`[QUEUE SERVICE] 用户 ${userId} 没有处理中的任务`)
        return result
      }
      
      const now = Date.now()
      const TASK_TIMEOUT_MS = 30 * 60 * 1000 // 30分钟
      
      for (const video of processingVideos) {
        const startedAt = video.processing_started_at ? new Date(video.processing_started_at).getTime() : now
        const runningTime = now - startedAt
        const isTimeout = runningTime > TASK_TIMEOUT_MS
        
        console.log(`[QUEUE SERVICE] 检查任务 ${video.id}: 运行时间 ${Math.round(runningTime / 60000)} 分钟`)
        
        if (isTimeout) {
          try {
            await this.cleanupZombieTask(video.id, userId, video.veo3_job_id)
            result.cleaned++
            console.log(`[QUEUE SERVICE] ✅ 已清理僵尸任务: ${video.title || video.id}`)
          } catch (error) {
            const errorMsg = `清理任务 ${video.id} 失败: ${error instanceof Error ? error.message : String(error)}`
            result.errors.push(errorMsg)
            console.error(`[QUEUE SERVICE] ❌ ${errorMsg}`)
          }
        } else {
          console.log(`[QUEUE SERVICE] ⏳ 任务 ${video.id} 仍在正常处理中，跳过`)
        }
      }
      
      console.log(`[QUEUE SERVICE] 🎉 用户 ${userId} 僵尸任务清理完成: 清理 ${result.cleaned} 个任务, ${result.errors.length} 个错误`)
      return result
      
    } catch (error) {
      const errorMsg = `手动清理僵尸任务异常: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(errorMsg)
      console.error(`[QUEUE SERVICE] ❌ ${errorMsg}`)
      return result
    }
  }

  /**
   * 获取用户当前的僵尸任务信息
   */
  async getUserZombieTasksInfo(userId: string): Promise<{
    zombieTasks: Array<{
      id: string
      title?: string
      startedAt: string
      runningMinutes: number
      veo3JobId?: string
    }>
    totalZombies: number
  }> {
    try {
      const { data: processingVideos, error } = await supabase
        .from('videos')
        .select('id, title, processing_started_at, veo3_job_id')
        .eq('user_id', userId)
        .eq('status', 'processing')
        .eq('is_deleted', false)
        
      if (error) {
        console.error(`[QUEUE SERVICE] 查询用户任务失败:`, error)
        return { zombieTasks: [], totalZombies: 0 }
      }
      
      if (!processingVideos) {
        return { zombieTasks: [], totalZombies: 0 }
      }
      
      const now = Date.now()
      const TASK_TIMEOUT_MS = 30 * 60 * 1000
      
      const zombieTasks = processingVideos
        .filter(video => {
          const startedAt = video.processing_started_at ? new Date(video.processing_started_at).getTime() : now
          return (now - startedAt) > TASK_TIMEOUT_MS
        })
        .map(video => ({
          id: video.id,
          title: video.title,
          startedAt: video.processing_started_at || new Date().toISOString(),
          runningMinutes: Math.round((now - (video.processing_started_at ? new Date(video.processing_started_at).getTime() : now)) / 60000),
          veo3JobId: video.veo3_job_id
        }))
      
      return {
        zombieTasks,
        totalZombies: zombieTasks.length
      }
    } catch (error) {
      console.error(`[QUEUE SERVICE] 获取僵尸任务信息失败:`, error)
      return { zombieTasks: [], totalZombies: 0 }
    }
  }

  /**
   * 手动触发全局清理（用于调试和紧急情况）
   */
  async manualCleanup(): Promise<{ 
    beforeCount: number; 
    afterCount: number; 
    cleanedCount: number; 
  }> {
    const beforeCount = this.activeJobs.size
    console.log(`[QUEUE SERVICE] 🛠️ 手动触发全局清理，清理前活跃任务数: ${beforeCount}`)
    
    await this.performGlobalCleanup()
    
    const afterCount = this.activeJobs.size
    const cleanedCount = beforeCount - afterCount
    
    return {
      beforeCount,
      afterCount,
      cleanedCount
    }
  }

  /**
   * 获取当前活跃任务的详细信息（用于调试）
   */
  getActiveJobsDebugInfo(): Array<{ taskId: string; userId: string }> {
    return Array.from(this.activeJobs.entries()).map(([taskId, userId]) => ({
      taskId,
      userId
    }))
  }

  /**
   * 获取用户语言设置
   */
  private async getUserLanguage(userId: string): Promise<string> {
    try {
      // 优先使用界面当前语言
      const i18n = (await import('@/i18n/config')).default
      const currentUILanguage = i18n.language || 'zh-CN'
      
      console.log(`[QUEUE SERVICE] 界面当前语言: ${currentUILanguage}`)
      
      // 尝试获取数据库中的用户语言设置
      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', userId)
        .single()
      
      // 优先使用界面当前语言，这样用户切换语言后立即生效
      const dbLanguage = profile?.language
      const finalLanguage = currentUILanguage
      
      console.log(`[QUEUE SERVICE] 数据库语言: ${dbLanguage || 'null'}, 界面语言: ${currentUILanguage}, 最终语言: ${finalLanguage}`)
      
      // 如果数据库语言与界面语言不一致，更新数据库以保持同步
      if (dbLanguage !== currentUILanguage) {
        try {
          await supabase
            .from('profiles')
            .update({ language: currentUILanguage })
            .eq('id', userId)
          console.log(`[QUEUE SERVICE] 已将数据库语言更新为: ${currentUILanguage}`)
        } catch (updateError) {
          console.warn(`[QUEUE SERVICE] 更新数据库语言失败: ${updateError}`)
        }
      }
      
      return finalLanguage
    } catch (error) {
      console.warn(`[QUEUE SERVICE] 获取用户语言失败，使用默认中文: ${error}`)
      return 'zh-CN'
    }
  }

  /**
   * 获取模板名称
   */
  private async getTemplateName(templateId?: string): Promise<string> {
    if (!templateId) return '视频模板'
    
    try {
      const { data: template } = await supabase
        .from('templates')
        .select('name')
        .eq('id', templateId)
        .single()
      
      return template?.name || templateId
    } catch (error) {
      console.warn(`[QUEUE SERVICE] 获取模板名称失败: ${error}`)
      return templateId
    }
  }

  /**
   * 同步生成AI标题和简介（带超时）
   */
  private async generateVideoMetadataSync(
    videoData: SubmitJobRequest['videoData'], 
    userId: string,
    timeoutMs: number = 8000
  ): Promise<{ title: string; description: string }> {
    try {
      console.log(`[QUEUE SERVICE] 🚀 开始同步生成AI标题和简介 (超时: ${timeoutMs}ms)`)
      
      // 获取用户语言和模板信息
      const [userLanguage, templateName] = await Promise.all([
        this.getUserLanguage(userId),
        this.getTemplateName(videoData.templateId)
      ])
      
      // 使用Promise.race实现超时机制
      const result = await Promise.race([
        // AI生成请求
        aiContentService.generateVideoMetadata({
          templateName,
          prompt: videoData.prompt || '',
          parameters: videoData.parameters || {},
          userLanguage
        }),
        // 超时Promise
        new Promise<{ title: string; description: string }>((resolve) => 
          setTimeout(() => {
            console.log(`[QUEUE SERVICE] ⏰ AI生成超时(${timeoutMs}ms)，使用智能默认值`)
            
            // 生成更智能的默认标题
            const smartTitle = this.generateSmartDefaultTitle(templateName, videoData.parameters || {})
            const smartDescription = this.generateSmartDefaultDescription(templateName, videoData.prompt || '', videoData.parameters || {})
            
            resolve({
              title: videoData.title || smartTitle,
              description: videoData.description || smartDescription
            })
          }, timeoutMs)
        )
      ])
      
      console.log(`[QUEUE SERVICE] ✅ AI标题生成成功:`, {
        title: result.title.substring(0, 30) + '...',
        descriptionLength: result.description.length
      })
      
      return result
    } catch (error) {
      console.error(`[QUEUE SERVICE] AI标题生成失败，使用回退方案: ${error}`)
      const templateName = await this.getTemplateName(videoData.templateId)
      
      return {
        title: videoData.title || templateName,
        description: videoData.description || `基于模板"${templateName}"生成的AI视频内容。`
      }
    }
  }

  /**
   * 异步生成视频标题和简介（不阻塞主流程）
   */
  private generateVideoMetadataAsync(
    videoId: string, 
    videoData: SubmitJobRequest['videoData'], 
    userId: string,
    isRetry: boolean = false,
    retryCount: number = 0
  ): void {
    const maxRetries = 2
    
    // 异步执行，不等待结果
    (async () => {
      try {
        const retryText = isRetry ? ` (重试 ${retryCount + 1}/${maxRetries})` : ''
        console.log(`[QUEUE SERVICE] 🤖 开始为视频 ${videoId} 异步生成AI标题和简介${retryText}`)
        
        // 获取用户语言和模板信息
        const [userLanguage, templateName] = await Promise.all([
          this.getUserLanguage(userId),
          this.getTemplateName(videoData.templateId)
        ])
        
        // 生成AI标题和简介 - 给异步更新更多时间
        const metadata = await Promise.race([
          aiContentService.generateVideoMetadata({
            templateName: templateName,
            prompt: videoData.prompt || '',
            parameters: videoData.parameters || {},
            userLanguage: userLanguage
          }),
          // 异步更新时使用更长的超时时间（15秒）
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('异步AI生成超时')), 15000)
          )
        ])
        
        console.log(`[QUEUE SERVICE] ✅ 异步AI生成成功:`, {
          videoId,
          title: metadata.title.substring(0, 30) + '...',
          descriptionLength: metadata.description.length,
          isRetry
        })
        
        // 更新视频记录
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            title: metadata.title,
            description: metadata.description,
            // 添加标记表示已通过AI更新
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
        
        if (updateError) {
          console.error(`[QUEUE SERVICE] 更新视频标题简介失败: ${updateError.message}`)
          throw updateError
        } else {
          console.log(`[QUEUE SERVICE] 🎉 视频 ${videoId} 异步AI标题更新成功`)
        }
        
      } catch (error) {
        console.error(`[QUEUE SERVICE] 异步AI生成失败 (尝试 ${retryCount + 1}): ${error}`)
        
        // 如果还有重试次数，延迟后重试
        if (retryCount < maxRetries) {
          const delayMs = (retryCount + 1) * 3000 // 递增延迟：3s, 6s, 9s
          console.log(`[QUEUE SERVICE] ⏰ ${delayMs/1000}秒后进行第${retryCount + 2}次重试`)
          
          setTimeout(() => {
            this.generateVideoMetadataAsync(videoId, videoData, userId, true, retryCount + 1)
          }, delayMs)
          
          return
        }
        
        // 所有重试都失败，使用最终备用方案
        try {
          const templateName = await this.getTemplateName(videoData.templateId)
          const smartTitle = this.generateSmartDefaultTitle(templateName, videoData.parameters || {})
          const smartDescription = this.generateSmartDefaultDescription(
            templateName, 
            videoData.prompt || '', 
            videoData.parameters || {}
          )
          
          await supabase
            .from('videos')
            .update({
              title: smartTitle,
              description: smartDescription
            })
            .eq('id', videoId)
            
          console.log(`[QUEUE SERVICE] 📝 所有AI重试失败，使用最终智能备用方案: ${smartTitle}`)
        } catch (fallbackError) {
          console.error(`[QUEUE SERVICE] 最终备用方案也失败: ${fallbackError}`)
        }
      }
    })().catch(error => {
      // 静默处理异步错误，避免影响主流程
      console.error(`[QUEUE SERVICE] AI标题生成异步任务失败: ${error}`)
    })
  }

  /**
   * 生成备用标题（当AI生成失败时使用）
   */
  private generateFallbackTitle(videoData: SubmitJobRequest['videoData']): string {
    const timestamp = new Date().toLocaleDateString('zh-CN')
    const baseTitle = videoData.title || '创意AI视频'
    
    // 如果原标题太短，添加一些描述性内容
    if (baseTitle.length < 10) {
      return `${baseTitle} - ${timestamp}`
    }
    
    return baseTitle
  }

  /**
   * 生成备用简介（当AI生成失败时使用）
   */
  private generateFallbackDescription(videoData: SubmitJobRequest['videoData']): string {
    const prompt = videoData.prompt || ''
    const shortPrompt = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt
    
    return `基于创意提示"${shortPrompt}"生成的AI视频内容，展现独特的视觉效果和创意表达。`
  }

  /**
   * 生成智能默认标题（超时时使用，比简单模板名称更有吸引力）
   */
  private generateSmartDefaultTitle(templateName: string, parameters: Record<string, any>): string {
    // 基于模板名称和参数生成更有吸引力的标题
    const paramValues = Object.values(parameters).filter(v => typeof v === 'string' && v.trim().length > 0)
    
    // 如果有参数，尝试结合参数生成标题
    if (paramValues.length > 0) {
      const firstParam = paramValues[0] as string
      const words = firstParam.split(' ').slice(0, 3) // 取前3个词
      
      if (words.length > 0) {
        const capitalizedWords = words.map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ')
        
        // 根据模板类型生成不同风格的标题
        if (templateName.toLowerCase().includes('animal')) {
          return `${capitalizedWords} Adventure`
        } else if (templateName.toLowerCase().includes('magic')) {
          return `Magical ${capitalizedWords}`
        } else if (templateName.toLowerCase().includes('street') || templateName.toLowerCase().includes('city')) {
          return `Urban ${capitalizedWords}`
        } else if (templateName.toLowerCase().includes('product') || templateName.toLowerCase().includes('tech')) {
          return `${capitalizedWords} Showcase`
        } else {
          return `${capitalizedWords} Story`
        }
      }
    }
    
    // 如果没有参数，基于模板名称生成吸引人的标题
    const baseTitle = templateName.replace(/[_-]/g, ' ').trim()
    
    // 添加一些吸引人的词语
    const enhancers = ['Epic', 'Amazing', 'Incredible', 'Stunning', 'Creative', 'Unique', 'Fantastic']
    const randomEnhancer = enhancers[Math.floor(Math.random() * enhancers.length)]
    
    return `${randomEnhancer} ${baseTitle}`
  }

  /**
   * 生成智能默认描述（超时时使用，比简单模板描述更详细）
   */
  private generateSmartDefaultDescription(templateName: string, prompt: string, parameters: Record<string, any>): string {
    const shortPrompt = prompt.length > 80 ? prompt.substring(0, 80) + '...' : prompt
    const paramCount = Object.keys(parameters).length
    
    // 基于模板和提示词生成描述
    let description = ''
    
    if (shortPrompt.trim()) {
      description = `AI-generated video featuring "${shortPrompt}"`
    } else {
      description = `Creative AI video based on the ${templateName} template`
    }
    
    // 添加参数信息
    if (paramCount > 0) {
      description += ` with ${paramCount} custom parameter${paramCount > 1 ? 's' : ''}`
    }
    
    // 根据模板类型添加特色描述
    const lowerTemplate = templateName.toLowerCase()
    if (lowerTemplate.includes('animal')) {
      description += ', showcasing amazing animal performances'
    } else if (lowerTemplate.includes('magic')) {
      description += ', featuring magical elements and special effects'
    } else if (lowerTemplate.includes('street') || lowerTemplate.includes('city')) {
      description += ', capturing urban life and street scenes'
    } else if (lowerTemplate.includes('product')) {
      description += ', highlighting product features and design'
    } else if (lowerTemplate.includes('tech')) {
      description += ', demonstrating cutting-edge technology'
    } else {
      description += ', delivering engaging visual storytelling'
    }
    
    return description + '.'
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
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = undefined
      console.log('[QUEUE SERVICE] Periodic cleanup stopped')
    }
  }
}

// 创建单例实例
export const videoQueueService = new VideoQueueService()

export default videoQueueService