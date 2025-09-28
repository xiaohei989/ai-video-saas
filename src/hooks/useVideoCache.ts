/**
 * 视频缓存相关的自定义Hook
 * 包含缩略图缓存检查、IndexedDB缓存查询等逻辑
 */

import { useState, useCallback } from 'react'
import { getCachedImage, clearSingleImageCache, getCacheKey } from '@/utils/newImageCache'
import { enhancedIDB } from '@/services/EnhancedIDBService'
import type { Video, ThumbnailDebugInfo, IndexedDBCacheInfo } from '@/types/video.types'

interface UseVideoCacheOptions {
  enableDebugInfo?: boolean
}

interface UseVideoCacheReturn {
  // 状态
  videoDebugInfo: Map<string, boolean>
  thumbnailDebugInfo: Map<string, ThumbnailDebugInfo>
  thumbnailGeneratingVideos: Set<string>

  // 操作
  setVideoDebugInfo: React.Dispatch<React.SetStateAction<Map<string, boolean>>>
  setThumbnailDebugInfo: React.Dispatch<React.SetStateAction<Map<string, ThumbnailDebugInfo>>>
  setThumbnailGeneratingVideos: React.Dispatch<React.SetStateAction<Set<string>>>

  // 缓存操作函数
  checkThumbnailCache: (video: Video) => Promise<void>
  queryIndexedDBCache: (videoId: string) => Promise<IndexedDBCacheInfo[]>
  toggleDebugInfo: (videoId: string) => Promise<void>
  clearVideoCache: (videoId: string) => Promise<void>
}

