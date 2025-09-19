/**
 * 视频缓存服务 - 移动端优化的本地缓存机制
 * 提供多层缓存：内存缓存 + localStorage + 预加载
 */

import type { Database } from '@/lib/supabase'

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
   * 🗄️ 从localStorage获取
   */
  private getFromStorage(cacheKey: string): CachedVideoData | null {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${cacheKey}`
      const cached = localStorage.getItem(storageKey)
      
      if (cached) {
        const data: CachedVideoData = JSON.parse(cached)
        
        if (this.isCacheValid(data.timestamp, this.DEFAULT_MAX_AGE * 2)) { // localStorage缓存时间更长
          // 🚀 增强日志：显示localStorage缓存详情
          const videoInfo = data.videos[0]
          const videoTitle = videoInfo?.title || videoInfo?.template_name || '未知视频'
          const videoId = videoInfo?.id || 'unknown'
          const ageMinutes = Math.round((Date.now() - data.timestamp) / 60000)
          console.log(`[VideoCache] 📱 localStorage缓存命中: 视频ID[${videoId}] "${videoTitle}" (${data.videos.length}个视频, ${ageMinutes}分钟前缓存)`)
          
          // 同时加载到内存缓存（会自动更新LRU）
          this.setToMemory(cacheKey, data)
          
          return data
        } else {
          // 清理过期的localStorage缓存
          localStorage.removeItem(storageKey)
          console.log(`[VideoCache] 🧹 清理过期localStorage缓存: ${cacheKey}`)
        }
      }
    } catch (error) {
      console.warn('[VideoCache] localStorage读取失败:', error)
    }
    
    return null
  }

  /**
   * 🗄️ 存储到localStorage
   */
  private setToStorage(cacheKey: string, data: CachedVideoData): void {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${cacheKey}`
      localStorage.setItem(storageKey, JSON.stringify(data))
      
      // 清理旧的缓存项（保持localStorage整洁）
      this.cleanupStorage()
      
    } catch (error) {
      console.warn('[VideoCache] localStorage存储失败:', error)
      
      // 如果存储失败（可能是空间不足），尝试清理后重试
      this.cleanupStorage()
      try {
        localStorage.setItem(`${this.STORAGE_PREFIX}${cacheKey}`, JSON.stringify(data))
      } catch (retryError) {
        console.error('[VideoCache] localStorage重试失败:', retryError)
      }
    }
  }

  /**
   * 🧹 清理过期的localStorage缓存
   */
  private cleanupStorage(): void {
    try {
      const keysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const item = localStorage.getItem(key)
          if (item) {
            try {
              const data: CachedVideoData = JSON.parse(item)
              if (!this.isCacheValid(data.timestamp, this.DEFAULT_MAX_AGE * 3)) {
                keysToRemove.push(key)
              }
            } catch {
              // 格式错误的缓存也要清理
              keysToRemove.push(key)
            }
          }
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })
      
      if (keysToRemove.length > 0) {
        console.log(`[VideoCache] 🧹 清理了${keysToRemove.length}个过期缓存`)
      }
      
    } catch (error) {
      console.warn('[VideoCache] 缓存清理失败:', error)
    }
  }

  /**
   * 🚀 获取缓存数据（优先级：内存 > localStorage）
   */
  getCachedVideos(
    userId: string, 
    filter?: any, 
    pagination?: any
  ): CachedVideoData | null {
    const cacheKey = this.getCacheKey(userId, filter, pagination)
    
    // 1. 尝试从内存获取
    const memoryResult = this.getFromMemory(cacheKey)
    if (memoryResult) {
      return memoryResult
    }
    
    // 2. 尝试从localStorage获取
    const storageResult = this.getFromStorage(cacheKey)
    if (storageResult) {
      return storageResult
    }
    
    return null
  }

  /**
   * 💾 缓存视频数据
   */
  cacheVideos(
    userId: string,
    videos: Video[],
    total: number,
    page: number,
    pageSize: number,
    filter?: any,
    pagination?: any
  ): void {
    const cacheKey = this.getCacheKey(userId, filter, pagination)
    const data: CachedVideoData = {
      videos,
      total,
      page,
      pageSize,
      timestamp: Date.now(),
      userId
    }
    
    // 同时存储到内存和localStorage
    this.setToMemory(cacheKey, data)
    this.setToStorage(cacheKey, data)
    
    // 🚀 增强日志：显示缓存生成详情
    const sampleVideo = videos[0]
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
    const cached = this.getCachedVideos(userId, filter, pagination)
    
    // 立即返回缓存数据
    let result: { cached: CachedVideoData | null, fresh?: any } = { cached }
    
    // 后台更新（如果提供了更新函数）
    if (updateFn) {
      try {
        result.fresh = await updateFn()
        
        // 如果获得了新数据且与缓存不同，更新缓存
        if (result.fresh && result.fresh.videos) {
          const { videos, total, page, pageSize } = result.fresh
          this.cacheVideos(userId, videos, total, page, pageSize, filter, pagination)
        }
      } catch (error) {
        console.warn('[VideoCache] 后台更新失败:', error)
      }
    }
    
    return result
  }

  /**
   * 🗑️ 清空用户相关的所有缓存
   */
  clearUserCache(userId: string): void {
    // 清理内存缓存
    const keysToDelete: string[] = []
    this.memoryCache.forEach((data, key) => {
      if (data.userId === userId) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.memoryCache.delete(key))
    
    // 清理localStorage缓存
    try {
      const storageKeysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const item = localStorage.getItem(key)
          if (item) {
            try {
              const data: CachedVideoData = JSON.parse(item)
              if (data.userId === userId) {
                storageKeysToRemove.push(key)
              }
            } catch {
              // 忽略格式错误的项目
            }
          }
        }
      }
      
      storageKeysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })
      
      console.log(`[VideoCache] 🗑️ 清理了用户${userId}的${keysToDelete.length + storageKeysToRemove.length}个缓存项`)
      
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
  } {
    let storageSize = 0
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const item = localStorage.getItem(key)
          if (item) {
            storageSize++
          }
        }
      }
    } catch (error) {
      console.warn('[VideoCache] 获取缓存统计失败:', error)
    }
    
    return {
      memorySize: this.memoryCache.size,
      storageSize,
      totalItems: this.memoryCache.size + storageSize
    }
  }
}

// 导出单例实例
export const videoCacheService = new VideoCacheService()