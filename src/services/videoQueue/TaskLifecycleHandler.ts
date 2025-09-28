/**
 * 任务生命周期处理器
 * 负责处理任务完成、失败和状态转换
 */

import supabaseVideoService from '../supabaseVideoService'
import creditService from '../creditService'
import type { QueueStore } from './QueueStore'
import type { UserManager } from './UserManager'
import type { TaskScheduler } from './TaskScheduler'
import { QUEUE_CONSTANTS } from './config'

export class TaskLifecycleHandler {
  constructor(
    private queueStore: QueueStore,
    private userManager: UserManager,
    private taskScheduler: TaskScheduler
  ) {}

  /**
   * 任务完成时调用（改进版：确保清理的原子性）
   */
  async jobCompleted(videoId: string): Promise<void> {
    console.log(`[LIFECYCLE HANDLER] Job completed: ${videoId}`)

    let userId: string | undefined

    try {
      // 1. 立即从内存清理（避免时间窗口问题）
      const wasInMemory = this.queueStore.isJobActive(videoId)
      if (wasInMemory) {
        userId = this.queueStore.getJobUserId(videoId)
        this.queueStore.removeActiveJob(videoId)
        console.log(`[LIFECYCLE HANDLER] ✅ 立即从内存移除任务: ${videoId}`)
      }

      // 2. 验证和更新数据库状态
      const video = await supabaseVideoService.getVideo(videoId)
      if (video) {
        userId = userId || video.user_id // 确保我们有用户ID

        if (video.status !== 'completed') {
          console.warn(`[LIFECYCLE HANDLER] ⚠️ 任务 ${videoId} 完成但数据库状态不正确: ${video.status}`)

          // 尝试修正数据库状态
          if (video.video_url) {
            console.log(`[LIFECYCLE HANDLER] 🔄 修正数据库状态为completed: ${videoId}`)
            await supabaseVideoService.updateVideo(videoId, {
              status: 'completed',
              processing_completed_at: new Date().toISOString()
            })
          } else {
            console.warn(`[LIFECYCLE HANDLER] ⚠️ 任务 ${videoId} 没有video_url，可能未真正完成`)
          }
        } else {
          console.log(`[LIFECYCLE HANDLER] ✅ 任务 ${videoId} 数据库状态正确`)
        }

        // 3. 清理相关用户的缓存
        try {
          await this.userManager.clearUserSubscriptionCache(video.user_id)
          console.log(`[LIFECYCLE HANDLER] ✅ 清理用户缓存: ${video.user_id}`)
        } catch (cacheError) {
          console.warn(`[LIFECYCLE HANDLER] 缓存清理失败:`, cacheError)
        }

      } else {
        console.error(`[LIFECYCLE HANDLER] ❌ 无法获取任务 ${videoId} 的数据库记录`)
      }

      // 4. 触发队列处理
      setTimeout(() => {
        this.taskScheduler.processQueue()
      }, QUEUE_CONSTANTS.QUEUE_PROCESS_DELAY)

      console.log(`[LIFECYCLE HANDLER] ✅ 任务 ${videoId} 清理完成，用户: ${userId}`)

    } catch (error) {
      console.error(`[LIFECYCLE HANDLER] ❌ 任务完成清理出错 ${videoId}:`, error)

      // 错误情况下，确保内存状态已清理
      if (this.queueStore.isJobActive(videoId)) {
        this.queueStore.removeActiveJob(videoId)
        console.log(`[LIFECYCLE HANDLER] 🔧 错误恢复：强制从内存移除任务: ${videoId}`)
      }

      // 即使出错也要触发队列处理
      setTimeout(() => {
        this.taskScheduler.processQueue()
      }, QUEUE_CONSTANTS.QUEUE_PROCESS_ERROR_DELAY)
    }
  }