export function useVideoCache(options: UseVideoCacheOptions = {}): UseVideoCacheReturn {
  const { enableDebugInfo = true } = options

  // 状态管理
  const [videoDebugInfo, setVideoDebugInfo] = useState<Map<string, boolean>>(new Map())
  const [thumbnailDebugInfo, setThumbnailDebugInfo] = useState<Map<string, ThumbnailDebugInfo>>(new Map())
  const [thumbnailGeneratingVideos, setThumbnailGeneratingVideos] = useState<Set<string>>(new Set())

  /**
   * 查询IndexedDB中与视频相关的缓存信息（包括缩略图和视频）
   */
  const queryIndexedDBCache = useCallback(async (videoId: string): Promise<IndexedDBCacheInfo[]> => {
    try {
      // 确保EnhancedIDB已初始化
      await enhancedIDB.initialize()

      // 使用EnhancedIDB获取分类统计，查找相关缓存项
      const categoryStats = await enhancedIDB.getCategoryStats()
      const matchingEntries: IndexedDBCacheInfo[] = []

      // 遍历所有分类查找与videoId相关的缓存项
      for (const [category, stats] of Object.entries(categoryStats)) {
        if (stats.error) continue

        try {
          // 这里需要实际查询具体的缓存条目
          // 由于EnhancedIDB的API限制，我们需要通过其他方式获取具体条目
          // 暂时返回模拟数据结构，实际使用时需要调用具体的查询方法

          if (category === 'image') {
            // 查找图片缓存（缩略图）
            const imageKey = `thumbnail_${videoId}`
            const cacheData = await enhancedIDB.get(imageKey)

            if (cacheData) {
              matchingEntries.push({
                key: imageKey,
                size: {
                  bytes: cacheData.size || 0,
                  kb: ((cacheData.size || 0) / 1024).toFixed(2) + 'KB',
                  mb: ((cacheData.size || 0) / (1024 * 1024)).toFixed(2) + 'MB'
                },
                category: 'image',
                timestamp: new Date(cacheData.timestamp || Date.now()).toLocaleString(),
                expiry: cacheData.ttl ? new Date(cacheData.timestamp + cacheData.ttl).toLocaleString() : undefined,
                dataType: 'Base64 Image',
                dataLength: typeof cacheData.data === 'string' ? cacheData.data.length : 0,
                dataPreview: typeof cacheData.data === 'string' ?
                  cacheData.data.substring(0, 50) + '...' :
                  'Binary Data'
              })
            }
          } else if (category === 'video') {
            // 查找视频缓存
            const videoKey = `video_${videoId}`
            const cacheData = await enhancedIDB.get(videoKey)

            if (cacheData) {
              matchingEntries.push({
                key: videoKey,
                size: {
                  bytes: cacheData.size || 0,
                  kb: ((cacheData.size || 0) / 1024).toFixed(2) + 'KB',
                  mb: ((cacheData.size || 0) / (1024 * 1024)).toFixed(2) + 'MB'
                },
                category: 'video',
                timestamp: new Date(cacheData.timestamp || Date.now()).toLocaleString(),
                expiry: cacheData.ttl ? new Date(cacheData.timestamp + cacheData.ttl).toLocaleString() : undefined,
                dataType: 'Video Metadata',
                dataLength: JSON.stringify(cacheData.data).length,
                dataPreview: JSON.stringify(cacheData.data).substring(0, 50) + '...'
              })
            }
          }
        } catch (categoryError) {
          console.warn(`[useVideoCache] 查询分类${category}失败:`, categoryError)
        }
      }

      return matchingEntries
    } catch (error) {
      console.error('[useVideoCache] 查询IndexedDB缓存失败:', error)
      return []
    }
  }, [])

  /**
   * 检查缩略图缓存状态
   */
  const checkThumbnailCache = useCallback(async (video: Video) => {
    const videoId = video.id

    try {
      console.log(`[useVideoCache] 检查视频缩略图缓存: ${videoId}`)

      // 设置加载状态
      setThumbnailDebugInfo(prev => {
        const newMap = new Map(prev)
        newMap.set(videoId, {
          hasCachedThumbnail: false,
          isLoading: true
        })
        return newMap
      })

      let hasCachedThumbnail = false
      let cacheSize = '0KB'
      let cacheType: 'base64' | 'url' | 'r2' | 'external' = 'external'
      let thumbnailUrl = ''
      let remoteUrl = ''
      let cacheLocation = ''
      let isBlurImage = false
      let remoteFileSize = ''
      let cacheKey = ''
      let blurImageUrl: string | null = null

      // 检查各种可能的缩略图URL
      const possibleUrls = [
        video.thumbnail_url,
        video.r2_thumbnail_url,
        video.backup_thumbnail_url
      ].filter(Boolean)

      for (const url of possibleUrls) {
        if (url) {
          try {
            const cachedData = await getCachedImage(url)

            if (cachedData) {
              hasCachedThumbnail = true
              thumbnailUrl = cachedData
              remoteUrl = url
              cacheKey = getCacheKey(url) // 使用正确的缓存Key生成函数

              if (cachedData.startsWith('data:')) {
                cacheType = 'base64'
                const base64Data = cachedData.split(',')[1] || ''
                const sizeBytes = Math.ceil(base64Data.length * 0.75) // Base64解码后的大小
                cacheSize = `${(sizeBytes / 1024).toFixed(2)}KB` // 缓存数据大小
                // 移除重复的cachedFileSize，因为它和cacheSize是一样的
              } else {
                cacheType = 'url'
                cacheSize = '缓存URL'
              }

              cacheLocation = `本地IndexedDB缓存 (${cacheType})`

              // 检查是否是模糊图 (根据URL判断)
              if (url.includes('blur') || url.includes('placeholder')) {
                isBlurImage = true
                blurImageUrl = cachedData
              }

              break
            }
          } catch (error) {
            console.warn(`[useVideoCache] 检查缓存失败 ${url}:`, error)
          }
        }
      }

      // 获取远程文件大小（如果有的话）
      if (remoteUrl && !hasCachedThumbnail) {
        try {
          const response = await fetch(remoteUrl, { method: 'HEAD' })
          const contentLength = response.headers.get('content-length')
          if (contentLength) {
            const sizeBytes = parseInt(contentLength)
            remoteFileSize = `${(sizeBytes / 1024).toFixed(2)}KB`
          }
        } catch (error) {
          console.warn('[useVideoCache] 获取远程文件大小失败:', error)
        }
      }

      // 更新缓存位置信息
      if (hasCachedThumbnail && cacheSize) {
        cacheLocation = cacheLocation.replace(/ \+ Cached \(.+?\)/, '') + ` + Cached (${cacheSize})`
      } else {
        remoteFileSize = cacheSize
      }

      // 查询IndexedDB中的真实缓存信息
      const indexedDBCacheInfo = await queryIndexedDBCache(videoId)

      setThumbnailDebugInfo(prev => {
        const newMap = new Map(prev)
        newMap.set(videoId, {
          hasCachedThumbnail,
          cacheSize,
          cacheType,
          thumbnailUrl,
          remoteUrl,
          cacheLocation,
          isBlurImage,
          isLoading: false,
          remoteFileSize,
          cacheKey,
          blurImageUrl,
          indexedDBCacheInfo
        })
        return newMap
      })

      console.log(`[useVideoCache] 缓存检查完成: ${videoId}`, {
        hasCachedThumbnail,
        cacheType,
        cacheSize,
        indexedDBCacheInfo: indexedDBCacheInfo.length
      })

    } catch (error) {
      console.error(`[useVideoCache] 检查缩略图缓存失败: ${videoId}`, error)

      setThumbnailDebugInfo(prev => {
        const newMap = new Map(prev)
        newMap.set(videoId, {
          hasCachedThumbnail: false,
          isLoading: false
        })
        return newMap
      })
    }
  }, [queryIndexedDBCache])

  /**
   * 切换调试信息显示状态
   */
  const toggleDebugInfo = useCallback(async (videoId: string) => {
    if (!enableDebugInfo) return

    const isCurrentlyShown = videoDebugInfo.get(videoId) || false

    setVideoDebugInfo(prev => {
      const newMap = new Map(prev)
      newMap.set(videoId, !isCurrentlyShown)
      return newMap
    })

    // 如果是首次显示且没有缓存信息，则检查缓存状态
    if (!isCurrentlyShown && !thumbnailDebugInfo.has(videoId)) {
      // 这里需要视频对象，但由于架构分离，我们让外部传入
      console.log('[useVideoCache] 需要检查缓存状态，请从外部调用 checkThumbnailCache')
    }
  }, [enableDebugInfo, videoDebugInfo, thumbnailDebugInfo])

  /**
   * 清除视频缓存
   */
  const clearVideoCache = useCallback(async (videoId: string) => {
    try {
      console.log(`[useVideoCache] 清除视频缓存: ${videoId}`)

      // 清除缩略图缓存
      const debugInfo = thumbnailDebugInfo.get(videoId)
      if (debugInfo?.remoteUrl) {
        await clearSingleImageCache(debugInfo.remoteUrl)
      }

      // 清除IndexedDB中的相关缓存
      await enhancedIDB.delete(`thumbnail_${videoId}`)
      await enhancedIDB.delete(`video_${videoId}`)

      // 更新调试信息
      setThumbnailDebugInfo(prev => {
        const newMap = new Map(prev)
        newMap.delete(videoId)
        return newMap
      })

      console.log(`[useVideoCache] 视频缓存清除完成: ${videoId}`)
    } catch (error) {
      console.error(`[useVideoCache] 清除视频缓存失败: ${videoId}`, error)
    }
  }, [thumbnailDebugInfo])

  return {
    // 状态
    videoDebugInfo,
    thumbnailDebugInfo,
    thumbnailGeneratingVideos,

    // 操作
    setVideoDebugInfo,
    setThumbnailDebugInfo,
    setThumbnailGeneratingVideos,

    // 缓存操作函数
    checkThumbnailCache,
    queryIndexedDBCache,
    toggleDebugInfo,
    clearVideoCache
  }
}