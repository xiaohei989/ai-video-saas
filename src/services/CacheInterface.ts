/**
 * 统一缓存接口定义
 * 
 * 为所有缓存服务提供一致的接口规范
 */

export interface CacheOptions {
  ttl?: number // 过期时间（秒）
  compress?: boolean // 是否压缩
  quality?: number // 压缩质量 (0.1-1.0)
  maxWidth?: number // 图片最大宽度
  priority?: 'low' | 'normal' | 'high' // 缓存优先级
  category?: 'image' | 'template' | 'video' | 'user' // 数据分类
  level?: 'L1' | 'L2' | 'L3' | 'all' // 缓存级别
  sync?: boolean // 是否同步到所有级别
  force?: boolean // 强制刷新
}

export interface CacheEntry<T = any> {
  key: string
  data: T
  timestamp: number
  ttl: number
  category?: string
  size?: number
  accessCount?: number
  priority?: string
}

export interface CacheStats {
  hits: number
  misses: number
  errors: number
  total: number
  hitRate: string
  memoryUsage?: string
  idbUsage?: string
}

export interface CategoryStats {
  name: string
  count: number
  size: number
  maxSize: number
  hitRate: number
  lastAccess: number
}

export interface BatchCacheResult<T = any> {
  hits: Map<string, T>
  misses: string[]
  errors: Map<string, Error>
}

/**
 * 统一缓存服务接口
 */
export interface ICacheService {
  /**
   * 获取缓存数据
   */
  get<T = any>(key: string, options?: CacheOptions): Promise<T | null>

  /**
   * 设置缓存数据
   */
  set<T = any>(key: string, data: T, options?: CacheOptions): Promise<boolean>

  /**
   * 删除缓存数据
   */
  delete(key: string): Promise<boolean>

  /**
   * 批量获取缓存
   */
  getBatch?<T = any>(keys: string[], options?: CacheOptions): Promise<BatchCacheResult<T>>

  /**
   * 批量设置缓存
   */
  setBatch?<T = any>(entries: Array<{ key: string; data: T; ttl?: number }>, options?: CacheOptions): Promise<boolean>

  /**
   * 清除所有缓存
   */
  clearAll(): Promise<void>

  /**
   * 获取统计信息
   */
  getStats(): CacheStats | Promise<CacheStats>

  /**
   * 获取分类统计
   */
  getCategoryStats?(): CategoryStats[] | Promise<CategoryStats[]>
}

/**
 * 内存缓存服务接口
 */
export interface IMemoryCacheService extends ICacheService {
  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): {
    totalSize: number
    itemCount: number
    categories: Record<string, { size: number; count: number }>
  }

  /**
   * 清理过期缓存
   */
  cleanupExpired(): void

  /**
   * 按分类清理缓存
   */
  evictCategory(category: string, ratio?: number): void
}

/**
 * 持久化缓存服务接口
 */
export interface IPersistentCacheService extends ICacheService {
  /**
   * 初始化存储
   */
  initialize(): Promise<void>

  /**
   * 获取存储使用情况
   */
  getStorageUsage(): Promise<{
    quota: number
    usage: number
    available: number
  }>

  /**
   * 清理过期数据
   */
  cleanupExpired(): Promise<number>

  /**
   * 按前缀清理
   */
  clearByPrefix?(prefix: string): Promise<void>
}

/**
 * 多级缓存服务接口
 */
export interface IMultiLevelCacheService extends ICacheService {
  /**
   * 预热缓存
   */
  warmup(keys: string[], fetcher: (key: string) => Promise<any>): Promise<void>

  /**
   * 重置统计信息
   */
  resetStats(): void

  /**
   * 按级别删除缓存
   */
  delete(key: string, level?: 'L1' | 'L2' | 'L3' | 'all'): Promise<boolean>
}

// 缓存类型常量
export const CACHE_TYPES = {
  MEMORY: 'memory',
  IDB: 'indexeddb',
  REDIS: 'redis',
  UNIFIED: 'unified',
  MULTI_LEVEL: 'multi-level'
} as const

export type CacheType = typeof CACHE_TYPES[keyof typeof CACHE_TYPES]

// 缓存分类常量
export const CACHE_CATEGORIES = {
  IMAGE: 'image',
  TEMPLATE: 'template', 
  VIDEO: 'video',
  USER: 'user'
} as const

export type CacheCategory = typeof CACHE_CATEGORIES[keyof typeof CACHE_CATEGORIES]

// 缓存优先级常量
export const CACHE_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high'
} as const

export type CachePriority = typeof CACHE_PRIORITIES[keyof typeof CACHE_PRIORITIES]