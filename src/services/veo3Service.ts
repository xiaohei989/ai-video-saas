import { getApicoreApiService } from './veo/ApicoreApiService'
import { getWuyinApiService } from './veo/WuyinApiService'
import type { VeoApiParams } from './veo/VeoApiAbstraction'
import supabaseVideoService from './supabaseVideoService'
import { progressManager } from './progressManager'
import i18n from '@/i18n/config'
import { detectApiProvider, getApiProviderDisplayName } from '@/utils/apiProviderDetector'

export interface VideoGenerationRequest {
  prompt: string
  template: string
  parameters: Record<string, any>
  userId?: string
  credits: number
  aspectRatio?: '16:9' | '9:16'
  negativePrompt?: string
  image?: string | File
  model?: 'fast' | 'pro'  // 质量设置：fast（快速）或 pro（高质量）
  videoRecordId?: string  // Supabase video record ID for direct updates
  apiProvider?: 'apicore' | 'wuyin'  // API提供商选择
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

  /**
   * 获取默认API提供商
   */
  private getDefaultApiProvider(): 'apicore' | 'wuyin' {
    const defaultProvider = import.meta.env.VITE_PRIMARY_VIDEO_API || 'wuyin'
    // console.log(`[VEO3 SERVICE] 🛠️ 默认API提供商配置: ${defaultProvider}`)
    return defaultProvider as 'apicore' | 'wuyin'
  }

  /**
   * 检查API提供商是否可用
   */
  private async isApiProviderAvailable(provider: 'apicore' | 'wuyin'): Promise<boolean> {
    try {
      if (provider === 'wuyin') {
        const apiKey = import.meta.env.VITE_WUYIN_API_KEY
        return !!apiKey
      } else {
        const apiKey = import.meta.env.VITE_APICORE_API_KEY
        return !!apiKey
      }
    } catch {
      return false
    }
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
    const useRealAPI = import.meta.env.VEO_USE_REAL_API === 'true' || process.env.VEO_USE_REAL_API === 'true'

    if (!useRealAPI) {
      // 使用模拟生成（开发环境）
      return this.generateVideoWithMock(request)
    }

    // 确定API提供商
    const apiProvider = request.apiProvider || this.getDefaultApiProvider()
    // console.log(`[VEO3 SERVICE] 🛠️ 使用API提供商: ${apiProvider} (请求参数: ${request.apiProvider}, 默认配置: ${this.getDefaultApiProvider()})`)

    try {
      // 根据API提供商路由
      if (apiProvider === 'wuyin') {
        // console.log(`[VEO3 SERVICE] ✅ 选择Wuyin API进行视频生成`)
        return await this.generateVideoWithWuyinAPI(request)
      } else {
        // console.log(`[VEO3 SERVICE] ✅ 选择APICore API进行视频生成`)
        return await this.generateVideoWithApicoreAPI(request)
      }
    } catch (error) {
      // console.error(`[VEO3 SERVICE] ${apiProvider} API失败，尝试备用:`, error)

      // 如果主API失败，尝试备用API
      const fallbackProvider: 'apicore' | 'wuyin' = apiProvider === 'wuyin' ? 'apicore' : 'wuyin'

      try {
        // console.log(`[VEO3 SERVICE] 🔄 尝试备用API: ${fallbackProvider}`)
        return await this.generateVideo({ ...request, apiProvider: fallbackProvider })
      } catch (fallbackError) {
        throw error // 抛出原始错误
      }
    }
  }

