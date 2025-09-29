/**
 * 简化的视频缓存服务
 *
 * 专为小于20MB的视频文件设计的完整文件缓存系统
 * 支持直接存储整个视频文件到IndexedDB，无需分片
 */

import { enhancedIDB } from './EnhancedIDBService'

export interface VideoCacheEntry {
  videoId: string
  url: string
  blob: Blob
  size: number
  timestamp: number
  lastAccessed: number
  quality?: string
  duration?: number
}

export interface VideoCacheStats {
  totalVideos: number
  totalSize: number
  hitRate: number
  cacheUsage: number
  availableSpace: number
}

export interface CacheSettings {
  enableVideoCache: boolean
  maxCacheSize: number // MB
  autoDownloadOnWifi: boolean
  cacheQuality: 'high' | 'medium' | 'low'
  maxVideosToCache: number
}

class SimpleVideoCacheService {
  private cacheKeyPrefix = 'video_full_'
  private metadataKeyPrefix = 'video_meta_'
  private stats = {
    hits: 0,
    misses: 0,
    downloads: 0,
    totalSize: 0
  }

  // 默认设置
  private defaultSettings: CacheSettings = {
    enableVideoCache: true,
    maxCacheSize: 500, // 500MB
    autoDownloadOnWifi: false,
    cacheQuality: 'high',
    maxVideosToCache: 100
  }

  constructor() {
    this.initializeSettings()
  }

  /**
   * 初始化设置
   */
  private async initializeSettings(): Promise<void> {
    try {
      const savedSettings = localStorage.getItem('video_cache_settings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings) as CacheSettings
        this.defaultSettings = { ...this.defaultSettings, ...settings }
      }
    } catch (error) {
      console.warn('[VideoCache] 加载设置失败:', error)
    }
  }

  /**
   * 缓存视频文件
   */
  async cacheVideo(videoId: string, videoUrl: string, options: {
    quality?: string
    duration?: number
    priority?: 'high' | 'normal' | 'low'
  } = {}): Promise<boolean> {
    if (!this.defaultSettings.enableVideoCache) {
      console.log('[VideoCache] 视频缓存已禁用')
      return false
    }

    try {
      console.log(`[VideoCache] 🚀 开始缓存视频: ${videoId}`)

      // 检查是否已经缓存
      const existing = await this.getCachedVideo(videoId)
      if (existing) {
        console.log(`[VideoCache] ✅ 视频已缓存: ${videoId}`)
        return true
      }

      // 检查缓存空间
      const canCache = await this.checkCacheSpace()
      if (!canCache) {
        console.warn('[VideoCache] ⚠️ 缓存空间不足')
        await this.cleanupOldVideos()
      }

      // 下载视频
      const response = await fetch(videoUrl)
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      const size = blob.size

      // 检查文件大小（最大20MB）
      if (size > 20 * 1024 * 1024) {
        console.warn(`[VideoCache] ⚠️ 视频文件过大: ${(size / 1024 / 1024).toFixed(2)}MB`)
        return false
      }

      // 存储视频文件
      const cacheKey = this.getCacheKey(videoId)
      console.log(`[VideoCache] 💾 开始存储视频文件: ${videoId}, Blob大小: ${(blob.size / 1024 / 1024).toFixed(2)}MB`)

      const success = await enhancedIDB.set(cacheKey, blob, {
        ttl: 7 * 24 * 60 * 60 // 7天
      })

      if (!success) {
        throw new Error('存储到IndexedDB失败')
      }

      console.log(`[VideoCache] ✅ 视频文件存储成功: ${videoId}`)

      // 验证存储结果
      const verification = await enhancedIDB.get(cacheKey)
      if (verification && verification.data instanceof Blob) {
        console.log(`[VideoCache] ✅ 存储验证成功: ${videoId}, 实际存储大小: ${(verification.data.size / 1024 / 1024).toFixed(2)}MB`)
      } else {
        console.error(`[VideoCache] ❌ 存储验证失败: ${videoId}`)
      }

      // 存储元数据（不包含 blob，避免重复存储）
      const metadata = {
        videoId,
        url: videoUrl,
        size,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        quality: options.quality,
        duration: options.duration
      }

      await enhancedIDB.set(this.getMetadataKey(videoId), metadata, {
        ttl: 7 * 24 * 60 * 60
      })

      this.stats.downloads++
      this.stats.totalSize += size

      console.log(`[VideoCache] ✅ 视频缓存成功: ${videoId} (${(size / 1024 / 1024).toFixed(2)}MB)`)
      return true

    } catch (error) {
      console.error(`[VideoCache] ❌ 缓存视频失败: ${videoId}`, error)
      return false
    }
  }

