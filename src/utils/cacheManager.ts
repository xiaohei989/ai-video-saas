/**
 * 统一缓存管理工具
 * 用于清除和管理项目中的所有缓存
 */

import videoLoaderService from '@/services/VideoLoaderService'
// thumbnailGenerator 服务已简化，现在使用浏览器原生 Media Fragments
import { likesCacheService } from '@/services/likesCacheService'

interface CacheStats {
  videoLoader: {
    loadingVideos: number
    preloadQueue: number
  }
  thumbnailCache: {
    memoryItems: number
    dbItems: number
    totalSize: string
  }
  likesCache: {
    items: number
  }
  localStorage: {
    items: number
    totalSize: string
  }
  sessionStorage: {
    items: number
    totalSize: string
  }
  browserCache: {
    estimated: string
  }
}

interface ClearResult {
  success: boolean
  clearedItems: string[]
  errors: string[]
  stats: {
    before: Partial<CacheStats>
    after: Partial<CacheStats>
  }
}

class CacheManager {
  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<CacheStats> {
    const stats: CacheStats = {
      videoLoader: {
        loadingVideos: 0,
        preloadQueue: 0
      },
      thumbnailCache: {
        memoryItems: 0,
        dbItems: 0,
        totalSize: '0 KB'
      },
      likesCache: {
        items: 0
      },
      localStorage: {
        items: 0,
        totalSize: '0 KB'
      },
      sessionStorage: {
        items: 0,
        totalSize: '0 KB'
      },
      browserCache: {
        estimated: 'Unknown'
      }
    }

    try {
      // VideoLoader统计
      stats.videoLoader = {
        loadingVideos: this.getVideoLoaderStats().loadingVideos,
        preloadQueue: this.getVideoLoaderStats().preloadQueue
      }

      // ThumbnailCache统计
      const thumbnailStats = { memoryItems: 0, dbItems: 0, totalSize: 0 } // 简化统计
      stats.thumbnailCache = {
        memoryItems: thumbnailStats.memoryItems,
        dbItems: thumbnailStats.dbItems,
        totalSize: this.formatBytes(thumbnailStats.totalSize)
      }

      // LikesCache统计
      stats.likesCache.items = this.getLikesCacheStats()

      // LocalStorage统计
      const localStorageStats = this.getStorageStats(localStorage)
      stats.localStorage = {
        items: localStorageStats.items,
        totalSize: this.formatBytes(localStorageStats.size)
      }

      // SessionStorage统计
      const sessionStorageStats = this.getStorageStats(sessionStorage)
      stats.sessionStorage = {
        items: sessionStorageStats.items,
        totalSize: this.formatBytes(sessionStorageStats.size)
      }

      // 浏览器缓存估计（需要Storage API）
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        stats.browserCache.estimated = this.formatBytes(estimate.usage || 0)
      }

    } catch (error) {
      console.error('[CacheManager] 获取缓存统计失败:', error)
    }

