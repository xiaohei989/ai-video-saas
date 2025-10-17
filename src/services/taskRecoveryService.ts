/**
 * 任务恢复服务
 * 处理页面重新加载或关闭重开后的任务状态恢复
 */

import i18n from '@/i18n/config'
import { progressManager } from './progressManager'
import supabaseVideoService from './supabaseVideoService'
import { veo3Service } from './veo3Service'
import type { Database } from '@/lib/supabase'

type Video = Database['public']['Tables']['videos']['Row']

export interface TaskRecoveryResult {
  restoredCount: number
  resumedPollingCount: number
  errors: string[]
  restoredVideoIds: string[] // 恢复的视频ID列表，用于创建广播监听器
}

class TaskRecoveryService {
  private isRecovering = false

  /**
   * 恢复用户的所有处理中任务
   */
  async recoverProcessingTasks(userId: string): Promise<TaskRecoveryResult> {
    console.log(`[TASK RECOVERY] ========== 开始任务恢复流程 ==========`)
    console.log(`[TASK RECOVERY] 用户ID: ${userId}`)
    console.log(`[TASK RECOVERY] 当前恢复状态: ${this.isRecovering}`)
    console.log(`[TASK RECOVERY] 时间: ${new Date().toISOString()}`)
    
    if (this.isRecovering) {
      console.log('[TASK RECOVERY] ⚠️ Recovery already in progress, skipping...')
      return { restoredCount: 0, resumedPollingCount: 0, errors: [], restoredVideoIds: [] }
    }

    this.isRecovering = true
    const result: TaskRecoveryResult = {
      restoredCount: 0,
      resumedPollingCount: 0,
      errors: [],
      restoredVideoIds: []
    }

    try {
      console.log('[TASK RECOVERY] 🚀 === 开始任务恢复 ===')
      
      // 1. 先从数据库恢复进度数据
      console.log('[TASK RECOVERY] 📊 第1步：从数据库恢复进度数据...')
      const dbRestored = await progressManager.restoreFromDatabase(userId)
      result.restoredCount = dbRestored
      console.log(`[TASK RECOVERY] 📊 进度数据恢复结果: ${dbRestored} 个任务`)
      
      // 2. 获取所有处理中和等待中的视频
      console.log('[TASK RECOVERY] 🔍 第2步：查找处理中的视频任务...')
      const processingVideos = await this.getProcessingVideos(userId)
      console.log(`[TASK RECOVERY] 🔍 发现 ${processingVideos.length} 个处理中/等待中的视频`)
      
      if (processingVideos.length > 0) {
        console.log('[TASK RECOVERY] 📋 视频详情:')
        processingVideos.forEach((video, index) => {
          console.log(`[TASK RECOVERY]   ${index + 1}. ID: ${video.id}, Status: ${video.status}, JobID: ${video.veo3_job_id || 'MISSING'}`)
        })
      }
      
      // 3. 为每个视频尝试恢复轮询
      console.log('[TASK RECOVERY] 🔄 第3步：恢复视频轮询...')
      for (let i = 0; i < processingVideos.length; i++) {
        const video = processingVideos[i]
        console.log(`[TASK RECOVERY] 🔄 处理视频 ${i + 1}/${processingVideos.length}: ${video.id}`)
        
        try {
          const resumed = await this.resumeVideoPolling(video)
          if (resumed) {
            result.resumedPollingCount++
            result.restoredVideoIds.push(video.id) // 收集恢复的视频ID
            console.log(`[TASK RECOVERY] ✅ 视频 ${video.id} 轮询恢复成功`)
          } else {
            console.log(`[TASK RECOVERY] ⚠️ 视频 ${video.id} 轮询恢复失败`)
          }
        } catch (error) {
          const errorMsg = `Failed to resume polling for video ${video.id}: ${error}`
          console.error('[TASK RECOVERY] ❌', errorMsg)
          result.errors.push(errorMsg)
        }
      }

      console.log(`[TASK RECOVERY] 🎉 === 恢复流程完成 ===`)
      console.log(`[TASK RECOVERY] 📊 最终统计:`)
      console.log(`[TASK RECOVERY]   - 恢复进度数据: ${result.restoredCount} 个`)
      console.log(`[TASK RECOVERY]   - 恢复轮询任务: ${result.resumedPollingCount} 个`)
      console.log(`[TASK RECOVERY]   - 恢复的视频ID: [${result.restoredVideoIds.join(', ')}]`)
      console.log(`[TASK RECOVERY]   - 错误数量: ${result.errors.length}`)
      
      if (result.errors.length > 0) {
        console.warn(`[TASK RECOVERY] ⚠️ 遇到 ${result.errors.length} 个错误:`)
        result.errors.forEach((error, index) => {
          console.warn(`[TASK RECOVERY]   ${index + 1}. ${error}`)
        })
      }
      
      console.log(`[TASK RECOVERY] ========== 任务恢复流程结束 ==========`)

    } catch (error) {
      console.error('[TASK RECOVERY] 💥 Recovery failed with critical error:', error)
      console.error('[TASK RECOVERY] Error stack:', (error as Error)?.stack)
      result.errors.push(`Recovery failed: ${error}`)
      
      // 确保错误被正确传播
      console.error('[TASK RECOVERY] 🚨 Critical failure details:', {
        userId,
        error: (error as Error)?.message,
        stack: (error as Error)?.stack,
        timestamp: new Date().toISOString()
      })
    } finally {
      this.isRecovering = false
      console.log(`[TASK RECOVERY] 🔒 重置恢复状态 isRecovering = false`)
    }

    return result
  }