  /**
   * 使用APICore API生成视频
   */
  private async generateVideoWithApicoreAPI(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const trackingId = `apicore-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // 获取APICore API配置
      const apiKey = import.meta.env.VITE_APICORE_API_KEY
      const endpoint = import.meta.env.VITE_APICORE_ENDPOINT || 'https://api.apicore.ai'
      
      if (!apiKey) {
        throw new Error('APICore API key not configured')
      }

      // 初始化APICore服务
      // console.log(`[VEO3 SERVICE] APICore初始化配置: endpoint=${endpoint}`)
      const apicoreService = getApicoreApiService({
        apiKey,
        endpoint
      })
      
      // 注册任务到 activeJobs
      const job: VideoGenerationResponse = {
        id: trackingId,
        status: 'processing',
        progress: 0,
        createdAt: new Date()
      }
      this.activeJobs.set(trackingId, job)
      // console.log('[VEO3 SERVICE] Registered APICore task to activeJobs:', trackingId)
      
      // console.log('[VEO3 SERVICE] Using APICore API for video generation')
      
      // 处理图片参数
      let images: string[] | undefined
      if (request.image) {
        images = await this.processImagesForApicore(request.image)
      }
      
      // 选择合适的APICore模型
      const quality = request.model || 'fast'
      const aspectRatio = request.aspectRatio || '16:9'
      const apicoreModel = apicoreService.selectModel(quality, !!images)
      
      // 在提示词中添加宽高比设置
      const finalPrompt = aspectRatio === '9:16' 
        ? `Aspect ratio: 9:16. ${request.prompt}`
        : request.prompt
      
      // console.log(`[VEO3 SERVICE] APICore model selected: ${apicoreModel}`)
      
      // 创建视频任务
      const task = await apicoreService.createVideo({
        prompt: finalPrompt,        // 使用增强后的提示词
        model: apicoreModel,        // 使用简化的模型名
        images: images,
        enhance_prompt: true
        // 移除aspect_ratio参数，改为通过提示词控制
      })
      
      // 获取任务ID
      const taskId = task.data
      if (!taskId) {
        throw new Error('No task ID returned from APICore')
      }
      
      // 立即保存APICore任务ID到数据库
      if (request.videoRecordId) {
        // console.log(`[VEO3 SERVICE] ⚡ CRITICAL: Saving APICore task ID to database: ${taskId}`)
        
        // 多次尝试保存，确保成功
        let saveSuccess = false
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, {
              veo3_job_id: taskId,
              status: 'processing',
              processing_started_at: new Date().toISOString()
            })
            // console.log(`[VEO3 SERVICE] ✅ Successfully saved veo3_job_id: ${taskId} (attempt ${attempt})`)
            saveSuccess = true
            break
          } catch (error) {
            // console.error(`[VEO3 SERVICE] ❌ Failed to save veo3_job_id attempt ${attempt}:`, error)
            
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }
        
        if (!saveSuccess) {
          // console.error(`[VEO3 SERVICE] 🚨 CRITICAL: Failed to save veo3_job_id after 3 attempts: ${taskId}`)
        }
      }
      
      // 轮询获取结果
      const result = await apicoreService.pollUntilComplete(
        taskId,
        async (progress) => {
          // 更新 activeJobs 中的进度状态
          const job = this.activeJobs.get(trackingId)
          if (job) {
            job.progress = progress
            job.status = 'processing'
            this.activeJobs.set(trackingId, job)
          }

          // 只在关键进度点输出日志
          if (progress % 25 === 0 || progress >= 95) {
            // console.log(`[VEO3 SERVICE] Progress: ${progress}%`);
          }

          if (request.videoRecordId && progress > 0) {
            progressManager.updateProgress(request.videoRecordId, {
              progress,
              status: 'processing',
              statusText: progress < 50 ? i18n.t('videoCreator.processing') : i18n.t('videoCreator.almostComplete'),
              apiProvider: 'apicore',
              apicoreTaskId: taskId
            })
          }
        },
        60,  // 最大尝试次数（60次 × 10秒 = 10分钟超时）
        10000  // 轮询间隔 10 秒
      )
      
      // 获取视频URL
      const videoUrl = result.videoUrl || result.video_url
      if (videoUrl) {
        // console.log('[VEO3 SERVICE] ========== APICore视频生成完成 ==========')  
        // console.log('[VEO3 SERVICE] 📹 原始视频URL:', videoUrl)
        // console.log('[VEO3 SERVICE] 📏 URL长度:', videoUrl.length)
        // console.log('[VEO3 SERVICE] 🔗 URL类型:', typeof videoUrl)
        // console.log('[VEO3 SERVICE] ✅ URL有效性:', videoUrl.startsWith('http'))
        // console.log('[VEO3 SERVICE] ============================================')
        
        // 更新 activeJobs 中的任务状态为完成
        const job = this.activeJobs.get(trackingId)
        if (job) {
          job.status = 'completed'
          job.videoUrl = videoUrl
          job.completedAt = new Date()
          job.progress = 100
          this.activeJobs.set(trackingId, job)
          // console.log('[VEO3 SERVICE] Updated activeJobs task to completed:', trackingId)
        }
        
        // 如果提供了 videoRecordId，立即迁移到R2并更新数据库
        if (request.videoRecordId) {
          const updateTimestamp = new Date().toISOString()
          // console.log('[VEO3 SERVICE] 🎯 CRITICAL UPDATE: 立即迁移APICore视频到R2存储')
          // console.log('[VEO3 SERVICE] 📋 迁移详情:', {
          //   videoRecordId: request.videoRecordId,
          //   originalVideoUrl: videoUrl,
          //   videoUrlLength: videoUrl.length,
          //   videoUrlType: typeof videoUrl,
          //   timestamp: updateTimestamp
          // })

          // 💾 保存视频URL（迁移由后端触发器自动处理）
          await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, {
            status: 'completed',
            video_url: videoUrl,
            processing_completed_at: updateTimestamp
          })

          // 更新内存状态为完成
          progressManager.markAsCompleted(request.videoRecordId, videoUrl)
        }
        
        // 延迟清理任务
        setTimeout(() => {
          this.activeJobs.delete(trackingId)
          // console.log('[VEO3 SERVICE] Cleaned up completed APICore task:', trackingId)
        }, 5000)
        
        // 返回成功响应（使用真实的APICore task ID）
        return {
          id: taskId,  // 🔧 修复：使用真实的APICore task ID
          status: 'completed' as const,
          videoUrl: videoUrl,
          progress: 100,
          createdAt: new Date(),
          completedAt: new Date()
        }
      } else {
        throw new Error('No video URL in APICore response')
      }
    } catch (error) {
      // 更新 activeJobs 中的任务状态为失败
      const job = this.activeJobs.get(trackingId)
      if (job) {
        job.status = 'failed'
        job.error = (error as Error).message
        job.progress = 0
        this.activeJobs.set(trackingId, job)
        // console.log('[VEO3 SERVICE] Updated activeJobs task to failed:', trackingId)
      }
      
      // 如果有错误且提供了 videoRecordId，使用系统级更新标记为失败
      if (request.videoRecordId) {
        // console.log('[VEO3 SERVICE] Marking video as failed in Supabase with system privileges:', request.videoRecordId)
        const updateResult = await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, {
          status: 'failed',
          error_message: (error as Error).message
        })

        if (!updateResult) {
          // console.error('[VEO3 SERVICE] Failed to update video status to failed')
        }

        // 🔧 修复：更新progressManager状态为失败，确保前端卡片显示失败状态
        progressManager.markAsFailed(request.videoRecordId, (error as Error).message)
      }

      // 延迟清理失败的任务
      setTimeout(() => {
        this.activeJobs.delete(trackingId)
        // console.log('[VEO3 SERVICE] Cleaned up failed APICore task:', trackingId)
      }, 10000)

      // 返回失败响应（优先使用真实task ID）
      const finalTaskId = typeof taskId !== 'undefined' ? taskId : trackingId
      // console.log(`[VEO3 SERVICE] 🔧 APICore返回失败ID: ${finalTaskId} (真实ID: ${typeof taskId !== 'undefined' ? taskId : 'undefined'})`)
      return {
        id: finalTaskId,  // 🔧 修复：优先使用真实APICore task ID
        status: 'failed' as const,
        error: (error as Error).message,
        progress: 0,
        createdAt: new Date()
      }
    }
  }

  /**
   * 处理图片为APICore格式（URL数组）
   */
  private async processImagesForApicore(image: string | File): Promise<string[]> {
    // 如果已经是URL，直接使用
    if (typeof image === 'string' && 
        (image.startsWith('http://') || image.startsWith('https://'))) {
      // console.log('[VEO3 SERVICE] Using existing image URL for APICore:', image)
      return [image]
    }
    
    // 如果是base64格式，上传到Supabase Storage获取URL
    if (typeof image === 'string' && image.startsWith('data:image/')) {
      // console.log('[VEO3 SERVICE] Uploading base64 image to Supabase Storage for APICore')
      
      // 动态导入图片上传服务，避免循环依赖
      const { imageUploadService } = await import('./imageUploadService')
      
      try {
        const url = await imageUploadService.uploadBase64Image(image)
        // console.log('[VEO3 SERVICE] Successfully uploaded image to Supabase, URL:', url)
        return [url]
      } catch (error) {
        // console.error('[VEO3 SERVICE] Failed to upload image to Supabase:', error)
        throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // 如果是File对象，需要转换为base64后上传
    if (image instanceof File) {
      // console.log('[VEO3 SERVICE] Converting File to base64 and uploading for APICore')
      
      const base64 = await this.fileToBase64(image)
      const { imageUploadService } = await import('./imageUploadService')
      
      try {
        const url = await imageUploadService.uploadBase64Image(base64)
        // console.log('[VEO3 SERVICE] Successfully uploaded File to Supabase, URL:', url)
        return [url]
      } catch (error) {
        // console.error('[VEO3 SERVICE] Failed to upload File to Supabase:', error)
        throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    throw new Error('Unsupported image format. APICore requires URL, base64, or File format.')
  }

  /**
   * 将File对象转换为base64字符串
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to convert file to base64'))
        }
      }
      reader.onerror = () => reject(new Error('FileReader error'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * 处理图片为Wuyin API格式（URL数组）
   * Wuyin API支持URL格式的图片
   */
  private async processImagesForWuyin(image: string | File): Promise<string[]> {
    // 如果是字符串URL，直接返回
    if (typeof image === 'string' &&
        (image.startsWith('http://') || image.startsWith('https://'))) {
      return [image]
    }

    // 如果是base64格式，上传到Supabase Storage获取URL
    if (typeof image === 'string' && image.startsWith('data:image/')) {
      console.log('[VEO3 SERVICE] Uploading base64 image to Supabase Storage for Wuyin')

      // 动态导入图片上传服务
      const { imageUploadService } = await import('./imageUploadService')

      try {
        const url = await imageUploadService.uploadBase64Image(image)
        console.log('[VEO3 SERVICE] Successfully uploaded image to Supabase, URL:', url)
        return [url]
      } catch (error) {
        console.error('[VEO3 SERVICE] Failed to upload image to Supabase:', error)
        throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // 如果是File对象，需要转换为base64后上传
    if (image instanceof File) {
      console.log('[VEO3 SERVICE] Converting File to base64 and uploading for Wuyin')

      const base64 = await this.fileToBase64(image)
      const { imageUploadService } = await import('./imageUploadService')

      try {
        const url = await imageUploadService.uploadBase64Image(base64)
        console.log('[VEO3 SERVICE] Successfully uploaded File to Supabase, URL:', url)
        return [url]
      } catch (error) {
        console.error('[VEO3 SERVICE] Failed to upload File to Supabase:', error)
        throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    throw new Error('Unsupported image format. Wuyin requires URL, base64, or File format.')
  }

  /**
   * 使用Wuyin API生成视频
   */
  private async generateVideoWithWuyinAPI(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const trackingId = `wuyin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      // 获取Wuyin API配置
      const apiKey = import.meta.env.VITE_WUYIN_API_KEY
      const endpoint = import.meta.env.VITE_WUYIN_ENDPOINT || 'https://api.wuyinkeji.com'

      if (!apiKey) {
        throw new Error('Wuyin API key not configured')
      }

      // 初始化Wuyin服务
      const wuyinService = getWuyinApiService({
        apiKey,
        endpoint
      })

      // 注册任务到 activeJobs
      const job: VideoGenerationResponse = {
        id: trackingId,
        status: 'processing',
        progress: 0,
        createdAt: new Date()
      }
      this.activeJobs.set(trackingId, job)

      console.log('[VEO3 SERVICE] Using Wuyin API for video generation')

      // 直接使用传入的model作为模型名称
      // 支持: veo3, veo3-pro, veo3.1-fast, veo3.1-pro
      const modelName = request.model || 'veo3'
      const hasImages = !!request.image

      console.log(`[VEO3 SERVICE] Wuyin model selected: ${modelName}`)

      // 处理图片URL
      let imageUrls: string[] | undefined
      if (request.image) {
        imageUrls = await this.processImagesForWuyin(request.image)
      }

      // 构建统一的API参数
      const apiParams: VeoApiParams = {
        endpoint_url: endpoint,
        key: apiKey,
        model_name: modelName,
        prompt: request.prompt,
        type: hasImages ? 'img2video' : 'text2video',
        img_url: imageUrls,
        ratio: request.aspectRatio || '16:9'
      }

      // 创建视频任务
      const task = await wuyinService.createVideo(apiParams)

      // 🔧 FIX: 记录统一的开始时间,避免移动端进度跳动
      const processingStartTime = new Date()
      const processingStartTimeISO = processingStartTime.toISOString()

      // 立即保存Wuyin任务ID到数据库
      if (request.videoRecordId) {
        console.log(`[VEO3 SERVICE] ⚡ CRITICAL: Saving Wuyin task ID to database: ${task.taskId}`)
        console.log(`[VEO3 SERVICE] 📅 Processing start time: ${processingStartTimeISO}`)

        let saveSuccess = false
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, {
              veo3_job_id: task.taskId,
              status: 'processing',
              processing_started_at: processingStartTimeISO
            })
            console.log(`[VEO3 SERVICE] ✅ Successfully saved veo3_job_id: ${task.taskId}`)
            saveSuccess = true
            break
          } catch (error) {
            console.error(`[VEO3 SERVICE] ❌ Failed to save veo3_job_id attempt ${attempt}:`, error)
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }

