/**
 * 视频相关类型定义
 * 从 VideosPageNew.tsx 提取的类型定义
 */

import type { Database } from '@/lib/supabase'
import type { VideoTask } from '@/services/VideoTaskManager'
import type { VideoProgress } from '@/services/progressManager'

// 基础视频类型
export type Video = Database['public']['Tables']['videos']['Row']

// 订阅层级类型
export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending'

// IndexedDB缓存信息类型
export interface IndexedDBCacheInfo {
  key: string
  size: {
    bytes: number
    kb: string
    mb: string
  }
  category?: string
  timestamp: string
  expiry?: string
  dataType: string
  dataLength: number
  dataPreview: string
}

// 加载状态类型
export interface LoadingState {
  initial: boolean      // 初始骨架UI状态
  basicLoaded: boolean  // 基础数据已加载（首屏视频）
  fullLoaded: boolean   // 完整数据已加载（任务状态、订阅等）
}

// 缩略图调试信息类型
export interface ThumbnailDebugInfo {
  hasCachedThumbnail: boolean
  cacheSize?: string
  cacheType?: 'base64' | 'url' | 'r2' | 'external'
  thumbnailUrl?: string
  remoteUrl?: string
  cacheLocation?: string
  isBlurImage?: boolean
  isLoading?: boolean
  remoteFileSize?: string
  cacheKey?: string
  blurImageUrl?: string | null
  indexedDBCacheInfo?: IndexedDBCacheInfo[]
}

// 性能监控指标类型
export interface PerformanceMetrics {
  pageLoadStart: number
  firstContentfulPaint: number
  timeToInteractive: number
  cacheHitCount: number
  networkRequestCount: number
  totalLoadTime: number
}

// 删除对话框状态类型
export interface DeleteDialogState {
  open: boolean
  video: Video | null
}

// 容器尺寸类型
export interface ContainerDimensions {
  width: number
  height: number
}

// 分页选项类型
export interface PaginationOptions {
  page: number
  pageSize: number
}

// 快速加载结果类型
export interface QuickLoadResult {
  initialResult: any
  fromCache: boolean
  usedFullCacheForDisplay: boolean
}

// 后台加载选项类型
export interface BackgroundLoadOptions {
  skipInitialRefresh?: boolean
}

// 视频操作类型
export type VideoAction = 'play' | 'download' | 'share' | 'delete' | 'regenerate'

// 视频状态类型
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

// 🆕 缩略图生成状态类型
export type ThumbnailGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | null

// 缓存类型
export type CacheType = 'base64' | 'url' | 'r2' | 'external'

// 设备类型
export type DeviceType = 'mobile' | 'desktop'

// 视频视图模式
export type ViewMode = 'grid' | 'list'