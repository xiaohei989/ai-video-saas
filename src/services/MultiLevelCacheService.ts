/**
 * 多级缓存服务
 * 
 * 实现四级缓存架构：
 * L1: 内存缓存 (Map) - <50ms响应
 * L2: IndexedDB缓存 - <100ms响应
 * L3: Redis缓存 (Edge Function) - <200ms响应
 * L4: Supabase数据库 - 备选方案
 * 
 * 特性：
 * - 自动缓存同步
 * - TTL分层策略
 * - 批量操作支持
 * - 缓存预热
 * - 智能失效策略
 */

import { idb } from '@/services/idbService'
import edgeCacheClient from './EdgeFunctionCacheClient'
// import { supabase } from '@/lib/supabase' // unused

export interface CacheOptions {
  ttl?: number // 过期时间（秒）
  level?: 'L1' | 'L2' | 'L3' | 'all' // 缓存级别
  sync?: boolean // 是否同步到所有级别
  force?: boolean // 强制刷新
}

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  key: string
}

export interface BatchCacheResult<T = any> {
  hits: Map<string, T>
  misses: string[]
  errors: Map<string, Error>
}

// TTL策略配置（秒）
const TTL_STRATEGY = {
  STATIC: 86400,    // 24小时 - 模板数据等
  USER: 3600,       // 1小时 - 用户数据
  DYNAMIC: 300,     // 5分钟 - 点赞数等
  REALTIME: 0,      // 不缓存 - 实时数据
  DEFAULT: 1800     // 30分钟 - 默认
}

// 缓存类型前缀
const CACHE_PREFIX = {
  TEMPLATE: 'template:',
  USER: 'user:',
  VIDEO: 'video:',
  STATS: 'stats:',
  THUMBNAIL: 'thumb:',
  SUBSCRIPTION: 'sub:',
  CREDITS: 'credits:'
}

class MultiLevelCacheService {
  // L1: 内存缓存
  private memoryCache = new Map<string, CacheEntry>()
  private memoryCacheSize = 0
  private readonly MAX_MEMORY_SIZE = 50 * 1024 * 1024 // 50MB
  
  // L2: IndexedDB实例
  private idbReady = false
  private idbInitPromise: Promise<void> | null = null
  
