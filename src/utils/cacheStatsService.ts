/**
 * 缓存统计服务 - 多层缓存监控工具
 * 统计memory cache、localStorage、IndexedDB等多层缓存的使用情况
 */

import { videoCacheService } from '@/services/videoCacheService'
import { unifiedCache } from '@/services/UnifiedCacheService'
import { enhancedIDB } from '@/services/EnhancedIDBService'
import { cacheHitTracker, type DetailedCacheStats } from './cacheHitTracker'

export interface MultiLayerCacheStats {
  // 总体统计
  totalSize: number           // 总缓存大小(字节)
  totalItems: number         // 总缓存项目数
  hitCount: number           // 缓存命中数
  missCount: number          // 缓存失误数
  
  // 分类命中统计
  categoryHitStats: {
    image: { hits: number; misses: number; hitRate: number }
    video: { hits: number; misses: number; hitRate: number }
    template: { hits: number; misses: number; hitRate: number }
    api: { hits: number; misses: number; hitRate: number }
    overall: { hits: number; misses: number; hitRate: number }
  }
  
  // 分层统计
  memoryCache: {
    size: number             // 内存缓存大小(字节)
    items: number            // 内存缓存项目数
    hitRate: string          // 命中率
  }
  
  localStorageCache: {
    size: number             // localStorage大小(字节)
    items: number            // localStorage项目数
    prefixes: string[]       // 使用的前缀列表
  }
  
  indexedDBCache: {
    size: number             // IndexedDB大小(字节)
    items: number            // IndexedDB项目数
    isAvailable: boolean     // 是否可用
  }
  
  // 分类缓存统计
  imageCacheStats: {
    size: number             // 图片缓存大小(字节)
    items: number            // 图片缓存项目数
    prefixes: string[]       // 图片相关前缀
  }
  
  videoCacheStats: {
    size: number             // 视频缓存大小(字节)
    items: number            // 视频缓存项目数
    prefixes: string[]       // 视频相关前缀
  }
  
  // 实时性能指标
  lastUpdateTime: number     // 最后更新时间
  environment: 'development' | 'production'
}

class CacheStatsService {
  private readonly CACHE_PREFIXES = [
    'veo3_video_cache_',      // 视频缓存服务
    'cached_img_',            // 图片缓存
    'template_cache_',        // 模板缓存
    'template:',              // 多级缓存模板
    'user:',                  // 多级缓存用户
    'video:',                 // 多级缓存视频
    'stats:',                 // 多级缓存统计
    'thumb:',                 // 多级缓存缩略图
    'sub:',                   // 多级缓存订阅
    'credits:'                // 多级缓存积分
  ]

  // 图片相关缓存前缀
  private readonly IMAGE_CACHE_PREFIXES = [
    'cached_img_',            // 图片缓存
    'thumb:',                 // 缩略图缓存
    'template_',              // 模板图片缓存（实际使用的前缀）
  ]

  // 视频相关缓存前缀
  private readonly VIDEO_CACHE_PREFIXES = [
    'veo3_video_cache_',      // 视频缓存服务
    'video:',                 // 多级缓存视频
  ]

