/**
 * 简化的视频缩略图生成服务
 * 实现：LRU内存缓存 + IndexedDB持久化 + 客户端视频帧提取
 * 目标：组件初始化时有缓存直接显示，无缓存生成并立即更新显示
 */

import { openDB, IDBPDatabase } from 'idb'
import { createMobileLRUCache, type LRUCache } from '@/utils/LRUCache'
import { log } from '@/utils/logger'

interface ThumbnailCacheItem {
  videoUrl: string
  thumbnail: string // base64 JPEG
  generatedAt: number
  quality: 'real-frame'
}

class ThumbnailGeneratorService {
  // LRU内存缓存 - 智能内存管理
  private memoryCache: LRUCache<string>
  
  // IndexedDB 配置
  private db: IDBPDatabase | null = null
  private readonly DB_NAME = 'video-thumbnails-simple'
  private readonly DB_VERSION = 1
  private readonly STORE_NAME = 'thumbnails'
  private readonly CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30天
  
  // 并发控制
  private generatingThumbnails = new Set<string>()

  constructor() {
    // 初始化LRU缓存
    this.memoryCache = createMobileLRUCache<string>({
      onEvict: (key, thumbnail) => {
        log.debug('缩略图从内存缓存中驱逐', { key, size: thumbnail.length })
      }
    })

    // 初始化数据库
    this.initDB()
  }
  
