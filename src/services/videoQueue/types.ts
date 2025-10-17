/**
 * 视频队列服务相关类型定义
 */

import type { Database } from '@/lib/supabase'
import type { VideoQuality } from '@/config/credits'

export type Video = Database['public']['Tables']['videos']['Row']

export type SubscriptionTier =
  | 'free'
  | 'basic'
  | 'pro'
  | 'enterprise'
  | 'basic-annual'
  | 'pro-annual'
  | 'enterprise-annual'

/**
 * 队列任务
 */
export interface QueueJob {
  id: string
  userId: string
  videoRecordId: string
  priority: number
  queuedAt: Date
  estimatedWaitMinutes?: number
}

/**
 * 提交任务请求
 */
export interface SubmitJobRequest {
  userId: string
  videoData: {
    templateId?: string
    title?: string
    description?: string
    prompt?: string
    parameters?: Record<string, any>
    creditsUsed: number
    isPublic?: boolean
    aspectRatio?: '16:9' | '9:16'
    quality?: VideoQuality
    // apiProvider 已移除 - 统一由环境变量 VITE_PRIMARY_VIDEO_API 控制
  }
  priority?: number
}

/**
 * 提交任务结果
 */
export interface SubmitJobResult {
  status: 'processing' | 'queued'
  videoRecordId: string
  queuePosition?: number
  estimatedWaitMinutes?: number
}

/**
 * 用户提交状态
 */
export interface UserSubmitStatus {
  canSubmit: boolean
  reason?: string
  activeCount?: number
  maxAllowed?: number
  tier?: SubscriptionTier
}

/**
 * 用户队列状态
 */
export interface UserQueueStatus {
  activeCount: number
  maxAllowed: number
  queuedJobs: Array<{
    videoId: string
    position: number
    estimatedWaitMinutes: number
  }>
}

/**
 * 清理结果
 */
export interface CleanupResult {
  cleaned: number
  errors: string[]
}

/**
 * 僵尸任务信息
 */
export interface ZombieTaskInfo {
  id: string
  title?: string
  startedAt: string
  runningMinutes: number
  veo3JobId?: string
}

/**
 * 用户僵尸任务信息
 */
export interface UserZombieTasksInfo {
  zombieTasks: ZombieTaskInfo[]
  totalZombies: number
}

/**
 * AI元数据生成结果
 */
export interface AIMetadataResult {
  title: string
  description: string
  status: 'ai_generated' | 'timeout_default' | 'error_fallback'
  aiPromise?: Promise<any>
}

/**
 * 手动清理结果
 */
export interface ManualCleanupResult {
  beforeCount: number
  afterCount: number
  cleanedCount: number
}

/**
 * 活跃任务调试信息
 */
export interface ActiveJobDebugInfo {
  taskId: string
  userId: string
}

/**
 * 并发检查结果
 */
export interface ConcurrencyCheckResult {
  canSubmit: boolean
  reason?: string
  activeCount: number
  maxAllowed: number
  tier: SubscriptionTier
}

/**
 * 系统并发检查结果
 */
export interface SystemConcurrencyResult {
  canStartProcessing: boolean
  availableSlots: number
  activeCount: number
  maxConcurrent: number
}

/**
 * 将年度订阅映射到基础订阅等级
 */
export const mapAnnualToBaseTier = (tier: SubscriptionTier): SubscriptionTier => {
  if (tier === 'basic-annual') return 'basic'
  if (tier === 'pro-annual') return 'pro'
  if (tier === 'enterprise-annual') return 'enterprise'
  return tier
}