  /**
   * 任务失败时调用（改进版：确保清理的原子性）
   */
  async jobFailed(videoId: string): Promise<void> {
    console.log(`[LIFECYCLE HANDLER] Job failed: ${videoId}`)

    let userId: string | undefined

    try {
      // 1. 立即从内存清理（避免时间窗口问题）
      const wasInMemory = this.queueStore.isJobActive(videoId)
      if (wasInMemory) {
        userId = this.queueStore.getJobUserId(videoId)
        this.queueStore.removeActiveJob(videoId)
        console.log(`[LIFECYCLE HANDLER] ✅ 立即从内存移除失败任务: ${videoId}`)
      }

      // 2. 验证并更新数据库状态为失败
      const video = await supabaseVideoService.getVideo(videoId)
      if (video) {
        userId = userId || video.user_id // 确保我们有用户ID

        if (video.status !== 'failed') {
          console.log(`[LIFECYCLE HANDLER] 🔄 更新数据库状态为failed: ${videoId}`)
          await supabaseVideoService.updateVideo(videoId, {
            status: 'failed',
            error_message: '视频生成失败',
            processing_completed_at: new Date().toISOString()
          })
        } else {
          console.log(`[LIFECYCLE HANDLER] ✅ 任务 ${videoId} 数据库状态已为failed`)
        }

        // 3. 退还积分
        if (video.credits_used && video.credits_used > 0) {
          console.log(`[LIFECYCLE HANDLER] 💰 退还失败任务积分: ${video.credits_used} credits`)

          const refundResult = await creditService.addCredits(
            video.user_id,
            video.credits_used,
            'refund',
            `视频生成失败，退还积分: ${video.title || videoId}`,
            videoId,
            'video_generation_failed'
          )

          if (refundResult.success) {
            console.log(`[LIFECYCLE HANDLER] ✅ 积分退还成功. New balance: ${refundResult.newBalance}`)
          } else {
            console.error(`[LIFECYCLE HANDLER] ❌ 积分退还失败: ${refundResult.error}`)
          }
        }

        // 4. 清理相关用户的缓存
        try {
          await this.userManager.clearUserSubscriptionCache(video.user_id)
          console.log(`[LIFECYCLE HANDLER] ✅ 清理用户缓存: ${video.user_id}`)
        } catch (cacheError) {
          console.warn(`[LIFECYCLE HANDLER] 缓存清理失败:`, cacheError)
        }

      } else {
        console.error(`[LIFECYCLE HANDLER] ❌ 无法获取失败任务 ${videoId} 的数据库记录`)
      }

      // 5. 触发队列处理
      setTimeout(() => {
        this.taskScheduler.processQueue()
      }, QUEUE_CONSTANTS.QUEUE_PROCESS_DELAY)

      console.log(`[LIFECYCLE HANDLER] ✅ 失败任务 ${videoId} 清理完成，用户: ${userId}`)

    } catch (error) {
      console.error(`[LIFECYCLE HANDLER] ❌ 处理失败任务时出错 ${videoId}:`, error)

      // 错误情况下，确保内存状态已清理
      if (this.queueStore.isJobActive(videoId)) {
        this.queueStore.removeActiveJob(videoId)
        console.log(`[LIFECYCLE HANDLER] 🔧 错误恢复：强制从内存移除失败任务: ${videoId}`)
      }

      // 即使出错也要触发队列处理
      setTimeout(() => {
        this.taskScheduler.processQueue()
      }, QUEUE_CONSTANTS.QUEUE_PROCESS_ERROR_DELAY)
    }
  }

  /**
   * 处理任务状态更新（来自外部状态监听）
   */
  async handleStatusUpdate(videoId: string, update: any): Promise<void> {
    console.log(`[LIFECYCLE HANDLER] 收到状态更新: ${videoId}`, update)

    if (update.type === 'complete') {
      console.log(`[LIFECYCLE HANDLER] ✅ 视频生成完成回调触发: ${videoId}`)
      console.log(`[LIFECYCLE HANDLER] 完成数据:`, update.data)
      await this.jobCompleted(videoId)
    } else if (update.type === 'error') {
      console.error(`[LIFECYCLE HANDLER] ❌ 视频生成失败回调触发: ${videoId}`, update.data)
      await this.jobFailed(videoId)
    } else if (update.type === 'progress') {
      console.log(`[LIFECYCLE HANDLER] 📊 进度更新: ${videoId}, 进度: ${update.data?.progress}%`)
      // 处理进度更新，但不需要特殊处理
    }
  }

