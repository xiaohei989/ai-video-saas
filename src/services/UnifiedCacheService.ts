/**
 * 统一缓存服务
 * 
 * 基于MultiLevelCacheService构建，专门优化的缓存系统：
 * - L1: 分类内存缓存 (图片、模板、视频、用户数据分别管理)
 * - L2: IndexedDB持久化存储 (完全替代localStorage)
 * 
 * 特性：
 * - 智能分类内存管理
 * - 高效图片压缩算法
 * - 大容量IndexedDB存储
 * - 自动数据迁移
 * - 详细性能监控
 */

import { enhancedIDB } from '@/services/EnhancedIDBService'

// 移动端检测
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export interface CacheOptions {
  ttl?: number // 过期时间（秒）
  compress?: boolean // 是否压缩（仅图片）
  quality?: number // 图片质量 (0.1-1.0)
  maxWidth?: number // 图片最大宽度
  priority?: 'low' | 'normal' | 'high' // 缓存优先级
  category?: 'image' | 'template' | 'video' | 'user' // 数据分类
}

export interface CacheEntry<T = any> {
  key: string
  data: T
  timestamp: number
  ttl: number
  category: string
  size: number
  accessCount: number
  priority: string
}

export interface CategoryStats {
  name: string
  count: number
  size: number
  maxSize: number
  hitRate: number
  lastAccess: number
}

// 分类内存配置
const MEMORY_CONFIG = {
  image: {
    maxSize: isMobile ? 15 * 1024 * 1024 : 25 * 1024 * 1024, // 15MB/25MB
    maxItems: isMobile ? 50 : 100,
    defaultTTL: 24 * 60 * 60, // 24小时
    evictionRatio: 0.3 // 清理30%
  },
  template: {
    maxSize: isMobile ? 3 * 1024 * 1024 : 8 * 1024 * 1024, // 3MB/8MB
    maxItems: isMobile ? 100 : 200,
    defaultTTL: 12 * 60 * 60, // 12小时
    evictionRatio: 0.2
  },
  video: {
    maxSize: isMobile ? 20 * 1024 * 1024 : 50 * 1024 * 1024, // 20MB/50MB (内存缓存)
    maxItems: isMobile ? 30 : 80, // 支持更多视频元数据
    defaultTTL: 24 * 60 * 60, // 24小时 (延长缓存时间)
    evictionRatio: 0.3
  },
  user: {
    maxSize: isMobile ? 2 * 1024 * 1024 : 5 * 1024 * 1024, // 2MB/5MB
    maxItems: isMobile ? 100 : 200,
    defaultTTL: 2 * 60 * 60, // 2小时
    evictionRatio: 0.2
  }
} as const

// 图片压缩配置已移除 - 由NewImageCache专门处理图片压缩

class UnifiedCacheService {
  // 分类内存缓存
  private memoryCache = new Map<string, Map<string, CacheEntry>>()
  private categoryStats = new Map<string, {
    size: number
    accessOrder: Map<string, number>
    hits: number
    misses: number
  }>()
  private accessCounter = 0
  
  // IndexedDB状态
  private idbReady = false
  private idbInitPromise: Promise<void> | null = null
  
  // 全局统计
  private globalStats = {
    totalHits: 0,
    totalMisses: 0,
    totalSize: 0,
    migrationCompleted: false
  }
  