  /**
   * 获取用户所有处理中和等待中的视频
   */
  private async getProcessingVideos(userId: string): Promise<Video[]> {
    try {
      console.log(`[TASK RECOVERY] 📋 查询用户 ${userId} 的处理中任务...`)
      
      // 获取 processing 状态的视频
      console.log('[TASK RECOVERY] 🔍 查询 processing 状态的视频...')
      const processingResult = await supabaseVideoService.getUserVideos(userId, {
        status: 'processing'
      })
      console.log(`[TASK RECOVERY] 🔍 找到 ${processingResult.videos.length} 个 processing 状态的视频`)
      
      // 获取 pending 状态的视频
      console.log('[TASK RECOVERY] 🔍 查询 pending 状态的视频...')
      const pendingResult = await supabaseVideoService.getUserVideos(userId, {
        status: 'pending'
      })
      console.log(`[TASK RECOVERY] 🔍 找到 ${pendingResult.videos.length} 个 pending 状态的视频`)
      
      const allVideos = [...processingResult.videos, ...pendingResult.videos]
      console.log(`[TASK RECOVERY] 📋 总计找到 ${allVideos.length} 个需要恢复的视频任务`)
      
      return allVideos
    } catch (error) {
      console.error('[TASK RECOVERY] 💥 Failed to get processing videos:', error)
      console.error('[TASK RECOVERY] Error details:', {
        userId,
        error: (error as Error)?.message,
        stack: (error as Error)?.stack
      })
      return []
    }
  }

