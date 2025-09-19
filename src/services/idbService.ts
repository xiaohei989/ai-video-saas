/**
 * IndexedDB缓存服务
 * 
 * 提供本地持久化缓存能力
 * 作为多级缓存架构的L2层
 * 
 * 特性：
 * - 异步存储，不阻塞主线程
 * - 支持大容量存储（>50MB）
 * - 自动过期清理
 * - 批量操作支持
 * - 缓存统计
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface CacheDBSchema extends DBSchema {
  cache: {
    key: string
    value: {
      key: string
      data: any
      timestamp: number
      ttl: number
      size: number
    }
    indexes: {
      'by-timestamp': number
      'by-prefix': string
    }
  }
  metadata: {
    key: string
    value: {
      key: string
      totalSize: number
      itemCount: number
      lastCleanup: number
    }
  }
}

interface CacheEntry<T = any> {
  key: string
  data: T
  timestamp: number
  ttl: number
  size: number
}

class IDBCacheService {
  private db: IDBPDatabase<CacheDBSchema> | null = null
  private dbName = 'ai-video-saas-cache'
  private version = 1
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  
  // 配置
  private readonly MAX_STORAGE_SIZE = 100 * 1024 * 1024 // 100MB
  private readonly CLEANUP_THRESHOLD = 0.9 // 90%使用率时触发清理
  private readonly BATCH_SIZE = 50 // 批量操作大小
  
  // 统计
  private stats = {
    reads: 0,
    writes: 0,
    deletes: 0,
    hits: 0,
    misses: 0,
    errors: 0
  }

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
      this.db = await openDB<CacheDBSchema>(this.dbName, this.version, {
        upgrade(db) {
          // 创建缓存存储
          if (!db.objectStoreNames.contains('cache')) {
            const cacheStore = db.createObjectStore('cache', { keyPath: 'key' })
            cacheStore.createIndex('by-timestamp', 'timestamp')
            cacheStore.createIndex('by-prefix', 'key')
          }
          
          // 创建元数据存储
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' })
          }
        },
        blocked() {
          console.warn('[IDBCache] 数据库升级被阻塞')
        },
        blocking() {
          console.warn('[IDBCache] 阻塞了其他连接')
        },
        terminated() {
          console.error('[IDBCache] 数据库连接异常终止')
        }
      })

      this.isInitialized = true
      console.log('[IDBCache] IndexedDB初始化成功')
      
      // 启动清理任务
      this.scheduleCleanup()
      
      // 初始化元数据
      await this.initializeMetadata()
    } catch (error) {
      console.error('[IDBCache] 初始化失败:', error)
      this.isInitialized = false
      throw error
    }
  }

  /**
   * 获取缓存数据
   */
  async getCache<T = any>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return null

    this.stats.reads++

    try {
      const entry = await this.db.get('cache', key)
      
      if (!entry) {
        this.stats.misses++
        return null
      }

      // 检查是否过期
      if (this.isExpired(entry)) {
        await this.deleteCache(key)
        this.stats.misses++
        return null
      }

      this.stats.hits++
      return entry as CacheEntry<T>
    } catch (error) {
      this.stats.errors++
      console.error('[IDBCache] 读取失败:', error)
      return null
    }
  }

  /**
   * 设置缓存数据
   */
  async setCache<T = any>(
    key: string, 
    data: T, 
    ttl: number = 3600
  ): Promise<boolean> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return false

    this.stats.writes++

    try {
      const size = this.estimateSize(data)
      
      // 检查存储空间
      const canStore = await this.checkStorageSpace(size)
      if (!canStore) {
        console.warn('[IDBCache] 存储空间不足，尝试清理...')
        await this.cleanupCache(size)
      }

      const entry: CacheEntry = {
        key,
        data,
        timestamp: Date.now(),
        ttl: ttl * 1000, // 转换为毫秒
        size
      }

      await this.db.put('cache', entry)
      await this.updateMetadata(size, 'add')
      
      return true
    } catch (error) {
      this.stats.errors++
      console.error('[IDBCache] 写入失败:', error)
      return false
    }
  }

  /**
   * 批量获取缓存
   */
  async getBatch<T = any>(keys: string[]): Promise<Map<string, T>> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return new Map()

    const results = new Map<string, T>()
    const tx = this.db.transaction('cache', 'readonly')
    const store = tx.objectStore('cache')

    try {
      const promises = keys.map(async key => {
        const entry = await store.get(key)
        if (entry && !this.isExpired(entry)) {
          results.set(key, entry.data)
          this.stats.hits++
        } else {
          this.stats.misses++
        }
      })

      await Promise.all(promises)
      await tx.done
    } catch (error) {
      this.stats.errors++
      console.error('[IDBCache] 批量读取失败:', error)
    }

    return results
  }

  /**
   * 批量设置缓存
   */
  async setBatch(entries: Array<{ key: string; data: any; ttl?: number }>): Promise<boolean> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return false

    const tx = this.db.transaction('cache', 'readwrite')
    const store = tx.objectStore('cache')
    let totalSize = 0

    try {
      const promises = entries.map(async ({ key, data, ttl = 3600 }) => {
        const size = this.estimateSize(data)
        totalSize += size

        const entry: CacheEntry = {
          key,
          data,
          timestamp: Date.now(),
          ttl: ttl * 1000,
          size
        }

        await store.put(entry)
        this.stats.writes++
      })

      await Promise.all(promises)
      await tx.done
      
      await this.updateMetadata(totalSize, 'add')
      return true
    } catch (error) {
      this.stats.errors++
      console.error('[IDBCache] 批量写入失败:', error)
      await tx.abort()
      return false
    }
  }

  /**
   * 删除缓存
   */
  async deleteCache(key: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return false

    this.stats.deletes++

    try {
      const entry = await this.db.get('cache', key)
      if (entry) {
        await this.db.delete('cache', key)
        await this.updateMetadata(entry.size, 'remove')
      }
      return true
    } catch (error) {
      this.stats.errors++
      console.error('[IDBCache] 删除失败:', error)
      return false
    }
  }

  /**
   * 清除指定前缀的缓存
   */
  async clearCacheByPrefix(prefix: string): Promise<number> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return 0

    let deletedCount = 0
    let totalSize = 0

    try {
      const tx = this.db.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      const index = store.index('by-prefix')
      
      // 获取所有匹配前缀的键
      const range = IDBKeyRange.bound(prefix, prefix + '\uffff')
      const keys = await index.getAllKeys(range)
      
      // 批量删除
      for (const key of keys) {
        const entry = await store.get(key)
        if (entry) {
          totalSize += entry.size
          await store.delete(key)
          deletedCount++
        }
      }
      
      await tx.done
      await this.updateMetadata(totalSize, 'remove')
      
      console.log(`[IDBCache] 清除前缀 ${prefix} 的缓存 ${deletedCount} 个`)
    } catch (error) {
      console.error('[IDBCache] 清除前缀缓存失败:', error)
    }

    return deletedCount
  }

  /**
   * 清空所有缓存
   */
  async clearAll(): Promise<void> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return

    try {
      await this.db.clear('cache')
      await this.resetMetadata()
      console.log('[IDBCache] 已清空所有缓存')
    } catch (error) {
      console.error('[IDBCache] 清空缓存失败:', error)
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageInfo(): Promise<{
    usage: number
    quota: number
    percentage: number
    itemCount: number
  }> {
    try {
      // 使用 navigator.storage.estimate() 获取存储配额信息
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate()
        
        // 获取缓存项数量
        const metadata = await this.getMetadata()
        
        return {
          usage,
          quota,
          percentage: quota > 0 ? (usage / quota) * 100 : 0,
          itemCount: metadata?.itemCount || 0
        }
      }
    } catch (error) {
      console.error('[IDBCache] 获取存储信息失败:', error)
    }

    return {
      usage: 0,
      quota: 0,
      percentage: 0,
      itemCount: 0
    }
  }

  /**
   * 获取所有缓存键
   */
  async getAllCacheKeys(): Promise<string[]> {
    if (!this.isInitialized) await this.initialize()
    if (!this.db) return []

    try {
      const tx = this.db.transaction('cache', 'readonly')
      const store = tx.objectStore('cache')
      const keys = await store.getAllKeys()
      await tx.done
      
      return keys.filter(key => typeof key === 'string') as string[]
    } catch (error) {
      console.error('[IDBCache] 获取所有键失败:', error)
      return []
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const total = this.stats.reads + this.stats.writes
    const hitRate = this.stats.reads > 0 
      ? (this.stats.hits / this.stats.reads * 100).toFixed(2) + '%'
      : '0%'

    return {
      ...this.stats,
      total,
      hitRate
    }
  }

  // ============ 私有方法 ============

  /**
   * 检查是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    if (entry.ttl === 0) return false // 永不过期
    return Date.now() > entry.timestamp + entry.ttl
  }

  /**
   * 估算数据大小
   */
  private estimateSize(data: any): number {
    if (data === null || data === undefined) return 0
    
    const type = typeof data
    if (type === 'boolean') return 4
    if (type === 'number') return 8
    if (type === 'string') return data.length * 2
    
    if (data instanceof ArrayBuffer) return data.byteLength
    if (data instanceof Blob) return data.size
    
    try {
      return JSON.stringify(data).length * 2
    } catch {
      return 1024
    }
  }

  /**
   * 检查存储空间
   */
  private async checkStorageSpace(requiredSize: number): Promise<boolean> {
    const metadata = await this.getMetadata()
    if (!metadata) return true

    return metadata.totalSize + requiredSize < this.MAX_STORAGE_SIZE * this.CLEANUP_THRESHOLD
  }

  /**
   * 清理缓存（LRU策略）
   */
  private async cleanupCache(requiredSpace: number = 0): Promise<void> {
    if (!this.db) return

    try {
      const tx = this.db.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      const index = store.index('by-timestamp')
      
      let freedSpace = 0
      let deletedCount = 0
      
      // 按时间戳排序，删除最旧的
      for await (const cursor of index.iterate()) {
        if (freedSpace >= requiredSpace) break
        
        // 优先删除过期的
        if (this.isExpired(cursor.value) || freedSpace < requiredSpace) {
          freedSpace += cursor.value.size
          await cursor.delete()
          deletedCount++
        }
        
        // 限制单次清理数量
        if (deletedCount >= this.BATCH_SIZE) break
      }
      
      await tx.done
      await this.updateMetadata(freedSpace, 'remove')
      
      console.log(`[IDBCache] 清理了 ${deletedCount} 个缓存，释放 ${(freedSpace / 1024 / 1024).toFixed(2)}MB`)
    } catch (error) {
      console.error('[IDBCache] 清理失败:', error)
    }
  }

  /**
   * 定时清理任务
   */
  private scheduleCleanup(): void {
    // 每小时执行一次清理
    setInterval(async () => {
      await this.cleanupExpired()
    }, 60 * 60 * 1000)
  }

  /**
   * 清理过期缓存
   */
  private async cleanupExpired(): Promise<void> {
    if (!this.db) return

    try {
      const tx = this.db.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      
      let deletedCount = 0
      let totalSize = 0

      for await (const cursor of store.iterate()) {
        if (this.isExpired(cursor.value)) {
          totalSize += cursor.value.size
          await cursor.delete()
          deletedCount++
        }
      }

      await tx.done
      
      if (deletedCount > 0) {
        await this.updateMetadata(totalSize, 'remove')
        console.log(`[IDBCache] 清理了 ${deletedCount} 个过期缓存`)
      }
    } catch (error) {
      console.error('[IDBCache] 清理过期缓存失败:', error)
    }
  }

  /**
   * 初始化元数据
   */
  private async initializeMetadata(): Promise<void> {
    if (!this.db) return

    try {
      const existing = await this.db.get('metadata', 'stats')
      if (!existing) {
        await this.db.put('metadata', {
          key: 'stats',
          totalSize: 0,
          itemCount: 0,
          lastCleanup: Date.now()
        })
      }
    } catch (error) {
      console.error('[IDBCache] 初始化元数据失败:', error)
    }
  }

  /**
   * 获取元数据
   */
  private async getMetadata() {
    if (!this.db) return null
    
    try {
      return await this.db.get('metadata', 'stats')
    } catch {
      return null
    }
  }

  /**
   * 更新元数据
   */
  private async updateMetadata(sizeChange: number, operation: 'add' | 'remove'): Promise<void> {
    if (!this.db) return

    try {
      const metadata = await this.getMetadata()
      if (metadata) {
        if (operation === 'add') {
          metadata.totalSize += sizeChange
          metadata.itemCount++
        } else {
          metadata.totalSize = Math.max(0, metadata.totalSize - sizeChange)
          metadata.itemCount = Math.max(0, metadata.itemCount - 1)
        }
        
        await this.db.put('metadata', metadata)
      }
    } catch (error) {
      console.error('[IDBCache] 更新元数据失败:', error)
    }
  }

  /**
   * 重置元数据
   */
  private async resetMetadata(): Promise<void> {
    if (!this.db) return

    try {
      await this.db.put('metadata', {
        key: 'stats',
        totalSize: 0,
        itemCount: 0,
        lastCleanup: Date.now()
      })
    } catch (error) {
      console.error('[IDBCache] 重置元数据失败:', error)
    }
  }
}

// 导出单例
export const idb = new IDBCacheService()