        if (!saveSuccess) {
          console.error(`[VEO3 SERVICE] 🚨 CRITICAL: Failed to save veo3_job_id after 3 attempts`)
        }
      }

      // 确定视频质量：根据模型名称判断
      const videoQuality = (modelName.includes('fast') || modelName === 'veo3') ? 'fast' : 'pro'
      console.log(`[VEO3 SERVICE] Video quality mode: ${videoQuality}`)

      // 🔧 FIX: 传递统一的开始时间给 Wuyin API,避免进度计算不一致
      const result = await wuyinService.pollUntilComplete(
        task.taskId,
        async (progress) => {
          // 更新 activeJobs 中的进度状态
          const job = this.activeJobs.get(trackingId)
          if (job) {
            job.progress = progress
            job.status = 'processing'
            this.activeJobs.set(trackingId, job)
          }

          if (request.videoRecordId && progress > 0) {
            progressManager.updateProgress(request.videoRecordId, {
              progress,
              status: 'processing',
              statusText: progress < 50 ? i18n.t('videoCreator.processing') : i18n.t('videoCreator.almostComplete'),
              apiProvider: 'wuyin',
              wuyinTaskId: task.taskId
            })
          }
        },
        60,
        10000,
        videoQuality, // 传递质量参数
        processingStartTime // 🔧 FIX: 传递统一的开始时间
      )

      if (result.video_url) {
        console.log('[VEO3 SERVICE] ========== Wuyin视频生成完成 ==========')
        console.log('[VEO3 SERVICE] 📹 视频URL:', result.video_url)

        // 更新 activeJobs
        const job = this.activeJobs.get(trackingId)
        if (job) {
          job.status = 'completed'
          job.videoUrl = result.video_url
          job.completedAt = new Date()
          job.progress = 100
          this.activeJobs.set(trackingId, job)
        }

        // 更新数据库
        if (request.videoRecordId) {
          await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, {
            status: 'completed',
            video_url: result.video_url,
            processing_completed_at: new Date().toISOString()
          })

          progressManager.markAsCompleted(request.videoRecordId, result.video_url)
        }

        // 延迟清理任务
        setTimeout(() => {
          this.activeJobs.delete(trackingId)
        }, 5000)

        return {
          id: task.taskId,
          status: 'completed',
          videoUrl: result.video_url,
          progress: 100,
          createdAt: new Date(),
          completedAt: new Date()
        }
      } else {
        throw new Error('No video URL in Wuyin response')
      }
    } catch (error) {
      // 错误处理
      const job = this.activeJobs.get(trackingId)
      if (job) {
        job.status = 'failed'
        job.error = (error as Error).message
        this.activeJobs.set(trackingId, job)
      }

      if (request.videoRecordId) {
        await supabaseVideoService.updateVideoAsSystem(request.videoRecordId, {
          status: 'failed',
          error_message: (error as Error).message
        })
        progressManager.markAsFailed(request.videoRecordId, (error as Error).message)
      }

      return {
        id: trackingId,
        status: 'failed',
        error: (error as Error).message,
        progress: 0,
        createdAt: new Date()
      }
    }
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
    // console.log(`[VEO3 SERVICE] 订阅状态更新: ${jobId}`)
    
    // 立即检查当前状态
    const job = this.activeJobs.get(jobId)
    if (job) {
      // console.log(`[VEO3 SERVICE] 订阅时的当前状态: ${job.status}, 进度: ${job.progress}%`)
      
      // 如果任务已完成，立即触发完成事件
      if (job.status === 'completed' && job.videoUrl) {
        // console.log(`[VEO3 SERVICE] ⚡ 任务已完成，立即触发完成事件: ${jobId}`)
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
          // console.log(`[VEO3 SERVICE] ✅ 通过轮询检测到完成状态: ${jobId}`)
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
          // console.log(`[VEO3 SERVICE] ❌ 通过轮询检测到失败状态: ${jobId}`)
          onUpdate({
            type: 'error',
            data: { error: job.error || 'Unknown error' }
          })
          clearInterval(interval)
        }
      } else {
        // 如果任务不存在，可能已被清理，停止轮询
        // console.log(`[VEO3 SERVICE] 任务不存在，停止状态订阅: ${jobId}`)
        clearInterval(interval)
      }
    }, 1000)
    
    return () => {
      // console.log(`[VEO3 SERVICE] 取消状态订阅: ${jobId}`)
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
   * 支持APICore和Wuyin任务的恢复
   */
  async restoreJob(taskId: string, videoRecordId: string, provider?: 'apicore' | 'wuyin'): Promise<boolean> {
    // 🔧 使用智能检测而不是简单的前缀匹配
    if (!provider) {
      provider = detectApiProvider(taskId) as 'apicore' | 'wuyin';
    }

    const apiDisplayName = getApiProviderDisplayName(provider);
    // console.log(`[VEO3 SERVICE] 🔄 恢复${apiDisplayName}任务: ${taskId}`)

    if (provider === 'wuyin') {
      return this.restoreWuyinJob(taskId, videoRecordId)
    } else {
      return this.restoreApicoreJob(taskId, videoRecordId)
    }
  }

  /**
   * 恢复APICore任务
   */
  private async restoreApicoreJob(apicoreTaskId: string, videoRecordId: string): Promise<boolean> {
    // console.log(`[VEO3 SERVICE] ========== 开始恢复APICore任务 ==========`)
    // console.log(`[VEO3 SERVICE] 🎯 APICore任务ID: ${apicoreTaskId}`)
    // console.log(`[VEO3 SERVICE] 🎬 视频ID: ${videoRecordId}`)
    // console.log(`[VEO3 SERVICE] 📅 时间: ${new Date().toISOString()}`)
    
    try {
      // 检查视频当前状态
      const supabaseVideoService = (await import('./supabaseVideoService')).default
      const currentVideo = await supabaseVideoService.getVideo(videoRecordId)
      
      if (currentVideo) {
        // console.log(`[VEO3 SERVICE] 📊 当前视频状态: ${currentVideo.status}`)
        
        if (currentVideo.status === 'completed' || currentVideo.status === 'failed') {
          // console.log(`[VEO3 SERVICE] ✅ 视频 ${videoRecordId} 已经是 ${currentVideo.status} 状态，跳过恢复`)
          return false
        }
      }
      
      // 检查任务是否已经在 activeJobs 中
      if (this.activeJobs.has(apicoreTaskId)) {
        // console.log(`[VEO3 SERVICE] ✅ 任务 ${apicoreTaskId} 已存在于 activeJobs，恢复成功`)
        return true
      }

      // 获取APICore API配置
      const apiKey = import.meta.env.VITE_APICORE_API_KEY
      const endpoint = import.meta.env.VITE_APICORE_ENDPOINT || 'https://api.apicore.ai'
      
      if (!apiKey) {
        // console.error('[VEO3 SERVICE] APICore API密钥未配置，无法恢复任务')
        return false
      }

      // 初始化APICore服务
      // console.log(`[VEO3 SERVICE] APICore恢复任务配置: endpoint=${endpoint}`)
      const { getApicoreApiService } = await import('./veo/ApicoreApiService')
      const apicoreService = getApicoreApiService({
        apiKey,
        endpoint
      })

      // 查询当前状态
      let currentStatus
      try {
        currentStatus = await apicoreService.queryStatus(apicoreTaskId)
        // console.log(`[VEO3 SERVICE] 📊 APICore任务状态:`, {
        //   status: currentStatus.data?.status || currentStatus.status || currentStatus.code,
        //   video_url: currentStatus.data?.data?.videoUrl || currentStatus.data?.videoUrl ? 'EXISTS' : 'NULL'
        // })
      } catch (error) {
        // console.error(`[VEO3 SERVICE] ❌ 查询APICore任务状态失败 ${apicoreTaskId}:`, error)
        return false
      }

      const status = currentStatus.data?.status || currentStatus.status || currentStatus.code || 'UNKNOWN'
      const videoUrl = currentStatus.data?.data?.videoUrl || currentStatus.data?.videoUrl || currentStatus.videoUrl

      // 如果任务已经完成
      if (status === 'SUCCESS' || status === 'COMPLETED') {
        // console.log(`[VEO3 SERVICE] ✅ APICore任务已完成，更新数据库状态...`)
        
        if (videoUrl) {
          try {
            // 💾 保存视频URL（迁移由后端触发器自动处理）
            await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
              status: 'completed',
              video_url: videoUrl,
              processing_completed_at: new Date().toISOString()
            })

            // 更新进度管理器
            progressManager.markAsCompleted(videoRecordId, videoUrl)
            return true
          } catch (updateError) {
            console.error(`[VEO3 SERVICE] ❌ 更新完成状态时出错:`, updateError)
            return false
          }
        }
      }

      // 如果任务失败
      if (status === 'FAILED' || status === 'ERROR') {
        // console.log(`[VEO3 SERVICE] ❌ APICore任务已失败，更新数据库状态...`)
        
        try {
          await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
            status: 'failed' as const,
            error_message: 'APICore task failed during processing'
          })
          progressManager.markAsFailed(videoRecordId, 'APICore task failed')
          // console.log(`[VEO3 SERVICE] 💀 APICore任务 ${apicoreTaskId} 恢复确认失败`)
          return false
        } catch (updateError) {
          // console.error(`[VEO3 SERVICE] ❌ 更新失败状态时出错:`, updateError)
          return false
        }
      }

      // 如果任务仍在处理中，恢复轮询
      if (status === 'IN_PROGRESS' || status === 'PROCESSING' || status === 'NOT_START') {
        // console.log(`[VEO3 SERVICE] 🔄 APICore任务仍在处理中，恢复轮询...`)

        // 创建任务对象并添加到 activeJobs，不设置固定进度
        const job: VideoGenerationResponse = {
          id: apicoreTaskId,
          status: 'processing',
          progress: 0, // 让ProgressManager统一管理进度
          createdAt: new Date()
        }
        
        this.activeJobs.set(apicoreTaskId, job)

        // 在后台继续轮询（使用通用方法）
        this.resumePollingInBackground(apicoreTaskId, apicoreService, videoRecordId, 'apicore')
        
        // console.log(`[VEO3 SERVICE] ✅ APICore轮询恢复成功: ${apicoreTaskId}`)
        return true
      }

      // console.warn(`[VEO3 SERVICE] Unknown APICore status: ${status}`)
      return false

    } catch (error) {
      // console.error(`[VEO3 SERVICE] 💥 APICore任务恢复失败: ${apicoreTaskId}`, error)
      return false
    }
  }

  /**
   * 恢复Wuyin任务
   */
  private async restoreWuyinJob(wuyinTaskId: string, videoRecordId: string): Promise<boolean> {
    console.log(`[VEO3 SERVICE] ========== 开始恢复Wuyin任务 ==========`)
    console.log(`[VEO3 SERVICE] 🎯 Wuyin任务ID: ${wuyinTaskId}`)
    console.log(`[VEO3 SERVICE] 🎬 视频ID: ${videoRecordId}`)

    try {
      // 检查视频当前状态
      const supabaseVideoService = (await import('./supabaseVideoService')).default
      const currentVideo = await supabaseVideoService.getVideo(videoRecordId)

      if (currentVideo) {
        console.log(`[VEO3 SERVICE] 📊 当前视频状态: ${currentVideo.status}`)

        if (currentVideo.status === 'completed' || currentVideo.status === 'failed') {
          console.log(`[VEO3 SERVICE] ✅ 视频 ${videoRecordId} 已经是 ${currentVideo.status} 状态，跳过恢复`)
          return false
        }
      }

      // 检查任务是否已经在 activeJobs 中
      if (this.activeJobs.has(wuyinTaskId)) {
        console.log(`[VEO3 SERVICE] ✅ 任务 ${wuyinTaskId} 已存在于 activeJobs，恢复成功`)
        return true
      }

      // 获取Wuyin API配置
      const apiKey = import.meta.env.VITE_WUYIN_API_KEY
      const endpoint = import.meta.env.VITE_WUYIN_ENDPOINT || 'https://api.wuyinkeji.com'

      if (!apiKey) {
        console.error('[VEO3 SERVICE] Wuyin API密钥未配置，无法恢复任务')
        return false
      }

      // 初始化Wuyin服务
      console.log(`[VEO3 SERVICE] Wuyin恢复任务配置: endpoint=${endpoint}`)
      const wuyinService = getWuyinApiService({
        apiKey,
        endpoint
      })

      // 查询当前状态
      let currentStatus
      try {
        currentStatus = await wuyinService.queryStatus(wuyinTaskId)
        console.log(`[VEO3 SERVICE] 📊 Wuyin任务状态:`, {
          status: currentStatus.status,
          video_url: currentStatus.video_url ? 'EXISTS' : 'NULL'
        })
      } catch (error) {
        console.error(`[VEO3 SERVICE] ❌ 查询Wuyin任务状态失败 ${wuyinTaskId}:`, error)
        return false
      }

      // 如果任务已经完成
      if (currentStatus.status === 'completed' && currentStatus.video_url) {
        console.log(`[VEO3 SERVICE] ✅ Wuyin任务已完成，更新数据库状态...`)

        try {
          await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
            status: 'completed',
            video_url: currentStatus.video_url,
            processing_completed_at: new Date().toISOString()
          })

          progressManager.markAsCompleted(videoRecordId, currentStatus.video_url)
          return true
        } catch (updateError) {
          console.error(`[VEO3 SERVICE] ❌ 更新完成状态时出错:`, updateError)
          return false
        }
      }

      // 如果任务失败
      if (currentStatus.status === 'failed') {
        console.log(`[VEO3 SERVICE] ❌ Wuyin任务已失败，更新数据库状态...`)

        try {
          await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
            status: 'failed' as const,
            error_message: currentStatus.fail_reason || 'Wuyin task failed during processing'
          })
          progressManager.markAsFailed(videoRecordId, currentStatus.fail_reason || 'Task failed')
          console.log(`[VEO3 SERVICE] 💀 Wuyin任务 ${wuyinTaskId} 恢复确认失败`)
          return false
        } catch (updateError) {
          console.error(`[VEO3 SERVICE] ❌ 更新失败状态时出错:`, updateError)
          return false
        }
      }

      // 如果任务仍在处理中，恢复轮询
      if (currentStatus.status === 'processing' || currentStatus.status === 'queued') {
        console.log(`[VEO3 SERVICE] 🔄 Wuyin任务仍在处理中，恢复轮询...`)

        // 创建任务对象并添加到 activeJobs
        const job: VideoGenerationResponse = {
          id: wuyinTaskId,
          status: 'processing',
          progress: currentStatus.progress || 0,
          createdAt: new Date()
        }

        this.activeJobs.set(wuyinTaskId, job)

        // 在后台继续轮询
        this.resumePollingInBackground(wuyinTaskId, wuyinService, videoRecordId, 'wuyin')

        console.log(`[VEO3 SERVICE] ✅ Wuyin轮询恢复成功: ${wuyinTaskId}`)
        return true
      }

      console.warn(`[VEO3 SERVICE] Unknown Wuyin status: ${currentStatus.status}`)
      return false

    } catch (error) {
      console.error(`[VEO3 SERVICE] 💥 Wuyin任务恢复失败: ${wuyinTaskId}`, error)
      return false
    }
  }

  /**
   * 在后台继续轮询任务状态
   */
  private async resumePollingInBackground(
    taskId: string,
    apiService: any,
    videoRecordId: string,
    provider: 'apicore' | 'wuyin' = 'wuyin'
  ) {
    const providerName = provider === 'apicore' ? 'APICore' : 'Wuyin'
    // console.log(`[VEO3 SERVICE] 🔄 ========== 开始后台轮询 ==========`)
    // console.log(`[VEO3 SERVICE] 🎯 ${providerName}任务ID: ${taskId}`)
    // console.log(`[VEO3 SERVICE] 🎬 视频记录ID: ${videoRecordId}`)
    // console.log(`[VEO3 SERVICE] ⏰ 开始时间: ${new Date().toISOString()}`)
    
    try {
      // console.log(`[VEO3 SERVICE] 🚀 启动${providerName}轮询监控...`)

      // 继续轮询任务直到完成
      const result = await apiService.pollUntilComplete(
        taskId,
        (progress: number) => {
          // 更新进度
          // console.log(`[VEO3 SERVICE] 📊 ${providerName}进度更新: ${progress}%`)
          progressManager.updateProgress(videoRecordId, {
            progress,
            status: 'processing',
            statusText: progress > 80 ? i18n.t('videoCreator.almostComplete') : i18n.t('videoCreator.processing'),
            apiProvider: provider,
            apicoreTaskId: provider === 'apicore' ? taskId : undefined,
            wuyinTaskId: provider === 'wuyin' ? taskId : undefined,
            pollingAttempts: (progressManager.getProgress(videoRecordId)?.pollingAttempts || 0) + 1
          })
        }
      )

      // 更新任务状态
      // console.log(`[VEO3 SERVICE] 🎉 后台轮询完成！更新任务状态...`)
      const job = this.activeJobs.get(taskId)
      if (job) {
        job.status = 'completed'
        job.progress = 100
        job.completedAt = new Date()
        job.videoUrl = result.video_url || undefined
        // console.log(`[VEO3 SERVICE] ✅ activeJobs状态更新完成`)
      } else {
        // console.warn(`[VEO3 SERVICE] ⚠️ 在activeJobs中未找到任务 ${taskId}`)
      }

      // console.log(`[VEO3 SERVICE] 🎬 恢复的任务完成: ${taskId}`)
      // console.log(`[VEO3 SERVICE] 🎥 生成的视频URL: ${result.video_url || 'NULL'}`)
      
      // 更新进度管理器
      // console.log(`[VEO3 SERVICE] 📊 更新进度管理器为完成状态...`)
      progressManager.updateProgress(videoRecordId, {
        progress: 100,
        status: 'completed',
        statusText: i18n.t('videoCreator.completed'),
        apiProvider: provider,
        apicoreTaskId: provider === 'apicore' ? taskId : undefined,
        wuyinTaskId: provider === 'wuyin' ? taskId : undefined
      })
      
      // 🚀 立即执行R2迁移（恢复的任务也需要迁移）
      // console.log(`[VEO3 SERVICE] 💾 更新数据库为完成状态并立即迁移到R2...`)
      const supabaseVideoService = (await import('./supabaseVideoService')).default
      
      let finalVideoUrl = result.video_url
      let migrationSuccess = false
      
      try {
        // 动态导入迁移服务
        const { videoMigrationService } = await import('./videoMigrationService')
        
        // 先保存第三方URL到数据库，设置迁移状态为下载中
        await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
          status: 'completed',
          video_url: result.video_url,
          processing_completed_at: new Date().toISOString(),
          migration_status: 'downloading',
          original_video_url: result.video_url
        })
        
        // 执行迁移（使用服务端迁移方法，避免CORS问题）
        const migrationResult = await videoMigrationService.migrateVideoServerSide(videoRecordId)
        // console.log(`[VEO3 SERVICE] 📊 恢复任务迁移结果:`, {
        //   success: migrationResult.success,
        //   r2Url: migrationResult.r2Url,
        //   error: migrationResult.error
        // })
        
        if (migrationResult.success && migrationResult.r2Url) {
          // 迁移成功，使用R2 URL
          finalVideoUrl = migrationResult.r2Url
          migrationSuccess = true
          // console.log(`[VEO3 SERVICE] ✅ 恢复任务迁移成功！最终URL:`, finalVideoUrl)
          
          // 更新数据库，将video_url也设置为R2 URL
          await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
            video_url: finalVideoUrl,
            r2_url: finalVideoUrl,
            r2_key: migrationResult.r2Key || undefined,
            migration_status: 'completed',
            r2_uploaded_at: new Date().toISOString()
          })
        } else {
          // 迁移失败，保持原始URL
          // console.warn(`[VEO3 SERVICE] ⚠️ 恢复任务迁移失败，保持原始URL:`, migrationResult.error)
          await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
            migration_status: 'failed'
          })
        }
      } catch (migrationError) {
        // console.error(`[VEO3 SERVICE] ❌ 恢复任务R2迁移出错:`, migrationError)
        // 迁移失败，但任务仍然完成
        await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
          status: 'completed',
          video_url: result.video_url,
          processing_completed_at: new Date().toISOString(),
          migration_status: 'failed'
        })
      }
      
      // 更新进度管理器为最终完成状态（使用最终URL）
      progressManager.markAsCompleted(videoRecordId, finalVideoUrl || undefined)
      // console.log(`[VEO3 SERVICE] ✅ 进度管理器更新完成，使用最终URL:`, finalVideoUrl)

      // 清理任务
      setTimeout(() => {
        this.activeJobs.delete(taskId)
        // console.log(`[VEO3 SERVICE] Cleaned up restored task: ${taskId}`)
      }, 30000) // 30秒后清理

    } catch (error) {
      // console.error(`[VEO3 SERVICE] 💥 后台轮询失败: ${taskId}`)
      // console.error(`[VEO3 SERVICE] 错误详情:`, {
      //   taskId: taskId,
      //   videoId: videoRecordId,
      //   error: error instanceof Error ? error.message : String(error),
      //   stack: (error as Error)?.stack,
      //   timestamp: new Date().toISOString()
      // })
      
      // 标记为失败
      // console.log(`[VEO3 SERVICE] 💀 标记任务为失败状态...`)
      const job = this.activeJobs.get(taskId)
      if (job) {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : String(error)
        // console.log(`[VEO3 SERVICE] ✅ activeJobs失败状态更新完成`)
      } else {
        // console.warn(`[VEO3 SERVICE] ⚠️ 在activeJobs中未找到失败的任务 ${taskId}`)
      }

      // 更新进度管理器
      // console.log(`[VEO3 SERVICE] 📊 更新进度管理器为失败状态...`)
      progressManager.markAsFailed(videoRecordId, error instanceof Error ? error.message : String(error))
      // console.log(`[VEO3 SERVICE] ✅ 进度管理器失败状态更新完成`)

      // 更新数据库状态
      // console.log(`[VEO3 SERVICE] 💾 更新数据库为失败状态...`)
      try {
        const supabaseVideoService = (await import('./supabaseVideoService')).default
        await supabaseVideoService.updateVideoAsSystem(videoRecordId, {
          status: 'failed' as const,
          error_message: error instanceof Error ? error.message : String(error)
        })
        // console.log(`[VEO3 SERVICE] ✅ 数据库失败状态更新完成`)
      } catch (dbError) {
        // console.error(`[VEO3 SERVICE] ❌ 更新数据库失败状态时出错:`, dbError)
      }

      // 清理任务
      // console.log(`[VEO3 SERVICE] 🧹 清理失败的任务...`)
      this.activeJobs.delete(taskId)
      // console.log(`[VEO3 SERVICE] ✅ 任务清理完成`)
    }
  }
}

// 导出单例实例
export const veo3Service = new Veo3Service()

export default veo3Service;