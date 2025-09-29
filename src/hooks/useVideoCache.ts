/**
 * 视频缓存相关的自定义Hook
 * 包含缩略图缓存检查、IndexedDB缓存查询等逻辑
 * 新增：完整视频文件缓存和自动预加载功能
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { getCachedImage, clearSingleImageCache, getCacheKey } from '@/utils/newImageCache'
import { enhancedIDB } from '@/services/EnhancedIDBService'
import { smartPreloadService, type VideoItem } from '@/services/SmartVideoPreloadService'
import type { Video, ThumbnailDebugInfo, IndexedDBCacheInfo } from '@/types/video.types'

interface UseVideoCacheOptions {
  enableDebugInfo?: boolean
  autoPreload?: boolean
  priority?: number
  enableHoverPreload?: boolean
  enableViewportPreload?: boolean
}

interface VideoCacheStatus {
  isCached: boolean
  isLoading: boolean
  progress: number
  error: string | null
  localUrl: string | null
}

interface UseVideoCacheReturn {
  // 状态
  videoDebugInfo: Map<string, boolean>
  thumbnailDebugInfo: Map<string, ThumbnailDebugInfo>
  thumbnailGeneratingVideos: Set<string>
  videoCacheStatus: VideoCacheStatus

  // 操作
  setVideoDebugInfo: React.Dispatch<React.SetStateAction<Map<string, boolean>>>
  setThumbnailDebugInfo: React.Dispatch<React.SetStateAction<Map<string, ThumbnailDebugInfo>>>
  setThumbnailGeneratingVideos: React.Dispatch<React.SetStateAction<Set<string>>>

  // 缓存操作函数
  checkThumbnailCache: (video: Video) => Promise<void>
  queryIndexedDBCache: (videoId: string) => Promise<IndexedDBCacheInfo[]>
  toggleDebugInfo: (videoId: string) => Promise<void>
  clearVideoCache: (videoId: string) => Promise<void>

  // 新增：视频文件缓存功能
  cacheVideo: () => Promise<void>
  checkVideoCacheStatus: () => Promise<void>
  registerElement: (element: HTMLElement) => void

  // 便捷的状态判断
  isCached: boolean
  isLoading: boolean
  hasError: boolean
  localUrl: string | null
}

export function useVideoCache(
  video?: Video | VideoItem,
  options: UseVideoCacheOptions = {}
): UseVideoCacheReturn {
  const {
    enableDebugInfo = true,
    autoPreload = true,
    priority = 0,
    enableHoverPreload = true,
    enableViewportPreload = true
  } = options

  // 状态管理
  const [videoDebugInfo, setVideoDebugInfo] = useState<Map<string, boolean>>(new Map())
  const [thumbnailDebugInfo, setThumbnailDebugInfo] = useState<Map<string, ThumbnailDebugInfo>>(new Map())
  const [thumbnailGeneratingVideos, setThumbnailGeneratingVideos] = useState<Set<string>>(new Set())

  // 新增：视频文件缓存状态
  const [videoCacheStatus, setVideoCacheStatus] = useState<VideoCacheStatus>({
    isCached: false,
    isLoading: false,
    progress: 0,
    error: null,
    localUrl: null
  })

  const elementRef = useRef<HTMLElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // 获取视频ID和URL的辅助函数
  const getVideoId = useCallback(() => {
    if (!video) return null
    return 'id' in video ? video.id : video.id
  }, [video])

  const getVideoUrl = useCallback(() => {
    if (!video) return null
    if ('url' in video && video.url) return video.url
    if ('video_url' in video && video.video_url) return video.video_url
    return `/videos/${getVideoId()}`
  }, [video, getVideoId])

  /**
   * 检查视频缓存状态
   */
  const checkVideoCacheStatus = useCallback(async () => {
    const videoId = getVideoId()
    if (!videoId) return

    try {
      const isCached = await smartPreloadService.isVideoCached(videoId)
      const localUrl = isCached ? await smartPreloadService.getLocalVideoUrl(videoId) : null

      setVideoCacheStatus(prev => ({
        ...prev,
        isCached,
        localUrl,
        error: null
      }))

      return isCached
    } catch (error) {
      setVideoCacheStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '检查缓存失败'
      }))
      return false
    }
  }, [getVideoId])

  /**
   * 手动缓存视频
   */
  const cacheVideo = useCallback(async () => {
    const videoId = getVideoId()
    const videoUrl = getVideoUrl()

    if (!videoId || !videoUrl) {
      setVideoCacheStatus(prev => ({
        ...prev,
        error: '视频信息不完整'
      }))
      return
    }

    if (videoCacheStatus.isCached || videoCacheStatus.isLoading) return

    setVideoCacheStatus(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: 0
    }))

    try {
      const success = await smartPreloadService.cacheVideoManually(videoId, videoUrl)

      if (success) {
        const localUrl = await smartPreloadService.getLocalVideoUrl(videoId)
        setVideoCacheStatus(prev => ({
          ...prev,
          isCached: true,
          isLoading: false,
          progress: 100,
          localUrl
        }))
      } else {
        throw new Error('缓存失败')
      }
    } catch (error) {
      setVideoCacheStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '缓存失败'
      }))
    }
  }, [getVideoId, getVideoUrl, videoCacheStatus.isCached, videoCacheStatus.isLoading])

  /**
   * 注册元素到预加载服务
   */
  const registerElement = useCallback((element: HTMLElement) => {
    const videoId = getVideoId()
    const videoUrl = getVideoUrl()

    if (!element || !videoId || !videoUrl || elementRef.current === element) return

    // 清理之前的注册
    if (cleanupRef.current) {
      cleanupRef.current()
    }

    elementRef.current = element

    // 构造VideoItem对象
    const videoItem: VideoItem = {
      id: videoId,
      url: videoUrl,
      ...(video && 'duration' in video && { duration: video.duration }),
      ...(video && 'size' in video && { size: video.size })
    }

    // 注册到智能预加载服务
    const cleanup = smartPreloadService.registerVideo(element, videoItem, {
      autoPreload: autoPreload && enableViewportPreload,
      priority,
      onProgress: (progress) => {
        setVideoCacheStatus(prev => ({
          ...prev,
          progress
        }))
      },
      onComplete: () => {
        checkVideoCacheStatus()
      },
      onError: (error) => {
        setVideoCacheStatus(prev => ({
          ...prev,
          error: error.message,
          isLoading: false
        }))
      }
    })

    cleanupRef.current = cleanup
  }, [video, autoPreload, enableViewportPreload, priority, checkVideoCacheStatus, getVideoId, getVideoUrl])

  // 组件挂载时检查缓存状态
  useEffect(() => {
    if (video) {
      checkVideoCacheStatus()
    }
  }, [video, checkVideoCacheStatus])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

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
        }
      }

      return matchingEntries
    } catch (error) {
      return []
    }
  }, [])

  /**
   * 检查缩略图缓存状态
   */
  const checkThumbnailCache = useCallback(async (video: Video) => {
    const videoId = video.id

    try {

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


    } catch (error) {

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
    }
  }, [enableDebugInfo, videoDebugInfo, thumbnailDebugInfo])

  /**
   * 清除视频缓存
   */
  const clearVideoCache = useCallback(async (videoId: string) => {
    try {

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

    } catch (error) {
    }
  }, [thumbnailDebugInfo])

  return {
    // 状态
    videoDebugInfo,
    thumbnailDebugInfo,
    thumbnailGeneratingVideos,
    videoCacheStatus,

    // 操作
    setVideoDebugInfo,
    setThumbnailDebugInfo,
    setThumbnailGeneratingVideos,

    // 缓存操作函数
    checkThumbnailCache,
    queryIndexedDBCache,
    toggleDebugInfo,
    clearVideoCache,

    // 新增：视频文件缓存功能
    cacheVideo,
    checkVideoCacheStatus,
    registerElement,

    // 便捷的状态判断
    isCached: videoCacheStatus.isCached,
    isLoading: videoCacheStatus.isLoading,
    hasError: !!videoCacheStatus.error,
    localUrl: videoCacheStatus.localUrl
  }
}

/**
 * 简化版本的视频缓存Hook，只提供状态查询
 */
export function useVideoCacheStatus(videoId: string) {
  const [isCached, setIsCached] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      const cached = await smartPreloadService.isVideoCached(videoId)
      setIsCached(cached)
    } catch (error) {
      console.error('[VideoCache] 检查状态失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  return {
    isCached,
    isLoading,
    refresh: checkStatus
  }
}