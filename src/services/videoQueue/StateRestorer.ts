/**
 * 状态恢复服务
 * 负责系统启动时从数据库恢复队列和活跃任务状态
 */

import { supabase } from '@/lib/supabase'
import supabaseVideoService from '../supabaseVideoService'
import type { QueueStore } from './QueueStore'
import type { CleanupService } from './CleanupService'
import type { QueueJob } from './types'
import { QUEUE_CONSTANTS } from './config'

export class StateRestorer {
  constructor(
    private queueStore: QueueStore,
    private cleanupService: CleanupService
  ) {}

  /**
   * 初始化队列服务（从数据库恢复状态）
   */
  async initialize(): Promise<void> {
    try {
      // 检查数据库是否支持队列功能
      const hasQueueSupport = await this.checkQueueSupport()

      if (!hasQueueSupport) {
        console.warn('[STATE RESTORER] Database does not support queue features yet. Running in fallback mode.')
        return
      }

      // 恢复处理中的任务
      await this.restoreActiveJobs()

      // 恢复排队中的任务
      await this.restoreQueuedJobs()

      console.log('[STATE RESTORER] ✅ 队列状态恢复完成')

    } catch (error) {
      console.error('[STATE RESTORER] Failed to initialize:', error)
      console.log('[STATE RESTORER] Starting in fallback mode...')
    }
  }

  /**
   * 检查数据库是否支持队列功能
   */
  async checkQueueSupport(): Promise<boolean> {
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
        console.warn('[STATE RESTORER] Queue fields not found in database')
        return false
      }