  /**
   * 恢复单个视频的轮询
   */
   private async resumeVideoPolling(video: Video): Promise<boolean> {
    console.log(`[TASK RECOVERY] 🎬 开始恢复视频 ${video.id} 的轮询...`)
    console.log(`[TASK RECOVERY] 🎬 视频初始状态: ${video.status}, veo3_job_id: ${video.veo3_job_id}`)
    
    try {
      // 首先获取视频的最新状态，防止恢复已完成的任务
      console.log(`[TASK RECOVERY] 🔄 获取视频 ${video.id} 的最新状态...`)
      const latestVideo = await supabaseVideoService.getVideo(video.id)
      if (latestVideo) {
        console.log(`[TASK RECOVERY] 📊 最新状态: ${latestVideo.status} (原状态: ${video.status})`)
        
        // 如果视频已经完成或失败，不需要恢复
        if (latestVideo.status === 'completed' || latestVideo.status === 'failed') {
          console.log(`[TASK RECOVERY] ✅ 视频 ${video.id} 已经是 ${latestVideo.status} 状态，跳过恢复`)
          return false
        }
        
        // 使用最新的视频数据
        video = latestVideo
        console.log(`[TASK RECOVERY] 🔄 使用最新视频数据进行恢复`)
      } else {
        console.warn(`[TASK RECOVERY] ⚠️ 无法获取视频 ${video.id} 的最新状态，使用原始数据`)
      }
      
      // 检查是否有 veo3_job_id
      if (!video.veo3_job_id) {
        console.log(`[TASK RECOVERY] ⚠️ 视频 ${video.id} 缺少 veo3_job_id`)
        
        // 检查视频创建时间，如果超过10分钟还没有job_id，标记为失败
        const createdAt = new Date(video.created_at).getTime()
        const processingStartedAt = video.processing_started_at ? new Date(video.processing_started_at).getTime() : createdAt
        const now = Date.now()
        const ageMinutes = (now - processingStartedAt) / (1000 * 60)
        
        console.log(`[TASK RECOVERY] 📅 视频年龄检查: ${Math.round(ageMinutes * 100) / 100} 分钟`)
        
        if (ageMinutes > 10) {
          console.log(`[TASK RECOVERY] 💀 视频 ${video.id} 已卡住 ${Math.round(ageMinutes)} 分钟，标记为失败`)
          
          try {
            await supabaseVideoService.updateVideoAsSystem(video.id, {
              status: 'failed',
              error_message: 'Video generation task was not properly initialized (missing veo3_job_id)'
            })
            console.log(`[TASK RECOVERY] ✅ 成功标记卡住的视频 ${video.id} 为失败状态`)
          } catch (error) {
            console.error(`[TASK RECOVERY] ❌ 标记视频 ${video.id} 为失败时出错:`, error)
          }
        } else {
          // 如果是新视频，可能还在初始化，等待
          console.log(`[TASK RECOVERY] ⏳ 视频 ${video.id} 年龄 ${Math.round(ageMinutes)} 分钟，等待任务初始化`)
        }
        
        return false
      }
      
      console.log(`[TASK RECOVERY] ✅ 视频 ${video.id} 有有效的 veo3_job_id: ${video.veo3_job_id}`)

      // 计算当前预估进度
      console.log(`[TASK RECOVERY] 📊 计算视频 ${video.id} 的当前进度...`)
      const currentProgress = this.calculateCurrentProgress(video)
      console.log(`[TASK RECOVERY] 📊 计算结果: ${currentProgress.percentage}% (${currentProgress.statusText})`)
      
      // 恢复进度管理器中的数据（如果不存在）
      const existingProgress = progressManager.getProgress(video.id)
      if (!existingProgress) {
        console.log(`[TASK RECOVERY] 💾 初始化进度管理器数据...`)

        // 根据API提供商类型设置正确的taskId字段
        const apiProvider = detectApiProvider(video.veo3_job_id)
        const progressUpdate: any = {
          progress: currentProgress.percentage,
          status: video.status as any,
          statusText: currentProgress.statusText,
          pollingAttempts: 0,
          lastPollingStatus: 'resumed'
        }

        if (apiProvider === 'apicore') {
          progressUpdate.apicoreTaskId = video.veo3_job_id
        } else if (apiProvider === 'wuyin') {
          progressUpdate.wuyinTaskId = video.veo3_job_id
        }

        progressManager.updateProgress(video.id, progressUpdate)
        
        console.log(`[TASK RECOVERY] ✅ 进度管理器初始化完成: ${video.id} -> ${currentProgress.percentage}%`)
      } else {
        console.log(`[TASK RECOVERY] 📋 进度管理器已有数据: ${video.id} -> ${existingProgress.progress}%`)
      }

      // 恢复 veo3Service 中的任务跟踪 - 关键步骤！
      console.log(`[TASK RECOVERY] 🚀 关键步骤：恢复青云API轮询 ${video.veo3_job_id}...`)
      try {
        const resumed = await veo3Service.restoreJob(video.veo3_job_id, video.id)
        
        if (resumed) {
          console.log(`[TASK RECOVERY] ✅ 青云API轮询恢复成功: ${video.id}`)
          console.log(`[TASK RECOVERY] 🎯 视频 ${video.id} 现在应该开始接收青云API更新`)
          return true
        } else {
          console.warn(`[TASK RECOVERY] ⚠️ 青云API轮询恢复失败: ${video.id}`)
          console.warn(`[TASK RECOVERY] 🔍 可能原因: 任务已完成、任务不存在、或API连接问题`)
          return false
        }
      } catch (restoreError) {
        console.error(`[TASK RECOVERY] 💥 恢复青云API轮询时出错:`, restoreError)
        console.error(`[TASK RECOVERY] Error details:`, {
          videoId: video.id,
          jobId: video.veo3_job_id,
          error: (restoreError as Error)?.message
        })
        return false
      }
    } catch (error) {
      console.error(`[TASK RECOVERY] Error resuming video ${video.id}:`, error)
      return false
    }
  }

