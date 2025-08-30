import { getQingyunApiService } from './veo/QingyunApiService'
import supabaseVideoService from './supabaseVideoService'
import { progressManager } from './progressManager'
import i18n from '@/i18n/config'

export interface VideoGenerationRequest {
  prompt: string
  template: string
  parameters: Record<string, any>
  userId?: string
  credits: number
  aspectRatio?: '16:9' | '9:16'
  negativePrompt?: string
  image?: string | File
  model?: 'fast' | 'pro'  // 简化为青云API的质量设置
  videoRecordId?: string  // Supabase video record ID for direct updates
}

export interface VideoGenerationResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
  progress?: number
  createdAt: Date
  completedAt?: Date
  metadata?: {
    duration?: number
    resolution?: string
    fileSize?: number
  }
}

export interface AccountStatus {
  id: string
  email: string
  isActive: boolean
  dailyQuota: number
  usedQuota: number
  lastUsed?: Date
}

class Veo3Service {
  private accounts: AccountStatus[] = []
  private currentAccountIndex = 0
  private activeJobs: Map<string, VideoGenerationResponse> = new Map()

  constructor() {
    // 初始化模拟账户池
    this.initializeAccounts()
  }

  private initializeAccounts() {
    // 模拟多个账户用于开发测试
    this.accounts = [
      {
        id: 'account-1',
        email: 'veo-account-1@example.com',
        isActive: true,
        dailyQuota: 100,
        usedQuota: 0,
        lastUsed: undefined
      },
      {
        id: 'account-2',
        email: 'veo-account-2@example.com',
        isActive: true,
        dailyQuota: 100,
        usedQuota: 25,
        lastUsed: new Date()
      },
      {
        id: 'account-3',
        email: 'veo-account-3@example.com',
        isActive: true,
        dailyQuota: 100,
        usedQuota: 50,
        lastUsed: new Date()
      }
    ]
  }

  private getNextAvailableAccount(): AccountStatus | null {
    // 轮询获取下一个可用账户
    let attempts = 0
    
    while (attempts < this.accounts.length) {
      const account = this.accounts[this.currentAccountIndex]
      
      if (account.isActive && account.usedQuota < account.dailyQuota) {
        this.currentAccountIndex = (this.currentAccountIndex + 1) % this.accounts.length
        return account
      }
      
      this.currentAccountIndex = (this.currentAccountIndex + 1) % this.accounts.length
      attempts++
    }
    
    return null
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const useRealAPI = process.env.VEO_USE_REAL_API === 'true'
    
    if (useRealAPI) {
      // 使用青云API
      return this.generateVideoWithQingyunAPI(request)
    } else {
      // 使用模拟生成（开发环境）
      return this.generateVideoWithMock(request)
    }
  }

