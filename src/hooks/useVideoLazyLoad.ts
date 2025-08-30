/**
 * 视频懒加载 Hook
 * 
 * 功能：
 * 1. 使用 Intersection Observer 检测视口进入
 * 2. 管理视频加载状态
 * 3. 提供缩略图预加载
 * 4. 支持预加载策略配置
 * 5. 集成缓存服务
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'
import thumbnailCacheService from '@/services/ThumbnailCacheService'
import videoLoaderService, { type VideoLoadOptions, type LoadProgress } from '@/services/VideoLoaderService'

export interface LazyLoadOptions {
  // 视口检测选项
  threshold?: number // 进入视口的阈值 (0-1)
  rootMargin?: string // 扩展检测区域
  
  // 加载策略
  loadStrategy?: 'immediate' | 'onVisible' | 'onInteraction' // 加载策略
  preloadDistance?: number // 预加载距离（屏幕数量）
  
  // 视频选项
  videoOptions?: VideoLoadOptions
  
  // 缩略图选项
  thumbnailQuality?: 'high' | 'medium' | 'low'
  
  // 启用功能
  enableThumbnailCache?: boolean
  enableProgressiveLoading?: boolean
  enablePreload?: boolean
}

export interface LazyLoadState {
  // 基本状态
  isVisible: boolean
  isLoaded: boolean
  isLoading: boolean
  hasError: boolean
  error: string | null
  
  // 缩略图状态
  thumbnail: string | null
  thumbnailLoading: boolean
  
  // 视频加载状态
  loadProgress: LoadProgress | null
  
  // 交互状态
  hasInteracted: boolean
}

export interface LazyLoadActions {
  // 手动触发加载
  load: () => Promise<void>
  
  // 预加载缩略图
  preloadThumbnail: () => Promise<void>
  
  // 取消加载
  cancel: () => void
  
  // 重试加载
  retry: () => Promise<void>
  
  // 标记用户交互
  markInteraction: () => void
  
  // 重置状态
  reset: () => void
}

export function useVideoLazyLoad(
  videoUrl: string,
  options: LazyLoadOptions = {}
): [LazyLoadState, LazyLoadActions, React.RefObject<HTMLElement>] {
  
  const {
    threshold = 0.1,
    rootMargin = '50px',
    loadStrategy = 'onVisible',
    preloadDistance = 1,
    videoOptions = {},
    thumbnailQuality = 'medium',
    enableThumbnailCache = true,
    enableProgressiveLoading = true,
    enablePreload = false
  } = options

  // 使用 react-intersection-observer
  const { ref: inViewRef, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: false // 允许重复触发
  })

  // 状态管理
  const [state, setState] = useState<LazyLoadState>({
    isVisible: false,
    isLoaded: false,
    isLoading: false,
    hasError: false,
    error: null,
    thumbnail: null,
    thumbnailLoading: false,
    loadProgress: null,
    hasInteracted: false
  })

  // 加载控制
  const loadingPromiseRef = useRef<Promise<void> | null>(null)
  const thumbnailPromiseRef = useRef<Promise<string> | null>(null)

  // 更新可见性状态
  useEffect(() => {
    setState(prev => ({ ...prev, isVisible: inView }))
  }, [inView])

  /**
   * 预加载缩略图
   */
  const preloadThumbnail = useCallback(async (): Promise<void> => {
    if (!enableThumbnailCache || !videoUrl || state.thumbnail || state.thumbnailLoading) {
      return
    }

    // 如果已经有正在进行的缩略图请求，返回它
    if (thumbnailPromiseRef.current) {
      try {
        await thumbnailPromiseRef.current
      } catch (error) {
        // 忽略缩略图加载错误
      }
      return
    }

    setState(prev => ({ ...prev, thumbnailLoading: true }))

    const thumbnailPromise = thumbnailCacheService.getThumbnail(videoUrl, {
      quality: thumbnailQuality,
      frameTime: 0.33
    })

    thumbnailPromiseRef.current = thumbnailPromise

    try {
      const thumbnail = await thumbnailPromise
      setState(prev => ({
        ...prev,
        thumbnail,
        thumbnailLoading: false
      }))
    } catch (error) {
      console.error('[LazyLoad] Thumbnail load failed:', error)
      setState(prev => ({
        ...prev,
        thumbnailLoading: false,
        // 不设置错误状态，缩略图失败不应影响整体功能
      }))
    } finally {
      thumbnailPromiseRef.current = null
    }
  }, [videoUrl, thumbnailQuality, enableThumbnailCache, state.thumbnail, state.thumbnailLoading])

  /**
   * 加载视频
   */
  const load = useCallback(async (): Promise<void> => {
    if (!videoUrl || state.isLoaded || state.isLoading) {
      return
    }

    // 如果已经有正在进行的加载请求，返回它
    if (loadingPromiseRef.current) {
      return loadingPromiseRef.current
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      hasError: false,
      error: null,
      loadProgress: null
    }))

    const loadPromise = (async () => {
      try {
        const progressCallback = (progress: LoadProgress) => {
          setState(prev => ({ ...prev, loadProgress: progress }))
        }

        await videoLoaderService.loadVideo(videoUrl, videoOptions, progressCallback)

        setState(prev => ({
          ...prev,
          isLoaded: true,
          isLoading: false,
          loadProgress: {
            loaded: 100,
            total: 100,
            percentage: 100,
            speed: 0,
            remainingTime: 0
          }
        }))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Video load failed'
        setState(prev => ({
          ...prev,
          isLoading: false,
          hasError: true,
          error: errorMessage,
          loadProgress: null
        }))
        throw error
      }
    })()

    loadingPromiseRef.current = loadPromise

    try {
      await loadPromise
    } finally {
      loadingPromiseRef.current = null
    }
  }, [videoUrl, videoOptions, state.isLoaded, state.isLoading])

  /**
   * 取消加载
   */
  const cancel = useCallback((): void => {
    if (state.isLoading && videoUrl) {
      videoLoaderService.cancelLoad(videoUrl)
      setState(prev => ({
        ...prev,
        isLoading: false,
        loadProgress: null
      }))
    }
    
    loadingPromiseRef.current = null
  }, [videoUrl, state.isLoading])

  /**
   * 重试加载
   */
  const retry = useCallback(async (): Promise<void> => {
    setState(prev => ({
      ...prev,
      hasError: false,
      error: null,
      isLoaded: false
    }))
    
    await load()
  }, [load])

  /**
   * 标记用户交互
   */
  const markInteraction = useCallback((): void => {
    setState(prev => ({ ...prev, hasInteracted: true }))
  }, [])

  /**
   * 重置状态
   */
  const reset = useCallback((): void => {
    cancel()
    
    setState({
      isVisible: false,
      isLoaded: false,
      isLoading: false,
      hasError: false,
      error: null,
      thumbnail: null,
      thumbnailLoading: false,
      loadProgress: null,
      hasInteracted: false
    })

    thumbnailPromiseRef.current = null
  }, [cancel])

  // 根据加载策略自动触发加载
  useEffect(() => {
    const shouldLoad = (() => {
      switch (loadStrategy) {
        case 'immediate':
          return true
        case 'onVisible':
          return state.isVisible
        case 'onInteraction':
          return state.hasInteracted
        default:
          return false
      }
    })()

    if (shouldLoad && !state.isLoaded && !state.isLoading && !state.hasError) {
      load().catch(error => {
        console.error('[LazyLoad] Auto load failed:', error)
      })
    }
  }, [loadStrategy, state.isVisible, state.hasInteracted, state.isLoaded, state.isLoading, state.hasError, load])

  // 自动预加载缩略图
  useEffect(() => {
    if (enableThumbnailCache && (loadStrategy === 'onVisible' ? state.isVisible : true)) {
      preloadThumbnail().catch(error => {
        console.error('[LazyLoad] Auto thumbnail preload failed:', error)
      })
    }
  }, [enableThumbnailCache, loadStrategy, state.isVisible, preloadThumbnail])

  // 预加载策略 - 当元素即将进入视口时预加载
  useEffect(() => {
    if (!enablePreload || loadStrategy !== 'onVisible') return

    // 计算预加载触发点
    const preloadRootMargin = `${preloadDistance * 100}%`
    
    // 这里可以创建另一个 intersection observer 用于预加载
    // 为了简化，我们使用当前的可见性状态
    if (state.isVisible && !state.thumbnailLoading && !state.thumbnail) {
      preloadThumbnail().catch(error => {
        console.error('[LazyLoad] Preload failed:', error)
      })
    }
  }, [enablePreload, loadStrategy, preloadDistance, state.isVisible, state.thumbnailLoading, state.thumbnail, preloadThumbnail])

  // 清理函数
  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  // 返回状态和操作方法
  const actions: LazyLoadActions = useMemo(() => ({
    load,
    preloadThumbnail,
    cancel,
    retry,
    markInteraction,
    reset
  }), [load, preloadThumbnail, cancel, retry, markInteraction, reset])

  return [state, actions, inViewRef]
}

