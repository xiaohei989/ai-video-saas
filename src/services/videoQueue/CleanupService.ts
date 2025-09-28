/**
 * 清理服务
 * 负责僵尸任务检测、清理和定期维护
 */

import { supabase } from '@/lib/supabase'
import supabaseVideoService from '../supabaseVideoService'
import creditService from '../creditService'
import type { QueueStore } from './QueueStore'
import type { UserManager } from './UserManager'
import type { CleanupResult, UserZombieTasksInfo, ZombieTaskInfo } from './types'
import { QUEUE_CONSTANTS } from './config'

export class CleanupService {
  private cleanupIntervalId?: NodeJS.Timeout
  private lastZombieCheck: number = 0

  constructor(
    private queueStore: QueueStore,
    private userManager: UserManager
  ) {}

  /**
   * 清理僵尸任务
   */
  async cleanupZombieTask(videoId: string, userId: string, _veo3JobId?: string): Promise<void> {
    console.log(`[CLEANUP SERVICE] 🧹 开始清理僵尸任务: ${videoId}`)

    try {
      // 1. 退还积分
      const video = await supabaseVideoService.getVideo(videoId)
      if (video && video.credits_used && video.credits_used > 0) {
        console.log(`[CLEANUP SERVICE] 💰 退还僵尸任务积分: ${video.credits_used}`)

        const refundResult = await creditService.addCredits(
          userId,
          video.credits_used,
          'refund',
          `僵尸任务超时，退还积分: ${video.title || videoId}`,
          videoId,
          'zombie_task_timeout'
        )

        if (refundResult.success) {
          console.log(`[CLEANUP SERVICE] ✅ 僵尸任务积分退还成功: ${refundResult.newBalance}`)
        } else {
          console.error(`[CLEANUP SERVICE] ❌ 僵尸任务积分退还失败: ${refundResult.error}`)
        }
      }

      // 2. 更新数据库状态为失败
      await supabaseVideoService.updateVideo(videoId, {
        status: 'failed',
        error_message: '任务处理超时，已自动清理',
        processing_completed_at: new Date().toISOString()
      })

      // 3. 确保从activeJobs中移除
      this.queueStore.removeActiveJob(videoId)

      // 4. 清理用户订阅缓存，确保下次检查获取最新状态
      try {
        await this.userManager.clearUserSubscriptionCache(userId)
      } catch (cacheError) {
        console.warn(`[CLEANUP SERVICE] 清理缓存时出错:`, cacheError)
      }

      console.log(`[CLEANUP SERVICE] ✅ 僵尸任务清理完成: ${videoId}`)

    } catch (error) {
      console.error(`[CLEANUP SERVICE] ❌ 清理僵尸任务时出错 ${videoId}:`, error)
      // 即使清理失败，也要从activeJobs中移除，避免永久阻塞
      this.queueStore.removeActiveJob(videoId)
    }
  }

  /**
   * 运行时清理僵尸任务（长时间卡住的任务）
   */
  async cleanupZombieTasks(): Promise<void> {
    try {
      const now = Date.now()
      const zombieTasks: string[] = []

      console.log(`[CLEANUP SERVICE] 🔍 运行时僵尸任务检测，当前活跃任务数: ${this.queueStore.getActiveJobCount()}`)

      const activeJobs = this.queueStore.getActiveJobs()
      for (const [videoId, userId] of activeJobs.entries()) {
        try {
          const video = await supabaseVideoService.getVideo(videoId)
          if (video && video.processing_started_at) {
            const processingTime = now - new Date(video.processing_started_at).getTime()

            if (processingTime > QUEUE_CONSTANTS.ZOMBIE_THRESHOLD) {
              console.warn(`[CLEANUP SERVICE] 🧟 运行时检测到僵尸任务: ${videoId}, 处理时长: ${Math.round(processingTime / 60000)} 分钟`)
              zombieTasks.push(videoId)

              await this.cleanupZombieTask(videoId, userId, video.veo3_job_id || undefined)
            }
          } else if (!video) {
            // 内存中有但数据库没有的任务，直接清理
            console.warn(`[CLEANUP SERVICE] 🧟 检测到幽灵任务（数据库中不存在）: ${videoId}`)
            this.queueStore.removeActiveJob(videoId)
            zombieTasks.push(videoId)
          }
        } catch (error) {
          console.error(`[CLEANUP SERVICE] 检测僵尸任务时出错 ${videoId}:`, error)
        }
      }

      if (zombieTasks.length > 0) {
        console.log(`[CLEANUP SERVICE] ✅ 运行时清理了 ${zombieTasks.length} 个僵尸任务: ${zombieTasks.join(', ')}`)
      }

    } catch (error) {
      console.error('[CLEANUP SERVICE] 运行时僵尸任务清理出错:', error)
    }
  }