      // 其他错误也认为不支持
      console.warn('[STATE RESTORER] Database query error:', error)
      return false
    } catch (error) {
      console.warn('[STATE RESTORER] Failed to check queue support:', error)
      return false
    }
  }

  /**
   * 恢复处理中的任务状态
   */
  async restoreActiveJobs(): Promise<void> {
    try {
      const { data: activeVideos, error } = await supabase
        .from('videos')
        .select('id, user_id, processing_started_at, veo3_job_id')
        .eq('status', 'processing')
        .eq('is_deleted', false)

      if (error) {
        console.error('[STATE RESTORER] Failed to restore active jobs:', error)
        return
      }

      if (activeVideos) {
        const now = Date.now()

        for (const video of activeVideos) {
          const startedAt = video.processing_started_at ? new Date(video.processing_started_at).getTime() : now
          const isTimeout = (now - startedAt) > QUEUE_CONSTANTS.TASK_TIMEOUT_MS

          if (isTimeout) {
            // 僵尸任务：处理超时，直接标记为失败
            console.warn(`[STATE RESTORER] 🧟 检测到僵尸任务: ${video.id}, 已处理 ${Math.round((now - startedAt) / 60000)} 分钟`)

            try {
              await this.cleanupService.cleanupZombieTask(video.id, video.user_id, video.veo3_job_id)
            } catch (cleanupError) {
              console.error(`[STATE RESTORER] 清理僵尸任务失败 ${video.id}:`, cleanupError)
            }
          } else {
            // 正常任务：添加到activeJobs并尝试恢复
            this.queueStore.addActiveJob(video.id, video.user_id)
            console.log(`[STATE RESTORER] ✅ 恢复活跃任务: ${video.id}, 已处理 ${Math.round((now - startedAt) / 60000)} 分钟`)

            // 如果有veo3_job_id，尝试恢复任务状态跟踪
            if (video.veo3_job_id) {
              this.restoreTaskStatusTracking(video.id, video.user_id, video.veo3_job_id).catch(error => {
                console.error(`[STATE RESTORER] 恢复任务状态跟踪失败 ${video.id}:`, error)
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('[STATE RESTORER] Error restoring active jobs:', error)
    }
  }

  /**
   * 恢复任务状态跟踪
   */
  async restoreTaskStatusTracking(videoId: string, userId: string, veo3JobId: string): Promise<void> {
    console.log(`[STATE RESTORER] 🔄 开始恢复任务状态跟踪: ${videoId} -> ${veo3JobId}`)

    try {
      const veo3Service = (await import('../veo3Service')).default

      // 尝试通过veo3Service恢复任务
      const restored = await veo3Service.restoreJob(veo3JobId, videoId)

      if (restored) {
        console.log(`[STATE RESTORER] ✅ veo3任务状态跟踪恢复成功: ${veo3JobId}`)
      } else {
        console.warn(`[STATE RESTORER] ⚠️ veo3任务恢复返回false，可能任务已完成或失败: ${veo3JobId}`)

        // 如果veo3Service返回false，可能任务已经完成但数据库未更新
        // 给veo3Service一些时间来更新状态，然后检查
        setTimeout(async () => {
          try {
            const currentVideo = await supabaseVideoService.getVideo(videoId)
            if (currentVideo && currentVideo.status === 'processing') {
              console.warn(`[STATE RESTORER] ⚠️ 任务 ${videoId} 在veo3恢复后仍为processing状态，可能需要人工干预`)

              // 等待更长时间后如果还是processing，将其标记为失败
              setTimeout(async () => {
                const laterVideo = await supabaseVideoService.getVideo(videoId)
                if (laterVideo && laterVideo.status === 'processing') {
                  console.error(`[STATE RESTORER] ❌ 任务 ${videoId} 恢复失败，标记为失败`)
                  await this.cleanupService.cleanupZombieTask(videoId, userId, veo3JobId)
                }
              }, 60000) // 等待1分钟
            }
          } catch (error) {
            console.error(`[STATE RESTORER] ❌ 检查恢复后任务状态时出错 ${videoId}:`, error)
          }
        }, 10000) // 等待10秒
      }
    } catch (error) {
      console.error(`[STATE RESTORER] ❌ 恢复任务状态跟踪异常 ${videoId}:`, error)

      // 如果恢复失败，可能任务已经不存在或有问题，设定超时后清理
      setTimeout(async () => {
        try {
          const video = await supabaseVideoService.getVideo(videoId)
          if (video && video.status === 'processing') {
            console.warn(`[STATE RESTORER] ⚠️ 任务 ${videoId} 恢复失败且仍为processing，将清理`)
            await this.cleanupService.cleanupZombieTask(videoId, userId, veo3JobId)
          }
        } catch (cleanupError) {
          console.error(`[STATE RESTORER] ❌ 延迟清理失败恢复任务时出错 ${videoId}:`, cleanupError)
        }
      }, 300000) // 5分钟后清理
    }
  }

  /**
   * 恢复排队中的任务状态
   */
  async restoreQueuedJobs(): Promise<void> {
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
          console.log('[STATE RESTORER] Queue fields not available, skipping queued jobs restoration')
          return
        }
        console.error('[STATE RESTORER] Failed to restore queued jobs:', error)
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
          this.queueStore.addToQueue(job)
          console.log(`[STATE RESTORER] ✅ 恢复排队任务: ${video.id}`)
        }
      }
    } catch (error) {
      console.error('[STATE RESTORER] Error restoring queued jobs:', error)
    }
  }

  /**
   * 验证恢复状态的完整性
   */
  async validateRestoredState(): Promise<{
    activeJobsCount: number
    queuedJobsCount: number
    inconsistencies: string[]
  }> {
    const inconsistencies: string[] = []

    try {
      // 检查活跃任务的一致性
      const activeJobs = this.queueStore.getActiveJobs()
      const activeJobIds = Array.from(activeJobs.keys())

      if (activeJobIds.length > 0) {
        const { data: dbActiveVideos } = await supabase
          .from('videos')
          .select('id, status')
          .in('id', activeJobIds)
          .eq('status', 'processing')

        const dbActiveIds = new Set(dbActiveVideos?.map(v => v.id) || [])

        for (const jobId of activeJobIds) {
          if (!dbActiveIds.has(jobId)) {
            inconsistencies.push(`内存中的活跃任务 ${jobId} 在数据库中状态不是processing`)
          }
        }
      }

      // 检查排队任务的一致性
      const queuedJobs = this.queueStore.getQueuedJobs()
      const queuedJobIds = queuedJobs.map(job => job.id)

      if (queuedJobIds.length > 0) {
        const { data: dbQueuedVideos } = await supabase
          .from('videos')
          .select('id, status')
          .in('id', queuedJobIds)
          .eq('status', 'pending')

        const dbQueuedIds = new Set(dbQueuedVideos?.map(v => v.id) || [])

        for (const jobId of queuedJobIds) {
          if (!dbQueuedIds.has(jobId)) {
            inconsistencies.push(`内存中的排队任务 ${jobId} 在数据库中状态不是pending`)
          }
        }
      }

      if (inconsistencies.length > 0) {
        console.warn('[STATE RESTORER] 发现状态不一致:', inconsistencies)
      } else {
        console.log('[STATE RESTORER] ✅ 状态验证通过，无不一致性')
      }

      return {
        activeJobsCount: activeJobs.size,
        queuedJobsCount: queuedJobs.length,
        inconsistencies
      }

    } catch (error) {
      console.error('[STATE RESTORER] 状态验证失败:', error)
      return {
        activeJobsCount: this.queueStore.getActiveJobCount(),
        queuedJobsCount: this.queueStore.getQueueSize(),
        inconsistencies: [`状态验证失败: ${error}`]
      }
    }
  }

  /**
   * 获取恢复统计信息
   */
  getRestoreStats(): {
    activeJobs: number
    queuedJobs: number
    totalJobs: number
    memoryUsage: string
  } {
    const activeCount = this.queueStore.getActiveJobCount()
    const queuedCount = this.queueStore.getQueueSize()

    return {
      activeJobs: activeCount,
      queuedJobs: queuedCount,
      totalJobs: activeCount + queuedCount,
      memoryUsage: `${activeCount} active, ${queuedCount} queued`
    }
  }

  /**
   * 强制重新同步状态（紧急情况使用）
   */
  async forceResync(): Promise<void> {
    console.log('[STATE RESTORER] 🚨 开始强制重新同步状态...')

    // 清空当前内存状态
    this.queueStore.clearActiveJobs()
    this.queueStore.clearQueue()

    // 重新恢复状态
    await this.initialize()

    console.log('[STATE RESTORER] ✅ 强制重新同步完成')
  }
}