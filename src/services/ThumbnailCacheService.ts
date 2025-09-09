/**
 * 缩略图缓存服务
 * 
 * 三层缓存策略：
 * 1. 内存缓存（LRU Cache）- 最快
 * 2. IndexedDB 持久化缓存 - 中等速度
 * 3. 实时提取 - 最慢，但保证可用性
 */

import { openDB, IDBPDatabase } from 'idb'
import { extractVideoThumbnail } from '@/utils/videoThumbnail'
import { serverThumbnailService } from './serverThumbnailService'

interface ThumbnailCacheItem {
  url: string
  thumbnail: string
  timestamp: number
  quality: 'high' | 'medium' | 'low'
  size: number // 文件大小（字节）
}

interface MemoryCacheItem {
  thumbnail: string
  timestamp: number
  quality: 'high' | 'medium' | 'low'
  accessCount: number
  lastAccessed: number
}

class ThumbnailCacheService {
  private db: IDBPDatabase | null = null
  private memoryCache = new Map<string, MemoryCacheItem>()
  private readonly DB_NAME = 'video-thumbnails'
  private readonly DB_VERSION = 1
  private readonly STORE_NAME = 'thumbnails'
  private readonly CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30天
  private readonly MAX_MEMORY_CACHE_SIZE = 50 // 最大内存缓存数量
  private readonly MAX_DB_CACHE_SIZE = 500 // 最大数据库缓存数量
  private readonly ERROR_CACHE_EXPIRY = 5 * 60 * 1000 // 错误缓存5分钟
  
  // 正在处理的缩略图请求（避免重复请求）
  private pendingRequests = new Map<string, Promise<string>>()
  // 失败URL的短期缓存（避免重复尝试失败的URL）
  private errorCache = new Map<string, { timestamp: number; errorType: string }>()