  /**
   * 使用青云API生成视频
   */
  private async generateVideoWithQingyunAPI(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const trackingId = `qingyun-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // 获取青云API配置
      const apiKey = process.env.QINGYUN_API_KEY
      const endpoint = process.env.QINGYUN_API_ENDPOINT || 'https://api.qingyuntop.top'
      
      if (!apiKey) {
        throw new Error('Qingyun API key not configured')
      }

      // 初始化青云服务
      const qingyunService = getQingyunApiService({
        apiKey,
        endpoint
      })
      
      // 注册任务到 activeJobs，以便 subscribeToStatus 能够找到
      const job: VideoGenerationResponse = {
        id: trackingId,
        status: 'processing',
        progress: 0,
        createdAt: new Date()
      }
      this.activeJobs.set(trackingId, job)
      console.log('[VEO3 SERVICE] Registered Qingyun task to activeJobs:', trackingId)
      
      console.log('[VEO3 SERVICE] Using Qingyun API for video generation')
      
      // 处理图片参数
      let images: string[] | undefined
      if (request.image) {
        images = await this.processImagesForQingyun(request.image)
      }
      
      // 自动选择正确的青云模型
      const quality = request.model || 'fast'
      const qingyunModel = qingyunService.selectModel(quality, !!images)
      
      console.log(`[VEO3 SERVICE] Qingyun model selected: ${qingyunModel}`)
      
      // 创建视频任务
      const task = await qingyunService.createVideo({
        prompt: request.prompt,
        model: qingyunModel,
        images: images,
        enhance_prompt: true
      })
      
      // 立即保存青云任务ID到数据库，确保任务可以恢复 - 关键步骤！
      if (request.videoRecordId) {
        console.log(`[VEO3 SERVICE] ⚡ CRITICAL: Saving Qingyun task ID to database: ${task.id}`)
        
        // 多次尝试保存，确保成功
        let saveSuccess = false
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, {
              veo3_job_id: task.id,
              status: 'processing',
              processing_started_at: new Date().toISOString()
            })
            console.log(`[VEO3 SERVICE] ✅ Successfully saved veo3_job_id: ${task.id} (attempt ${attempt})`)
            saveSuccess = true
            break
          } catch (error) {
            console.error(`[VEO3 SERVICE] ❌ Failed to save veo3_job_id attempt ${attempt}:`, error)
            
            if (attempt < 3) {
              // 等待1秒后重试
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }
        
        if (!saveSuccess) {
          console.error(`[VEO3 SERVICE] 🚨 CRITICAL: Failed to save veo3_job_id after 3 attempts: ${task.id}`)
          // 即使保存失败，也继续处理，但记录错误
        }
      }
      
      // 轮询获取结果
      const result = await qingyunService.pollUntilComplete(
        task.id,
        async (progress) => {
          // 更新 activeJobs 中的进度状态
          const job = this.activeJobs.get(trackingId)
          if (job) {
            job.progress = progress
            job.status = 'processing'
            this.activeJobs.set(trackingId, job)
          }
          
          console.log(`[VEO3 SERVICE] Progress: ${progress}%`)
          
          if (request.videoRecordId && progress > 0) {
            progressManager.updateProgress(request.videoRecordId, {
              progress,
              status: 'processing',
              statusText: progress < 50 ? i18n.t('videoCreator.processing') : i18n.t('videoCreator.almostComplete'),
              qingyunTaskId: task.id
            })
          }
        },
        60,  // 最大尝试次数
        10000  // 轮询间隔 10 秒
      )
      
      if (result.video_url) {
        // 🎬 详细记录生成完成的视频URL
        console.log('[VEO3 SERVICE] ========== 视频生成完成 ==========')
        console.log('[VEO3 SERVICE] 📹 原始视频URL:', result.video_url)
        console.log('[VEO3 SERVICE] 📏 URL长度:', result.video_url.length)
        console.log('[VEO3 SERVICE] 🔗 URL类型:', typeof result.video_url)
        console.log('[VEO3 SERVICE] ✅ URL有效性:', result.video_url.startsWith('http'))
        console.log('[VEO3 SERVICE] ============================================')
        
        // 更新 activeJobs 中的任务状态为完成
        const job = this.activeJobs.get(trackingId)
        if (job) {
          job.status = 'completed'
          job.videoUrl = result.video_url
          job.completedAt = new Date()
          job.progress = 100
          this.activeJobs.set(trackingId, job)
          console.log('[VEO3 SERVICE] Updated activeJobs task to completed:', trackingId)
          console.log('[VEO3 SERVICE] 💾 ActiveJob保存的URL:', job.videoUrl)
        }
        
        // 如果提供了 videoRecordId，使用系统级更新
        if (request.videoRecordId) {
          const updateTimestamp = new Date().toISOString()
          console.log('[VEO3 SERVICE] 🎯 CRITICAL UPDATE: Updating Supabase record with system privileges')
          console.log('[VEO3 SERVICE] 📋 Update details:', {
            videoRecordId: request.videoRecordId,
            newStatus: 'completed',
            videoUrl: result.video_url,
            videoUrlLength: result.video_url.length,
            videoUrlType: typeof result.video_url,
            timestamp: updateTimestamp
          })
          
          // 先更新内存状态为完成
          progressManager.markAsCompleted(request.videoRecordId, result.video_url)
          console.log('[VEO3 SERVICE] ✅ Memory state updated via progressManager')
          console.log('[VEO3 SERVICE] 🔄 准备发送到数据库的video_url:', result.video_url)
          
          // 再更新数据库（只更新一次）
          console.log('[VEO3 SERVICE] 🔄 Starting database status update to COMPLETED...')
          const updatePayload = {
            status: 'completed' as const,
            video_url: result.video_url,
            processing_completed_at: new Date().toISOString()
          }
          console.log('[VEO3 SERVICE] 📤 完整更新载荷:', updatePayload)
          
          const updateResult = await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, updatePayload)
          
          if (updateResult) {
            console.log('[VEO3 SERVICE] ✅ Successfully updated video status to completed')
            console.log('[VEO3 SERVICE] 📊 数据库返回的完整数据:', updateResult)
            console.log('[VEO3 SERVICE] 🔍 返回数据中的video_url:', updateResult.video_url)
            console.log('[VEO3 SERVICE] 📏 返回URL长度:', updateResult.video_url ? updateResult.video_url.length : 'NULL')
            console.log('[VEO3 SERVICE] 📊 Final video state:', {
              id: updateResult.id,
              status: updateResult.status,
              hasVideoUrl: !!updateResult.video_url,
              videoUrlMatches: updateResult.video_url === result.video_url,
              completedAt: updateResult.processing_completed_at
            })
          } else {
            console.error('[VEO3 SERVICE] ❌ Failed to update video status, but video was generated:', result.video_url)
            console.error('[VEO3 SERVICE] ❌ updateResult is null/undefined')
          }
        }
        
        // 🔍 验证数据库更新结果
        if (request.videoRecordId) {
          console.log('[VEO3 SERVICE] 🔍 验证数据库更新结果...')
          try {
            // 立即重新读取数据库验证
            const verifyResult = await supabaseVideoService.getVideo(request.videoRecordId)
            if (verifyResult) {
              console.log('[VEO3 SERVICE] 📋 验证结果 - 数据库当前状态:')
              console.log('[VEO3 SERVICE] 🎯 状态:', verifyResult.status)
              console.log('[VEO3 SERVICE] 📹 video_url:', verifyResult.video_url)
              console.log('[VEO3 SERVICE] 📏 video_url长度:', verifyResult.video_url ? verifyResult.video_url.length : 'NULL')
              console.log('[VEO3 SERVICE] ✅ URL匹配:', verifyResult.video_url === result.video_url)
              
              if (!verifyResult.video_url || verifyResult.video_url !== result.video_url) {
                console.error('[VEO3 SERVICE] 🚨 数据库验证失败！video_url未正确保存')
                console.error('[VEO3 SERVICE] 🚨 期望URL:', result.video_url)
                console.error('[VEO3 SERVICE] 🚨 实际URL:', verifyResult.video_url)
              } else {
                console.log('[VEO3 SERVICE] ✅ 数据库验证成功！video_url已正确保存')
              }
            } else {
              console.error('[VEO3 SERVICE] 🚨 数据库验证失败！无法读取视频记录')
            }
          } catch (verifyError) {
            console.error('[VEO3 SERVICE] 🚨 数据库验证出错:', verifyError)
          }
        }
        
        // 主动触发完成事件给所有订阅者
        console.log('[VEO3 SERVICE] 🚀 主动触发完成事件给订阅者:', trackingId)
        
        // 延迟清理任务，给订阅者时间处理完成事件
        setTimeout(() => {
          this.activeJobs.delete(trackingId)
          console.log('[VEO3 SERVICE] Cleaned up completed Qingyun task:', trackingId)
        }, 5000)
        
        // 返回成功响应
        return {
          id: trackingId,
          status: 'completed' as const,
          videoUrl: result.video_url,
          progress: 100,
          createdAt: new Date(),
          completedAt: new Date()
        }
      } else {
        throw new Error('No video URL in response')
      }
    } catch (error) {
      // 更新 activeJobs 中的任务状态为失败
      const job = this.activeJobs.get(trackingId)
      if (job) {
        job.status = 'failed'
        job.error = (error as Error).message
        job.progress = 0
        this.activeJobs.set(trackingId, job)
        console.log('[VEO3 SERVICE] Updated activeJobs task to failed:', trackingId)
      }
      
      // 如果有错误且提供了 videoRecordId，使用系统级更新标记为失败
      if (request.videoRecordId) {
        console.log('[VEO3 SERVICE] Marking video as failed in Supabase with system privileges:', request.videoRecordId)
        const updateResult = await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, {
          status: 'failed',
          error_message: (error as Error).message
        })
        
        if (!updateResult) {
          console.error('[VEO3 SERVICE] Failed to update video status to failed')
        }
      }
      
      // 延迟清理失败的任务
      setTimeout(() => {
        this.activeJobs.delete(trackingId)
        console.log('[VEO3 SERVICE] Cleaned up failed Qingyun task:', trackingId)
      }, 10000)
      
      // 返回失败响应
      return {
        id: trackingId,
        status: 'failed' as const,
        error: (error as Error).message,
        progress: 0,
        createdAt: new Date()
      }
    }
  }

  /**
   * 处理图片为青云API格式（URL数组）
   * 青云API只接受URL格式的图片
   */
  private async processImagesForQingyun(image: string | File): Promise<string[]> {
    // 青云API只接受URL格式
    if (typeof image === 'string' && 
        (image.startsWith('http://') || image.startsWith('https://'))) {
      console.log('[VEO3 SERVICE] Image URL for Qingyun:', image)
      return [image]
    }
    
    // 如果不是URL，抛出错误提示用户
    throw new Error('青云API只支持URL格式的图片。请提供图片的URL地址。')
  }

  /**
   * 使用模拟生成（开发环境）
   */
  private async generateVideoWithMock(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    // 获取可用账户
    const account = this.getNextAvailableAccount()
    if (!account) {
      throw new Error('No available accounts for video generation')
    }

    // 创建生成任务
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const job: VideoGenerationResponse = {
      id: jobId,
      status: 'pending',
      progress: 0,
      createdAt: new Date()
    }

    this.activeJobs.set(jobId, job)

    // 模拟异步生成过程
    this.simulateVideoGeneration(jobId, account, request)

    return job
  }

  private async simulateVideoGeneration(
    jobId: string,
    account: AccountStatus,
    request: VideoGenerationRequest
  ) {
    const job = this.activeJobs.get(jobId)
    if (!job) return

    // 更新状态为处理中
    job.status = 'processing'
    job.progress = 10

    // 模拟生成进度
    const progressSteps = [20, 40, 60, 80, 95, 100]
    for (const progress of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      job.progress = progress
      
      // 随机产生错误（5%概率）
      if (Math.random() < 0.05) {
        job.status = 'failed'
        job.error = 'Video generation failed: API limit exceeded'
        return
      }
    }

    // 生成完成
    job.status = 'completed'
    job.completedAt = new Date()
    job.videoUrl = this.generateMockVideoUrl(request.prompt)
    job.thumbnailUrl = this.generateMockThumbnailUrl(request.prompt)
    job.metadata = {
      duration: Math.floor(Math.random() * 30) + 10, // 10-40秒
      resolution: '1920x1080',
      fileSize: Math.floor(Math.random() * 50) + 10 // 10-60MB
    }

    // 更新账户使用配额
    account.usedQuota += 1
    account.lastUsed = new Date()
  }

  async getJobStatus(jobId: string): Promise<VideoGenerationResponse | null> {
    return this.activeJobs.get(jobId) || null
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId)
    if (job && job.status === 'processing') {
      job.status = 'failed'
      job.error = 'Job cancelled by user'
      return true
    }
    return false
  }

  async retryJob(jobId: string): Promise<VideoGenerationResponse> {
    const job = this.activeJobs.get(jobId)
    if (!job || job.status !== 'failed') {
      throw new Error('Job not found or not in failed state')
    }

    // 重置任务状态
    job.status = 'pending'
    job.error = undefined
    job.progress = 0

    // 重新生成
    const account = this.getNextAvailableAccount()
    if (!account) {
      throw new Error('No available accounts for retry')
    }

    this.simulateVideoGeneration(jobId, account, {
      prompt: '',
      template: '',
      parameters: {},
      credits: 0
    })

    return job
  }

  getAccountsStatus(): AccountStatus[] {
    return this.accounts.map(acc => ({ ...acc }))
  }

  async checkAccountHealth(): Promise<{
    healthy: number
    total: number
    availableQuota: number
  }> {
    const healthy = this.accounts.filter(acc => acc.isActive).length
    const availableQuota = this.accounts.reduce(
      (sum, acc) => sum + (acc.dailyQuota - acc.usedQuota),
      0
    )

    return {
      healthy,
      total: this.accounts.length,
      availableQuota
    }
  }

  /**
   * 获取实时状态更新
   */
  subscribeToStatus(
    jobId: string,
    onUpdate: (status: any) => void
  ): () => void {
    console.log(`[VEO3 SERVICE] 订阅状态更新: ${jobId}`)
    
    // 立即检查当前状态
    const job = this.activeJobs.get(jobId)
    if (job) {
      console.log(`[VEO3 SERVICE] 订阅时的当前状态: ${job.status}, 进度: ${job.progress}%`)
      
      // 如果任务已完成，立即触发完成事件
      if (job.status === 'completed' && job.videoUrl) {
        console.log(`[VEO3 SERVICE] ⚡ 任务已完成，立即触发完成事件: ${jobId}`)
        setTimeout(() => {
          onUpdate({
            type: 'complete',
            data: {
              videoUrl: job.videoUrl,
              thumbnailUrl: job.thumbnailUrl,
              duration: job.metadata?.duration,
              resolution: job.metadata?.resolution,
              fileSize: job.metadata?.fileSize
            }
          })
        }, 100)
      }
    }
    
    // 模拟状态订阅
    const interval = setInterval(() => {
      const job = this.activeJobs.get(jobId)
      if (job) {
        // 转换为期望的更新格式
        if (job.status === 'processing' && job.progress !== undefined && job.progress < 100) {
          onUpdate({
            type: 'progress',
            data: { progress: job.progress }
          })
        } else if (job.status === 'completed') {
          console.log(`[VEO3 SERVICE] ✅ 通过轮询检测到完成状态: ${jobId}`)
          onUpdate({
            type: 'complete',
            data: {
              videoUrl: job.videoUrl,
              thumbnailUrl: job.thumbnailUrl,
              duration: job.metadata?.duration,
              resolution: job.metadata?.resolution,
              fileSize: job.metadata?.fileSize
            }
          })
          clearInterval(interval)
        } else if (job.status === 'failed') {
          console.log(`[VEO3 SERVICE] ❌ 通过轮询检测到失败状态: ${jobId}`)
          onUpdate({
            type: 'error',
            data: { error: job.error || 'Unknown error' }
          })
          clearInterval(interval)
        }
      } else {
        // 如果任务不存在，可能已被清理，停止轮询
        console.log(`[VEO3 SERVICE] 任务不存在，停止状态订阅: ${jobId}`)
        clearInterval(interval)
      }
    }, 1000)
    
    return () => {
      console.log(`[VEO3 SERVICE] 取消状态订阅: ${jobId}`)
      clearInterval(interval)
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    return {
      total: this.activeJobs.size,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      averageProcessingTime: 180 // 3分钟
    }
  }

  private generateMockVideoUrl(prompt: string): string {
    const encodedPrompt = encodeURIComponent(prompt.substring(0, 50))
    return `https://storage.googleapis.com/veo3-mock/videos/${Date.now()}_${encodedPrompt}.mp4`
  }

