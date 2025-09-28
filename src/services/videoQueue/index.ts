/**
 * VideoQueue 模块统一导出入口
 * 提供所有队列相关的类型、配置和服务
 */

// 主要服务 - 单例实例
export { default as videoQueueService } from './VideoQueueService'

// 类型定义
export type {
  QueueJob,
  SubmitJobRequest,
  SubmitJobResult,
  UserSubmitStatus,
  UserQueueStatus,
  CleanupResult,
  UserZombieTasksInfo,
  ManualCleanupResult,
  ActiveJobDebugInfo,
  SubscriptionTier,
  AIMetadataResult,
  ConcurrencyCheckResult,
  SystemConcurrencyResult
} from './types'

// 配置和常量
export { QueueConfig, QUEUE_CONSTANTS } from './config'

// 工具函数
export { mapAnnualToBaseTier } from './types'

// 模块类 (用于单独使用或测试)
export { QueueStore } from './QueueStore'
export { UserManager } from './UserManager'
export { ConcurrencyController } from './ConcurrencyController'
export { CleanupService } from './CleanupService'
export { StateRestorer } from './StateRestorer'
export { MetadataGenerator } from './MetadataGenerator'
export { TaskScheduler } from './TaskScheduler'
export { TaskLifecycleHandler } from './TaskLifecycleHandler'