  // 清理任务
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.initializeCategories()
    this.initializeIDB()
    this.startCleanupTask()
    this.migrateFromLocalStorage()
  }

  /**
   * 初始化分类缓存
   */
  private initializeCategories(): void {
    Object.keys(MEMORY_CONFIG).forEach(category => {
      this.memoryCache.set(category, new Map())
      this.categoryStats.set(category, {
        size: 0,
        accessOrder: new Map(),
        hits: 0,
        misses: 0
      })
    })
    
  }

  /**
   * 初始化IndexedDB
   */
  private async initializeIDB(): Promise<void> {
    if (this.idbInitPromise) return this.idbInitPromise
    
    this.idbInitPromise = (async () => {
      try {
        await enhancedIDB.initialize()
        this.idbReady = true

        // 检查存储使用情况
        await this.getStorageUsage()
      } catch (error) {
        this.idbReady = false
      }
    })()
    
    return this.idbInitPromise
  }

  /**
   * 获取缓存数据
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const category = options.category || this.getCategoryFromKey(key)

    // L1: 内存缓存检查
    const memoryResult = this.getFromMemory<T>(key, category)
    if (memoryResult !== null) {
      this.updateStats(category, 'hit')
      return memoryResult
    }
    
    // L2: IndexedDB检查
    if (this.idbReady) {
      try {
        const idbData = await enhancedIDB.get(key)
        if (idbData && !this.isExpired(idbData)) {
          // 回填到L1内存缓存
          this.setInMemory(key, idbData.data, category, {
            ttl: this.getRemainingTTL(idbData),
            priority: 'normal'
          })
          
          this.updateStats(category, 'hit')
          return idbData.data as T
        }
      } catch (error) {
        // L2 read failed
      }
    }

    this.updateStats(category, 'miss')
    return null
  }

  /**
   * 设置缓存数据
   */
  async set<T = any>(key: string, data: T, options: CacheOptions = {}): Promise<boolean> {
    const category = options.category || this.getCategoryFromKey(key)
    const ttl = options.ttl || MEMORY_CONFIG[category as keyof typeof MEMORY_CONFIG]?.defaultTTL || 3600

    // 验证数据有效性
    if (data === undefined || data === null) {
      return false
    }
    
    try {
      // 数据直接存储，不进行压缩处理
      // 图片压缩由专门的NewImageCache系统处理
      const processedData = data
      
      // L1: 设置内存缓存
      const memorySuccess = this.setInMemory(key, processedData, category, {
        ttl,
        priority: options.priority || 'normal'
      })
      
      // L2: 设置IndexedDB缓存
      if (this.idbReady && memorySuccess) {
        try {
          await enhancedIDB.set(key, processedData, { ttl })
        } catch (error) {
          // L2 write failed
        }
      }
      
      return memorySuccess
    } catch (error) {
      return false
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string, options: { category?: string } = {}): Promise<boolean> {
    const category = options.category || this.getCategoryFromKey(key)

    try {
      // L1: 从内存中删除
      this.removeFromMemory(key, category)

      // L2: 从IndexedDB中删除
      if (this.idbReady) {
        try {
          await enhancedIDB.delete(key)
        } catch (error) {
          // L2 delete failed
        }
      }

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 从内存获取数据
   */
  private getFromMemory<T>(key: string, category: string): T | null {
    const categoryCache = this.memoryCache.get(category)
    if (!categoryCache) return null
    
    const entry = categoryCache.get(key)
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.removeFromMemory(key, category)
      }
      return null
    }
    
    // 更新访问统计
    entry.accessCount++
    this.updateAccessOrder(key, category)
    
    return entry.data as T
  }

  /**
   * 在内存中设置数据
   */
  private setInMemory(key: string, data: any, category: string, options: {
    ttl: number
    priority: string
  }): boolean {
    const config = MEMORY_CONFIG[category as keyof typeof MEMORY_CONFIG]
    if (!config) {
      return false
    }
    
    const categoryCache = this.memoryCache.get(category)
    const categoryStats = this.categoryStats.get(category)
    if (!categoryCache || !categoryStats) return false
    
    const dataSize = this.estimateSize(data)
    
    // 检查是否需要清理空间
    if (categoryStats.size + dataSize > config.maxSize || 
        categoryCache.size >= config.maxItems) {
      this.evictCategory(category, Math.ceil(config.maxItems * config.evictionRatio))
    }
    
    // 创建缓存条目
    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl: options.ttl * 1000, // 转换为毫秒
      category,
      size: dataSize,
      accessCount: 1,
      priority: options.priority
    }
    
    // 如果存在旧条目，先移除
    if (categoryCache.has(key)) {
      this.removeFromMemory(key, category)
    }
    
    // 添加新条目
    categoryCache.set(key, entry)
    categoryStats.size += dataSize
    this.updateAccessOrder(key, category)
    this.globalStats.totalSize += dataSize
    
    return true
  }

  // 图片压缩相关方法已移除
  // 所有图片压缩处理现在由NewImageCache系统统一管理

  /**
   * 分类LRU淘汰
   */
  private evictCategory(category: string, count: number): void {
    const categoryCache = this.memoryCache.get(category)
    const categoryStats = this.categoryStats.get(category)
    if (!categoryCache || !categoryStats) return

    // 按优先级和访问时间排序
    const entries = Array.from(categoryCache.entries())
      .map(([key, entry]) => ({
        key,
        entry,
        accessOrder: categoryStats.accessOrder.get(key) || 0
      }))
      .sort((a, b) => {
        // 先按优先级
        const priorityOrder = { high: 3, normal: 2, low: 1 }
        const priorityDiff = priorityOrder[a.entry.priority as keyof typeof priorityOrder] - 
                            priorityOrder[b.entry.priority as keyof typeof priorityOrder]
        if (priorityDiff !== 0) return priorityDiff
        
        // 再按访问时间
        return a.accessOrder - b.accessOrder
      })
    
    let removedCount = 0
    let removedSize = 0
    
    for (const { key, entry } of entries) {
      if (removedCount >= count) break

      this.removeFromMemory(key, category)
      removedCount++
      removedSize += entry.size
    }
  }

  /**
   * 从内存移除数据
   */
  private removeFromMemory(key: string, category: string): void {
    const categoryCache = this.memoryCache.get(category)
    const categoryStats = this.categoryStats.get(category)
    if (!categoryCache || !categoryStats) return
    
    const entry = categoryCache.get(key)
    if (entry) {
      categoryCache.delete(key)
      categoryStats.size -= entry.size
      categoryStats.accessOrder.delete(key)
      this.globalStats.totalSize -= entry.size
    }
  }

  /**
   * 更新访问顺序
   */
  private updateAccessOrder(key: string, category: string): void {
    const categoryStats = this.categoryStats.get(category)
    if (categoryStats) {
      categoryStats.accessOrder.set(key, ++this.accessCounter)
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(category: string, type: 'hit' | 'miss'): void {
    const categoryStats = this.categoryStats.get(category)
    if (categoryStats) {
      if (type === 'hit') {
        categoryStats.hits++
        this.globalStats.totalHits++
      } else {
        categoryStats.misses++
        this.globalStats.totalMisses++
      }
    }
  }

  /**
   * 获取分类统计信息
   */
  getCategoryStats(): CategoryStats[] {
    return Array.from(this.categoryStats.entries()).map(([name, stats]) => {
      const config = MEMORY_CONFIG[name as keyof typeof MEMORY_CONFIG]
      const total = stats.hits + stats.misses
      
      return {
        name,
        count: this.memoryCache.get(name)?.size || 0,
        size: stats.size,
        maxSize: config?.maxSize || 0,
        hitRate: total > 0 ? (stats.hits / total) : 0,
        lastAccess: Math.max(...(stats.accessOrder.values() || [0]))
      }
    })
  }

  /**
   * 从localStorage迁移数据
   */
  private async migrateFromLocalStorage(): Promise<void> {
    if (this.globalStats.migrationCompleted) return

    try {
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith('cached_img_') ||
        key.startsWith('template_') ||
        key.startsWith('video_')
      )

      let migratedCount = 0
      let totalSize = 0
      
      for (const key of keys) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const parsed = JSON.parse(data)
            
            // 根据key判断分类
            const category = key.startsWith('cached_img_') ? 'image' : 
                            key.startsWith('template_') ? 'template' : 'video'
            
            // 验证数据有效性
            const dataToMigrate = parsed.base64 || parsed.data
            if (dataToMigrate === undefined || dataToMigrate === null) {
              localStorage.removeItem(key) // 清理无效数据
              continue
            }
            
            // 迁移到新缓存系统
            const success = await this.set(key, dataToMigrate, {
              category: category as any,
              ttl: parsed.ttl || MEMORY_CONFIG[category as keyof typeof MEMORY_CONFIG]?.defaultTTL
            })
            
            if (success) {
              migratedCount++
              totalSize += data.length
              localStorage.removeItem(key) // 清理旧数据
            }
          }
        } catch (error) {
          // Migration failed for this key
        }
      }

      this.globalStats.migrationCompleted = true

    } catch (error) {
      // Migration failed
    }
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    // 每5分钟清理过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache()
    }, 5 * 60 * 1000)
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    this.memoryCache.forEach((categoryCache, category) => {
      const keysToRemove: string[] = []

      categoryCache.forEach((entry, key) => {
        if (this.isExpired(entry)) {
          keysToRemove.push(key)
        }
      })

      keysToRemove.forEach(key => {
        this.removeFromMemory(key, category)
      })
    })
  }

  /**
   * 检查是否过期
   */
  private isExpired(entry: CacheEntry | any): boolean {
    if (entry.ttl === 0) return false
    return Date.now() > entry.timestamp + entry.ttl
  }

  /**
   * 获取剩余TTL
   */
  private getRemainingTTL(entry: any): number {
    if (entry.ttl === 0) return 0
    const remaining = (entry.timestamp + entry.ttl - Date.now()) / 1000
    return Math.max(remaining, 0)
  }

  /**
   * 根据key推断分类
   */
  private getCategoryFromKey(key: string): string {
    if (key.includes('img') || key.includes('thumb')) return 'image'
    if (key.includes('template')) return 'template'
    if (key.includes('video')) return 'video'
    return 'user'
  }

  /**
   * 估算数据大小
   */
  private estimateSize(data: any): number {
    try {
      // 处理 undefined、null 和其他边界情况
      if (data === undefined || data === null) {
        return 0
      }
      
      if (typeof data === 'string') {
        return data.length * 2 // Unicode字符估算
      }
      
      if (typeof data === 'number' || typeof data === 'boolean') {
        return 8 // 基本类型估算
      }
      
      // 尝试序列化对象
      const serialized = JSON.stringify(data)
      if (serialized === undefined) {
        return 0
      }

      return serialized.length * 2
    } catch (error) {
      return 0 // 出错时返回0，避免阻塞缓存操作
    }
  }

  /**
   * 获取存储使用情况
   */
  private async getStorageUsage(): Promise<any> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        return await navigator.storage.estimate()
      }
      return { quota: 0, usage: 0 }
    } catch {
      return { quota: 0, usage: 0 }
    }
  }

  /**
   * 获取总最大内存限制
   */
  private getTotalMaxSize(): string {
    const total = Object.values(MEMORY_CONFIG).reduce((sum, config) => sum + config.maxSize, 0)
    return `${(total / 1024 / 1024).toFixed(2)}MB`
  }

  /**
   * 获取全局统计
   */
  getGlobalStats() {
    const categories = this.getCategoryStats()
    const totalItems = categories.reduce((sum, cat) => sum + cat.count, 0)
    const totalSize = categories.reduce((sum, cat) => sum + cat.size, 0)
    const averageHitRate = categories.length > 0 ? 
      categories.reduce((sum, cat) => sum + cat.hitRate, 0) / categories.length : 0

    return {
      categories,
      summary: {
        totalItems,
        totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
        totalMaxSize: this.getTotalMaxSize(),
        averageHitRate: `${(averageHitRate * 100).toFixed(1)}%`,
        migrationCompleted: this.globalStats.migrationCompleted,
        idbReady: this.idbReady
      }
    }
  }

  /**
   * 清理所有缓存
   */
  async clearAll(): Promise<void> {
    // 清理内存缓存
    this.memoryCache.forEach(cache => cache.clear())
    this.categoryStats.forEach(stats => {
      stats.size = 0
      stats.accessOrder.clear()
      stats.hits = 0
      stats.misses = 0
    })
    this.globalStats.totalSize = 0
    
    // 清理IndexedDB
    if (this.idbReady) {
      // Note: enhancedIDB doesn't have a clear() method, would need to delete individual items
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.clearAll()
  }
}

// 创建全局实例
export const unifiedCache = new UnifiedCacheService()

export default unifiedCache