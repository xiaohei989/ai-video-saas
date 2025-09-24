/**
 * 视频缓存服务 - 移动端优化的本地缓存机制
 * 提供多层缓存：内存缓存 + 统一缓存系统(IndexedDB) + 预加载
 */

import type { Database } from '@/lib/supabase'
import { unifiedCache } from './UnifiedCacheService'

type Video = Database['public']['Tables']['videos']['Row']

export interface CacheOptions {
  maxAge?: number        // 缓存最大有效期（毫秒）
  maxItems?: number      // 最大缓存项数
  enablePreload?: boolean // 是否启用预加载
}

export interface CachedVideoData {
  videos: Video[]
  total: number
  page: number
  pageSize: number
  timestamp: number
  userId: string
}

class VideoCacheService {
  private memoryCache = new Map<string, CachedVideoData>()
  private accessOrder = new Map<string, number>() // 🚀 LRU访问顺序跟踪
  private accessCounter = 0 // 🚀 访问计数器
  private readonly DEFAULT_MAX_AGE = 5 * 60 * 1000 // 5分钟
  private readonly DEFAULT_MAX_ITEMS = 100  // 🚀 从20增加到100，大幅提升缓存容量
  private readonly STORAGE_PREFIX = 'veo3_video_cache_'
  private readonly STORAGE_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5分钟节流
  private readonly STORAGE_CLEANUP_THRESHOLD = 10 // 累计写入次数阈值
  private lastStorageCleanup = 0
  private storageWriteCounter = 0
  
  /**
   * 🚀 生成稳定的缓存键（解决JSON.stringify键顺序不稳定问题）
   */
  private getCacheKey(userId: string, filter?: any, pagination?: any): string {
    const filterStr = filter ? this.stableStringify(filter) : 'no_filter'
    const paginationStr = pagination ? this.stableStringify(pagination) : 'no_pagination'
    return `${userId}_${filterStr}_${paginationStr}`
  }

  /**
   * 🔧 稳定的JSON序列化（键按字母排序）
   */
  private stableStringify(obj: any): string {
    if (obj === null || obj === undefined) return 'null'
    if (typeof obj !== 'object') return String(obj)
    if (Array.isArray(obj)) return `[${obj.map(item => this.stableStringify(item)).join(',')}]`
    
    const sortedKeys = Object.keys(obj).sort()
    const pairs = sortedKeys.map(key => `"${key}":${this.stableStringify(obj[key])}`)
    return `{${pairs.join(',')}}`
  }

  /**
   * 🚀 检查缓存是否有效
   */
  private isCacheValid(timestamp: number, maxAge: number = this.DEFAULT_MAX_AGE): boolean {
    return Date.now() - timestamp < maxAge
  }

  /**
   * 💾 从内存缓存获取（LRU优化）
   */
  private getFromMemory(cacheKey: string): CachedVideoData | null {
    const cached = this.memoryCache.get(cacheKey)
    if (cached && this.isCacheValid(cached.timestamp)) {
      // 🚀 更新LRU访问顺序
      this.accessOrder.set(cacheKey, ++this.accessCounter)
      
      // 🚀 增强日志：显示缓存的视频详情
      const videoInfo = cached.videos[0] // 取第一个视频作为示例
      const videoTitle = videoInfo?.title || videoInfo?.template_name || '未知视频'
      const videoId = videoInfo?.id || 'unknown'
      console.log(`[VideoCache] 🚀 内存缓存命中: 视频ID[${videoId}] "${videoTitle}" (${cached.videos.length}个视频, ${Math.round((Date.now() - cached.timestamp) / 1000)}秒前缓存)`)
      return cached
    }
    
    // 清理过期的内存缓存
    if (cached) {
      this.memoryCache.delete(cacheKey)
      this.accessOrder.delete(cacheKey) // 🚀 同时清理访问记录
      console.log(`[VideoCache] 🧹 清理过期内存缓存: ${cacheKey}`)
    }
    
    return null
  }