  // 缓存统计
  private stats = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    l4Hits: 0,
    misses: 0,
    errors: 0
  }
  
  // LRU追踪
  private accessOrder = new Map<string, number>()
  private accessCounter = 0

  constructor() {
    this.initializeIDB()
    this.startCleanupTask()
  }

  /**
   * 初始化IndexedDB
   */
  private async initializeIDB(): Promise<void> {
    if (this.idbInitPromise) return this.idbInitPromise
    
    this.idbInitPromise = (async () => {
      try {
        await idb.initialize()
        this.idbReady = true
        console.log('[MultiLevelCache] IndexedDB初始化成功')
      } catch (error) {
        console.error('[MultiLevelCache] IndexedDB初始化失败:', error)
        this.idbReady = false
      }
    })()
    
    return this.idbInitPromise
  }

  /**
   * 启动定期清理任务
   */
  private startCleanupTask(): void {
    // 每5分钟清理过期缓存
    setInterval(() => {
      this.cleanupExpiredCache()
    }, 5 * 60 * 1000)
  }

  /**
   * 获取缓存数据（支持多级查找）
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const { force = false, level = 'all' } = options
    
    if (force) {
      return null // 强制刷新，跳过缓存
    }

    // L1: 内存缓存
    if (level === 'L1' || level === 'all') {
      const memoryEntry = this.memoryCache.get(key)
      if (memoryEntry && !this.isExpired(memoryEntry)) {
        this.stats.l1Hits++
        this.updateAccessOrder(key)
        return memoryEntry.data as T
      }
    }

    // L2: IndexedDB缓存
    if ((level === 'L2' || level === 'all') && this.idbReady) {
      try {
        const idbData = await idb.getCache(key)
        if (idbData && !this.isExpired(idbData)) {
          this.stats.l2Hits++
          // 回填到L1
          if (level === 'all') {
            this.setMemoryCache(key, idbData.data, idbData.ttl)
          }
          return idbData.data as T
        }
      } catch (error) {
        console.error('[MultiLevelCache] L2读取失败:', error)
      }
    }

    // L3: Redis缓存
    if (level === 'L3' || level === 'all') {
      try {
        const redisData = await edgeCacheClient.get(key)
        if (redisData) {
          this.stats.l3Hits++
          // 回填到L1和L2
          if (level === 'all') {
            const ttl = options.ttl || this.getTTLByKey(key)
            await this.setMultiLevel(key, redisData, { ttl, sync: false })
          }
          return redisData as T
        }
      } catch (error) {
        console.error('[MultiLevelCache] L3读取失败:', error)
      }
    }

    this.stats.misses++
    return null
  }

  /**
   * 设置缓存数据（支持多级同步）
   */
  async set<T = any>(
    key: string, 
    data: T, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    const { 
      ttl = this.getTTLByKey(key), 
      level = 'all', 
      sync = true 
    } = options

    try {
      if (level === 'L1' || level === 'all') {
        this.setMemoryCache(key, data, ttl)
      }

      if ((level === 'L2' || level === 'all') && this.idbReady) {
        await idb.setCache(key, data, ttl)
      }

      if ((level === 'L3' || level === 'all') && sync) {
        await edgeCacheClient.set(key, data, ttl)
      }

      return true
    } catch (error) {
      this.stats.errors++
      console.error('[MultiLevelCache] 设置缓存失败:', error)
      return false
    }
  }

  /**
   * 批量获取缓存
   */
  async getBatch<T = any>(
    keys: string[], 
    options: CacheOptions = {}
  ): Promise<BatchCacheResult<T>> {
    const result: BatchCacheResult<T> = {
      hits: new Map(),
      misses: [],
      errors: new Map()
    }

    // 第一步：从L1批量获取
    const l1Misses: string[] = []
    for (const key of keys) {
      const cached = await this.get<T>(key, { ...options, level: 'L1' })
      if (cached !== null) {
        result.hits.set(key, cached)
      } else {
        l1Misses.push(key)
      }
    }

    if (l1Misses.length === 0) {
      return result
    }

    // 第二步：从L2批量获取
    if (this.idbReady) {
      const l2Misses: string[] = []
      const l2Results = await Promise.allSettled(
        l1Misses.map(key => this.get<T>(key, { ...options, level: 'L2' }))
      )

      l1Misses.forEach((key, index) => {
        const res = l2Results[index]
        if (res.status === 'fulfilled' && res.value !== null) {
          result.hits.set(key, res.value)
        } else {
          l2Misses.push(key)
        }
      })

      if (l2Misses.length === 0) {
        return result
      }
      
      result.misses = l2Misses
    } else {
      result.misses = l1Misses
    }

    // 第三步：从L3批量获取（如果还有未命中的）
    if (result.misses.length > 0) {
      try {
        const l3Results = await Promise.allSettled(
          result.misses.map(key => this.get<T>(key, { ...options, level: 'L3' }))
        )

        const finalMisses: string[] = []
        result.misses.forEach((key, index) => {
          const res = l3Results[index]
          if (res.status === 'fulfilled' && res.value !== null) {
            result.hits.set(key, res.value)
          } else {
            finalMisses.push(key)
          }
        })
        
        result.misses = finalMisses
      } catch (error) {
        console.error('[MultiLevelCache] L3批量获取失败:', error)
      }
    }

    return result
  }

  /**
   * 批量设置缓存
   */
  async setBatch<T = any>(
    entries: Array<{ key: string; data: T; ttl?: number }>,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const results = await Promise.allSettled(
      entries.map(entry => 
        this.set(entry.key, entry.data, {
          ...options,
          ttl: entry.ttl || options.ttl
        })
      )
    )

    return results.every(r => r.status === 'fulfilled' && r.value)
  }

  /**
   * 删除缓存
   */
  async delete(key: string, level: 'L1' | 'L2' | 'L3' | 'all' = 'all'): Promise<boolean> {
    try {
      if (level === 'L1' || level === 'all') {
        this.memoryCache.delete(key)
        this.accessOrder.delete(key)
      }

      if ((level === 'L2' || level === 'all') && this.idbReady) {
        await idb.deleteCache(key)
      }

      if (level === 'L3' || level === 'all') {
        await edgeCacheClient.delete(key)
      }

      return true
    } catch (error) {
      console.error('[MultiLevelCache] 删除缓存失败:', error)
      return false
    }
  }

  /**
   * 清除指定前缀的所有缓存
   */
  async clearByPrefix(prefix: string): Promise<void> {
    // 清除内存缓存
    const keysToDelete: string[] = []
    this.memoryCache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => {
      this.memoryCache.delete(key)
      this.accessOrder.delete(key)
    })

    // 清除IndexedDB缓存
    if (this.idbReady) {
      await idb.clearCacheByPrefix(prefix)
    }

    // Redis不支持前缀清除，需要逐个删除
    // 这里可以通过Edge Function实现批量删除
  }

  /**
   * 预热缓存
   */
  async warmup(keys: string[], fetcher: (key: string) => Promise<any>): Promise<void> {
    const missingKeys = keys.filter(key => !this.memoryCache.has(key))
    
    if (missingKeys.length === 0) return

    const results = await Promise.allSettled(
      missingKeys.map(async key => {
        const data = await fetcher(key)
        if (data !== null && data !== undefined) {
          await this.set(key, data)
        }
      })
    )

    const errors = results.filter(r => r.status === 'rejected')
    if (errors.length > 0) {
      console.warn(`[MultiLevelCache] 预热失败 ${errors.length}/${missingKeys.length} 个键`)
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const total = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits + 
                  this.stats.l4Hits + this.stats.misses
    
    return {
      ...this.stats,
      total,
      l1HitRate: total > 0 ? (this.stats.l1Hits / total * 100).toFixed(2) + '%' : '0%',
      l2HitRate: total > 0 ? (this.stats.l2Hits / total * 100).toFixed(2) + '%' : '0%',
      l3HitRate: total > 0 ? (this.stats.l3Hits / total * 100).toFixed(2) + '%' : '0%',
      overallHitRate: total > 0 ? 
        ((total - this.stats.misses) / total * 100).toFixed(2) + '%' : '0%',
      memoryCacheSize: `${(this.memoryCacheSize / 1024 / 1024).toFixed(2)}MB`,
      memoryCacheCount: this.memoryCache.size
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      l4Hits: 0,
      misses: 0,
      errors: 0
    }
  }

  // ============ 私有方法 ============

  /**
   * 设置内存缓存
   */
  private setMemoryCache(key: string, data: any, ttl: number): void {
    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000 // 转换为毫秒
    }

    // 估算数据大小
    const dataSize = this.estimateSize(data)
    
    // 如果超过最大内存限制，执行LRU淘汰
    if (this.memoryCacheSize + dataSize > this.MAX_MEMORY_SIZE) {
      this.evictLRU(dataSize)
    }

    this.memoryCache.set(key, entry)
    this.memoryCacheSize += dataSize
    this.updateAccessOrder(key)
  }

  /**
   * 设置多级缓存
   */
  private async setMultiLevel(key: string, data: any, options: CacheOptions): Promise<void> {
    const { ttl = this.getTTLByKey(key) } = options
    
    // L1
    this.setMemoryCache(key, data, ttl)
    
    // L2
    if (this.idbReady) {
      try {
        await idb.setCache(key, data, ttl)
      } catch (error) {
        console.error('[MultiLevelCache] L2设置失败:', error)
      }
    }
  }

  /**
   * 检查缓存是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    if (entry.ttl === 0) return false // 永不过期
    return Date.now() > entry.timestamp + entry.ttl
  }

  /**
   * 根据key获取默认TTL
   */
  private getTTLByKey(key: string): number {
    if (key.startsWith(CACHE_PREFIX.TEMPLATE)) return TTL_STRATEGY.STATIC
    if (key.startsWith(CACHE_PREFIX.USER)) return TTL_STRATEGY.USER
    if (key.startsWith(CACHE_PREFIX.VIDEO)) return TTL_STRATEGY.USER
    if (key.startsWith(CACHE_PREFIX.STATS)) return TTL_STRATEGY.DYNAMIC
    if (key.startsWith(CACHE_PREFIX.THUMBNAIL)) return TTL_STRATEGY.STATIC
    if (key.startsWith(CACHE_PREFIX.SUBSCRIPTION)) return TTL_STRATEGY.USER
    if (key.startsWith(CACHE_PREFIX.CREDITS)) return TTL_STRATEGY.DYNAMIC
    return TTL_STRATEGY.DEFAULT
  }

  /**
   * 更新访问顺序（用于LRU）
   */
  private updateAccessOrder(key: string): void {
    this.accessOrder.set(key, ++this.accessCounter)
  }

  /**
   * LRU淘汰
   */
  private evictLRU(requiredSpace: number): void {
    const entries = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1]) // 按访问时间排序
    
    let freedSpace = 0
    for (const [key] of entries) {
      if (freedSpace >= requiredSpace) break
      
      const entry = this.memoryCache.get(key)
      if (entry) {
        const size = this.estimateSize(entry.data)
        this.memoryCache.delete(key)
        this.accessOrder.delete(key)
        this.memoryCacheSize -= size
        freedSpace += size
      }
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    // const now = Date.now() // unused
    const expiredKeys: string[] = []

    this.memoryCache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        expiredKeys.push(key)
      }
    })

    expiredKeys.forEach(key => {
      const entry = this.memoryCache.get(key)
      if (entry) {
        const size = this.estimateSize(entry.data)
        this.memoryCache.delete(key)
        this.accessOrder.delete(key)
        this.memoryCacheSize -= size
      }
    })

    if (expiredKeys.length > 0) {
      console.log(`[MultiLevelCache] 清理了 ${expiredKeys.length} 个过期缓存`)
    }
  }

  /**
   * 估算数据大小（字节）
   */
  private estimateSize(data: any): number {
    if (data === null || data === undefined) return 0
    
    const type = typeof data
    if (type === 'boolean') return 4
    if (type === 'number') return 8
    if (type === 'string') return data.length * 2 // UTF-16
    
    if (data instanceof ArrayBuffer) return data.byteLength
    if (data instanceof Blob) return data.size
    
    // 对象和数组，简单估算
    try {
      return JSON.stringify(data).length * 2
    } catch {
      return 1024 // 默认1KB
    }
  }
}

// 导出单例
export const multiLevelCache = new MultiLevelCacheService()

// 导出常量
export { CACHE_PREFIX, TTL_STRATEGY }