/**
 * 任务调度器
 * 负责任务提交、调度和队列处理的核心逻辑
 */

import supabaseVideoService from '../supabaseVideoService'
import creditService from '../creditService'
import type { QueueStore } from './QueueStore'
import type { UserManager } from './UserManager'
import type { ConcurrencyController } from './ConcurrencyController'
import type { MetadataGenerator } from './MetadataGenerator'
import type { QueueConfig } from './config'
import type { SubmitJobRequest, SubmitJobResult, QueueJob } from './types'
import { QUEUE_CONSTANTS } from './config'

export class TaskScheduler {
  private intervalId?: NodeJS.Timeout

  constructor(
    private queueStore: QueueStore,
    private _userManager: UserManager,
    private concurrencyController: ConcurrencyController,
    private metadataGenerator: MetadataGenerator,
    private config: QueueConfig
  ) {}

  /**
   * 提交新的视频生成任务
   */
  async submitJob(request: SubmitJobRequest): Promise<SubmitJobResult> {
    console.log('[TASK SCHEDULER] Submitting job for user:', request.userId)

    // 检查用户是否可以提交
    const concurrencyCheck = await this.concurrencyController.checkUserConcurrency(request.userId)
    if (!concurrencyCheck.canSubmit) {
      throw new Error(concurrencyCheck.reason || 'Cannot submit job')
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

    // 🚀 积分扣除成功后立即刷新profile，确保UI一致性
    if (creditResult.refreshProfile) {
      creditResult.refreshProfile()
    }

    console.log(`[TASK SCHEDULER] Credits consumed successfully: ${request.videoData.creditsUsed}, new balance: ${creditResult.newBalance}`)

    // 🎯 新增：在创建视频记录前先生成AI标题和简介
    console.log(`[TASK SCHEDULER] 📝 开始为视频生成AI标题和简介...`)
    const aiMetadata = await this.metadataGenerator.generateVideoMetadataSync(request.videoData, request.userId, 12000)

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
      apiProvider: request.videoData.apiProvider || 'qingyun',
      aiTitleStatus: aiMetadata.status // 添加AI标题状态
    })