  /**
   * 根据时间差智能计算当前进度
   */
  private calculateCurrentProgress(video: Video): { percentage: number; statusText: string } {
    const now = new Date()
    const startedAt = video.processing_started_at ? new Date(video.processing_started_at) : video.created_at ? new Date(video.created_at) : now
    const elapsedMs = now.getTime() - startedAt.getTime()
    const elapsedMinutes = elapsedMs / (1000 * 60)

    // 检查 metadata 中是否有进度数据
    if (video.metadata?.progressData) {
      const lastUpdate = new Date(video.metadata.progressData.lastUpdate)
      const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime()
      
      // 如果最后更新时间不超过 30 分钟，使用存储的进度
      if (timeSinceLastUpdate < 30 * 60 * 1000) {
        return {
          percentage: video.metadata.progressData.percentage || 0,
          statusText: video.metadata.progressData.statusText || i18n.t('videoCreator.restoring')
        }
      }
    }

    // 否则基于时间智能推算
    if (video.status === 'pending') {
      // pending 状态：0-10%，最多5分钟
      const percentage = Math.min(10, elapsedMinutes * 2)
      return {
        percentage: Math.max(5, percentage), // 至少5%
        statusText: i18n.t('videoCreator.preparing')
      }
    }

    if (video.status === 'processing') {
      // processing 状态：10-99%，预计90秒完成
      const expectedDurationMinutes = 1.5 // 90秒
      const progressPercentage = Math.min(99, 10 + (elapsedMinutes / expectedDurationMinutes) * 89)
      
      let statusText = i18n.t('videoCreator.processing')
      if (progressPercentage > 80) {
        statusText = i18n.t('videoCreator.almostComplete')
      } else if (progressPercentage > 50) {
        statusText = i18n.t('videoCreator.generating')
      }

      return {
        percentage: Math.max(15, progressPercentage), // 至少15%
        statusText
      }
    }

    // 其他状态
    return {
      percentage: 0,
      statusText: i18n.t('videoCreator.unknownStatus')
    }
  }

  /**
   * 清理过期的任务数据
   */
  async cleanupExpiredTasks(userId: string, olderThanHours: number = 24): Promise<number> {
    try {
      // 获取所有用户视频
      const result = await supabaseVideoService.getUserVideos(userId)
      const videos = result.videos
      
      let cleanedCount = 0
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)

      for (const video of videos) {
        const videoDate = new Date(video.updated_at)
        
        // 如果视频已经很久没更新，且不是完成状态，则清理其进度数据
        if (videoDate < cutoffTime && video.status !== 'completed') {
          // 清理内存中的进度数据
          progressManager.clearProgress(video.id)
          
          // 如果有 metadata.progressData，也清理掉
          if (video.metadata?.progressData) {
            const updatedMetadata = { ...video.metadata }
            delete updatedMetadata.progressData
            
            await supabaseVideoService.updateVideo(video.id, { metadata: updatedMetadata })
          }
          
          cleanedCount++
        }
      }

      console.log(`[TASK RECOVERY] Cleaned up ${cleanedCount} expired tasks`)
      return cleanedCount
    } catch (error) {
      console.error('[TASK RECOVERY] Failed to cleanup expired tasks:', error)
      return 0
    }
  }

  /**
   * 检查是否有需要恢复的任务
   */
  async hasRecoverableTasks(userId: string): Promise<boolean> {
    try {
      const processingVideos = await this.getProcessingVideos(userId)
      return processingVideos.length > 0
    } catch (error) {
      console.error('[TASK RECOVERY] Failed to check recoverable tasks:', error)
      return false
    }
  }

  /**
   * 清理所有卡住的任务（无veo3_job_id超过10分钟的处理中视频）
   */
  async cleanupStuckTasks(userId: string): Promise<number> {
    try {
      console.log('[TASK RECOVERY] === 开始清理卡住的任务 ===')
      
      const processingVideos = await this.getProcessingVideos(userId)
      let cleanedCount = 0
      
      for (const video of processingVideos) {
        // 跳过有job_id的正常任务
        if (video.veo3_job_id) {
          continue
        }
        
        // 检查是否卡住超过10分钟
        const createdAt = new Date(video.created_at).getTime()
        const processingStartedAt = video.processing_started_at ? new Date(video.processing_started_at).getTime() : createdAt
        const now = Date.now()
        const ageMinutes = (now - processingStartedAt) / (1000 * 60)
        
        if (ageMinutes > 10) {
          console.log(`[TASK RECOVERY] Cleaning stuck video ${video.id} (age: ${Math.round(ageMinutes)} minutes)`)
          
          try {
            await supabaseVideoService.updateVideoAsSystem(video.id, {
              status: 'failed',
              error_message: 'Video generation task was stuck (missing veo3_job_id)'
            })
            cleanedCount++
            console.log(`[TASK RECOVERY] ✅ Cleaned stuck video: ${video.id}`)
          } catch (error) {
            console.error(`[TASK RECOVERY] ❌ Failed to clean video ${video.id}:`, error)
          }
        }
      }
      
      console.log(`[TASK RECOVERY] === 清理完成，处理了 ${cleanedCount} 个卡住的任务 ===`)
      return cleanedCount
    } catch (error) {
      console.error('[TASK RECOVERY] Failed to cleanup stuck tasks:', error)
      return 0
    }
  }
}

// 导出单例实例
export const taskRecoveryService = new TaskRecoveryService()
export default taskRecoveryService