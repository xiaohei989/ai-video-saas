/**
 * 视频数据加载相关的自定义Hook
 * 包含快速加载、后台加载、分页等逻辑
 */

import { useState, useEffect, useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import supabaseVideoService from '@/services/supabaseVideoService'
import { videoCacheService } from '@/services/videoCacheService'
import { SubscriptionService } from '@/services/subscriptionService'
import analyticsService from '@/services/analyticsService'
import { AuthContext } from '@/contexts/AuthContext'
import type {
  Video,
  LoadingState,
  QuickLoadResult,
  BackgroundLoadOptions,
  PerformanceMetrics,
  DeviceType
} from '@/types/video.types'

interface UseVideosDataOptions {
  quickLoadPageSize?: number
  maxPageSize?: number
  enableAnalytics?: boolean
}

interface UseVideosDataReturn {
  // 状态
  videos: Video[]
  loadingState: LoadingState
  isPaidUser: boolean
  subscriptionLoading: boolean
  searchTerm: string
  page: number
  pageSize: number

  // 操作
  setVideos: React.Dispatch<React.SetStateAction<Video[]>>
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  setPage: React.Dispatch<React.SetStateAction<number>>
  setPageSize: React.Dispatch<React.SetStateAction<number>>
  refreshVideos: () => Promise<void>

  // 兼容性属性
  loading: boolean
  isInitialLoad: boolean
}

export function useVideosData(options: UseVideosDataOptions = {}): UseVideosDataReturn {
  const {
    quickLoadPageSize = 9,
    maxPageSize = 50,
    enableAnalytics = true
  } = options

  const authContext = useContext(AuthContext)
  const user = authContext?.user
  const navigate = useNavigate()

  // 状态管理
  const [videos, setVideos] = useState<Video[]>([])
  const [loadingState, setLoadingState] = useState<LoadingState>({
    initial: true,
    basicLoaded: false,
    fullLoaded: false
  })
  const [isPaidUser, setIsPaidUser] = useState<boolean>(false)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 兼容性：保留原有的loading和isInitialLoad状态
  const loading = loadingState.initial
  const isInitialLoad = loadingState.initial

  // 设备检测
  const isMobile = typeof window !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  /**
   * 🚀 快速加载：优先从缓存显示，后台更新数据
   */
  const quickLoad = useCallback(async (): Promise<QuickLoadResult> => {
    const startTime = performance.now()
    const loadingPhase = isMobile ? 'mobile_quick_load' : 'desktop_quick_load'
    let initialResult: Awaited<ReturnType<typeof supabaseVideoService.getUserVideos>> | null = null
    let initialFromCache = false
    let usedFullCacheForDisplay = false

    try {
      console.log('[useVideosData] 🚀 开始快速加载流程...')

      // Step 1: 立即检查缓存
      const fullCacheResult = await videoCacheService.getCachedVideos(
        user!.id,
        undefined,
        { page: 1, pageSize: maxPageSize }
      )

      const quickCacheResult = await videoCacheService.getCachedVideos(
        user!.id,
        undefined,
        { page: 1, pageSize: quickLoadPageSize }
      )

      let cacheResult = quickCacheResult
      if (!cacheResult && fullCacheResult) {
        usedFullCacheForDisplay = true
        const videos = Array.isArray(fullCacheResult.videos) ? fullCacheResult.videos : []
        cacheResult = {
          ...fullCacheResult,
          pageSize: quickLoadPageSize,
          videos: videos.slice(0, quickLoadPageSize)
        }
      }

      if (cacheResult) {
        initialFromCache = true
        const safeVideos = Array.isArray(cacheResult.videos) ? cacheResult.videos : []

        initialResult = fullCacheResult || {
          videos: safeVideos,
          total: cacheResult.total || 0,
          page: cacheResult.page || 1,
          pageSize: cacheResult.pageSize || quickLoadPageSize
        }

        // 立即显示缓存数据，隐藏骨架UI
        setVideos(safeVideos)
        setLoadingState(prev => ({
          ...prev,
          initial: false,
          basicLoaded: true
        }))

        const cacheTime = performance.now() - startTime

        console.log(`[useVideosData] 📦 缓存命中！立即显示${safeVideos.length}个视频 (${cacheTime.toFixed(1)}ms)`)

        // 发送缓存命中分析
        if (enableAnalytics && analyticsService && typeof analyticsService.track === 'function') {
          analyticsService.track('cache_performance', {
            type: 'cache_hit',
            load_time: cacheTime,
            video_count: safeVideos.length,
            device_type: isMobile ? 'mobile' : 'desktop',
            phase: loadingPhase
          })
        }
      }

      if (!cacheResult) {
        // Step 2: 缓存未命中，加载新数据
        console.log('[useVideosData] 🌐 缓存未命中，从网络加载数据...')

        const networkStartTime = performance.now()

        const result = await supabaseVideoService.getUserVideos(
          user!.id,
          undefined,
          { page: 1, pageSize: quickLoadPageSize }
        )

        initialResult = result

        const networkEndTime = performance.now()
        const networkTime = networkEndTime - networkStartTime
        const totalTime = networkEndTime - startTime

        const safeVideos = Array.isArray(result.videos) ? result.videos : []

        // 显示数据并缓存
        setVideos(safeVideos)
        videoCacheService.cacheVideos(
          user!.id,
          safeVideos,
          result.total || 0,
          result.page || 1,
          result.pageSize || quickLoadPageSize,
          undefined,
          { page: 1, pageSize: quickLoadPageSize }
        )

        // 隐藏骨架UI
        setLoadingState(prev => ({
          ...prev,
          initial: false,
          basicLoaded: true
        }))

        console.log(`[useVideosData] ✅ 网络加载完成，获取${safeVideos.length}个视频 (网络:${networkTime.toFixed(1)}ms, 总计:${totalTime.toFixed(1)}ms)`)

        // 发送网络加载分析
        if (enableAnalytics && analyticsService && typeof analyticsService.track === 'function') {
          analyticsService.track('network_performance', {
            type: 'cache_miss',
            network_time: networkTime,
            total_time: totalTime,
            video_count: safeVideos.length,
            device_type: isMobile ? 'mobile' : 'desktop',
            phase: loadingPhase
          })
        }
      }

    } catch (error) {
      const errorTime = performance.now() - startTime

      console.error('[useVideosData] 快速加载失败:', error)

      // 记录错误指标
      if (enableAnalytics && analyticsService && typeof analyticsService.track === 'function') {
        analyticsService.track('loading_error', {
          error_type: 'quick_load_failed',
          error_time: errorTime,
          device_type: isMobile ? 'mobile' : 'desktop',
          error_message: error instanceof Error ? error.message : 'unknown'
        })
      }

      // 失败时尝试使用过期缓存
      const fallbackCache = await videoCacheService.getCachedVideos(
        user!.id,
        undefined,
        { page: 1, pageSize: quickLoadPageSize }
      )

      if (fallbackCache) {
        console.log('[useVideosData] 🚑 使用备用缓存数据')
        const fallbackVideos = Array.isArray(fallbackCache.videos) ? fallbackCache.videos : []
        setVideos(fallbackVideos)
        toast.info('网络不稳定，显示缓存数据')
      }

      // 无论如何都要隐藏骨架UI
      setLoadingState(prev => ({
        ...prev,
        initial: false,
        basicLoaded: true
      }))
    }

    return {
      initialResult,
      fromCache: initialFromCache,
      usedFullCacheForDisplay
    }
  }, [user?.id, quickLoadPageSize, maxPageSize, isMobile, enableAnalytics])

  /**
   * 📚 后台加载：加载订阅信息等非关键数据
   */
  const backgroundLoad = useCallback(async (
    quickLoadResult: QuickLoadResult,
    opts: BackgroundLoadOptions = {}
  ) => {
    try {
      console.log('[useVideosData] 📚 开始后台加载非关键数据...')

      // 加载订阅信息
      const subscription = await SubscriptionService.getCurrentSubscription(user!.id)

      // 设置订阅状态
      setIsPaidUser(subscription?.status === 'active' || false)
      setSubscriptionLoading(false)

      // 加载更多视频（如果用户有超过首屏数量的视频）
      await loadMoreVideosIfNeeded(quickLoadResult, opts)

      // 标记全部加载完成
      setLoadingState(prev => ({
        ...prev,
        fullLoaded: true
      }))

      console.log(`[useVideosData] ✅ 后台加载完成 ${quickLoadResult.fromCache ? '(缓存命中)' : '(直接加载)'}`)

    } catch (error) {
      console.error('[useVideosData] 后台加载失败:', error)
      // 后台加载失败不影响基础UI显示
    }
  }, [user?.id])

  /**
   * 加载更多视频（如果用户有更多视频）
   */
  const loadMoreVideosIfNeeded = useCallback(async (
    quickLoadResult: QuickLoadResult,
    { skipInitialRefresh = false }: BackgroundLoadOptions = {}
  ) => {
    try {
      if (!skipInitialRefresh && quickLoadResult.initialResult) {
        const { videos: initialVideos, total, page, pageSize } = quickLoadResult.initialResult

        // 如果 quickLoad 走的是网络请求，已经覆盖首屏，无需再次拉取
        if (!quickLoadResult.fromCache) {
          videoCacheService.cacheVideos(
            user!.id,
            initialVideos,
            total,
            page,
            pageSize,
            undefined,
            { page: 1, pageSize: quickLoadPageSize }
          )
        }

        // 直接对比现有列表与初始数据，避免重复请求
        const safeInitialVideos = Array.isArray(initialVideos) ? initialVideos : []
        setVideos(prev => {
          const currentVideos = prev.length > 0 ? prev : safeInitialVideos
          const currentIds = currentVideos.map(v => v?.id).filter(Boolean).sort()
          const initialIds = safeInitialVideos.map(v => v?.id).filter(Boolean).sort()

          if (JSON.stringify(currentIds) !== JSON.stringify(initialIds)) {
            return safeInitialVideos
          }
          return prev
        })
      }

      // 加载更多视频
      const totalResult = await supabaseVideoService.getUserVideos(
        user!.id,
        undefined,
        { page: 1, pageSize: maxPageSize }
      )

      const safeVideos = Array.isArray(totalResult.videos) ? totalResult.videos : []

      if (safeVideos.length > quickLoadPageSize) {
        setVideos(safeVideos)

        // 缓存全量数据
        videoCacheService.cacheVideos(
          user!.id,
          safeVideos,
          totalResult.total || 0,
          totalResult.page || 1,
          totalResult.pageSize || maxPageSize,
          undefined,
          { page: 1, pageSize: maxPageSize }
        )

        console.log(`[useVideosData] 加载更多视频，总数: ${safeVideos.length}`)
      }
    } catch (error) {
      console.error('[useVideosData] 加载更多视频失败:', error)
    }
  }, [user?.id, quickLoadPageSize, maxPageSize])

  /**
   * 刷新视频数据
   */
  const refreshVideos = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoadingState(prev => ({ ...prev, initial: true }))

      const result = await quickLoad()
      await backgroundLoad(result)
    } catch (error) {
      console.error('[useVideosData] 刷新视频失败:', error)
      toast.error('刷新失败，请重试')
    }
  }, [user?.id, quickLoad, backgroundLoad])

  /**
   * 初始化页面数据
   */
  useEffect(() => {
    if (!user?.id) return

    console.log('[useVideosData] 🚀 初始化数据加载流程')

    // 立即开始快速加载，不等待
    quickLoad().then(result => {
      backgroundLoad(result, {
        skipInitialRefresh: result.usedFullCacheForDisplay
      })
    })

  }, [user?.id, quickLoad, backgroundLoad])

  return {
    // 状态
    videos,
    loadingState,
    isPaidUser,
    subscriptionLoading,
    searchTerm,
    page,
    pageSize,

    // 操作
    setVideos,
    setSearchTerm,
    setPage,
    setPageSize,
    refreshVideos,

    // 兼容性属性
    loading,
    isInitialLoad
  }
}