  private generateMockThumbnailUrl(prompt: string): string {
    const encodedPrompt = encodeURIComponent(prompt.substring(0, 50))
    return `https://storage.googleapis.com/veo3-mock/thumbnails/${Date.now()}_${encodedPrompt}.jpg`
  }

  // 获取生成历史
  async getGenerationHistory(): Promise<VideoGenerationResponse[]> {
    return Array.from(this.activeJobs.values())
      .filter(job => job.status === 'completed')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  // 清理过期任务
  cleanupOldJobs(olderThanHours: number = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000)
    
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.createdAt.getTime() < cutoffTime) {
        this.activeJobs.delete(jobId)
      }
    }
  }

  /**
   * 恢复已有的任务（从数据库重新加载后继续轮询）
   */
  async restoreJob(qingyunTaskId: string, videoRecordId: string): Promise<boolean> {
    console.log(`[VEO3 SERVICE] ========== 开始恢复青云API任务 ==========`)
    console.log(`[VEO3 SERVICE] 🎯 任务ID: ${qingyunTaskId}`)
    console.log(`[VEO3 SERVICE] 🎬 视频ID: ${videoRecordId}`)
    console.log(`[VEO3 SERVICE] 📅 时间: ${new Date().toISOString()}`)
    
    try {
      // 首先检查视频当前状态，避免恢复已完成的任务
      console.log(`[VEO3 SERVICE] 🔍 步骤1：检查视频当前状态...`)
      const supabaseVideoService = (await import('./supabaseVideoService')).default
      const currentVideo = await supabaseVideoService.getVideo(videoRecordId)
      
      if (currentVideo) {
        console.log(`[VEO3 SERVICE] 📊 当前视频状态: ${currentVideo.status}`)
        console.log(`[VEO3 SERVICE] 📊 veo3_job_id: ${currentVideo.veo3_job_id}`)
        console.log(`[VEO3 SERVICE] 📊 video_url存在: ${!!currentVideo.video_url}`)
        
        // 如果视频已经完成或失败，不需要恢复
        if (currentVideo.status === 'completed' || currentVideo.status === 'failed') {
          console.log(`[VEO3 SERVICE] ✅ 视频 ${videoRecordId} 已经是 ${currentVideo.status} 状态，跳过恢复`)
          return false
        }
      } else {
        console.error(`[VEO3 SERVICE] ❌ 无法获取视频 ${videoRecordId} 的状态`)
        return false
      }
      
      // 检查任务是否已经在 activeJobs 中
      console.log(`[VEO3 SERVICE] 🔍 步骤2：检查任务是否已在activeJobs中...`)
      if (this.activeJobs.has(qingyunTaskId)) {
        console.log(`[VEO3 SERVICE] ✅ 任务 ${qingyunTaskId} 已存在于 activeJobs，恢复成功`)
        return true
      } else {
        console.log(`[VEO3 SERVICE] 📝 任务 ${qingyunTaskId} 不在 activeJobs 中，需要恢复`)
      }

      // 获取青云API配置
      console.log(`[VEO3 SERVICE] 🔧 步骤3：获取青云API配置...`)
      const apiKey = process.env.QINGYUN_API_KEY
      const endpoint = process.env.QINGYUN_API_ENDPOINT || 'https://api.qingyuntop.top'
      
      console.log(`[VEO3 SERVICE] 🔧 API端点: ${endpoint}`)
      console.log(`[VEO3 SERVICE] 🔧 API密钥存在: ${!!apiKey}`)
      
      if (!apiKey) {
        console.error('[VEO3 SERVICE] ❌ 青云API密钥未配置，无法恢复任务')
        return false
      }

      // 初始化青云服务
      console.log(`[VEO3 SERVICE] 🚀 步骤4：初始化青云API服务...`)
      const { getQingyunApiService } = await import('./veo/QingyunApiService')
      const qingyunService = getQingyunApiService({
        apiKey,
        endpoint
      })
      console.log(`[VEO3 SERVICE] ✅ 青云API服务初始化完成`)

      // 先查询一次当前状态
      console.log(`[VEO3 SERVICE] 🔍 步骤5：查询青云API任务当前状态...`)
      let currentStatus
      try {
        currentStatus = await qingyunService.queryStatus(qingyunTaskId)
        console.log(`[VEO3 SERVICE] 📊 任务状态查询结果:`)
        console.log(`[VEO3 SERVICE]   - 状态: ${currentStatus.status}`)
        console.log(`[VEO3 SERVICE]   - video_url: ${currentStatus.video_url ? 'EXISTS' : 'NULL'}`)
        console.log(`[VEO3 SERVICE]   - 更新时间: ${new Date(currentStatus.status_update_time * 1000).toISOString()}`)
      } catch (error) {
        console.error(`[VEO3 SERVICE] ❌ 查询任务状态失败 ${qingyunTaskId}:`, error)
        console.error(`[VEO3 SERVICE] 错误详情:`, {
          taskId: qingyunTaskId,
          error: (error as Error)?.message,
          stack: (error as Error)?.stack
        })
        // 如果查询失败，可能任务已经不存在了
        console.log(`[VEO3 SERVICE] 🚫 任务可能已不存在，恢复失败`)
        return false
      }

      // 如果任务已经完成或失败，更新数据库状态
      if (currentStatus.status === 'completed') {
        console.log(`[VEO3 SERVICE] ✅ 步骤6a：任务已完成，更新数据库状态...`)
        console.log(`[VEO3 SERVICE] 🎬 视频URL: ${currentStatus.video_url}`)
        
        try {
          // 更新视频记录状态
          const supabaseVideoService = (await import('./supabaseVideoService')).default
          await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
            status: 'completed' as const,
            video_url: currentStatus.video_url,
            processing_completed_at: new Date().toISOString()
          })
          console.log(`[VEO3 SERVICE] ✅ 数据库状态更新成功`)

          // 更新进度管理器
          progressManager.markAsCompleted(videoRecordId, currentStatus.video_url || undefined)
          console.log(`[VEO3 SERVICE] ✅ 进度管理器更新成功`)
          
          console.log(`[VEO3 SERVICE] 🎉 任务 ${qingyunTaskId} 恢复并完成`)
          return true
        } catch (updateError) {
          console.error(`[VEO3 SERVICE] ❌ 更新完成状态时出错:`, updateError)
          return false
        }
      }

      if (currentStatus.status === 'failed') {
        console.log(`[VEO3 SERVICE] ❌ 步骤6b：任务已失败，更新数据库状态...`)
        
        try {
          // 更新视频记录状态
          const supabaseVideoService = (await import('./supabaseVideoService')).default
          await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
            status: 'failed' as const,
            error_message: 'Task failed during processing'
          })
          console.log(`[VEO3 SERVICE] ✅ 失败状态更新成功`)

          // 更新进度管理器
          progressManager.markAsFailed(videoRecordId, 'Task failed during processing')
          console.log(`[VEO3 SERVICE] ✅ 进度管理器失败状态更新成功`)
          
          console.log(`[VEO3 SERVICE] 💀 任务 ${qingyunTaskId} 恢复确认失败`)
          return false
        } catch (updateError) {
          console.error(`[VEO3 SERVICE] ❌ 更新失败状态时出错:`, updateError)
          return false
        }
      }

      // 如果任务仍在处理中，恢复轮询
      if (currentStatus.status === 'processing' || currentStatus.status === 'pending' || currentStatus.status === 'video_generating') {
        console.log(`[VEO3 SERVICE] 🔄 步骤7：任务仍在处理中，恢复轮询...`)
        console.log(`[VEO3 SERVICE] 📊 当前任务状态: ${currentStatus.status}`)

        // 创建任务对象并添加到 activeJobs
        const initialProgress = currentStatus.status === 'pending' ? 5 : 
                               currentStatus.status === 'video_generating' ? 35 : 15
                               
        const job: VideoGenerationResponse = {
          id: qingyunTaskId,
          status: 'processing',
          progress: initialProgress,
          createdAt: new Date() // 使用当前时间作为恢复时间
        }
        
        console.log(`[VEO3 SERVICE] 📝 创建activeJobs条目: 进度 ${initialProgress}%`)
        this.activeJobs.set(qingyunTaskId, job)

        // 在后台继续轮询（不阻塞返回）
        console.log(`[VEO3 SERVICE] 🔄 启动后台轮询...`)
        this.resumePollingInBackground(qingyunTaskId, qingyunService, videoRecordId)
        
        console.log(`[VEO3 SERVICE] ✅ 青云API轮询恢复成功: ${qingyunTaskId}`)
        return true
      }

      console.warn(`[VEO3 SERVICE] Unknown status for task ${qingyunTaskId}: ${currentStatus.status}`)
      return false

    } catch (error) {
      console.error(`[VEO3 SERVICE] 💥 任务恢复流程失败: ${qingyunTaskId}`)
      console.error(`[VEO3 SERVICE] 🚨 失败详情:`, {
        taskId: qingyunTaskId,
        videoId: videoRecordId,
        error: error instanceof Error ? error.message : String(error),
        stack: (error as Error)?.stack,
        timestamp: new Date().toISOString()
      })
      console.log(`[VEO3 SERVICE] ========== 任务恢复流程结束（失败）==========`)
      return false
    }
  }

  /**
   * 在后台继续轮询任务状态
   */
  private async resumePollingInBackground(
    qingyunTaskId: string, 
    qingyunService: any, 
    videoRecordId: string
  ) {
    console.log(`[VEO3 SERVICE] 🔄 ========== 开始后台轮询 ==========`)
    console.log(`[VEO3 SERVICE] 🎯 青云任务ID: ${qingyunTaskId}`)
    console.log(`[VEO3 SERVICE] 🎬 视频记录ID: ${videoRecordId}`)
    console.log(`[VEO3 SERVICE] ⏰ 开始时间: ${new Date().toISOString()}`)
    
    try {
      console.log(`[VEO3 SERVICE] 🚀 启动青云API轮询监控...`)

      // 继续轮询任务直到完成
      const result = await qingyunService.pollUntilComplete(
        qingyunTaskId,
        (progress: number) => {
          // 更新进度
          console.log(`[VEO3 SERVICE] 📊 青云API进度更新: ${progress}%`)
          progressManager.updateProgress(videoRecordId, {
            progress,
            status: 'processing',
            statusText: progress > 80 ? i18n.t('videoCreator.almostComplete') : i18n.t('videoCreator.processing'),
            qingyunTaskId,
            pollingAttempts: (progressManager.getProgress(videoRecordId)?.pollingAttempts || 0) + 1
          })
        }
      )

      // 更新任务状态
      console.log(`[VEO3 SERVICE] 🎉 后台轮询完成！更新任务状态...`)
      const job = this.activeJobs.get(qingyunTaskId)
      if (job) {
        job.status = 'completed'
        job.progress = 100
        job.completedAt = new Date()
        job.videoUrl = result.video_url || undefined
        console.log(`[VEO3 SERVICE] ✅ activeJobs状态更新完成`)
      } else {
        console.warn(`[VEO3 SERVICE] ⚠️ 在activeJobs中未找到任务 ${qingyunTaskId}`)
      }

      console.log(`[VEO3 SERVICE] 🎬 恢复的任务完成: ${qingyunTaskId}`)
      console.log(`[VEO3 SERVICE] 🎥 生成的视频URL: ${result.video_url || 'NULL'}`)
      
      // 更新进度管理器
      console.log(`[VEO3 SERVICE] 📊 更新进度管理器为完成状态...`)
      progressManager.markAsCompleted(videoRecordId, result.video_url || undefined)
      console.log(`[VEO3 SERVICE] ✅ 进度管理器更新完成`)

      // 更新数据库状态
      console.log(`[VEO3 SERVICE] 💾 更新数据库为完成状态...`)
      const supabaseVideoService = (await import('./supabaseVideoService')).default
      await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
        status: 'completed' as const,
        video_url: result.video_url,
        processing_completed_at: new Date().toISOString()
      })
      console.log(`[VEO3 SERVICE] ✅ 数据库状态更新完成`)

      // 清理任务
      setTimeout(() => {
        this.activeJobs.delete(qingyunTaskId)
        console.log(`[VEO3 SERVICE] Cleaned up restored task: ${qingyunTaskId}`)
      }, 30000) // 30秒后清理

    } catch (error) {
      console.error(`[VEO3 SERVICE] 💥 后台轮询失败: ${qingyunTaskId}`)
      console.error(`[VEO3 SERVICE] 错误详情:`, {
        taskId: qingyunTaskId,
        videoId: videoRecordId,
        error: error instanceof Error ? error.message : String(error),
        stack: (error as Error)?.stack,
        timestamp: new Date().toISOString()
      })
      
      // 标记为失败
      console.log(`[VEO3 SERVICE] 💀 标记任务为失败状态...`)
      const job = this.activeJobs.get(qingyunTaskId)
      if (job) {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : String(error)
        console.log(`[VEO3 SERVICE] ✅ activeJobs失败状态更新完成`)
      } else {
        console.warn(`[VEO3 SERVICE] ⚠️ 在activeJobs中未找到失败的任务 ${qingyunTaskId}`)
      }

      // 更新进度管理器
      console.log(`[VEO3 SERVICE] 📊 更新进度管理器为失败状态...`)
      progressManager.markAsFailed(videoRecordId, error instanceof Error ? error.message : String(error))
      console.log(`[VEO3 SERVICE] ✅ 进度管理器失败状态更新完成`)

      // 更新数据库状态
      console.log(`[VEO3 SERVICE] 💾 更新数据库为失败状态...`)
      try {
        const supabaseVideoService = (await import('./supabaseVideoService')).default
        await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
          status: 'failed' as const,
          error_message: error instanceof Error ? error.message : String(error)
        })
        console.log(`[VEO3 SERVICE] ✅ 数据库失败状态更新完成`)
      } catch (dbError) {
        console.error(`[VEO3 SERVICE] ❌ 更新数据库失败状态时出错:`, dbError)
      }

      // 清理任务
      console.log(`[VEO3 SERVICE] 🧹 清理失败的任务...`)
      this.activeJobs.delete(qingyunTaskId)
      console.log(`[VEO3 SERVICE] ✅ 任务清理完成`)
    }
  }
}

// 导出单例实例
export const veo3Service = new Veo3Service()

export default veo3Service;