  /**
   * 手动清理用户的僵尸任务
   */
  async cleanupUserZombieTasks(userId: string): Promise<CleanupResult> {
    console.log(`[CLEANUP SERVICE] 🔧 开始手动清理用户僵尸任务: ${userId}`)

    const result: CleanupResult = {
      cleaned: 0,
      errors: []
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
        console.log(`[CLEANUP SERVICE] 用户 ${userId} 没有处理中的任务`)
        return result
      }

      const now = Date.now()

      for (const video of processingVideos) {
        const startedAt = video.processing_started_at ? new Date(video.processing_started_at).getTime() : now
        const runningTime = now - startedAt
        const isTimeout = runningTime > QUEUE_CONSTANTS.TASK_TIMEOUT_MS

        console.log(`[CLEANUP SERVICE] 检查任务 ${video.id}: 运行时间 ${Math.round(runningTime / 60000)} 分钟`)

        if (isTimeout) {
          try {
            await this.cleanupZombieTask(video.id, userId, video.veo3_job_id)
            result.cleaned++
            console.log(`[CLEANUP SERVICE] ✅ 已清理僵尸任务: ${video.title || video.id}`)
          } catch (error) {
            const errorMsg = `清理任务 ${video.id} 失败: ${error instanceof Error ? error.message : String(error)}`
            result.errors.push(errorMsg)
            console.error(`[CLEANUP SERVICE] ❌ ${errorMsg}`)
          }
        } else {
          console.log(`[CLEANUP SERVICE] ⏳ 任务 ${video.id} 仍在正常处理中，跳过`)
        }
      }

      console.log(`[CLEANUP SERVICE] 🎉 用户 ${userId} 僵尸任务清理完成: 清理 ${result.cleaned} 个任务, ${result.errors.length} 个错误`)
      return result

    } catch (error) {
      const errorMsg = `手动清理僵尸任务异常: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(errorMsg)
      console.error(`[CLEANUP SERVICE] ❌ ${errorMsg}`)
      return result
    }
  }

  /**
   * 获取用户当前的僵尸任务信息
   */
  async getUserZombieTasksInfo(userId: string): Promise<UserZombieTasksInfo> {
    try {
      const { data: processingVideos, error } = await supabase
        .from('videos')
        .select('id, title, processing_started_at, veo3_job_id')
        .eq('user_id', userId)
        .eq('status', 'processing')
        .eq('is_deleted', false)

      if (error) {
        console.error(`[CLEANUP SERVICE] 查询用户任务失败:`, error)
        return { zombieTasks: [], totalZombies: 0 }
      }

      if (!processingVideos) {
        return { zombieTasks: [], totalZombies: 0 }
      }

      const now = Date.now()

      const zombieTasks: ZombieTaskInfo[] = processingVideos
        .filter(video => {
          const startedAt = video.processing_started_at ? new Date(video.processing_started_at).getTime() : now
          return (now - startedAt) > QUEUE_CONSTANTS.TASK_TIMEOUT_MS
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
      console.error(`[CLEANUP SERVICE] 获取僵尸任务信息失败:`, error)
      return { zombieTasks: [], totalZombies: 0 }
    }
  }

  /**
   * 启动定期清理机制
   */
  startPeriodicCleanup(concurrencyController?: any): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
    }

    // 每5分钟执行一次全局清理
    this.cleanupIntervalId = setInterval(async () => {
      try {
        // 执行僵尸任务清理
        const now = Date.now()
        if (now - this.lastZombieCheck > QUEUE_CONSTANTS.ZOMBIE_CHECK_INTERVAL) {
          await this.cleanupZombieTasks()
          this.lastZombieCheck = now
        }

        // 如果有并发控制器，执行全局清理
        if (concurrencyController) {
          await concurrencyController.performGlobalCleanup()
        }
      } catch (error) {
        console.error('[CLEANUP SERVICE] 定期清理过程中出错:', error)
      }
    }, QUEUE_CONSTANTS.GLOBAL_CLEANUP_INTERVAL)

    console.log('[CLEANUP SERVICE] ✅ 定期清理机制已启动')
  }

  /**
   * 停止定期清理机制
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = undefined
      console.log('[CLEANUP SERVICE] ✅ 定期清理机制已停止')
    }
  }

  /**
   * 执行一次完整的系统清理
   */
  async performFullSystemCleanup(): Promise<{
    zombiesCleared: number
    memoryCleared: number
    errors: string[]
  }> {
    console.log('[CLEANUP SERVICE] 🧹 开始完整系统清理...')

    const result = {
      zombiesCleared: 0,
      memoryCleared: 0,
      errors: [] as string[]
    }

    try {
      // 1. 清理僵尸任务
      const beforeZombieCount = this.queueStore.getActiveJobCount()
      await this.cleanupZombieTasks()
      const afterZombieCount = this.queueStore.getActiveJobCount()
      result.zombiesCleared = beforeZombieCount - afterZombieCount

      // 2. 清理内存中的无效任务
      const activeJobs = this.queueStore.getActiveJobs()
      const userIds = new Set(activeJobs.values())

      // 为每个用户验证任务状态
      for (const userId of userIds) {
        try {
          const userActiveJobIds = this.queueStore.getUserActiveJobIds(userId)
          for (const jobId of userActiveJobIds) {
            try {
              const video = await supabaseVideoService.getVideo(jobId)
              if (!video || video.status !== 'processing') {
                this.queueStore.removeActiveJob(jobId)
                result.memoryCleared++
                console.log(`[CLEANUP SERVICE] 清理内存中的无效任务: ${jobId}`)
              }
            } catch (error) {
              result.errors.push(`验证任务 ${jobId} 时出错: ${error}`)
            }
          }
        } catch (error) {
          result.errors.push(`清理用户 ${userId} 任务时出错: ${error}`)
        }
      }

      console.log(`[CLEANUP SERVICE] ✅ 完整系统清理完成: 僵尸任务${result.zombiesCleared}个, 内存清理${result.memoryCleared}个, 错误${result.errors.length}个`)

    } catch (error) {
      const errorMsg = `完整系统清理失败: ${error}`
      result.errors.push(errorMsg)
      console.error(`[CLEANUP SERVICE] ❌ ${errorMsg}`)
    }

    return result
  }

  /**
   * 获取清理服务状态
   */
  getCleanupStatus(): {
    periodicCleanupActive: boolean
    lastZombieCheck: Date | null
    nextZombieCheck: Date | null
  } {
    const lastCheck = this.lastZombieCheck > 0 ? new Date(this.lastZombieCheck) : null
    const nextCheck = this.lastZombieCheck > 0
      ? new Date(this.lastZombieCheck + QUEUE_CONSTANTS.ZOMBIE_CHECK_INTERVAL)
      : null

    return {
      periodicCleanupActive: !!this.cleanupIntervalId,
      lastZombieCheck: lastCheck,
      nextZombieCheck: nextCheck
    }
  }
}