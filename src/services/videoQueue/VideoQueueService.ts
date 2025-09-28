/**
 * 视频队列服务 - 重构版
 * 组合所有模块，提供统一的API接口
 */

import { QueueConfig } from './config'
import { QueueStore } from './QueueStore'
import { UserManager } from './UserManager'
import { ConcurrencyController } from './ConcurrencyController'
import { CleanupService } from './CleanupService'
import { StateRestorer } from './StateRestorer'
import { MetadataGenerator } from './MetadataGenerator'
import { TaskScheduler } from './TaskScheduler'
import { TaskLifecycleHandler } from './TaskLifecycleHandler'
import type {
  SubmitJobRequest,
  SubmitJobResult,
  UserSubmitStatus,
  UserQueueStatus,
  CleanupResult,
  UserZombieTasksInfo,
  ManualCleanupResult,
  ActiveJobDebugInfo,
  SubscriptionTier
} from './types'

class VideoQueueService {
  // 模块实例
  private config: QueueConfig
  private queueStore: QueueStore
  private userManager: UserManager
  private concurrencyController: ConcurrencyController
  private cleanupService: CleanupService
  private stateRestorer: StateRestorer
  private metadataGenerator: MetadataGenerator
  private taskScheduler: TaskScheduler
  private lifecycleHandler: TaskLifecycleHandler

  constructor() {
    // 初始化配置
    this.config = new QueueConfig()

    // 初始化存储
    this.queueStore = new QueueStore()

    // 初始化用户管理器
    this.userManager = new UserManager(this.config)

    // 初始化并发控制器
    this.concurrencyController = new ConcurrencyController(
      this.queueStore,
      this.userManager
    )

    // 初始化清理服务
    this.cleanupService = new CleanupService(
      this.queueStore,
      this.userManager
    )

    // 初始化状态恢复器
    this.stateRestorer = new StateRestorer(
      this.queueStore,
      this.cleanupService
    )

    // 初始化元数据生成器
    this.metadataGenerator = new MetadataGenerator(this.userManager)

    // 初始化任务调度器
    this.taskScheduler = new TaskScheduler(
      this.queueStore,
      this.userManager,
      this.concurrencyController,
      this.metadataGenerator,
      this.config
    )

    // 初始化生命周期处理器
    this.lifecycleHandler = new TaskLifecycleHandler(
      this.queueStore,
      this.userManager,
      this.taskScheduler
    )

    console.log('[VIDEO QUEUE SERVICE] ✅ 所有模块初始化完成')
  }

  /**
   * 初始化队列服务（从数据库恢复状态）
   */
  async initialize(): Promise<void> {
    try {
      // 恢复状态
      await this.stateRestorer.initialize()

      // 启动任务调度器
      this.taskScheduler.startQueueProcessor()

      // 启动定期清理机制
      this.cleanupService.startPeriodicCleanup(this.concurrencyController)

      console.log('[VIDEO QUEUE SERVICE] ✅ 队列服务初始化完成')
    } catch (error) {
      console.error('[VIDEO QUEUE SERVICE] ❌ 队列服务初始化失败:', error)
      throw error
    }
  }

  /**
   * 检查用户是否可以提交新任务
   */
  async canUserSubmit(userId: string): Promise<UserSubmitStatus> {
    const concurrencyCheck = await this.concurrencyController.checkUserConcurrency(userId)

    return {
      canSubmit: concurrencyCheck.canSubmit,
      reason: concurrencyCheck.reason,
      activeCount: concurrencyCheck.activeCount,
      maxAllowed: concurrencyCheck.maxAllowed,
      tier: concurrencyCheck.tier as SubscriptionTier
    }
  }

  /**
   * 提交新的视频生成任务
   */
  async submitJob(request: SubmitJobRequest): Promise<SubmitJobResult> {
    return await this.taskScheduler.submitJob(request)
  }

  /**
   * 任务完成时调用
   */
  async jobCompleted(videoId: string): Promise<void> {
    await this.lifecycleHandler.jobCompleted(videoId)
  }

  /**
   * 任务失败时调用
   */
  async jobFailed(videoId: string): Promise<void> {
    await this.lifecycleHandler.jobFailed(videoId)
  }