  /**
   * 💾 存储到内存缓存（LRU淘汰策略）
   */
  private setToMemory(cacheKey: string, data: CachedVideoData): void {
    // 🚀 LRU缓存大小限制和淘汰
    if (this.memoryCache.size >= this.DEFAULT_MAX_ITEMS) {
      // 找到最少使用的缓存项
      let lruKey = ''
      let minAccessTime = Infinity
      
      for (const [key, accessTime] of this.accessOrder) {
        if (accessTime < minAccessTime) {
          minAccessTime = accessTime
          lruKey = key
        }
      }
      
      if (lruKey) {
        this.memoryCache.delete(lruKey)
        this.accessOrder.delete(lruKey)
        console.log(`[VideoCache] 🚀 LRU淘汰缓存: ${lruKey} (访问时间: ${minAccessTime})`)
      } else {
        // 降级到FIFO（防错处理）
        const oldestKey = this.memoryCache.keys().next().value
        this.memoryCache.delete(oldestKey)
        this.accessOrder.delete(oldestKey)
      }
    }
    
    this.memoryCache.set(cacheKey, data)
    this.accessOrder.set(cacheKey, ++this.accessCounter) // 🚀 记录访问时间
  }

  /**
   * 🗄️ 从统一缓存系统获取
   */
  private async getFromStorage(cacheKey: string): Promise<CachedVideoData | null> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${cacheKey}`
      const cached = await unifiedCache.get<CachedVideoData>(storageKey, {
        category: 'video'
      })
      
      if (cached) {
        if (this.isCacheValid(cached.timestamp, this.DEFAULT_MAX_AGE * 2)) { // 统一缓存时间更长
          // 🚀 增强日志：显示统一缓存详情
          const videoInfo = cached.videos[0]
          const videoTitle = videoInfo?.title || videoInfo?.template_name || '未知视频'
          const videoId = videoInfo?.id || 'unknown'
          const ageMinutes = Math.round((Date.now() - cached.timestamp) / 60000)
          console.log(`[VideoCache] 📱 统一缓存命中: 视频ID[${videoId}] "${videoTitle}" (${cached.videos.length}个视频, ${ageMinutes}分钟前缓存)`)
          
          // 同时加载到内存缓存（会自动更新LRU）
          this.setToMemory(cacheKey, cached)
          
          return cached
        } else {
          console.log(`[VideoCache] 🧹 清理过期统一缓存: ${cacheKey}`)
        }
      }
    } catch (error) {
      console.warn('[VideoCache] 统一缓存读取失败:', error)
    }
    
    return null
  }

  /**
   * 🗄️ 存储到统一缓存系统
   */
  private async setToStorage(cacheKey: string, data: CachedVideoData): Promise<void> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${cacheKey}`
      await unifiedCache.set(storageKey, data, {
        category: 'video',
        ttl: this.DEFAULT_MAX_AGE * 2 / 1000 // 转换为秒
      })
      console.log(`[VideoCache] 📱 统一缓存存储成功: ${storageKey}`)
    } catch (error) {
      console.warn('[VideoCache] 统一缓存存储失败:', error)
    }
  }

  // 统一缓存系统会自动处理清理，移除旧的localStorage清理逻辑

  /**
   * 🚀 获取缓存数据（优先级：内存 > 统一缓存）
   */
  async getCachedVideos(
    userId: string, 
    filter?: any, 
    pagination?: any
  ): Promise<CachedVideoData | null> {
    const cacheKey = this.getCacheKey(userId, filter, pagination)
    
    // 1. 尝试从内存获取
    const memoryResult = this.getFromMemory(cacheKey)
    if (memoryResult) {
      return memoryResult
    }
    
    // 2. 尝试从统一缓存获取
    const storageResult = await this.getFromStorage(cacheKey)
    if (storageResult) {
      return storageResult
    }
    
    return null
  }

  /**
   * 💾 缓存视频数据
   */
  async cacheVideos(
    userId: string,
    videos: Video[],
    total: number,
    page: number,
    pageSize: number,
    filter?: any,
    pagination?: any
  ): Promise<void> {
    const cacheKey = this.getCacheKey(userId, filter, pagination)
    const sanitizedVideos = videos.map(video => this.sanitizeVideo(video))

    const data: CachedVideoData = {
      videos: sanitizedVideos,
      total,
      page,
      pageSize,
      timestamp: Date.now(),
      userId
    }

    // 同时存储到内存和统一缓存
    this.setToMemory(cacheKey, data)
    await this.setToStorage(cacheKey, data)

    // 🚀 增强日志：显示缓存生成详情
    const sampleVideo = sanitizedVideos[0]
    const videoTitle = sampleVideo?.title || sampleVideo?.template_name || '未知视频'
    const videoId = sampleVideo?.id || 'unknown'
    const estimatedSize = Math.round(JSON.stringify(data).length / 1024) // 估算KB
    console.log(`[VideoCache] 💾 缓存已生成: 视频ID[${videoId}] "${videoTitle}" (${videos.length}个视频, 约${estimatedSize}KB, 页码${page}/${Math.ceil(total/pageSize)})`)
  }

  /**
   * 🔄 立即从缓存显示，后台更新数据
   */
  async getCacheFirstThenUpdate(
    userId: string,
    filter?: any,
    pagination?: any,
    updateFn?: () => Promise<any>
  ): Promise<{ 
    cached: CachedVideoData | null, 
    fresh?: any 
  }> {
    const cached = await this.getCachedVideos(userId, filter, pagination)
    
    // 立即返回缓存数据
    let result: { cached: CachedVideoData | null, fresh?: any } = { cached }
    
    // 后台更新（如果提供了更新函数）
    if (updateFn) {
      try {
        result.fresh = await updateFn()
        
        // 如果获得了新数据且与缓存不同，更新缓存
        if (result.fresh && result.fresh.videos) {
          const { videos, total, page, pageSize } = result.fresh
          await this.cacheVideos(userId, videos, total, page, pageSize, filter, pagination)
        }
      } catch (error) {
        console.warn('[VideoCache] 后台更新失败:', error)
      }
    }
    
    return result
  }

  /**
   * 🪥 移除缓存中不必要的大字段，降低localStorage占用
   */
  private sanitizeVideo(video: Video): Video {
    const clone: Record<string, any> = { ...video }
    const heavyKeys = [
      'parameters',
      'prompt_template',
      'veo3_settings',
      'render_config',
      'transcript',
      'audio_waveform',
      'metadata',
      'debug_info'
    ]

    heavyKeys.forEach(key => {
      if (key in clone) {
        delete clone[key]
      }
    })

    return clone as Video
  }

  /**
   * 🗑️ 清空用户相关的所有缓存
   */
  async clearUserCache(userId: string): Promise<void> {
    // 清理内存缓存
    const keysToDelete: string[] = []
    this.memoryCache.forEach((data, key) => {
      if (data.userId === userId) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => {
      this.memoryCache.delete(key)
      this.accessOrder.delete(key)
    })
    
    // 使用统一缓存系统清理所有视频相关缓存
    try {
      await unifiedCache.clearAll()
      
      console.log(`[VideoCache] 🗑️ 清理了用户${userId}的${keysToDelete.length}个内存缓存项，并清理了统一缓存`)
      
    } catch (error) {
      console.warn('[VideoCache] 清理用户缓存失败:', error)
    }
  }

  /**
   * 📊 获取缓存统计信息
   */
  getCacheStats(): {
    memorySize: number
    storageSize: number
    totalItems: number
    unifiedCacheStats?: any
  } {
    // 从统一缓存系统获取视频相关统计
    const unifiedStats = unifiedCache.getCategoryStats()
    const videoStats = unifiedStats.find(stat => stat.name === 'video')
    
    const memorySize = this.memoryCache.size
    const storageSize = videoStats?.count || 0
    
    console.log('[VideoCache] 📊 缓存统计 (统一缓存系统):', {
      内存缓存项: memorySize,
      持久化缓存项: storageSize,
      缓存命中率: videoStats?.hitRate ? `${(videoStats.hitRate * 100).toFixed(1)}%` : '0%',
      存储大小: videoStats?.size ? `${(videoStats.size / 1024 / 1024).toFixed(2)}MB` : '0MB'
    })
    
    return {
      memorySize,
      storageSize,
      totalItems: memorySize + storageSize,
      unifiedCacheStats: videoStats
    }
  }
}

// 导出单例实例
export const videoCacheService = new VideoCacheService()
