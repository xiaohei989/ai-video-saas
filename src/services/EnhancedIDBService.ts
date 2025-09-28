/**
 * 增强版IndexedDB缓存服务
 * 
 * 专为统一缓存系统设计的IndexedDB存储层
 * 支持分类存储、批量操作、自动清理等高级功能
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

export interface EnhancedCacheDBSchema extends DBSchema {
  // 图片缓存表
  images: {
    key: string
    value: {
      key: string
      data: string // Base64 compressed image
      timestamp: number
      ttl: number
      size: number
      originalUrl: string
      compressed: boolean
      quality: number
      dimensions: string
      category: 'image'
    }
    indexes: {
      'by-timestamp': number
      'by-category': string
      'by-size': number
    }
  }
  
  // 模板数据表
  templates: {
    key: string
    value: {
      key: string
      data: any
      timestamp: number
      ttl: number
      size: number
      category: 'template'
      templateId?: string
    }
    indexes: {
      'by-timestamp': number
      'by-template-id': string
    }
  }
  
  // 视频内容表
  videos: {
    key: string
    value: {
      key: string
      data: any
      timestamp: number
      ttl: number
      size: number
      category: 'video'
      videoId?: string
      contentType: 'metadata' | 'thumbnail' | 'preview'
    }
    indexes: {
      'by-timestamp': number
      'by-video-id': string
      'by-content-type': string
    }
  }
  
  // 用户数据表
  userdata: {
    key: string
    value: {
      key: string
      data: any
      timestamp: number
      ttl: number
      size: number
      category: 'user'
      userId?: string
    }
    indexes: {
      'by-timestamp': number
      'by-user-id': string
    }
  }
  
  // 系统元数据表
  metadata: {
    key: string
    value: {
      key: string
      totalSize: number
      totalItems: number
      lastCleanup: number
      categoryStats: Record<string, {
        items: number
        size: number
        lastAccess: number
      }>
      version: number
    }
  }
}

export interface CacheEntry<T = any> {
  key: string
  data: T
  timestamp: number
  ttl: number
  size: number
  category: string
  [key: string]: any
}

export interface CategoryConfig {
  storeName: keyof EnhancedCacheDBSchema
  maxSize: number
  maxItems: number
  cleanupThreshold: number
}

// 分类配置
const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  image: {
    storeName: 'images',
    maxSize: 80 * 1024 * 1024, // 80MB
    maxItems: 500,
    cleanupThreshold: 0.8
  },
  template: {
    storeName: 'templates',
    maxSize: 20 * 1024 * 1024, // 20MB
    maxItems: 1000,
    cleanupThreshold: 0.7
  },
  video: {
    storeName: 'videos',
    maxSize: 50 * 1024 * 1024, // 50MB
    maxItems: 200,
    cleanupThreshold: 0.8
  },
  user: {
    storeName: 'userdata',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxItems: 500,
    cleanupThreshold: 0.6
  }
}

class EnhancedIDBService {
  private db: IDBPDatabase<EnhancedCacheDBSchema> | null = null
  private dbName = 'ai-video-unified-cache'
  private version = 2 // 升级版本以支持新结构
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  
  // 统计信息
  private stats = {
    reads: 0,
    writes: 0,
    deletes: 0,
    hits: 0,
    misses: 0,
    errors: 0
    // compressionSaved 统计已移除
  }
  
  // 清理任务
  private cleanupInterval: NodeJS.Timeout | null = null

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.initializeDB()
    await this.initPromise
  }

  private async initializeDB(): Promise<void> {
    try {
      this.db = await openDB<EnhancedCacheDBSchema>(this.dbName, this.version, {
        upgrade(db, oldVersion, newVersion, transaction) {
          console.log(`[EnhancedIDB] 数据库升级: ${oldVersion} → ${newVersion}`)
          
          // 创建图片存储
          if (!db.objectStoreNames.contains('images')) {
            const imageStore = db.createObjectStore('images', { keyPath: 'key' })
            imageStore.createIndex('by-timestamp', 'timestamp')
            imageStore.createIndex('by-category', 'category')
            imageStore.createIndex('by-size', 'size')
          }
          
          // 创建模板存储
          if (!db.objectStoreNames.contains('templates')) {
            const templateStore = db.createObjectStore('templates', { keyPath: 'key' })
            templateStore.createIndex('by-timestamp', 'timestamp')
            templateStore.createIndex('by-template-id', 'templateId')
          }
          
          // 创建视频存储
          if (!db.objectStoreNames.contains('videos')) {
            const videoStore = db.createObjectStore('videos', { keyPath: 'key' })
            videoStore.createIndex('by-timestamp', 'timestamp')
            videoStore.createIndex('by-video-id', 'videoId')
            videoStore.createIndex('by-content-type', 'contentType')
          }
          
          // 创建用户数据存储
          if (!db.objectStoreNames.contains('userdata')) {
            const userStore = db.createObjectStore('userdata', { keyPath: 'key' })
            userStore.createIndex('by-timestamp', 'timestamp')
            userStore.createIndex('by-user-id', 'userId')
          }
          
          // 创建元数据存储
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' })
          }
        },
        blocked() {
          console.warn('[EnhancedIDB] 数据库升级被阻塞')
        },
        blocking() {
          console.warn('[EnhancedIDB] 阻塞了其他连接')
        },
        terminated() {
          console.error('[EnhancedIDB] 数据库连接异常终止')
        }
      })

      this.isInitialized = true
      console.log('[EnhancedIDB] ✅ 数据库初始化成功')
      
      // 启动定期清理
      this.startCleanupTasks()
      
      // 初始化元数据
      await this.initializeMetadata()
      
      // 显示存储使用情况
      const usage = await this.getStorageUsage()
      console.log('[EnhancedIDB] 📊 存储使用情况:', usage)
      
    } catch (error) {
      console.error('[EnhancedIDB] ❌ 初始化失败:', error)
      this.isInitialized = false
      throw error
    }
  }

  /**
   * 获取缓存数据 - 统一接口
   */
  async get<T = any>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return null

    this.stats.reads++

    try {
      // 根据key判断存储表
      const category = this.getCategoryFromKey(key)
      const config = CATEGORY_CONFIG[category]
      if (!config) return null

      const entry = await this.db.get(config.storeName as any, key)
      
      if (!entry) {
        this.stats.misses++
        return null
      }

      // 检查是否过期
      if (this.isExpired(entry)) {
        await this.delete(key)
        this.stats.misses++
        return null
      }

      this.stats.hits++
      return entry as CacheEntry<T>
    } catch (error) {
      this.stats.errors++
      console.error('[EnhancedIDB] 获取缓存失败:', error)
      return null
    }
  }

  /**
   * 设置缓存数据 - 统一接口
   */
  async set<T = any>(key: string, data: T, options: { ttl?: number } = {}): Promise<boolean> {
    const ttl = options.ttl || 3600
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return false

    this.stats.writes++

    try {
      const category = this.getCategoryFromKey(key)
      const config = CATEGORY_CONFIG[category]
      if (!config) return false

      const size = this.estimateSize(data)
      const entry: any = {
        key,
        data,
        timestamp: Date.now(),
        ttl: ttl * 1000, // 转换为毫秒
        size,
        category
      }

      // 分类特殊字段
      if (category === 'image') {
        entry.originalUrl = typeof data === 'string' && data.startsWith('http') ? data : ''
        entry.compressed = typeof data === 'string' && data.startsWith('data:')
        entry.quality = entry.compressed ? this.guessQuality(data as string) : 0
        entry.dimensions = entry.compressed ? this.getDimensions(data as string) : ''
      } else if (category === 'template') {
        entry.templateId = this.extractTemplateId(key)
      } else if (category === 'video') {
        entry.videoId = this.extractVideoId(key)
        entry.contentType = this.getVideoContentType(key)
      } else if (category === 'user') {
        entry.userId = this.extractUserId(key)
      }

      // 检查存储限制
      await this.checkStorageLimit(category, size)

      // 存储数据
      await this.db.put(config.storeName as any, entry)
      
      // 更新元数据
      await this.updateMetadata(category, size, 1)

      console.log(`[EnhancedIDB] ✅ 缓存写入成功 [${category}]:`, {
        key: key.substring(0, 50) + '...',
        size: `${(size / 1024).toFixed(2)}KB`
      })

      return true
    } catch (error) {
      this.stats.errors++
      console.error('[EnhancedIDB] 缓存写入失败:', error)
      return false
    }
  }

  /**
   * 批量获取缓存
   */
  async getBatchCache<T = any>(keys: string[]): Promise<Map<string, CacheEntry<T>>> {
    const results = new Map<string, CacheEntry<T>>()
    
    // 按分类分组
    const categorizedKeys = this.groupKeysByCategory(keys)
    
    for (const [category, categoryKeys] of categorizedKeys.entries()) {
      const config = CATEGORY_CONFIG[category]
      if (!config || !this.db) continue
      
      try {
        const tx = this.db.transaction(config.storeName, 'readonly')
        const store = tx.objectStore(config.storeName)
        
        const promises = categoryKeys.map(async (key) => {
          const entry = await store.get(key)
          if (entry && !this.isExpired(entry)) {
            results.set(key, entry as CacheEntry<T>)
          }
        })
        
        await Promise.all(promises)
        await tx.done
      } catch (error) {
        console.error(`[EnhancedIDB] 批量获取失败 [${category}]:`, error)
      }
    }
    
    return results
  }

  /**
   * 批量设置缓存
   */
  async setBatchCache<T = any>(entries: Array<{
    key: string
    data: T
    ttl?: number
  }>): Promise<boolean[]> {
    const results: boolean[] = []
    
    // 按分类分组
    const categorized = new Map<string, typeof entries>()
    entries.forEach(entry => {
      const category = this.getCategoryFromKey(entry.key)
      if (!categorized.has(category)) {
        categorized.set(category, [])
      }
      categorized.get(category)!.push(entry)
    })
    
    // 分类批量写入
    for (const [category, categoryEntries] of categorized.entries()) {
      const config = CATEGORY_CONFIG[category]
      if (!config || !this.db) {
        results.push(...categoryEntries.map(() => false))
        continue
      }
      
      try {
        const tx = this.db.transaction(config.storeName, 'readwrite')
        const store = tx.objectStore(config.storeName)
        
        const categoryResults = await Promise.allSettled(
          categoryEntries.map(async (entry) => {
            const size = this.estimateSize(entry.data)
            const cacheEntry: any = {
              key: entry.key,
              data: entry.data,
              timestamp: Date.now(),
              ttl: (entry.ttl || 3600) * 1000,
              size,
              category
            }
            
            await store.put(cacheEntry)
            return true
          })
        )
        
        await tx.done
        results.push(...categoryResults.map(r => r.status === 'fulfilled' && r.value))
        
      } catch (error) {
        console.error(`[EnhancedIDB] 批量设置失败 [${category}]:`, error)
        results.push(...categoryEntries.map(() => false))
      }
    }
    
    return results
  }

  /**
   * 删除缓存 - 统一接口
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isInitialized || !this.db) return false

    this.stats.deletes++

    try {
      const category = this.getCategoryFromKey(key)
      const config = CATEGORY_CONFIG[category]
      if (!config) return false

      // 获取条目大小用于统计
      const entry = await this.db.get(config.storeName as any, key)
      const size = entry?.size || 0

      await this.db.delete(config.storeName as any, key)
      
      // 更新元数据
      await this.updateMetadata(category, -size, -1)

      return true
    } catch (error) {
      this.stats.errors++
      console.error('[EnhancedIDB] 删除缓存失败:', error)
      return false
    }
  }

  /**
   * 按分类清理缓存
   */
  async cleanupCategory(category: string, ratio: number = 0.3): Promise<number> {
    if (!this.db) return 0

    const config = CATEGORY_CONFIG[category]
    if (!config) return 0

    try {
      const tx = this.db.transaction(config.storeName, 'readwrite')
      const store = tx.objectStore(config.storeName)
      const index = store.index('by-timestamp')
      
      // 获取所有条目按时间排序
      const entries = await index.getAll()
      const toDelete = Math.ceil(entries.length * ratio)
      
      if (toDelete === 0) return 0

      // 删除最旧的条目
      const deletePromises = entries
        .slice(0, toDelete)
        .map(entry => store.delete(entry.key))
      
      await Promise.all(deletePromises)
      await tx.done

      console.log(`[EnhancedIDB] 🧹 分类清理完成 [${category}]: 删除${toDelete}个条目`)
      return toDelete
    } catch (error) {
      console.error(`[EnhancedIDB] 分类清理失败 [${category}]:`, error)
      return 0
    }
  }

  /**
   * 获取分类统计
   */
  async getCategoryStats(): Promise<Record<string, any>> {
    if (!this.db) return {}

    const stats: Record<string, any> = {}

    for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
      try {
        const tx = this.db.transaction(config.storeName, 'readonly')
        const store = tx.objectStore(config.storeName)
        
        const allEntries = await store.getAll()
        const totalSize = allEntries.reduce((sum, entry) => sum + (entry.size || 0), 0)
        const now = Date.now()
        const expiredCount = allEntries.filter(entry => this.isExpired(entry)).length

        stats[category] = {
          items: allEntries.length,
          size: totalSize,
          maxSize: config.maxSize,
          usage: totalSize / config.maxSize,
          expired: expiredCount,
          lastAccess: allEntries.length > 0 ? 
            Math.max(...allEntries.map(e => e.timestamp)) : 0
        }

        await tx.done
      } catch (error) {
        console.error(`[EnhancedIDB] 获取统计失败 [${category}]:`, error)
        stats[category] = { error: error.message }
      }
    }

    return stats
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpired(): Promise<number> {
    if (!this.db) return 0

    let totalCleaned = 0

    for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
      try {
        const tx = this.db.transaction(config.storeName, 'readwrite')
        const store = tx.objectStore(config.storeName)
        
        const allEntries = await store.getAll()
        const expiredKeys = allEntries
          .filter(entry => this.isExpired(entry))
          .map(entry => entry.key)

        if (expiredKeys.length > 0) {
          await Promise.all(expiredKeys.map(key => store.delete(key)))
          totalCleaned += expiredKeys.length
        }

        await tx.done
      } catch (error) {
        console.error(`[EnhancedIDB] 清理过期缓存失败 [${category}]:`, error)
      }
    }

    if (totalCleaned > 0) {
      console.log(`[EnhancedIDB] 🧹 清理过期缓存: ${totalCleaned}个`)
    }

    return totalCleaned
  }

  /**
   * 清理所有缓存
   */
  async clearAll(): Promise<void> {
    if (!this.db) return

    try {
      const storeNames = Object.values(CATEGORY_CONFIG).map(c => c.storeName)
      const tx = this.db.transaction([...storeNames, 'metadata'], 'readwrite')
      
      await Promise.all([
        ...storeNames.map(name => tx.objectStore(name).clear()),
        tx.objectStore('metadata').clear()
      ])
      
      await tx.done
      console.log('[EnhancedIDB] 🧹 所有缓存已清理')
    } catch (error) {
      console.error('[EnhancedIDB] 清理所有缓存失败:', error)
    }
  }

  /**
   * 获取存储使用情况
   */
  async getStorageUsage(): Promise<any> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const categoryStats = await this.getCategoryStats()
        
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          available: (estimate.quota || 0) - (estimate.usage || 0),
          categories: categoryStats,
          globalStats: this.stats
        }
      }
      return { quota: 0, usage: 0, available: 0 }
    } catch (error) {
      console.error('[EnhancedIDB] 获取存储使用情况失败:', error)
      return { error: error.message }
    }
  }

  // ============ 私有方法 ============

  private async checkStorageLimit(category: string, newSize: number): Promise<void> {
    const config = CATEGORY_CONFIG[category]
    if (!config || !this.db) return

    const stats = await this.getCategoryStats()
    const categoryStats = stats[category]
    
    if (!categoryStats) return

    const projectedSize = categoryStats.size + newSize
    const projectedUsage = projectedSize / config.maxSize

    // 如果超过阈值，触发清理
    if (projectedUsage > config.cleanupThreshold) {
      console.log(`[EnhancedIDB] 📊 存储接近限制 [${category}]: ${(projectedUsage * 100).toFixed(1)}%`)
      await this.cleanupCategory(category, 0.3)
    }
  }

  private async initializeMetadata(): Promise<void> {
    if (!this.db) return

    try {
      const existing = await this.db.get('metadata', 'system')
      if (!existing) {
        await this.db.put('metadata', {
          key: 'system',
          totalSize: 0,
          totalItems: 0,
          lastCleanup: Date.now(),
          categoryStats: {},
          version: this.version
        })
      }
    } catch (error) {
      console.error('[EnhancedIDB] 初始化元数据失败:', error)
    }
  }

  private async updateMetadata(category: string, sizeChange: number, itemChange: number): Promise<void> {
    if (!this.db) return

    try {
      const metadata = await this.db.get('metadata', 'system')
      if (metadata) {
        metadata.totalSize += sizeChange
        metadata.totalItems += itemChange
        
        if (!metadata.categoryStats[category]) {
          metadata.categoryStats[category] = { items: 0, size: 0, lastAccess: 0 }
        }
        
        metadata.categoryStats[category].size += sizeChange
        metadata.categoryStats[category].items += itemChange
        metadata.categoryStats[category].lastAccess = Date.now()
        
        await this.db.put('metadata', metadata)
      }
    } catch (error) {
      console.error('[EnhancedIDB] 更新元数据失败:', error)
    }
  }

  private startCleanupTasks(): void {
    // 每10分钟清理过期缓存
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpired()
    }, 10 * 60 * 1000)
  }

  private getCategoryFromKey(key: string): string {
    if (key.includes('img') || key.includes('thumb') || key.includes('image')) return 'image'
    if (key.includes('template')) return 'template'
    if (key.includes('video')) return 'video'
    return 'user'
  }

  private groupKeysByCategory(keys: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    
    keys.forEach(key => {
      const category = this.getCategoryFromKey(key)
      if (!groups.has(category)) {
        groups.set(category, [])
      }
      groups.get(category)!.push(key)
    })
    
    return groups
  }

  private isExpired(entry: any): boolean {
    if (entry.ttl === 0) return false
    return Date.now() > entry.timestamp + entry.ttl
  }

  private estimateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2
    }
    return JSON.stringify(data).length * 2
  }

  private extractTemplateId(key: string): string {
    const match = key.match(/template[_-]([a-zA-Z0-9-]+)/)
    return match?.[1] || ''
  }

  private extractVideoId(key: string): string {
    const match = key.match(/video[_-]([a-zA-Z0-9-]+)/)
    return match?.[1] || ''
  }

  private extractUserId(key: string): string {
    const match = key.match(/user[_-]([a-zA-Z0-9-]+)/)
    return match?.[1] || ''
  }

  private getVideoContentType(key: string): 'metadata' | 'thumbnail' | 'preview' {
    if (key.includes('thumb')) return 'thumbnail'
    if (key.includes('preview')) return 'preview'
    return 'metadata'
  }

  private guessQuality(base64: string): number {
    // 根据Base64长度估算质量
    const length = base64.length
    if (length < 50000) return 0.3
    if (length < 100000) return 0.5
    if (length < 200000) return 0.7
    return 0.9
  }

  private getDimensions(base64: string): string {
    // 简单估算，实际应该解析图片
    return 'unknown'
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.db?.close()
    this.db = null
    this.isInitialized = false
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats }
  }
}

// 创建全局实例
export const enhancedIDB = new EnhancedIDBService()

export default enhancedIDB