  /**
   * 初始化数据库
   */
  private async initDB(): Promise<void> {
    if (this.db) return

    try {
      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('thumbnails')) {
            const store = db.createObjectStore('thumbnails', { keyPath: 'url' })
            store.createIndex('timestamp', 'timestamp')
            store.createIndex('quality', 'quality')
          }
        },
      })

      
      // 启动清理任务
      this.scheduleCleanup()
    } catch (error) {
      console.error('[ThumbnailCache] Failed to initialize IndexedDB:', error)
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(videoUrl: string, quality: 'high' | 'medium' | 'low' = 'medium'): string {
    // 使用简单的哈希算法
    const hash = this.simpleHash(videoUrl)
    return `${hash}_${quality}`
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 获取缩略图（核心方法）
   */
  async getThumbnail(
    videoUrl: string,
    options: {
      quality?: 'high' | 'medium' | 'low'
      frameTime?: number
      forceRefresh?: boolean
    } = {}
  ): Promise<string> {
    const { quality = 'medium', frameTime = 0.33, forceRefresh = false } = options
    const cacheKey = this.generateCacheKey(videoUrl, quality)

    // 检查错误缓存，避免重复尝试失败的URL
    if (!forceRefresh) {
      const errorInfo = this.errorCache.get(videoUrl)
      if (errorInfo && Date.now() - errorInfo.timestamp < this.ERROR_CACHE_EXPIRY) {
        console.log(`[ThumbnailCache] 跳过错误缓存的URL (${errorInfo.errorType}): ${videoUrl}`)
        return Promise.resolve(this.getDefaultThumbnailByErrorType(errorInfo.errorType))
      }
    }

    // 如果正在请求相同的缩略图，返回现有的Promise
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!
    }

    // 创建请求Promise
    const requestPromise = this.getThumbnailInternal(videoUrl, quality, frameTime, forceRefresh, cacheKey)
    
    // 存储Promise以避免重复请求
    this.pendingRequests.set(cacheKey, requestPromise)
    
    try {
      const result = await requestPromise
      return result
    } finally {
      // 清理已完成的请求
      this.pendingRequests.delete(cacheKey)
    }
  }

  /**
   * 内部获取缩略图方法
   */
  private async getThumbnailInternal(
    videoUrl: string,
    quality: 'high' | 'medium' | 'low',
    frameTime: number,
    forceRefresh: boolean,
    cacheKey: string
  ): Promise<string> {
    if (!forceRefresh) {
      // 1. 检查内存缓存
      const memoryResult = this.getFromMemoryCache(cacheKey)
      if (memoryResult) {
        return memoryResult
      }

      // 2. 检查 IndexedDB 缓存
      const dbResult = await this.getFromDBCache(cacheKey)
      if (dbResult) {
        // 将结果存入内存缓存
        this.setMemoryCache(cacheKey, dbResult, quality)
        return dbResult
      }
    }

    // 3. 实时生成缩略图
    const thumbnail = await this.generateThumbnail(videoUrl, frameTime, quality)

    // 存储到缓存中
    await this.setCaches(cacheKey, videoUrl, thumbnail, quality)

    return thumbnail
  }

  /**
   * 从内存缓存获取
   */
  private getFromMemoryCache(cacheKey: string): string | null {
    const item = this.memoryCache.get(cacheKey)
    if (!item) return null

    // 检查是否过期
    if (Date.now() - item.timestamp > this.CACHE_EXPIRY) {
      this.memoryCache.delete(cacheKey)
      return null
    }

    // 更新访问统计
    item.accessCount++
    item.lastAccessed = Date.now()

    return item.thumbnail
  }

  /**
   * 从数据库缓存获取
   */
  private async getFromDBCache(cacheKey: string): Promise<string | null> {
    try {
      await this.initDB()
      if (!this.db) return null

      const item = await this.db.get(this.STORE_NAME, cacheKey)
      if (!item) return null

      // 检查是否过期
      if (Date.now() - item.timestamp > this.CACHE_EXPIRY) {
        await this.db.delete(this.STORE_NAME, cacheKey)
        return null
      }

      return item.thumbnail
    } catch (error) {
      console.error('[ThumbnailCache] Failed to get from DB cache:', error)
      return null
    }
  }

  /**
   * 生成缩略图
   */
  private async generateThumbnail(
    videoUrl: string,
    frameTime: number,
    quality: 'high' | 'medium' | 'low'
  ): Promise<string> {
    try {
      // 根据质量调整参数
      const qualitySettings = {
        high: { frameTime, jpegQuality: 0.9 },
        medium: { frameTime, jpegQuality: 0.8 },
        low: { frameTime, jpegQuality: 0.6 }
      }

      const settings = qualitySettings[quality]
      return await extractVideoThumbnail(videoUrl, settings.frameTime)
    } catch (error) {
      console.error('[ThumbnailCache] 客户端缩略图生成失败:', error)
      
      // 尝试使用服务端生成作为fallback
      try {
        console.log('[ThumbnailCache] 尝试服务端缩略图生成...')
        const serverThumbnail = await serverThumbnailService.generateThumbnail(videoUrl, { frameTime, quality })
        console.log('[ThumbnailCache] 服务端缩略图生成成功')
        return serverThumbnail
      } catch (serverError) {
        console.error('[ThumbnailCache] 服务端缩略图生成也失败:', serverError)
      }
      
      // 记录错误到错误缓存
      const errorType = this.categorizeError(error, videoUrl)
      this.errorCache.set(videoUrl, {
        timestamp: Date.now(),
        errorType
      })
      
      // 返回对应错误类型的默认图
      return this.getDefaultThumbnailByErrorType(errorType)
    }
  }

  /**
   * 设置内存缓存
   */
  private setMemoryCache(cacheKey: string, thumbnail: string, quality: 'high' | 'medium' | 'low'): void {
    // 如果缓存已满，删除最少使用的项
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      this.evictLRUFromMemory()
    }

    this.memoryCache.set(cacheKey, {
      thumbnail,
      timestamp: Date.now(),
      quality,
      accessCount: 1,
      lastAccessed: Date.now()
    })
  }

  /**
   * 设置所有缓存层
   */
  private async setCaches(cacheKey: string, _videoUrl: string, thumbnail: string, quality: 'high' | 'medium' | 'low'): Promise<void> {
    // 设置内存缓存
    this.setMemoryCache(cacheKey, thumbnail, quality)

    // 设置数据库缓存
    try {
      await this.initDB()
      if (this.db) {
        const cacheItem: ThumbnailCacheItem = {
          url: cacheKey,
          thumbnail,
          timestamp: Date.now(),
          quality,
          size: thumbnail.length
        }

        await this.db.put(this.STORE_NAME, cacheItem)
        
        // 检查数据库缓存大小
        await this.cleanupDBCache()
      }
    } catch (error) {
      console.error('[ThumbnailCache] Failed to set DB cache:', error)
    }
  }

  /**
   * 从内存中驱逐最少使用的项
   */
  private evictLRUFromMemory(): void {
    let lruKey = ''
    let lruScore = Infinity

    for (const [key, item] of this.memoryCache.entries()) {
      // LRU 评分：结合访问次数和最后访问时间
      const score = item.accessCount * 0.3 + (Date.now() - item.lastAccessed) * 0.7
      if (score < lruScore) {
        lruScore = score
        lruKey = key
      }
    }

    if (lruKey) {
      this.memoryCache.delete(lruKey)
      console.log('[ThumbnailCache] Evicted from memory cache:', lruKey)
    }
  }

  /**
   * 清理数据库缓存
   */
  private async cleanupDBCache(): Promise<void> {
    try {
      if (!this.db) return

      const allItems = await this.db.getAll(this.STORE_NAME)
      
      if (allItems.length <= this.MAX_DB_CACHE_SIZE) return

      // 按时间戳排序，删除最旧的项
      const sortedItems = allItems.sort((a, b) => a.timestamp - b.timestamp)
      const itemsToDelete = sortedItems.slice(0, allItems.length - this.MAX_DB_CACHE_SIZE)

      for (const item of itemsToDelete) {
        await this.db.delete(this.STORE_NAME, item.url)
      }

      console.log(`[ThumbnailCache] Cleaned up ${itemsToDelete.length} old items from DB`)
    } catch (error) {
      console.error('[ThumbnailCache] Failed to cleanup DB cache:', error)
    }
  }

  /**
   * 定期清理任务
   */
  private scheduleCleanup(): void {
    // 每小时清理一次过期项
    setInterval(async () => {
      await this.cleanupExpiredItems()
    }, 60 * 60 * 1000)
  }

  /**
   * 清理过期项
   */
  private async cleanupExpiredItems(): Promise<void> {
    const now = Date.now()

    // 清理内存缓存中的过期项
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > this.CACHE_EXPIRY) {
        this.memoryCache.delete(key)
      }
    }

    // 清理错误缓存
    this.cleanupErrorCache()

    // 清理数据库中的过期项
    try {
      if (!this.db) return

      const allItems = await this.db.getAll(this.STORE_NAME)
      let deletedCount = 0

      for (const item of allItems) {
        if (now - item.timestamp > this.CACHE_EXPIRY) {
          await this.db.delete(this.STORE_NAME, item.url)
          deletedCount++
        }
      }

      if (deletedCount > 0) {
        console.log(`[ThumbnailCache] Cleaned up ${deletedCount} expired items`)
      }
    } catch (error) {
      console.error('[ThumbnailCache] Failed to cleanup expired items:', error)
    }
  }

  /**
   * 获取默认缩略图
   */
  private getDefaultThumbnail(): string {
    // 返回一个简单的SVG占位图的base64编码
    const svg = `
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="200" fill="#f0f0f0"/>
        <circle cx="150" cy="100" r="30" fill="#ccc"/>
        <polygon points="140,85 140,115 165,100" fill="white"/>
      </svg>
    `
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  /**
   * 预加载缩略图
   */
  async preloadThumbnails(videoUrls: string[], quality: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const promises = videoUrls.map(url => 
      this.getThumbnail(url, { quality }).catch(error => {
        console.error(`[ThumbnailCache] Failed to preload thumbnail for ${url}:`, error)
      })
    )

    await Promise.allSettled(promises)
    console.log(`[ThumbnailCache] Preloaded ${videoUrls.length} thumbnails`)
  }

  /**
   * 清空所有缓存
   */
  async clearAllCaches(): Promise<void> {
    // 清空内存缓存
    this.memoryCache.clear()

    // 清空数据库缓存
    try {
      await this.initDB()
      if (this.db) {
        await this.db.clear(this.STORE_NAME)
      }
    } catch (error) {
      console.error('[ThumbnailCache] Failed to clear DB cache:', error)
    }

    console.log('[ThumbnailCache] All caches cleared')
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    memoryCount: number
    dbCount: number
    totalSize: number
  }> {
    const memoryCount = this.memoryCache.size
    let dbCount = 0
    let totalSize = 0

    try {
      await this.initDB()
      if (this.db) {
        const allItems = await this.db.getAll(this.STORE_NAME)
        dbCount = allItems.length
        totalSize = allItems.reduce((sum, item) => sum + item.size, 0)
      }
    } catch (error) {
      console.error('[ThumbnailCache] Failed to get cache stats:', error)
    }

    return { memoryCount, dbCount, totalSize }
  }

  /**
   * 分类错误类型
   */
  private categorizeError(error: any, videoUrl: string): string {
    const errorMessage = error?.message || ''
    
    if (videoUrl.startsWith('/api/filesystem/') || videoUrl.startsWith('/api/heyoo/')) {
      return 'proxy-error'
    }
    
    if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
      return 'cors-error'
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
      return 'network-error'
    }
    
    if (errorMessage.includes('decode') || errorMessage.includes('format')) {
      return 'format-error'
    }
    
    return 'unknown-error'
  }

  /**
   * 根据错误类型返回对应的默认缩略图
   */
  private getDefaultThumbnailByErrorType(errorType: string): string {
    switch (errorType) {
      case 'proxy-error':
        return this.getProxyErrorThumbnail()
      case 'cors-error':
        return this.getCorsErrorThumbnail()
      case 'network-error':
        return this.getNetworkErrorThumbnail()
      case 'format-error':
        return this.getFormatErrorThumbnail()
      default:
        return this.getDefaultThumbnail()
    }
  }

  /**
   * 代理错误缩略图
   */
  private getProxyErrorThumbnail(): string {
    const svg = `
      <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="180" fill="#fef3f2"/>
        <circle cx="160" cy="90" r="30" fill="#f87171"/>
        <text x="160" y="90" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle" dy=".3em">!</text>
        <text x="160" y="130" font-family="Arial, sans-serif" font-size="11" fill="#dc2626" text-anchor="middle">代理服务器错误</text>
      </svg>
    `
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  /**
   * CORS错误缩略图
   */
  private getCorsErrorThumbnail(): string {
    const svg = `
      <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="180" fill="#fefce8"/>
        <circle cx="160" cy="90" r="30" fill="#eab308"/>
        <text x="160" y="90" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle" dy=".3em">⚠</text>
        <text x="160" y="130" font-family="Arial, sans-serif" font-size="11" fill="#ca8a04" text-anchor="middle">CORS访问限制</text>
      </svg>
    `
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  /**
   * 网络错误缩略图
   */
  private getNetworkErrorThumbnail(): string {
    const svg = `
      <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="180" fill="#f0f9ff"/>
        <circle cx="160" cy="90" r="30" fill="#3b82f6"/>
        <text x="160" y="90" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dy=".3em">📶</text>
        <text x="160" y="130" font-family="Arial, sans-serif" font-size="11" fill="#2563eb" text-anchor="middle">网络连接问题</text>
      </svg>
    `
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  /**
   * 格式错误缩略图
   */
  private getFormatErrorThumbnail(): string {
    const svg = `
      <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="180" fill="#f5f3ff"/>
        <circle cx="160" cy="90" r="30" fill="#8b5cf6"/>
        <text x="160" y="90" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" dy=".3em">📹</text>
        <text x="160" y="130" font-family="Arial, sans-serif" font-size="11" fill="#7c3aed" text-anchor="middle">格式不支持</text>
      </svg>
    `
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  /**
   * 清理错误缓存
   */
  private cleanupErrorCache(): void {
    const now = Date.now()
    for (const [url, errorInfo] of this.errorCache.entries()) {
      if (now - errorInfo.timestamp > this.ERROR_CACHE_EXPIRY) {
        this.errorCache.delete(url)
      }
    }
  }
}

// 创建单例实例
export const thumbnailCacheService = new ThumbnailCacheService()
export default thumbnailCacheService