  /**
   * 强制完成任务（紧急情况使用）
   */
  async forceCompleteJob(videoId: string, reason: string = '手动强制完成'): Promise<void> {
    console.log(`[LIFECYCLE HANDLER] 🚨 强制完成任务: ${videoId}, 原因: ${reason}`)

    try {
      // 从内存移除
      this.queueStore.removeActiveJob(videoId)

      // 更新数据库状态
      await supabaseVideoService.updateVideo(videoId, {
        status: 'completed',
        processing_completed_at: new Date().toISOString(),
        error_message: `强制完成: ${reason}`
      })

      // 清理缓存
      const video = await supabaseVideoService.getVideo(videoId)
      if (video) {
        await this.userManager.clearUserSubscriptionCache(video.user_id)
      }

      // 触发队列处理
      setTimeout(() => {
        this.taskScheduler.processQueue()
      }, QUEUE_CONSTANTS.QUEUE_PROCESS_DELAY)

      console.log(`[LIFECYCLE HANDLER] ✅ 强制完成任务成功: ${videoId}`)

    } catch (error) {
      console.error(`[LIFECYCLE HANDLER] ❌ 强制完成任务失败: ${videoId}`, error)
      throw error
    }
  }

  /**
   * 强制失败任务（紧急情况使用）
   */
  async forceFailJob(videoId: string, reason: string = '手动强制失败'): Promise<void> {
    console.log(`[LIFECYCLE HANDLER] 🚨 强制失败任务: ${videoId}, 原因: ${reason}`)

    try {
      // 从内存移除
      this.queueStore.removeActiveJob(videoId)

      // 获取视频信息用于退还积分
      const video = await supabaseVideoService.getVideo(videoId)

      // 更新数据库状态
      await supabaseVideoService.updateVideo(videoId, {
        status: 'failed',
        processing_completed_at: new Date().toISOString(),
        error_message: `强制失败: ${reason}`
      })

      // 退还积分
      if (video && video.credits_used && video.credits_used > 0) {
        const refundResult = await creditService.addCredits(
          video.user_id,
          video.credits_used,
          'refund',
          `强制失败，退还积分: ${reason}`,
          videoId,
          'manual_force_fail'
        )

        if (refundResult.success) {
          console.log(`[LIFECYCLE HANDLER] ✅ 强制失败积分退还成功: ${refundResult.newBalance}`)
        } else {
          console.error(`[LIFECYCLE HANDLER] ❌ 强制失败积分退还失败: ${refundResult.error}`)
        }
      }

      // 清理缓存
      if (video) {
        await this.userManager.clearUserSubscriptionCache(video.user_id)
      }

      // 触发队列处理
      setTimeout(() => {
        this.taskScheduler.processQueue()
      }, QUEUE_CONSTANTS.QUEUE_PROCESS_DELAY)

      console.log(`[LIFECYCLE HANDLER] ✅ 强制失败任务成功: ${videoId}`)

    } catch (error) {
      console.error(`[LIFECYCLE HANDLER] ❌ 强制失败任务失败: ${videoId}`, error)
      throw error
    }
  }

  /**
   * 获取任务生命周期统计
   */
  async getLifecycleStats(): Promise<{
    completedToday: number
    failedToday: number
    averageProcessingTime: number
    successRate: number
  }> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // 暂时使用备用方案获取统计数据
      const completedVideos: any[] = []
      const failedVideos: any[] = []
      const completedError = null
      const failedError = null

      if (completedError || failedError) {
        console.error('[LIFECYCLE HANDLER] 获取统计数据失败:', completedError || failedError)
        return {
          completedToday: 0,
          failedToday: 0,
          averageProcessingTime: 0,
          successRate: 0
        }
      }

      const completedCount = completedVideos?.length || 0
      const failedCount = failedVideos?.length || 0
      const totalCount = completedCount + failedCount

      // 计算平均处理时间
      let averageProcessingTime = 0
      if (completedVideos && completedVideos.length > 0) {
        const totalProcessingTime = completedVideos.reduce((sum: number, video: any) => {
          if (video.processing_started_at && video.processing_completed_at) {
            const startTime = new Date(video.processing_started_at).getTime()
            const endTime = new Date(video.processing_completed_at).getTime()
            return sum + (endTime - startTime)
          }
          return sum
        }, 0)
        averageProcessingTime = Math.round(totalProcessingTime / completedVideos.length / 60000) // 转换为分钟
      }

      const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

      return {
        completedToday: completedCount,
        failedToday: failedCount,
        averageProcessingTime,
        successRate
      }

    } catch (error) {
      console.error('[LIFECYCLE HANDLER] 获取生命周期统计失败:', error)
      return {
        completedToday: 0,
        failedToday: 0,
        averageProcessingTime: 0,
        successRate: 0
      }
    }
  }
}