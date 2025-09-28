/**
 * 视频队列服务配置管理
 */

import type { SubscriptionTier } from './types'

export class QueueConfig {
  /**
   * 系统最大并发视频数
   */
  public readonly systemMaxConcurrent: number

  /**
   * 队列检查间隔（毫秒）
   */
  public readonly queueCheckInterval: number

  /**
   * 用户并发限制配置（基础配置，年度订阅映射到对应基础版本）
   */
  public readonly userConcurrentLimits: Record<SubscriptionTier, number>

  constructor() {
    // 从环境变量读取配置
    this.systemMaxConcurrent = parseInt(
      process.env.VITE_SYSTEM_MAX_CONCURRENT_VIDEOS || '20'
    )
    this.queueCheckInterval = parseInt(
      process.env.VITE_QUEUE_CHECK_INTERVAL || '5000'
    )

    // 初始化用户并发限制配置
    this.userConcurrentLimits = {
      free: parseInt(process.env.VITE_USER_CONCURRENT_FREE || '1'),
      basic: parseInt(process.env.VITE_USER_CONCURRENT_BASIC || '3'),
      pro: parseInt(process.env.VITE_USER_CONCURRENT_PRO || '5'),
      enterprise: parseInt(process.env.VITE_USER_CONCURRENT_ENTERPRISE || '10'),
      'basic-annual': parseInt(process.env.VITE_USER_CONCURRENT_BASIC || '3'),
      'pro-annual': parseInt(process.env.VITE_USER_CONCURRENT_PRO || '5'),
      'enterprise-annual': parseInt(process.env.VITE_USER_CONCURRENT_ENTERPRISE || '10')
    }
  }

  /**
   * 获取用户并发限制
   */
  getUserLimit(tier: SubscriptionTier): number {
    return this.userConcurrentLimits[tier] || this.userConcurrentLimits.free
  }

  /**
   * 获取系统配置信息（用于调试）
   */
  getConfigInfo(): {
    systemMaxConcurrent: number
    queueCheckInterval: number
    userLimits: Record<SubscriptionTier, number>
  } {
    return {
      systemMaxConcurrent: this.systemMaxConcurrent,
      queueCheckInterval: this.queueCheckInterval,
      userLimits: { ...this.userConcurrentLimits }
    }
  }
}

/**
 * 配置常量
 */
export const QUEUE_CONSTANTS = {
  /**
   * 任务超时时间（毫秒）
   */
  TASK_TIMEOUT_MS: 30 * 60 * 1000, // 30分钟

  /**
   * 僵尸任务检查阈值（毫秒）
   */
  ZOMBIE_THRESHOLD: 30 * 60 * 1000, // 30分钟

  /**
   * 平均视频处理时间（分钟）
   */
  AVERAGE_PROCESSING_TIME: 3,

  /**
   * 全局清理间隔（毫秒）
   */
  GLOBAL_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5分钟

  /**
   * 僵尸任务检查间隔（毫秒）
   */
  ZOMBIE_CHECK_INTERVAL: 5 * 60 * 1000, // 5分钟

  /**
   * AI生成超时时间（毫秒）
   */
  AI_GENERATION_TIMEOUT: 12000, // 12秒

  /**
   * 异步AI生成超时时间（毫秒）
   */
  ASYNC_AI_GENERATION_TIMEOUT: 15000, // 15秒

  /**
   * 延迟AI处理最大等待时间（毫秒）
   */
  DELAYED_AI_MAX_WAIT: 2 * 60 * 1000, // 2分钟

  /**
   * AI重试最大次数
   */
  AI_MAX_RETRIES: 2,

  /**
   * 队列处理成功后的延迟时间（毫秒）
   */
  QUEUE_PROCESS_DELAY: 500,

  /**
   * 队列处理失败后的延迟时间（毫秒）
   */
  QUEUE_PROCESS_ERROR_DELAY: 1000
} as const

/**
 * 默认配置实例
 */
export const queueConfig = new QueueConfig()