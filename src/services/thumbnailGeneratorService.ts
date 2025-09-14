/**
 * 简化的视频缩略图生成服务
 * 实现：内存缓存 + IndexedDB持久化 + 客户端视频帧提取
 * 目标：组件初始化时有缓存直接显示，无缓存生成并立即更新显示
 */

import { openDB, IDBPDatabase } from 'idb'

interface ThumbnailCacheItem {
  videoUrl: string
  thumbnail: string // base64 JPEG
  generatedAt: number
  quality: 'real-frame'
}

class ThumbnailGeneratorService {
  // 内存缓存 - 快速访问
  private memoryCache = new Map<string, string>()
  private readonly MAX_MEMORY_CACHE = 50
  
  // IndexedDB 配置
  private db: IDBPDatabase | null = null
  private readonly DB_NAME = 'video-thumbnails-simple'
  private readonly DB_VERSION = 1
  private readonly STORE_NAME = 'thumbnails'
  private readonly CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30天
  
  // 并发控制
  private generatingThumbnails = new Set<string>()
  
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
      console.log('[ThumbnailGenerator] IndexedDB 初始化成功')
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
    // LRU策略：如果超出限制，删除最旧的
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE) {
      const firstKey = this.memoryCache.keys().next().value
      if (firstKey) this.memoryCache.delete(firstKey)
    }
    this.memoryCache.set(videoUrl, thumbnail)
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
   * 客户端视频帧提取
   */
  private async extractVideoThumbnail(videoUrl: string): Promise<string> {
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
          video.remove()
          canvas.remove()
          
          resolve(thumbnail)
        } catch (error) {
          reject(error)
        }
      }
      
      video.onerror = () => {
        reject(new Error('Video loading failed'))
      }
      
      video.src = videoUrl
      video.load()
    })
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
        console.log(`[ThumbnailGenerator] ✅ 内存缓存命中: ${videoId}`)
        return memoryCached
      }
      
      // 2. 检查 IndexedDB
      const dbCached = await this.getFromIndexedDB(videoUrl)
      if (dbCached) {
        console.log(`[ThumbnailGenerator] ✅ IndexedDB缓存命中: ${videoId}`)
        // 加载到内存缓存
        this.saveToMemoryCache(videoUrl, dbCached)
        return dbCached
      }
      
      // 3. 避免重复生成
      if (this.generatingThumbnails.has(videoUrl)) {
        console.log(`[ThumbnailGenerator] ⏳ 正在生成中: ${videoId}`)
        return null
      }
      
      // 4. 生成新缩略图
      console.log(`[ThumbnailGenerator] 🔄 开始生成缩略图: ${videoId}`)
      this.generatingThumbnails.add(videoUrl)
      
      try {
        const thumbnail = await this.extractVideoThumbnail(videoUrl)
        
        // 5. 保存到缓存
        this.saveToMemoryCache(videoUrl, thumbnail)
        await this.saveToIndexedDB(videoUrl, thumbnail)
        
        console.log(`[ThumbnailGenerator] ✅ 缩略图生成完成: ${videoId}`)
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
    return {
      memoryCache: this.memoryCache.size,
      maxMemoryCache: this.MAX_MEMORY_CACHE,
      generatingCount: this.generatingThumbnails.size
    }
  }
  
  /**
   * 清理缓存
   */
  clearCache(): void {
    this.memoryCache.clear()
    this.generatingThumbnails.clear()
    console.log('[ThumbnailGenerator] 缓存已清理')
  }
}

// 导出单例实例
export const thumbnailGenerator = new ThumbnailGeneratorService()
export default thumbnailGenerator