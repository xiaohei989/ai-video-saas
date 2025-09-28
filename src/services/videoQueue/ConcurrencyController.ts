/**
 * 并发控制器
 * 负责管理用户和系统级别的并发限制、活跃任务计数和清理
 */

import { supabase } from '@/lib/supabase'
import supabaseVideoService from '../supabaseVideoService'
import type { QueueStore } from './QueueStore'
import type { UserManager } from './UserManager'

export class ConcurrencyController {
  constructor(
    private queueStore: QueueStore,
    private userManager: UserManager
  ) {}

  /**
   * 获取用户当前活跃的任务数（改进版：双重验证机制）
   */
  async getUserActiveCount(userId: string): Promise<number> {
    // 先清理可能的无效任务
    await this.cleanupInvalidActiveTasks(userId)

    // 内存计数
    const memoryCount = this.queueStore.getUserActiveCount(userId)

    // 数据库验证作为安全网
    try {
      const { data: dbActiveVideos, error } = await supabase
        .from('videos')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'processing')
        .eq('is_deleted', false)

      if (error) {
        console.warn(`[CONCURRENCY CONTROLLER] 数据库验证查询失败: ${error.message}`)
        return memoryCount // 如果数据库查询失败，使用内存计数
      }

      const dbCount = dbActiveVideos?.length || 0

      // 如果内存计数与数据库差异过大，以数据库为准（保守策略）
      if (Math.abs(memoryCount - dbCount) > 1) {
        console.warn(`[CONCURRENCY CONTROLLER] 🔄 并发计数不一致: 内存=${memoryCount}, 数据库=${dbCount}, 用户=${userId}`)

        // 记录详细信息用于调试
        const memoryTasks = this.queueStore.getUserActiveJobIds(userId)

        console.warn(`[CONCURRENCY CONTROLLER] 内存中的任务: ${memoryTasks.join(', ')}`)
        console.warn(`[CONCURRENCY CONTROLLER] 数据库中的任务: ${dbActiveVideos?.map(v => v.id).join(', ') || '无'}`)

        // 如果数据库计数更小，说明内存中有已完成但未清理的任务
        // 如果数据库计数更大，说明内存中缺少一些任务（可能是重启后恢复不完整）
        // 保守策略：取较大值以避免过度限制用户
        const conservativeCount = Math.max(memoryCount, dbCount)
        console.warn(`[CONCURRENCY CONTROLLER] 采用保守计数: ${conservativeCount}`)
        return conservativeCount
      }

      return memoryCount

    } catch (error) {
      console.error(`[CONCURRENCY CONTROLLER] 双重验证过程中出错:`, error)
      return memoryCount // 发生错误时，回退到内存计数
    }
  }

  /**
   * 清理无效的活跃任务（数据库已完成但内存未清理的任务）
   */
  async cleanupInvalidActiveTasks(userId: string): Promise<void> {
    try {
      // 获取该用户在内存中的所有任务ID
      const userActiveJobIds = this.queueStore.getUserActiveJobIds(userId)

      if (userActiveJobIds.length === 0) {
        return
      }

      // 查询这些任务在数据库中的实际状态
      const { data: actualVideos, error } = await supabase
        .from('videos')
        .select('id, status')
        .in('id', userActiveJobIds)

      if (error) {
        console.warn('[CONCURRENCY CONTROLLER] Failed to query video status for cleanup:', error)
        return
      }

      // 清理已完成或失败的任务
      if (actualVideos) {
        for (const video of actualVideos) {
          if (video.status === 'completed' || video.status === 'failed') {
            console.log(`[CONCURRENCY CONTROLLER] 🧹 清理无效活跃任务: ${video.id} (状态: ${video.status})`)
            this.queueStore.removeActiveJob(video.id)
          }
        }
      }

      // 清理数据库中不存在的任务
      const existingVideoIds = new Set(actualVideos?.map(v => v.id) || [])
      for (const jobId of userActiveJobIds) {
        if (!existingVideoIds.has(jobId)) {
          console.log(`[CONCURRENCY CONTROLLER] 🧹 清理数据库中不存在的任务: ${jobId}`)
          this.queueStore.removeActiveJob(jobId)
        }
      }

    } catch (error) {
      console.error('[CONCURRENCY CONTROLLER] Error during cleanup:', error)
    }
  }

  /**
   * 执行全局清理
   */
  async performGlobalCleanup(): Promise<void> {
    try {
      const beforeCount = this.queueStore.getActiveJobCount()
      console.log(`[CONCURRENCY CONTROLLER] 🧹 开始全局清理，当前活跃任务数: ${beforeCount}`)

      // 获取所有活跃任务的用户ID
      const activeJobs = this.queueStore.getActiveJobs()
      const userIds = new Set(activeJobs.values())

      // 为每个用户清理无效任务
      for (const userId of userIds) {
        await this.cleanupInvalidActiveTasks(userId)
      }

      const afterCount = this.queueStore.getActiveJobCount()
      const cleanedCount = beforeCount - afterCount

      if (cleanedCount > 0) {
        console.log(`[CONCURRENCY CONTROLLER] ✅ 全局清理完成，清理了 ${cleanedCount} 个无效任务，剩余 ${afterCount} 个活跃任务`)
      } else {
        console.log(`[CONCURRENCY CONTROLLER] ✅ 全局清理完成，无需清理任务，维持 ${afterCount} 个活跃任务`)
      }
    } catch (error) {
      console.error('[CONCURRENCY CONTROLLER] ❌ 全局清理过程中出错:', error)
    }
  }

  /**
   * 检查用户并发限制并提供详细反馈
   */
  async checkUserConcurrency(userId: string): Promise<{
    canSubmit: boolean
    activeCount: number
    maxAllowed: number
    reason?: string
    tier?: string
    availableSlots?: number
  }> {
    const activeCount = await this.getUserActiveCount(userId)
    const submitStatus = await this.userManager.canUserSubmit(userId, activeCount)

    if (submitStatus.canSubmit) {
      return {
        canSubmit: true,
        activeCount: submitStatus.activeCount!,
        maxAllowed: submitStatus.maxAllowed!,
        tier: submitStatus.tier,
        availableSlots: submitStatus.maxAllowed! - submitStatus.activeCount!
      }
    } else {
      // 记录当前用户的活跃任务详情（用于调试）
      const userActiveTasks = []
      const activeJobIds = this.queueStore.getUserActiveJobIds(userId)

      for (const taskId of activeJobIds) {
        try {
          const taskInfo = await supabaseVideoService.getVideo(taskId)
          userActiveTasks.push({
            id: taskId,
            status: taskInfo?.status || 'unknown',
            startedAt: taskInfo?.processing_started_at,
            title: taskInfo?.title || '无标题',
            processingMinutes: taskInfo?.processing_started_at
              ? Math.round((Date.now() - new Date(taskInfo.processing_started_at).getTime()) / 60000)
              : 0
          })
        } catch (error) {
          userActiveTasks.push({
            id: taskId,
            status: 'error',
            error: 'Failed to fetch details'
          })
        }
      }

      console.warn(`[CONCURRENCY CONTROLLER] 🔍 用户活跃任务详情:`, {
        userId,
        activeCount: submitStatus.activeCount,
        maxAllowed: submitStatus.maxAllowed,
        tasks: userActiveTasks,
        totalSystemActive: this.queueStore.getActiveJobCount()
      })

      return {
        canSubmit: false,
        activeCount: submitStatus.activeCount!,
        maxAllowed: submitStatus.maxAllowed!,
        reason: submitStatus.reason,
        tier: submitStatus.tier
      }
    }
  }

  /**
   * 检查系统并发限制
   */
  checkSystemConcurrency(maxConcurrent: number): {
    canStartProcessing: boolean
    activeCount: number
    maxAllowed: number
    availableSlots: number
  } {
    const activeCount = this.queueStore.getActiveJobCount()
    const availableSlots = this.queueStore.getAvailableSlots(maxConcurrent)

    return {
      canStartProcessing: this.queueStore.canStartProcessing(maxConcurrent),
      activeCount,
      maxAllowed: maxConcurrent,
      availableSlots
    }
  }

  /**
   * 获取并发状态统计
   */
  async getConcurrencyStats(): Promise<{
    system: {
      activeJobs: number
      maxConcurrent: number
      utilizationPercent: number
    }
    topUsers: Array<{
      userId: string
      activeCount: number
      tier: string
    }>
  }> {
    const activeJobs = this.queueStore.getActiveJobs()
    const userStats = new Map<string, number>()

    // 统计每个用户的活跃任务数
    for (const userId of activeJobs.values()) {
      userStats.set(userId, (userStats.get(userId) || 0) + 1)
    }

    // 获取前5个最活跃的用户
    const topUsers = []
    const sortedUsers = Array.from(userStats.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    for (const [userId, activeCount] of sortedUsers) {
      try {
        const userInfo = await this.userManager.getUserInfo(userId)
        topUsers.push({
          userId,
          activeCount,
          tier: userInfo.tier
        })
      } catch (error) {
        topUsers.push({
          userId,
          activeCount,
          tier: 'unknown'
        })
      }
    }

    return {
      system: {
        activeJobs: activeJobs.size,
        maxConcurrent: 20, // 应该从配置获取
        utilizationPercent: Math.round((activeJobs.size / 20) * 100)
      },
      topUsers
    }
  }

  /**
   * 强制清理指定用户的所有活跃任务（紧急情况使用）
   */
  async forceCleanupUserTasks(userId: string): Promise<{
    removedFromMemory: number
    foundInDatabase: number
  }> {
    console.log(`[CONCURRENCY CONTROLLER] 🚨 强制清理用户任务: ${userId}`)

    const userActiveJobIds = this.queueStore.getUserActiveJobIds(userId)
    const removedFromMemory = userActiveJobIds.length

    // 从内存移除
    for (const jobId of userActiveJobIds) {
      this.queueStore.removeActiveJob(jobId)
    }

    // 检查数据库中的实际状态
    let foundInDatabase = 0
    try {
      const { data: dbActiveVideos } = await supabase
        .from('videos')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'processing')
        .eq('is_deleted', false)

      foundInDatabase = dbActiveVideos?.length || 0
    } catch (error) {
      console.error('[CONCURRENCY CONTROLLER] Failed to check database during force cleanup:', error)
    }

    console.log(`[CONCURRENCY CONTROLLER] ✅ 强制清理完成: 内存移除${removedFromMemory}个，数据库发现${foundInDatabase}个`)

    return {
      removedFromMemory,
      foundInDatabase
    }
  }
}