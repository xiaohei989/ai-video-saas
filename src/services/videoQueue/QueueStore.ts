/**
 * 队列内存存储管理
 * 负责维护内存中的队列和活跃任务状态
 */

import type { QueueJob, ActiveJobDebugInfo } from './types'
import { QUEUE_CONSTANTS } from './config'

export class QueueStore {
  /**
   * 内存队列状态
   */
  private queuedJobs = new Map<string, QueueJob>()

  /**
   * 活跃任务状态 (jobId -> userId)
   */
  private activeJobs = new Map<string, string>()

  /**
   * 添加任务到队列
   */
  addToQueue(job: QueueJob): number {
    this.queuedJobs.set(job.id, job)
    const queuePosition = this.queuedJobs.size

    console.log(`[QUEUE STORE] Added job ${job.id} to queue at position ${queuePosition}`)
    return queuePosition
  }

  /**
   * 从队列中移除任务
   */
  removeFromQueue(jobId: string): QueueJob | undefined {
    const job = this.queuedJobs.get(jobId)
    if (job) {
      this.queuedJobs.delete(jobId)
      console.log(`[QUEUE STORE] Removed job ${jobId} from queue`)
    }
    return job
  }

  /**
   * 获取所有排队中的任务
   */
  getQueuedJobs(): QueueJob[] {
    return Array.from(this.queuedJobs.values())
  }

  /**
   * 获取排序后的队列（优先级 + 时间排序）
   */
  getSortedQueue(): QueueJob[] {
    return Array.from(this.queuedJobs.values()).sort((a, b) => {
      // 优先级高的先处理，如果优先级相同则按时间排序
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.queuedAt.getTime() - b.queuedAt.getTime()
    })
  }

  /**
   * 获取指定用户的排队任务
   */
  getUserQueuedJobs(userId: string): Array<{
    videoId: string
    position: number
    estimatedWaitMinutes: number
  }> {
    const sortedQueue = this.getSortedQueue()
    return sortedQueue
      .filter(job => job.userId === userId)
      .map((job, index) => ({
        videoId: job.id,
        position: index + 1,
        estimatedWaitMinutes: this.estimateWaitTime(index + 1)
      }))
  }

  /**
   * 估算等待时间（分钟）
   */
  private estimateWaitTime(queuePosition: number): number {
    const parallelProcessing = Math.min(this.getActiveJobCount(), queuePosition)
    return Math.ceil((queuePosition * QUEUE_CONSTANTS.AVERAGE_PROCESSING_TIME) / Math.max(parallelProcessing, 1))
  }

  /**
   * 获取队列大小
   */
  getQueueSize(): number {
    return this.queuedJobs.size
  }

  /**
   * 检查队列是否为空
   */
  isQueueEmpty(): boolean {
    return this.queuedJobs.size === 0
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    const count = this.queuedJobs.size
    this.queuedJobs.clear()
    console.log(`[QUEUE STORE] Cleared ${count} jobs from queue`)
  }

  /**
   * 添加活跃任务
   */
  addActiveJob(videoId: string, userId: string): void {
    this.activeJobs.set(videoId, userId)
    console.log(`[QUEUE STORE] Added active job: ${videoId} for user ${userId}`)
  }

  /**
   * 移除活跃任务
   */
  removeActiveJob(videoId: string): boolean {
    const removed = this.activeJobs.delete(videoId)
    if (removed) {
      console.log(`[QUEUE STORE] Removed active job: ${videoId}`)
    }
    return removed
  }

  /**
   * 检查任务是否在活跃状态
   */
  isJobActive(videoId: string): boolean {
    return this.activeJobs.has(videoId)
  }

  /**
   * 获取任务对应的用户ID
   */
  getJobUserId(videoId: string): string | undefined {
    return this.activeJobs.get(videoId)
  }

  /**
   * 获取用户的活跃任务数量
   */
  getUserActiveCount(userId: string): number {
    let count = 0
    for (const activeUserId of this.activeJobs.values()) {
      if (activeUserId === userId) {
        count++
      }
    }
    return count
  }

  /**
   * 获取用户的所有活跃任务ID
   */
  getUserActiveJobIds(userId: string): string[] {
    const jobIds: string[] = []
    for (const [jobId, activeUserId] of this.activeJobs.entries()) {
      if (activeUserId === userId) {
        jobIds.push(jobId)
      }
    }
    return jobIds
  }

  /**
   * 获取所有活跃任务
   */
  getActiveJobs(): Map<string, string> {
    return new Map(this.activeJobs)
  }

  /**
   * 获取活跃任务数量
   */
  getActiveJobCount(): number {
    return this.activeJobs.size
  }

  /**
   * 检查是否可以开始新的处理（基于系统并发限制）
   */
  canStartProcessing(systemMaxConcurrent: number): boolean {
    return this.activeJobs.size < systemMaxConcurrent
  }

  /**
   * 获取系统可用处理槽位数
   */
  getAvailableSlots(systemMaxConcurrent: number): number {
    return Math.max(0, systemMaxConcurrent - this.activeJobs.size)
  }

  /**
   * 清空活跃任务
   */
  clearActiveJobs(): void {
    const count = this.activeJobs.size
    this.activeJobs.clear()
    console.log(`[QUEUE STORE] Cleared ${count} active jobs`)
  }

  /**
   * 获取活跃任务的调试信息
   */
  getActiveJobsDebugInfo(): ActiveJobDebugInfo[] {
    return Array.from(this.activeJobs.entries()).map(([taskId, userId]) => ({
      taskId,
      userId
    }))
  }

  /**
   * 获取存储状态概览
   */
  getStorageOverview(): {
    queuedCount: number
    activeCount: number
    totalUsers: number
    systemLoad: string
  } {
    const activeUserIds = new Set(this.activeJobs.values())

    return {
      queuedCount: this.queuedJobs.size,
      activeCount: this.activeJobs.size,
      totalUsers: activeUserIds.size,
      systemLoad: `${this.activeJobs.size}/${QUEUE_CONSTANTS.AVERAGE_PROCESSING_TIME}`
    }
  }
}