    if (!videoRecord) {
      // 如果创建视频记录失败，需要退还积分
      console.error('[TASK SCHEDULER] Video record creation failed, refunding credits')
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

    // 注意：积分交易记录的reference_id更新在原版本中实现
    console.log(`[TASK SCHEDULER] 视频记录创建完成: ${videoRecord.id}`)

    // 根据AI生成状态决定后续处理
    this.handleAIMetadataResult(videoRecord.id, aiMetadata, request.videoData, request.userId)

    // 检查是否可以立即开始处理
    const systemCheck = this.concurrencyController.checkSystemConcurrency(this.config.systemMaxConcurrent)
    if (systemCheck.canStartProcessing) {
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
   * 处理AI元数据生成结果
   */
  private handleAIMetadataResult(
    videoId: string,
    aiMetadata: any,
    videoData: SubmitJobRequest['videoData'],
    userId: string
  ): void {
    if (aiMetadata.status === 'timeout_default') {
      console.log(`[TASK SCHEDULER] 🔄 检测到超时使用默认标题，启动延迟AI处理`)

      // 如果有AI Promise，启动延迟处理
      if (aiMetadata.aiPromise) {
        this.metadataGenerator.handleDelayedAIResult(videoId, aiMetadata.aiPromise)
      }

      // 同时启动异步重试机制
      setTimeout(() => {
        this.metadataGenerator.generateVideoMetadataAsync(videoId, videoData, userId, true)
      }, 2000) // 稍微延迟一下，给延迟处理一些时间

    } else if (aiMetadata.status === 'ai_generated') {
      console.log(`[TASK SCHEDULER] ✅ 使用AI生成的标题和简介，无需异步更新`)
    } else {
      console.log(`[TASK SCHEDULER] ⚠️ 使用错误回退方案，将尝试异步重新生成`)
      setTimeout(() => {
        this.metadataGenerator.generateVideoMetadataAsync(videoId, videoData, userId, true)
      }, 1000)
    }
  }

  /**
   * 立即开始处理视频
   */
  async startProcessing(videoId: string, userId: string): Promise<void> {
    console.log(`[TASK SCHEDULER] Starting processing for video: ${videoId}`)

    // 添加到活跃任务
    this.queueStore.addActiveJob(videoId, userId)

    // 更新数据库状态
    await supabaseVideoService.updateVideo(videoId, {
      status: 'processing',
      processing_started_at: new Date().toISOString()
    })

    // 异步启动实际的视频生成过程
    this.startActualVideoGeneration(videoId, userId).catch((error) => {
      console.error(`[TASK SCHEDULER] Failed to start video generation for ${videoId}:`, error)
      // 注意：这里需要调用生命周期处理器的jobFailed方法
      // 暂时直接调用queueStore的方法
      this.queueStore.removeActiveJob(videoId)
    })

    console.log(`[TASK SCHEDULER] Video ${videoId} started processing`)
  }

  /**
   * 启动实际的视频生成过程
   */
  async startActualVideoGeneration(videoId: string, userId: string): Promise<void> {
    try {
      // 获取视频记录详细信息
      const video = await supabaseVideoService.getVideo(videoId)
      if (!video) {
        throw new Error(`Video record not found: ${videoId}`)
      }

      // 动态导入veo3Service以避免循环依赖
      const veo3Service = (await import('../veo3Service')).default

      // 调用视频生成API
      const aspectRatio = (video.parameters?.aspectRatio as '16:9' | '9:16') || '16:9'
      const quality = (video.parameters?.quality as 'fast' | 'pro') || import.meta.env.VITE_DEFAULT_VIDEO_QUALITY as 'fast' | 'pro' || 'fast'
      const apiProvider = (video.parameters?.apiProvider as 'qingyun' | 'apicore') || import.meta.env.VITE_PRIMARY_VIDEO_API as 'qingyun' | 'apicore' || 'qingyun'

      console.log(`[TASK SCHEDULER] 视频生成参数: aspectRatio=${aspectRatio}, quality=${quality}, apiProvider=${apiProvider}`)

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

      console.log(`[TASK SCHEDULER] Video generation started successfully: ${videoId}, veo3JobId: ${response.id}`)

      // 订阅生成进度更新
      console.log(`[TASK SCHEDULER] 开始订阅视频生成状态: ${videoId}, jobId: ${response.id}`)
      const unsubscribe = veo3Service.subscribeToStatus(response.id, (update) => {
        console.log(`[TASK SCHEDULER] 收到状态更新: ${videoId}`, update)

        if (update.type === 'complete') {
          console.log(`[TASK SCHEDULER] ✅ 视频生成完成回调触发: ${videoId}`)
          console.log(`[TASK SCHEDULER] 完成数据:`, update.data)
          // 这里需要调用生命周期处理器
          this.queueStore.removeActiveJob(videoId)
          unsubscribe()
        } else if (update.type === 'error') {
          console.error(`[TASK SCHEDULER] ❌ 视频生成失败回调触发: ${videoId}`, update.data)
          // 这里需要调用生命周期处理器
          this.queueStore.removeActiveJob(videoId)
          unsubscribe()
        } else if (update.type === 'progress') {
          console.log(`[TASK SCHEDULER] 📊 进度更新: ${videoId}, 进度: ${update.data?.progress}%`)
        }
      })

    } catch (error) {
      console.error(`[TASK SCHEDULER] Error in video generation: ${videoId}`, error)
      throw error
    }
  }

  /**
   * 添加任务到队列
   */
  async addToQueue(videoId: string, userId: string, priority: number): Promise<number> {
    const now = new Date()

    const job: QueueJob = {
      id: videoId,
      userId,
      videoRecordId: videoId,
      priority,
      queuedAt: now
    }

    const queuePosition = this.queueStore.addToQueue(job)

    // 更新数据库（注意：队列字段可能在某些数据库版本中不存在）
    try {
      await supabaseVideoService.updateVideo(videoId, {
        // queue_position: queuePosition,
        // queue_entered_at: now.toISOString()
      } as any)
    } catch (error) {
      console.warn(`[TASK SCHEDULER] 数据库队列字段更新失败（可能未添加队列字段）: ${error}`)
    }

    console.log(`[TASK SCHEDULER] Added video ${videoId} to queue at position ${queuePosition}`)
    return queuePosition
  }

  /**
   * 估算等待时间（分钟）
   */
  private estimateWaitTime(queuePosition: number): number {
    const parallelProcessing = Math.min(this.config.systemMaxConcurrent, queuePosition)
    return Math.ceil((queuePosition * QUEUE_CONSTANTS.AVERAGE_PROCESSING_TIME) / parallelProcessing)
  }

  /**
   * 处理队列（定时器调用）
   */
  async processQueue(): Promise<void> {
    try {
      // 检查系统容量
      const systemCheck = this.concurrencyController.checkSystemConcurrency(this.config.systemMaxConcurrent)
      if (systemCheck.availableSlots <= 0) {
        return
      }

      // 获取排序后的队列
      const sortedQueue = this.queueStore.getSortedQueue()

      let processed = 0
      for (const job of sortedQueue) {
        if (processed >= systemCheck.availableSlots) {
          break
        }

        // 检查用户并发限制
        const userCheck = await this.concurrencyController.checkUserConcurrency(job.userId)

        if (userCheck.canSubmit) {
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
      console.error('[TASK SCHEDULER] Error processing queue:', error)
    }
  }

  /**
   * 从队列中开始处理任务
   */
  private async startJobFromQueue(job: QueueJob): Promise<void> {
    console.log(`[TASK SCHEDULER] Starting queued job: ${job.id}`)

    // 从队列中移除
    this.queueStore.removeFromQueue(job.id)

    // 添加到活跃任务
    this.queueStore.addActiveJob(job.id, job.userId)

    // 更新数据库状态
    await supabaseVideoService.updateVideo(job.videoRecordId, {
      status: 'processing',
      processing_started_at: new Date().toISOString()
      // queue_position: null,
      // queue_started_at: new Date().toISOString()
    } as any)

    // 异步启动实际的视频生成过程
    this.startActualVideoGeneration(job.id, job.userId).catch((error) => {
      console.error(`[TASK SCHEDULER] Failed to start video generation for queued job ${job.id}:`, error)
      this.queueStore.removeActiveJob(job.id)
    })

    console.log(`[TASK SCHEDULER] Job ${job.id} moved from queue to processing`)
  }

  /**
   * 更新队列中所有任务的位置
   */
  private async updateQueuePositions(): Promise<void> {
    const jobs = this.queueStore.getSortedQueue()

    for (let i = 0; i < jobs.length; i++) {
      const _job = jobs[i]
      const _newPosition = i + 1

      // 暂时跳过队列位置更新，因为数据库可能没有这些字段
      // await supabaseVideoService.updateVideo(job.videoRecordId, {
      //   queue_position: newPosition
      // })
    }
  }

  /**
   * 启动队列处理定时器
   */
  startQueueProcessor(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }

    this.intervalId = setInterval(() => {
      this.processQueue()
    }, this.config.queueCheckInterval)

    console.log('[TASK SCHEDULER] ✅ 队列处理器已启动')
  }

  /**
   * 停止队列处理定时器
   */
  stopQueueProcessor(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      console.log('[TASK SCHEDULER] ✅ 队列处理器已停止')
    }
  }
}