  /**
   * 获取localStorage缓存统计
   */
  private getLocalStorageStats(): {
    size: number
    items: number
    prefixes: string[]
    details: Array<{ key: string; size: number; prefix: string }>
  } {
    let totalSize = 0
    let totalItems = 0
    const foundPrefixes = new Set<string>()
    const details: Array<{ key: string; size: number; prefix: string }> = []

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // 检查是否匹配任何缓存前缀
        const matchedPrefix = this.CACHE_PREFIXES.find(prefix => key.startsWith(prefix))
        if (matchedPrefix) {
          const item = localStorage.getItem(key)
          if (item) {
            const itemSize = item.length * 2 // UTF-16字符估算
            totalSize += itemSize
            totalItems++
            foundPrefixes.add(matchedPrefix)
            details.push({
              key: key.substring(0, 50) + (key.length > 50 ? '...' : ''), // 截断长key
              size: itemSize,
              prefix: matchedPrefix
            })
          }
        }
      }
    } catch (error) {
      console.warn('[CacheStats] localStorage统计失败:', error)
    }

    return {
      size: totalSize,
      items: totalItems,
      prefixes: Array.from(foundPrefixes),
      details
    }
  }

  /**
   * 分别获取图片和视频缓存统计
   */
  private getCategorizedCacheStats(): {
    imageCache: { size: number; items: number; prefixes: string[] }
    videoCache: { size: number; items: number; prefixes: string[] }
  } {
    let imageTotalSize = 0
    let imageTotalItems = 0
    const imageFoundPrefixes = new Set<string>()
    
    let videoTotalSize = 0
    let videoTotalItems = 0
    const videoFoundPrefixes = new Set<string>()

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        const item = localStorage.getItem(key)
        if (!item) continue
        
        const itemSize = item.length * 2 // UTF-16字符估算

        // 检查是否是图片缓存
        const matchedImagePrefix = this.IMAGE_CACHE_PREFIXES.find(prefix => key.startsWith(prefix))
        if (matchedImagePrefix) {
          imageTotalSize += itemSize
          imageTotalItems++
          imageFoundPrefixes.add(matchedImagePrefix)
          continue
        }

        // 检查是否是视频缓存
        const matchedVideoPrefix = this.VIDEO_CACHE_PREFIXES.find(prefix => key.startsWith(prefix))
        if (matchedVideoPrefix) {
          videoTotalSize += itemSize
          videoTotalItems++
          videoFoundPrefixes.add(matchedVideoPrefix)
        }
      }
    } catch (error) {
      console.warn('[CacheStats] 分类缓存统计失败:', error)
    }

    return {
      imageCache: {
        size: imageTotalSize,
        items: imageTotalItems,
        prefixes: Array.from(imageFoundPrefixes)
      },
      videoCache: {
        size: videoTotalSize,
        items: videoTotalItems,
        prefixes: Array.from(videoFoundPrefixes)
      }
    }
  }

  /**
   * 获取IndexedDB缓存统计
   */
  private async getIndexedDBStats(): Promise<{
    size: number
    items: number
    isAvailable: boolean
  }> {
    try {
      // 检查IndexedDB是否可用
      if (!window.indexedDB || !enhancedIDB) {
        return { size: 0, items: 0, isAvailable: false }
      }

      // 尝试获取IndexedDB统计
      await enhancedIDB.initialize()
      
      // 使用新的EnhancedIDB API获取分类统计
      const categoryStats = await enhancedIDB.getCategoryStats()
      let totalSize = 0
      let totalItems = 0
      
      // 统计所有分类的大小和项目数
      Object.values(categoryStats).forEach(stats => {
        if (stats && typeof stats === 'object' && !stats.error) {
          totalSize += stats.size || 0
          totalItems += stats.items || 0
        }
      })

      return {
        size: totalSize,
        items: totalItems,
        isAvailable: true
      }
    } catch (error) {
      console.warn('[CacheStats] IndexedDB统计失败:', error)
      return { size: 0, items: 0, isAvailable: false }
    }
  }

  /**
   * 获取分类缓存命中统计
   */
  private getCategoryHitStats(): {
    image: { hits: number; misses: number; hitRate: number }
    video: { hits: number; misses: number; hitRate: number }
    template: { hits: number; misses: number; hitRate: number }
    api: { hits: number; misses: number; hitRate: number }
    overall: { hits: number; misses: number; hitRate: number }
  } {
    try {
      const hitStats = cacheHitTracker.getStats()
      
      return {
        image: {
          hits: hitStats.image.hits,
          misses: hitStats.image.misses,
          hitRate: hitStats.image.hitRate
        },
        video: {
          hits: hitStats.video.hits,
          misses: hitStats.video.misses,
          hitRate: hitStats.video.hitRate
        },
        template: {
          hits: hitStats.template.hits,
          misses: hitStats.template.misses,
          hitRate: hitStats.template.hitRate
        },
        api: {
          hits: hitStats.api.hits,
          misses: hitStats.api.misses,
          hitRate: hitStats.api.hitRate
        },
        overall: {
          hits: hitStats.overall.hits,
          misses: hitStats.overall.misses,
          hitRate: hitStats.overall.hitRate
        }
      }
    } catch (error) {
      console.warn('[CacheStats] 分类命中统计失败:', error)
      const defaultStats = { hits: 0, misses: 0, hitRate: 0 }
      return {
        image: defaultStats,
        video: defaultStats,
        template: defaultStats,
        api: defaultStats,
        overall: defaultStats
      }
    }
  }

  /**
   * 获取内存缓存统计
   */
  private getMemoryCacheStats(): {
    size: number
    items: number
    hitRate: string
    details: any
  } {
    try {
      // 从videoCacheService获取统计
      const videoStats = videoCacheService.getCacheStats()
      
      // 从unifiedCache获取统计
      const unifiedStats = unifiedCache.getGlobalStats()
      
      return {
        size: unifiedStats.categories.reduce((sum, cat) => sum + cat.size, 0),
        items: videoStats.memorySize + unifiedStats.categories.reduce((sum, cat) => sum + cat.count, 0),
        hitRate: unifiedStats.summary.averageHitRate,
        details: {
          videoCache: videoStats,
          unifiedCache: unifiedStats
        }
      }
    } catch (error) {
      console.warn('[CacheStats] 内存缓存统计失败:', error)
      return { size: 0, items: 0, hitRate: '0%', details: {} }
    }
  }

  /**
   * 获取完整的多层缓存统计
   */
  async getMultiLayerCacheStats(): Promise<MultiLayerCacheStats> {
    const startTime = performance.now()
    
    // 并行获取各层缓存统计
    const [localStorageStats, indexedDBStats, memoryCacheStats, categorizedStats, categoryHitStats] = await Promise.all([
      Promise.resolve(this.getLocalStorageStats()),
      this.getIndexedDBStats(),
      Promise.resolve(this.getMemoryCacheStats()),
      Promise.resolve(this.getCategorizedCacheStats()),
      Promise.resolve(this.getCategoryHitStats())
    ])

    // 计算总体统计
    const totalSize = localStorageStats.size + indexedDBStats.size + memoryCacheStats.size
    const totalItems = localStorageStats.items + indexedDBStats.items + memoryCacheStats.items

    // 从统一缓存服务获取命中统计
    const unifiedStats = unifiedCache.getGlobalStats()
    const hitCount = unifiedStats.categories.reduce((sum, cat) => sum + cat.hitRate * cat.count, 0)
    const missCount = unifiedStats.categories.reduce((sum, cat) => sum + cat.count * (1 - cat.hitRate), 0)

    const endTime = performance.now()
    console.log(`[CacheStats] 📊 缓存统计完成: ${(endTime - startTime).toFixed(1)}ms`)
    console.log(`[CacheStats] 💾 总缓存: ${(totalSize / 1024).toFixed(1)}KB (${totalItems}项)`)
    console.log(`[CacheStats] 🏪 localStorage: ${localStorageStats.prefixes.join(', ')}`)
    console.log(`[CacheStats] 📱 IndexedDB: ${indexedDBStats.isAvailable ? '可用' : '不可用'}`)
    console.log(`[CacheStats] 🖼️ 图片缓存: ${(categorizedStats.imageCache.size / 1024).toFixed(1)}KB (${categorizedStats.imageCache.items}项)`)
    console.log(`[CacheStats] 🎬 视频缓存: ${(categorizedStats.videoCache.size / 1024).toFixed(1)}KB (${categorizedStats.videoCache.items}项)`)
    console.log(`[CacheStats] 📊 分类命中率: 图片${categoryHitStats.image.hitRate.toFixed(1)}% 视频${categoryHitStats.video.hitRate.toFixed(1)}% 模板${categoryHitStats.template.hitRate.toFixed(1)}%`)
    
    return {
      totalSize,
      totalItems,
      hitCount,
      missCount,
      
      categoryHitStats,
      
      memoryCache: {
        size: memoryCacheStats.size,
        items: memoryCacheStats.items,
        hitRate: memoryCacheStats.hitRate
      },
      
      localStorageCache: {
        size: localStorageStats.size,
        items: localStorageStats.items,
        prefixes: localStorageStats.prefixes
      },
      
      indexedDBCache: {
        size: indexedDBStats.size,
        items: indexedDBStats.items,
        isAvailable: indexedDBStats.isAvailable
      },
      
      imageCacheStats: {
        size: categorizedStats.imageCache.size,
        items: categorizedStats.imageCache.items,
        prefixes: categorizedStats.imageCache.prefixes
      },
      
      videoCacheStats: {
        size: categorizedStats.videoCache.size,
        items: categorizedStats.videoCache.items,
        prefixes: categorizedStats.videoCache.prefixes
      },
      
      lastUpdateTime: Date.now(),
      environment: process.env.NODE_ENV === 'development' ? 'development' : 'production'
    }
  }

  /**
   * 获取快速缓存概览（性能优化版本）
   */
  getQuickCacheOverview(): {
    estimatedSize: number
    estimatedItems: number
    cacheTypes: string[]
  } {
    const localStorageStats = this.getLocalStorageStats()
    const memoryCacheStats = this.getMemoryCacheStats()
    
    return {
      estimatedSize: localStorageStats.size + memoryCacheStats.size,
      estimatedItems: localStorageStats.items + memoryCacheStats.items,
      cacheTypes: [
        'Memory',
        ...localStorageStats.prefixes.map(p => p.replace(/[_:]/g, '')),
        'IndexedDB'
      ]
    }
  }

  /**
   * 获取分类缓存命中统计（公共方法）
   */
  getCategorizedHitStats(): {
    image: { hits: number; misses: number; hitRate: number }
    video: { hits: number; misses: number; hitRate: number }
    template: { hits: number; misses: number; hitRate: number }
    api: { hits: number; misses: number; hitRate: number }
    overall: { hits: number; misses: number; hitRate: number }
  } {
    return this.getCategoryHitStats()
  }

  /**
   * 清理所有缓存统计
   */
  async clearAllCaches(): Promise<void> {
    try {
      // 清理localStorage缓存
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && this.CACHE_PREFIXES.some(prefix => key.startsWith(prefix))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      // 清理统一缓存系统
      await unifiedCache.clearAll()
      
      // 清理视频缓存服务
      if (videoCacheService && typeof videoCacheService.clearAll === 'function') {
        videoCacheService.clearAll()
      }
      
      // 清理IndexedDB缓存
      if (enhancedIDB) {
        try {
          await enhancedIDB.clear()
        } catch (error) {
          console.warn('[CacheStats] IndexedDB清理失败:', error)
        }
      }
      
      // 重置缓存命中统计
      cacheHitTracker.reset()
      
      console.log(`[CacheStats] 🧹 已清理${keysToRemove.length}个localStorage项和所有缓存系统`)
    } catch (error) {
      console.error('[CacheStats] 清理缓存失败:', error)
    }
  }
}

// 导出单例
export const cacheStatsService = new CacheStatsService()