/**
 * 简化版本的懒加载 Hook，只处理基本的可见性检测
 */
export function useSimpleLazyLoad(options: {
  threshold?: number
  rootMargin?: string
} = {}) {
  const { threshold = 0.1, rootMargin = '0px' } = options
  
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce: true // 只触发一次
  })

  return {
    ref,
    isVisible: inView
  }
}

/**
 * 批量懒加载 Hook，用于管理多个视频的懒加载
 */
export function useBatchLazyLoad(
  videoUrls: string[],
  options: LazyLoadOptions = {}
) {
  const [loadedVideos, setLoadedVideos] = useState<Set<string>>(new Set())
  const [loadingVideos, setLoadingVideos] = useState<Set<string>>(new Set())
  const [visibleVideos, setVisibleVideos] = useState<Set<string>>(new Set())

  /**
   * 标记视频为可见
   */
  const markVisible = useCallback((videoUrl: string) => {
    setVisibleVideos(prev => new Set(prev).add(videoUrl))
  }, [])

  /**
   * 标记视频为不可见
   */
  const markHidden = useCallback((videoUrl: string) => {
    setVisibleVideos(prev => {
      const newSet = new Set(prev)
      newSet.delete(videoUrl)
      return newSet
    })
  }, [])

  /**
   * 预加载可见视频的缩略图
   */
  useEffect(() => {
    if (options.enableThumbnailCache && visibleVideos.size > 0) {
      const visibleUrls = Array.from(visibleVideos)
      thumbnailCacheService.preloadThumbnails(visibleUrls, options.thumbnailQuality)
        .catch(error => {
          console.error('[BatchLazyLoad] Thumbnail preload failed:', error)
        })
    }
  }, [visibleVideos, options.enableThumbnailCache, options.thumbnailQuality])

  return {
    loadedVideos,
    loadingVideos,
    visibleVideos,
    markVisible,
    markHidden
  }
}