  /**
   * 初始化 IndexedDB
   */
  private async initDB(): Promise<void> {
    if (this.db) return
    
    try {
      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('thumbnails')) {
            const store = db.createObjectStore('thumbnails', { keyPath: 'videoUrl' })
            store.createIndex('generatedAt', 'generatedAt')
          }
        }
      })
      // IndexedDB 初始化完成
    } catch (error) {
      console.error('[ThumbnailGenerator] IndexedDB 初始化失败:', error)
    }
  }
  
  /**
   * 从内存缓存获取缩略图（同步）
   */
  getFromMemoryCache(videoUrl: string): string | null {
    return this.memoryCache.get(videoUrl) || null
  }
  
  /**
   * 保存到内存缓存
   */
  private saveToMemoryCache(videoUrl: string, thumbnail: string): void {
    // LRU缓存会自动管理内存和数量限制
    this.memoryCache.set(videoUrl, thumbnail, thumbnail.length)
  }
  
  /**
   * 从 IndexedDB 获取缓存（异步）
   */
  private async getFromIndexedDB(videoUrl: string): Promise<string | null> {
    await this.initDB()
    if (!this.db) return null
    
    try {
      const item = await this.db.get(this.STORE_NAME, videoUrl) as ThumbnailCacheItem
      if (!item) return null
      
      // 检查过期
      const age = Date.now() - item.generatedAt
      if (age > this.CACHE_EXPIRY) {
        await this.db.delete(this.STORE_NAME, videoUrl)
        return null
      }
      
      return item.thumbnail
    } catch (error) {
      console.error('[ThumbnailGenerator] IndexedDB 读取失败:', error)
      return null
    }
  }
  
  /**
   * 保存到 IndexedDB
   */
  private async saveToIndexedDB(videoUrl: string, thumbnail: string): Promise<void> {
    await this.initDB()
    if (!this.db) return
    
    try {
      const item: ThumbnailCacheItem = {
        videoUrl,
        thumbnail,
        generatedAt: Date.now(),
        quality: 'real-frame'
      }
      await this.db.put(this.STORE_NAME, item)
    } catch (error) {
      console.error('[ThumbnailGenerator] IndexedDB 保存失败:', error)
    }
  }
  
  /**
   * 客户端视频帧提取 - 带有回退机制
   */
  private async extractVideoThumbnail(videoUrl: string): Promise<string> {
    // 回退机制：先尝试直接CDN，失败后尝试代理
    const tryLoadVideo = (url: string, isRetry: boolean = false): Promise<string> => {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.preload = 'metadata'
        
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Canvas context not supported'))
          return
        }
        
        // 设置超时机制 - 根据URL类型和重试状态调整超时时间
        let timeout = 10000 // 默认10秒
        if (url.includes('filesystem.site')) {
          // filesystem.site服务器较慢，需要更长超时时间
          timeout = isRetry ? 25000 : 20000
        } else if (url.includes('/api/r2/')) {
          // R2代理路径，第一次尝试10秒，重试时15秒
          timeout = isRetry ? 15000 : 10000
        } else if (url.includes('cdn.veo3video.me')) {
          // 直接CDN访问，较快
          timeout = isRetry ? 12000 : 8000
        }
        const timeoutId = setTimeout(() => {
          video.remove()
          canvas.remove()
          reject(new Error(`Video loading timeout: ${url} (retry: ${isRetry})`))
        }, timeout)
      
        video.onloadedmetadata = () => {
          // 设置画布尺寸
          canvas.width = 640
          canvas.height = 360
          
          // 跳转到第1秒位置
          video.currentTime = Math.min(1.0, video.duration - 0.1)
        }
        
        video.onseeked = () => {
          try {
            // 绘制视频帧到画布
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            
            // 转换为 base64 JPEG
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
            
            // 清理
            clearTimeout(timeoutId)
            video.remove()
            canvas.remove()
            
            resolve(thumbnail)
          } catch (error) {
            clearTimeout(timeoutId)
            video.remove()
            canvas.remove()
            reject(error)
          }
        }
        
        video.onerror = (event) => {
          clearTimeout(timeoutId)
          video.remove()
          canvas.remove()
          
          const error = new Error(`Video loading failed: ${url} (retry: ${isRetry})`)
          // 添加更多错误信息
          if (video.error) {
            error.message += ` (code: ${video.error.code}, media: ${video.error.message || 'unknown'})`
          }
          log.warn('视频加载失败，可能是CORS或网络问题', { 
            url,
            isRetry,
            error: video.error,
            networkState: video.networkState,
            readyState: video.readyState 
          })
          reject(error)
        }
        
        // 加载视频
        video.src = url
        video.load()
      })
    }
    
    // 处理R2存储URL - 如果是代理路径，先尝试直接CDN
    if (videoUrl.includes('/api/r2/videos/')) {
      const directUrl = videoUrl.replace('/api/r2/videos/', 'https://cdn.veo3video.me/videos/')
      try {
        // 首先尝试直接CDN加载
        return await tryLoadVideo(directUrl, false)
      } catch (error) {
        // 如果直接CDN失败，回退到代理路径
        log.warn('直接CDN加载失败，尝试代理路径', { directUrl, proxyUrl: videoUrl })
        return await tryLoadVideo(videoUrl, true)
      }
    } else {
      // 非R2存储URL，直接尝试加载
      return await tryLoadVideo(videoUrl, false)
    }
  }
  
  /**
   * 核心方法：确保缩略图已缓存，返回缩略图供立即显示
   */
  async ensureThumbnailCached(videoUrl: string, videoId?: string): Promise<string | null> {
    try {
      // 0. 参数验证 - 避免无效调用
      if (!videoUrl || !videoUrl.trim()) {
        console.warn(`[ThumbnailGenerator] ❌ 无效的videoUrl: ${videoUrl}`)
        return null
      }
      
      if (!videoId || typeof videoId !== 'string' || !videoId.trim()) {
        // 在开发环境下使用debug级别，生产环境保持warn
        if (process.env.NODE_ENV === 'development' && !videoId) {
          console.debug(`[ThumbnailGenerator] ⚠️ 跳过无效的videoId（可能是组件初始化中）: ${videoId}`)
        } else {
          console.warn(`[ThumbnailGenerator] ❌ 无效的videoId: ${videoId}`)
        }
        return null
      }
      
      // 1. 检查内存缓存
      const memoryCached = this.getFromMemoryCache(videoUrl)
      if (memoryCached) {
        return memoryCached
      }
      
      // 2. 检查 IndexedDB
      const dbCached = await this.getFromIndexedDB(videoUrl)
      if (dbCached) {
        // 加载到内存缓存
        this.saveToMemoryCache(videoUrl, dbCached)
        return dbCached
      }
      
      // 3. 避免重复生成
      if (this.generatingThumbnails.has(videoUrl)) {
        // 正在生成中，等待完成
        return null
      }
      
      // 4. 生成新缩略图
      // 开始生成缩略图
      this.generatingThumbnails.add(videoUrl)
      
      try {
        const thumbnail = await this.extractVideoThumbnail(videoUrl)
        
        // 5. 保存到缓存
        this.saveToMemoryCache(videoUrl, thumbnail)
        await this.saveToIndexedDB(videoUrl, thumbnail)
        
        // 缩略图生成完成
        return thumbnail
        
      } finally {
        this.generatingThumbnails.delete(videoUrl)
      }
      
    } catch (error) {
      console.error(`[ThumbnailGenerator] ❌ 缩略图生成失败: ${videoId}`, error)
      this.generatingThumbnails.delete(videoUrl)
      return null
    }
  }
  
  /**
   * 检查是否为 SVG 占位符
   */
  isSVGPlaceholder(thumbnailUrl: string): boolean {
    return thumbnailUrl?.startsWith('data:image/svg+xml') || false
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats() {
    const lruStats = this.memoryCache.getStats()
    return {
      memoryCache: lruStats.size,
      maxMemoryCache: lruStats.capacity,
      memoryUsage: lruStats.memoryUsage,
      maxMemory: lruStats.maxMemory,
      hitRate: lruStats.hitRate,
      generatingCount: this.generatingThumbnails.size,
      cacheStats: lruStats
    }
  }
  
  /**
   * 清理缓存
   */
  clearCache(): void {
    this.memoryCache.clear()
    this.generatingThumbnails.clear()
    // 缓存已清理
  }
}

// 导出单例实例
export const thumbnailGenerator = new ThumbnailGeneratorService()
export default thumbnailGenerator