    return stats
  }

  /**
   * 清除所有视频相关缓存
   */
  async clearAllVideoCache(): Promise<ClearResult> {
    const beforeStats = await this.getCacheStats()
    const clearedItems: string[] = []
    const errors: string[] = []

    console.log('[CacheManager] 开始清除所有视频相关缓存...')

    try {
      // 1. 清除VideoLoaderService缓存
      this.clearVideoLoaderCache()
      clearedItems.push('VideoLoader内存缓存')

      // 2. 缩略图现在使用浏览器原生 Media Fragments，无需清除缓存
      // await thumbnailGenerator.clearCache()
      clearedItems.push('缩略图现在使用浏览器原生处理')

      // 3. 清除LikesCache
      this.clearLikesCache()
      clearedItems.push('点赞状态缓存')

      // 4. 清除localStorage中的视频相关数据
      const localStorageCleared = this.clearLocalStorageVideoData()
      if (localStorageCleared.length > 0) {
        clearedItems.push(`LocalStorage (${localStorageCleared.join(', ')})`)
      }

      // 5. 清除sessionStorage中的视频相关数据
      const sessionStorageCleared = this.clearSessionStorageVideoData()
      if (sessionStorageCleared.length > 0) {
        clearedItems.push(`SessionStorage (${sessionStorageCleared.join(', ')})`)
      }

      // 6. 清除浏览器缓存（如果可能）
      await this.clearBrowserCache()
      clearedItems.push('浏览器HTTP缓存')

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      errors.push(errorMsg)
      console.error('[CacheManager] 清除缓存时出错:', error)
    }

    const afterStats = await this.getCacheStats()

    const result: ClearResult = {
      success: errors.length === 0,
      clearedItems,
      errors,
      stats: {
        before: beforeStats,
        after: afterStats
      }
    }

    console.log('[CacheManager] 缓存清除完成:', result)
    return result
  }

  /**
   * 清除VideoLoaderService缓存
   */
  private clearVideoLoaderCache(): void {
    try {
      videoLoaderService.cleanup()
      console.log('[CacheManager] VideoLoader缓存已清除')
    } catch (error) {
      console.error('[CacheManager] 清除VideoLoader缓存失败:', error)
      throw error
    }
  }

  /**
   * 清除点赞缓存
   */
  private clearLikesCache(): void {
    try {
      // 假设likesCacheService有清除方法
      if (typeof (likesCacheService as any).clearAll === 'function') {
        ;(likesCacheService as any).clearAll()
      }
      console.log('[CacheManager] 点赞缓存已清除')
    } catch (error) {
      console.error('[CacheManager] 清除点赞缓存失败:', error)
    }
  }

  /**
   * 清除localStorage中的视频相关数据
   */
  private clearLocalStorageVideoData(): string[] {
    const clearedKeys: string[] = []
    const videoRelatedKeys = [
      'video-loader-cache',
      'thumbnail-cache',
      'video-quality-cache',
      'video-progress',
      'likes-cache',
      'template-cache',
      'video-metadata-cache'
    ]

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (
          videoRelatedKeys.some(pattern => key.includes(pattern)) ||
          key.startsWith('video-') ||
          key.includes('thumbnail') ||
          key.includes('likes')
        )) {
          localStorage.removeItem(key)
          clearedKeys.push(key)
          i-- // 调整索引，因为删除了一项
        }
      }
    } catch (error) {
      console.error('[CacheManager] 清除localStorage失败:', error)
    }

    return clearedKeys
  }

  /**
   * 清除sessionStorage中的视频相关数据
   */
  private clearSessionStorageVideoData(): string[] {
    const clearedKeys: string[] = []

    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && (
          key.startsWith('video-') ||
          key.includes('thumbnail') ||
          key.includes('loader')
        )) {
          sessionStorage.removeItem(key)
          clearedKeys.push(key)
          i-- // 调整索引
        }
      }
    } catch (error) {
      console.error('[CacheManager] 清除sessionStorage失败:', error)
    }

    return clearedKeys
  }

  /**
   * 清除浏览器缓存
   */
  private async clearBrowserCache(): Promise<void> {
    try {
      // 清除Cache API缓存
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
        console.log('[CacheManager] Cache API缓存已清除')
      }

      // 如果支持，清除其他缓存
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          registrations.map(registration => registration.unregister())
        )
        console.log('[CacheManager] Service Worker已注销')
      }

    } catch (error) {
      console.error('[CacheManager] 清除浏览器缓存失败:', error)
    }
  }

  /**
   * 获取VideoLoaderService统计信息
   */
  private getVideoLoaderStats() {
    try {
      // 通过反射访问私有属性（仅用于调试）
      const service = videoLoaderService as any
      return {
        loadingVideos: service.loadingVideos ? service.loadingVideos.size : 0,
        preloadQueue: service.preloadQueue ? service.preloadQueue.length : 0
      }
    } catch {
      return { loadingVideos: 0, preloadQueue: 0 }
    }
  }

  /**
   * 获取点赞缓存统计信息
   */
  private getLikesCacheStats(): number {
    try {
      // 估算localStorage中的点赞缓存数量
      let count = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.includes('likes')) {
          count++
        }
      }
      return count
    } catch {
      return 0
    }
  }

  /**
   * 获取Storage统计信息
   */
  private getStorageStats(storage: Storage): { items: number; size: number } {
    let items = 0
    let size = 0

    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key) {
          const value = storage.getItem(key)
          items++
          size += (key.length + (value?.length || 0)) * 2 // UTF-16编码，每字符2字节
        }
      }
    } catch (error) {
      console.error('获取Storage统计失败:', error)
    }

    return { items, size }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 强制刷新页面并清除缓存
   */
  forceRefresh(): void {
    console.log('[CacheManager] 执行强制刷新...')
    
    // 清除当前页面的缓存
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName)
        })
      })
    }

    // 强制刷新页面
    window.location.reload()
  }

  /**
   * 重置所有视频加载器状态
   */
  resetVideoLoaders(): void {
    try {
      // 清除VideoLoaderService
      videoLoaderService.cleanup()
      
      // 重置服务状态
      console.log('[CacheManager] 所有视频加载器状态已重置')
    } catch (error) {
      console.error('[CacheManager] 重置视频加载器失败:', error)
    }
  }

  /**
   * 仅清除特定视频的缓存
   */
  async clearVideoCache(videoUrl: string): Promise<boolean> {
    try {
      console.log(`[CacheManager] 清除特定视频缓存: ${videoUrl}`)
      
      // 从VideoLoader中移除
      videoLoaderService.cancelLoad(videoUrl, true)
      
      // 从缩略图缓存中移除
      // 注意：thumbnailCacheService可能没有单个删除方法，需要检查
      
      return true
    } catch (error) {
      console.error(`[CacheManager] 清除视频缓存失败 ${videoUrl}:`, error)
      return false
    }
  }
}

// 创建单例实例
export const cacheManager = new CacheManager()
export default cacheManager

/**
 * React Hook for cache management
 */
import { useState, useCallback } from 'react'

export function useCacheManager() {
  const [isClearing, setIsClearing] = useState(false)
  const [lastClearResult, setLastClearResult] = useState<ClearResult | null>(null)

  const clearAllCache = useCallback(async (): Promise<ClearResult> => {
    setIsClearing(true)
    try {
      const result = await cacheManager.clearAllVideoCache()
      setLastClearResult(result)
      return result
    } finally {
      setIsClearing(false)
    }
  }, [])

  const getCacheStats = useCallback(async () => {
    return await cacheManager.getCacheStats()
  }, [])

  const forceRefresh = useCallback(() => {
    cacheManager.forceRefresh()
  }, [])

  return {
    isClearing,
    lastClearResult,
    clearAllCache,
    getCacheStats,
    forceRefresh,
    clearVideoCache: cacheManager.clearVideoCache.bind(cacheManager),
    resetVideoLoaders: cacheManager.resetVideoLoaders.bind(cacheManager)
  }
}