  /**
   * 获取用户的队列状态
   */
  async getUserQueueStatus(userId: string): Promise<UserQueueStatus> {
    const activeCount = await this.concurrencyController.getUserActiveCount(userId)
    const maxAllowed = await this.userManager.getUserConcurrentLimit(userId)
    const queuedJobs = this.queueStore.getUserQueuedJobs(userId)

    return {
      activeCount,
      maxAllowed,
      queuedJobs
    }
  }

  /**
   * 手动清理用户的僵尸任务
   */
  async cleanupUserZombieTasks(userId: string): Promise<CleanupResult> {
    return await this.cleanupService.cleanupUserZombieTasks(userId)
  }

  /**
   * 获取用户当前的僵尸任务信息
   */
  async getUserZombieTasksInfo(userId: string): Promise<UserZombieTasksInfo> {
    return await this.cleanupService.getUserZombieTasksInfo(userId)
  }

  /**
   * 手动触发全局清理（用于调试和紧急情况）
   */
  async manualCleanup(): Promise<ManualCleanupResult> {
    const beforeCount = this.queueStore.getActiveJobCount()
    console.log(`[VIDEO QUEUE SERVICE] 🛠️ 手动触发全局清理，清理前活跃任务数: ${beforeCount}`)

    await this.concurrencyController.performGlobalCleanup()

    const afterCount = this.queueStore.getActiveJobCount()
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
  getActiveJobsDebugInfo(): ActiveJobDebugInfo[] {
    return this.queueStore.getActiveJobsDebugInfo()
  }

  /**
   * 停止队列处理器
   */
  stop(): void {
    this.taskScheduler.stopQueueProcessor()
    this.cleanupService.stopPeriodicCleanup()
    console.log('[VIDEO QUEUE SERVICE] ✅ 队列服务已停止')
  }

  /**
   * 获取系统状态概览（用于监控和调试）
   */
  async getSystemStatus(): Promise<{
    config: ReturnType<QueueConfig['getConfigInfo']>
    storage: ReturnType<QueueStore['getStorageOverview']>
    cleanup: ReturnType<CleanupService['getCleanupStatus']>
    lifecycle: Awaited<ReturnType<TaskLifecycleHandler['getLifecycleStats']>>
    concurrency: Awaited<ReturnType<ConcurrencyController['getConcurrencyStats']>>
  }> {
    return {
      config: this.config.getConfigInfo(),
      storage: this.queueStore.getStorageOverview(),
      cleanup: this.cleanupService.getCleanupStatus(),
      lifecycle: await this.lifecycleHandler.getLifecycleStats(),
      concurrency: await this.concurrencyController.getConcurrencyStats()
    }
  }

  /**
   * 强制完成任务（紧急情况使用）
   */
  async forceCompleteJob(videoId: string, reason: string = '手动强制完成'): Promise<void> {
    await this.lifecycleHandler.forceCompleteJob(videoId, reason)
  }

  /**
   * 强制失败任务（紧急情况使用）
   */
  async forceFailJob(videoId: string, reason: string = '手动强制失败'): Promise<void> {
    await this.lifecycleHandler.forceFailJob(videoId, reason)
  }

  /**
   * 执行完整的系统清理
   */
  async performFullSystemCleanup(): Promise<ReturnType<CleanupService['performFullSystemCleanup']>> {
    return await this.cleanupService.performFullSystemCleanup()
  }

  /**
   * 验证恢复状态的完整性
   */
  async validateRestoredState(): Promise<ReturnType<StateRestorer['validateRestoredState']>> {
    return await this.stateRestorer.validateRestoredState()
  }

  /**
   * 强制重新同步状态（紧急情况使用）
   */
  async forceResync(): Promise<void> {
    await this.stateRestorer.forceResync()
  }

  /**
   * 获取恢复统计信息
   */
  getRestoreStats(): ReturnType<StateRestorer['getRestoreStats']> {
    return this.stateRestorer.getRestoreStats()
  }

  /**
   * 强制清理指定用户的所有活跃任务（紧急情况使用）
   */
  async forceCleanupUserTasks(userId: string): Promise<ReturnType<ConcurrencyController['forceCleanupUserTasks']>> {
    return await this.concurrencyController.forceCleanupUserTasks(userId)
  }
}

// 创建单例实例
export const videoQueueService = new VideoQueueService()

export default videoQueueService