  /**
   * 获取缓存的视频
   */
  async getCachedVideo(videoId: string): Promise<Blob | null> {
    try {
      const cacheKey = this.getCacheKey(videoId)
      const cached = await enhancedIDB.get(cacheKey)

      if (cached && cached.data instanceof Blob) {
        // 更新访问时间
        await this.updateAccessTime(videoId)
        this.stats.hits++

        console.log(`[VideoCache] ✅ 缓存命中: ${videoId}`)
        return cached.data as Blob
      }

      this.stats.misses++
      return null
    } catch (error) {
      console.error(`[VideoCache] ❌ 获取缓存失败: ${videoId}`, error)
      this.stats.misses++
      return null
    }
  }

  /**
   * 获取本地视频URL
   */
  async getLocalVideoUrl(videoId: string): Promise<string | null> {
    const blob = await this.getCachedVideo(videoId)
    if (blob) {
      return URL.createObjectURL(blob)
    }
    return null
  }

  /**
   * 检查视频是否已缓存
   */
  async isVideoCached(videoId: string): Promise<boolean> {
    try {
      // 检查实际的视频文件是否存在，而不仅仅是元数据
      const cacheKey = this.getCacheKey(videoId)
      const cached = await enhancedIDB.get(cacheKey)

      // 必须同时满足：有缓存数据 && 数据是 Blob 类型 && Blob 有实际大小
      if (cached && cached.data instanceof Blob && cached.data.size > 0) {
        return true
      }

      // 如果视频文件不存在或无效，清理可能存在的元数据
      if (!cached || !(cached.data instanceof Blob) || cached.data.size === 0) {
        const metadataKey = this.getMetadataKey(videoId)
        await enhancedIDB.delete(metadataKey)
        console.log(`[VideoCache] 🧹 清理无效缓存元数据: ${videoId}`)
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * 获取视频元数据
   */
  async getVideoMetadata(videoId: string): Promise<VideoCacheEntry | null> {
    try {
      const metadataKey = this.getMetadataKey(videoId)
      const cached = await enhancedIDB.get(metadataKey)
      return cached?.data as VideoCacheEntry || null
    } catch {
      return null
    }
  }

  /**
   * 删除缓存的视频
   */
  async removeVideo(videoId: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(videoId)
      const metadataKey = this.getMetadataKey(videoId)

      // 获取文件大小用于统计
      const metadata = await this.getVideoMetadata(videoId)
      if (metadata) {
        this.stats.totalSize -= metadata.size
      }

      await Promise.all([
        enhancedIDB.delete(cacheKey),
        enhancedIDB.delete(metadataKey)
      ])

      console.log(`[VideoCache] 🗑️ 删除缓存视频: ${videoId}`)
      return true
    } catch (error) {
      console.error(`[VideoCache] ❌ 删除缓存失败: ${videoId}`, error)
      return false
    }
  }

  /**
   * 获取所有缓存的视频列表
   */
  async getCachedVideosList(): Promise<VideoCacheEntry[]> {
    try {
      // 这里需要实现遍历所有元数据的逻辑
      // 由于IndexedDB结构限制，这是一个简化实现
      const videos: VideoCacheEntry[] = []

      // 通过统计获取视频相关的缓存项
      const stats = await enhancedIDB.getCategoryStats()
      const videoStats = stats['video']

      if (videoStats && !videoStats.error) {
        // 这里需要具体的实现来获取所有视频元数据
        console.log(`[VideoCache] 📊 发现 ${videoStats.items} 个缓存项`)
      }

      return videos
    } catch (error) {
      console.error('[VideoCache] ❌ 获取缓存列表失败:', error)
      return []
    }
  }

  /**
   * 清理旧视频
   */
  async cleanupOldVideos(keepCount: number = 50): Promise<void> {
    try {
      console.log('[VideoCache] 🧹 开始清理旧视频缓存...')

      const videos = await this.getCachedVideosList()
      if (videos.length <= keepCount) {
        return
      }

      // 按最后访问时间排序，删除最旧的
      videos.sort((a, b) => a.lastAccessed - b.lastAccessed)
      const toDelete = videos.slice(0, videos.length - keepCount)

      for (const video of toDelete) {
        await this.removeVideo(video.videoId)
      }

      console.log(`[VideoCache] ✅ 清理完成，删除了 ${toDelete.length} 个旧视频`)
    } catch (error) {
      console.error('[VideoCache] ❌ 清理失败:', error)
    }
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache(): Promise<void> {
    try {
      console.log('[VideoCache] 🧹 清空所有视频缓存...')

      const videos = await this.getCachedVideosList()
      for (const video of videos) {
        await this.removeVideo(video.videoId)
      }

      // 重置统计
      this.stats = {
        hits: 0,
        misses: 0,
        downloads: 0,
        totalSize: 0
      }

      console.log('[VideoCache] ✅ 所有视频缓存已清空')
    } catch (error) {
      console.error('[VideoCache] ❌ 清空缓存失败:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<VideoCacheStats> {
    try {
      const videos = await this.getCachedVideosList()
      const totalVideos = videos.length
      const totalSize = videos.reduce((sum, video) => sum + video.size, 0)
      const total = this.stats.hits + this.stats.misses
      const hitRate = total > 0 ? this.stats.hits / total : 0

      // 获取可用空间
      const usage = await enhancedIDB.getStorageUsage()
      const availableSpace = (usage.available || 0) / (1024 * 1024) // MB

      return {
        totalVideos,
        totalSize,
        hitRate,
        cacheUsage: totalSize / (this.defaultSettings.maxCacheSize * 1024 * 1024),
        availableSpace
      }
    } catch (error) {
      console.error('[VideoCache] ❌ 获取统计失败:', error)
      return {
        totalVideos: 0,
        totalSize: 0,
        hitRate: 0,
        cacheUsage: 0,
        availableSpace: 0
      }
    }
  }

  /**
   * 更新设置
   */
  updateSettings(settings: Partial<CacheSettings>): void {
    this.defaultSettings = { ...this.defaultSettings, ...settings }
    localStorage.setItem('video_cache_settings', JSON.stringify(this.defaultSettings))
    console.log('[VideoCache] ⚙️ 设置已更新:', this.defaultSettings)
  }

  /**
   * 获取当前设置
   */
  getSettings(): CacheSettings {
    return { ...this.defaultSettings }
  }

  // ============ 私有方法 ============

  private getCacheKey(videoId: string): string {
    return `${this.cacheKeyPrefix}${videoId}`
  }

  private getMetadataKey(videoId: string): string {
    return `${this.metadataKeyPrefix}${videoId}`
  }

  private async updateAccessTime(videoId: string): Promise<void> {
    try {
      const metadata = await this.getVideoMetadata(videoId)
      if (metadata) {
        metadata.lastAccessed = Date.now()
        await enhancedIDB.set(this.getMetadataKey(videoId), metadata, {
          ttl: 7 * 24 * 60 * 60
        })
      }
    } catch (error) {
      console.warn('[VideoCache] 更新访问时间失败:', error)
    }
  }

  private async checkCacheSpace(): Promise<boolean> {
    try {
      const usage = await enhancedIDB.getStorageUsage()
      const availableMB = (usage.available || 0) / (1024 * 1024)
      return availableMB > 50 // 至少保留50MB空间
    } catch {
      return true // 如果检查失败，允许缓存
    }
  }
}

// 导出单例实例
export const simpleVideoCacheService = new SimpleVideoCacheService()
export default simpleVideoCacheService