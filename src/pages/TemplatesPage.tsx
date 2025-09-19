import { useState, useEffect, useMemo, useCallback, memo, useRef, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Play, Hash, TrendingUp, Sparkles, ArrowUp, Video } from 'lucide-react'
import { templateList as initialTemplates, getPopularTags, getTemplatesByTags, localizeTemplate } from '@/features/video-creator/data/templates/index'
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import LikeCounterButton from '@/components/templates/LikeCounterButton'
import TemplatesSkeleton from '@/components/templates/TemplatesSkeleton'
import Pagination from '@/components/ui/pagination'
import CachedImage from '@/components/ui/CachedImage'
import { useTemplateLikes } from '@/hooks/useTemplateLikes'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'
import TemplatePerformanceStats, { 
  type TemplatePerformanceMetrics, 
  type TemplateLoadingState 
} from '@/components/debug/TemplatePerformanceStats'
import { cacheHitTracker } from '@/utils/cacheHitTracker'

type SortOption = 'popular' | 'latest'

// 统一状态管理接口
interface TemplatesState {
  // 核心分页和筛选状态
  currentPage: number
  pageSize: number
  sortBy: SortOption
  selectedTags: string[]
  
  // 控制状态
  loading: boolean
  showBackToTop: boolean
  isInitialized: boolean
  isMobileDetected: boolean
  hasInitializationError: boolean
  
  // 循环保护
  updateCount: number
  lastUpdateTime: number
  
  // 模板数据
  templates: any[]
}

// Action 类型定义
type TemplatesAction = 
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'SET_SORT'; payload: SortOption }
  | { type: 'SET_TAGS'; payload: string[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SHOW_BACK_TO_TOP'; payload: boolean }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_MOBILE_DETECTED'; payload: boolean }
  | { type: 'SET_INITIALIZATION_ERROR'; payload: boolean }
  | { type: 'SET_TEMPLATES'; payload: any[] }
  | { type: 'INCREMENT_UPDATE_COUNT' }
  | { type: 'RESET_UPDATE_COUNT' }
  | { type: 'BATCH_UPDATE'; payload: Partial<TemplatesState> }
  | { type: 'RESET_TO_DEFAULTS' }

// 循环检测和熔断机制
const MAX_UPDATES_PER_SECOND = 5
const UPDATE_WINDOW_MS = 1000

// Reducer 函数 - 统一状态管理，内置循环检测
function templatesReducer(state: TemplatesState, action: TemplatesAction): TemplatesState {
  const now = Date.now()
  
  // 循环检测：检查更新频率，但排除UI相关的频繁更新
  const excludedFromLimiting = [
    'RESET_UPDATE_COUNT', 
    'RESET_TO_DEFAULTS', 
    'SET_SHOW_BACK_TO_TOP', // 滚动事件可能频繁触发
    'SET_LOADING' // 加载状态变化不应被限制
  ]
  
  if (!excludedFromLimiting.includes(action.type)) {
    const timeSinceLastUpdate = now - state.lastUpdateTime
    let newUpdateCount = state.updateCount
    
    if (timeSinceLastUpdate < UPDATE_WINDOW_MS) {
      newUpdateCount += 1
      // 如果更新过于频繁，触发熔断 - 提高阈值，更宽容
      if (newUpdateCount > MAX_UPDATES_PER_SECOND) {
        console.warn(`[TemplatesReducer] 检测到频繁更新 (${action.type})，触发熔断保护`)
        return {
          ...state,
          hasInitializationError: true,
          updateCount: newUpdateCount,
          lastUpdateTime: now
        }
      }
    } else {
      newUpdateCount = 1
    }
    
    state = { ...state, updateCount: newUpdateCount, lastUpdateTime: now }
  }
  
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, currentPage: Math.max(1, action.payload) }
      
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: Math.max(3, action.payload) }
      
    case 'SET_SORT':
      return { ...state, sortBy: action.payload }
      
    case 'SET_TAGS':
      return { ...state, selectedTags: action.payload }
      
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
      
    case 'SET_SHOW_BACK_TO_TOP':
      return { ...state, showBackToTop: action.payload }
      
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload }
      
    case 'SET_MOBILE_DETECTED':
      return { ...state, isMobileDetected: action.payload }
      
    case 'SET_INITIALIZATION_ERROR':
      return { ...state, hasInitializationError: action.payload }
      
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload }
      
    case 'INCREMENT_UPDATE_COUNT':
      return { ...state, updateCount: state.updateCount + 1 }
      
    case 'RESET_UPDATE_COUNT':
      return { ...state, updateCount: 0, lastUpdateTime: now }
      
    case 'BATCH_UPDATE':
      // 批量更新，减少重渲染
      return { ...state, ...action.payload, lastUpdateTime: now }
      
    case 'RESET_TO_DEFAULTS':
      return {
        ...state,
        currentPage: 1,
        pageSize: state.isMobileDetected ? 6 : 12,
        sortBy: 'latest',
        selectedTags: [],
        hasInitializationError: false,
        updateCount: 0,
        lastUpdateTime: now
      }
      
    default:
      return state
  }
}

export default function TemplatesPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { trackTemplateView, trackEvent, trackFilter } = useAnalytics()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // 创建初始状态 - 从URL参数初始化
  const createInitialState = (): TemplatesState => {
    const page = searchParams.get('page')
    const size = searchParams.get('size')
    const sort = searchParams.get('sort') as SortOption
    const tags = searchParams.get('tags')
    
    return {
      // 核心分页和筛选状态
      currentPage: page ? Math.max(1, parseInt(page, 10)) : 1,
      pageSize: size ? Math.max(3, parseInt(size, 10)) : 12,
      sortBy: sort && ['popular', 'latest'].includes(sort) ? sort : 'latest',
      selectedTags: tags ? tags.split(',').filter(Boolean) : [],
      
      // 控制状态
      loading: false,
      showBackToTop: false,
      isInitialized: false,
      isMobileDetected: false,
      hasInitializationError: false,
      
      // 循环保护
      updateCount: 0,
      lastUpdateTime: 0,
      
      // 模板数据
      templates: initialTemplates
    }
  }
  
  // 使用 useReducer 统一管理所有状态
  const [state, dispatch] = useReducer(templatesReducer, null, createInitialState)
  
  // 解构状态以便使用
  const {
    currentPage,
    pageSize,
    sortBy,
    selectedTags,
    loading: stateLoading,
    showBackToTop,
    isInitialized,
    isMobileDetected,
    hasInitializationError,
    templates
  } = state
  
  // 简化的ref管理 - 只保留必要的定时器
  const urlSyncTimeoutRef = useRef<NodeJS.Timeout>()
  const initializationTimeoutRef = useRef<NodeJS.Timeout>()
  const errorRecoveryCountRef = useRef(0)
  
  // 获取热门标签
  const popularTags = getPopularTags(16)

  // SEO优化
  useSEO('templates')
  
  // 📊 性能监控状态
  const [performanceMetrics, setPerformanceMetrics] = useState<TemplatePerformanceMetrics>({
    // 页面加载性能
    pageLoadStart: 0,
    firstContentfulPaint: 0,
    timeToInteractive: 0,
    templateRenderTime: 0,
    
    // 数据加载性能
    templateLoadTime: 0,
    likeDataLoadTime: 0,
    cacheHitCount: 0,
    networkRequestCount: 0,
    
    // 用户交互性能
    filterResponseTime: 0,
    paginationResponseTime: 0,
    sortResponseTime: 0,
    tagClickResponseTime: 0,
    
    // 资源使用统计
    templateCount: 0,
    loadedImageCount: 0,
    loadedVideoCount: 0,
    cacheSize: 0,
    
    // 分类缓存统计
    imageCacheSize: 0,
    videoCacheSize: 0,
    imageCacheItems: 0,
    videoCacheItems: 0
  })
  
  const [templateLoadingState, setTemplateLoadingState] = useState<TemplateLoadingState>({
    initial: true,
    templatesLoaded: false,
    likesLoaded: false,
    assetsLoaded: false,
    fullReady: false
  })
  
  // 移动端设备检测（纯宽度检测）
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    
    return window.innerWidth <= 768
  }, [])
  
  // 移动端检测结果同步（一次性执行，避免循环）
  useEffect(() => {
    if (isMobile && !isMobileDetected) {
      dispatch({ type: 'SET_MOBILE_DETECTED', payload: true })
    }
  }, [isMobile]) // 移除isMobileDetected依赖，避免循环

  // 📊 性能监控初始化
  useEffect(() => {
    const pageLoadStart = performance.now()
    setPerformanceMetrics(prev => ({ ...prev, pageLoadStart }))
    
    // 监控首次内容绘制时间 (FCP)
    const measureFCP = () => {
      if ('getEntriesByType' in performance) {
        const paintEntries = performance.getEntriesByType('paint')
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
        
        if (fcpEntry) {
          setPerformanceMetrics(prev => ({
            ...prev,
            firstContentfulPaint: fcpEntry.startTime
          }))
          
          console.log(`[TemplatePerformance] 🎨 FCP: ${fcpEntry.startTime.toFixed(1)}ms`)
        }
      }
    }
    
    // 延迟测量FCP，确保渲染完成
    setTimeout(measureFCP, 100)
    
    return () => {
      // 组件卸载时记录最终性能数据
      const totalTime = performance.now() - pageLoadStart
      console.log(`[TemplatePerformance] 📊 总页面时间: ${totalTime.toFixed(1)}ms`)
    }
  }, [])



  // 📊 监控资源加载状态
  useEffect(() => {
    if (templateLoadingState.templatesLoaded && templateLoadingState.likesLoaded && !templateLoadingState.assetsLoaded) {
      // 监控图片和视频资源加载
      const images = document.querySelectorAll('img[src*="template"], img[src*="thumbnail"]')
      const videos = document.querySelectorAll('video[src], video source[src]')
      
      setPerformanceMetrics(prev => ({
        ...prev,
        loadedImageCount: images.length,
        loadedVideoCount: videos.length
      }))
      
      setTemplateLoadingState(prev => ({ ...prev, assetsLoaded: true }))
      
      // 计算可交互时间 (TTI)
      const tti = performance.now() - performanceMetrics.pageLoadStart
      setPerformanceMetrics(prev => ({
        ...prev,
        timeToInteractive: tti
      }))
      
      console.log(`[TemplatePerformance] 🖼️ 资源加载完成: ${images.length}图片, ${videos.length}视频`)
      console.log(`[TemplatePerformance] ⚡ TTI: ${tti.toFixed(1)}ms`)
    }
  }, [templateLoadingState.templatesLoaded, templateLoadingState.likesLoaded, templateLoadingState.assetsLoaded, performanceMetrics.pageLoadStart])

  // 📊 监控模板渲染性能
  useEffect(() => {
    if (templateLoadingState.assetsLoaded && !templateLoadingState.fullReady) {
      const renderStartTime = performance.now()
      
      // 使用 requestAnimationFrame 确保渲染完成后测量
      requestAnimationFrame(() => {
        const templateRenderTime = performance.now() - renderStartTime
        
        setPerformanceMetrics(prev => ({
          ...prev,
          templateRenderTime
        }))
        
        setTemplateLoadingState(prev => ({ ...prev, fullReady: true }))
        
        console.log(`[TemplatePerformance] 🎨 模板渲染时间: ${templateRenderTime.toFixed(1)}ms`)
      })
    }
  }, [templateLoadingState.assetsLoaded, templateLoadingState.fullReady])

  // 📊 监控缓存使用情况 - 使用新的多层缓存统计服务
  useEffect(() => {
    if (!templateLoadingState.fullReady) return
    
    const updateCacheStats = async () => {
      try {
        // 导入缓存统计服务
        const { cacheStatsService } = await import('@/utils/cacheStatsService')
        
        // 记录模板数据缓存使用情况
        if (filteredAndSortedTemplates.length > 0) {
          cacheHitTracker.recordTemplateHit('template_data', 'memory')
          console.log(`[TemplatesPage] 📋 模板数据缓存命中: ${filteredAndSortedTemplates.length}个模板`)
        } else {
          cacheHitTracker.recordTemplateMiss('template_data')
          console.log(`[TemplatesPage] 📋 模板数据缓存未命中: 无数据`)
        }
        
        // 获取资源缓存统计（使用cacheHitTracker而不是multiLevelCache）
        const hitTrackerStats = cacheHitTracker.getStats()
        const cacheStats = await cacheStatsService.getMultiLayerCacheStats()
        
        setPerformanceMetrics(prev => {
          const updatedMetrics = {
            ...prev,
            cacheSize: cacheStats.totalSize,
            // 使用资源缓存的命中数据
            cacheHitCount: hitTrackerStats.overall.hits,
            networkRequestCount: hitTrackerStats.overall.misses,
            // 添加分类缓存数据
            imageCacheSize: cacheStats.imageCacheStats.size,
            videoCacheSize: cacheStats.videoCacheStats.size,
            imageCacheItems: cacheStats.imageCacheStats.items,
            videoCacheItems: cacheStats.videoCacheStats.items,
            // 添加分类资源缓存命中统计
            imageCacheHits: hitTrackerStats.image.hits,
            imageCacheMisses: hitTrackerStats.image.misses,
            videoCacheHits: hitTrackerStats.video.hits,
            videoCacheMisses: hitTrackerStats.video.misses,
            templateCacheHits: hitTrackerStats.template.hits,
            templateCacheMisses: hitTrackerStats.template.misses,
            apiCacheHits: hitTrackerStats.api.hits,
            apiCacheMisses: hitTrackerStats.api.misses,
          }
          
          // 分类显示资源缓存统计
          console.log(`[TemplatePerformance] 📊 资源缓存统计:`)
          console.log(`  🖼️ 图片: 命中${hitTrackerStats.image.hits}次, 未命中${hitTrackerStats.image.misses}次, 命中率${hitTrackerStats.image.hitRate.toFixed(1)}%`)
          console.log(`  🎬 视频: 命中${hitTrackerStats.video.hits}次, 未命中${hitTrackerStats.video.misses}次, 命中率${hitTrackerStats.video.hitRate.toFixed(1)}%`)
          console.log(`  📋 模板: 命中${hitTrackerStats.template.hits}次, 未命中${hitTrackerStats.template.misses}次, 命中率${hitTrackerStats.template.hitRate.toFixed(1)}%`)
          console.log(`  🔗 API: 命中${hitTrackerStats.api.hits}次, 未命中${hitTrackerStats.api.misses}次, 命中率${hitTrackerStats.api.hitRate.toFixed(1)}%`)
          console.log(`  📊 总体: 命中${hitTrackerStats.overall.hits}次, 未命中${hitTrackerStats.overall.misses}次, 命中率${hitTrackerStats.overall.hitRate.toFixed(1)}%`)
          console.log(`  💾 缓存大小: ${(cacheStats.totalSize / 1024).toFixed(1)}KB`)
          console.log(`  🏪 localStorage: ${cacheStats.localStorageCache.prefixes.join(', ')}`)
          console.log(`  📱 IndexedDB: ${cacheStats.indexedDBCache.isAvailable ? '可用' : '不可用'}`)
          console.log(`  🔧 环境: ${cacheStats.environment}`)
          
          // 资源缓存效率诊断
          const totalResourceRequests = hitTrackerStats.overall.hits + hitTrackerStats.overall.misses
          const resourceEfficiency = totalResourceRequests > 0 ? (hitTrackerStats.overall.hits / totalResourceRequests * 100).toFixed(1) : '0'
          console.log(`[TemplatePerformance] 🔍 资源缓存效率诊断:`)
          console.log(`  - 资源缓存命中: ${hitTrackerStats.overall.hits}`)
          console.log(`  - 资源缓存未命中: ${hitTrackerStats.overall.misses}`) 
          console.log(`  - 总资源请求: ${totalResourceRequests}`)
          console.log(`  - 资源缓存效率: ${resourceEfficiency}%`)
          
          return updatedMetrics
        })
      } catch (error) {
        console.warn('[TemplatePerformance] 多层缓存统计失败:', error)
        
        // 降级到快速概览模式
        try {
          const { cacheStatsService } = await import('@/utils/cacheStatsService')
          const quickStats = cacheStatsService.getQuickCacheOverview()
          
          setPerformanceMetrics(prev => ({
            ...prev,
            cacheSize: quickStats.estimatedSize,
            cacheHitCount: quickStats.estimatedItems
          }))
          
          console.log(`[TemplatePerformance] 💾 快速缓存统计: ${(quickStats.estimatedSize / 1024).toFixed(1)}KB, ${quickStats.cacheTypes.join(', ')}`)
        } catch (fallbackError) {
          console.error('[TemplatePerformance] 缓存统计完全失败:', fallbackError)
        }
      }
    }
    
    // 立即执行一次
    updateCacheStats()
    
    // 每10秒更新一次缓存统计
    const cacheStatsInterval = setInterval(updateCacheStats, 10000)
    
    return () => {
      clearInterval(cacheStatsInterval)
    }
  }, [templateLoadingState.fullReady])

  // 重构的URL同步机制 - 使用ref缓存避免循环依赖
  const urlSyncState = useRef({
    currentPage,
    pageSize, 
    sortBy,
    selectedTags: selectedTags.join(','),
    isMobile
  })
  
  // 更新状态缓存
  urlSyncState.current = {
    currentPage,
    pageSize,
    sortBy, 
    selectedTags: selectedTags.join(','),
    isMobile
  }

  useEffect(() => {
    // 只有在初始化完成且无错误时才同步URL
    if (!isInitialized || hasInitializationError) return
    
    // 清除之前的定时器
    if (urlSyncTimeoutRef.current) {
      clearTimeout(urlSyncTimeoutRef.current)
    }
    
    urlSyncTimeoutRef.current = setTimeout(() => {
      try {
        const state = urlSyncState.current
        
        // 构建新的URL参数
        const params = new URLSearchParams()
        if (state.currentPage > 1) params.set('page', state.currentPage.toString())
        
        // 移动端默认页面大小为6，桌面端为12
        const defaultPageSize = state.isMobile ? 6 : 12
        if (state.pageSize !== defaultPageSize) params.set('size', state.pageSize.toString())
        
        if (state.sortBy !== 'popular') params.set('sort', state.sortBy)
        if (state.selectedTags) params.set('tags', state.selectedTags)
        
        const newSearch = params.toString()
        const currentSearch = searchParams.toString()
        
        // 只有在URL真正变化时才更新
        if (newSearch !== currentSearch) {
          console.log('[TemplatesPage] 同步URL参数:', newSearch)
          setSearchParams(params, { replace: true })
        }
      } catch (error) {
        console.error('[TemplatesPage] URL同步错误:', error)
        dispatch({ type: 'SET_INITIALIZATION_ERROR', payload: true })
      }
    }, 800) // 增加防抖时间
    
    // 清理函数
    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current)
      }
    }
  }, [isInitialized, hasInitializationError, searchParams, setSearchParams]) // 大幅简化依赖数组

  // 简化的初始化逻辑 - 只在挂载时执行一次
  useEffect(() => {
    if (isInitialized) return // 防止重复初始化
    
    console.log('[TemplatesPage] 开始组件初始化')
    
    // 延迟初始化，确保所有同步任务完成
    initializationTimeoutRef.current = setTimeout(() => {
      try {
        // 移动端自动调整页面大小
        if (isMobile && pageSize === 12) {
          console.log('[TemplatesPage] 移动端调整页面大小 12 -> 6')
          dispatch({ type: 'BATCH_UPDATE', payload: { pageSize: 6 } })
        }
        
        // 标记初始化完成
        dispatch({ type: 'SET_INITIALIZED', payload: true })
        console.log('[TemplatesPage] 组件初始化完成')
        
      } catch (error) {
        console.error('[TemplatesPage] 初始化错误:', error)
        dispatch({ type: 'BATCH_UPDATE', payload: {
          hasInitializationError: true,
          isInitialized: true
        }})
      }
    }, 100) // 短暂延迟确保其他同步任务完成
    
    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current)
      }
    }
  }, [isInitialized, isMobile, pageSize]) // 依赖必要的状态

  // 先获取所有模板ID用于获取点赞数据
  const allTemplateIds = useMemo(() => 
    getTemplatesByTags(selectedTags).map(t => t.id), 
    [selectedTags]
  )
  
  // 🚀 渐进式加载：先获取可见模板的点赞数据 - 稍后基于排序后的结果计算
  // 先初始化一个空的点赞状态Map，避免循环依赖
  const [allLikeStatuses, setAllLikeStatuses] = useState<Map<string, any>>(new Map())

  // 根据标签筛选和排序的模板列表
  const filteredAndSortedTemplates = useMemo(() => {
    // 首先根据选中的标签筛选模板
    const filteredTemplates = getTemplatesByTags(selectedTags)
    
    // 记录模板筛选缓存使用情况
    if (selectedTags.length > 0) {
      cacheHitTracker.recordTemplateHit(`filter_${selectedTags.join('_')}`, 'filter_cache')
    } else {
      cacheHitTracker.recordTemplateHit('all_templates', 'memory')
    }
    
    // 本地化模板内容
    const localizedTemplates = filteredTemplates.map(template => localizeTemplate(template, i18n.language))
    
    // 然后排序
    switch (sortBy) {
      case 'latest':
        // 记录最新排序缓存使用
        cacheHitTracker.recordTemplateHit('sort_latest', 'sort_cache')
        
        // 按创建时间降序排序（最新的在前）
        return localizedTemplates.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        })
      
      case 'popular':
      default:
        // 🚀 渐进式排序：使用已有的点赞数据，缺失的使用默认值
        const hasAnyLikeData = allLikeStatuses.size > 0
        
        if (!hasAnyLikeData) {
          // 完全没有点赞数据时，按创建时间排序
          cacheHitTracker.recordTemplateMiss('sort_popular_loading')
          
          return localizedTemplates.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return dateB - dateA
          })
        }
        
        // 有部分点赞数据时，混合排序
        cacheHitTracker.recordTemplateHit('sort_popular_progressive', 'sort_cache')
        
        // 按点赞数降序排序，缺失数据使用默认值0
        return localizedTemplates.sort((a, b) => {
          const likeCountA = allLikeStatuses.get(a.id)?.like_count || 0
          const likeCountB = allLikeStatuses.get(b.id)?.like_count || 0
          
          // 如果点赞数相同，按创建时间排序作为次要排序
          if (likeCountB === likeCountA) {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return dateB - dateA
          }
          
          return likeCountB - likeCountA
        })
    }
  }, [selectedTags, sortBy, allLikeStatuses, i18n.language]) // 移除 isLikeDataLoaded 依赖，允许渐进式更新

  // 分页计算
  const totalItems = filteredAndSortedTemplates.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTemplates = filteredAndSortedTemplates.slice(startIndex, endIndex)

  // 🚀 修复：基于排序后的分页模板计算visibleTemplateIds，确保点赞数据与显示模板匹配
  const visibleTemplateIds = useMemo(() => 
    paginatedTemplates.map(t => t.id),
    [paginatedTemplates]
  )

  // 优先加载可见模板的点赞状态（渐进式加载策略）
  const {
    likeStatuses: visibleLikeStatuses,
    loading: likesLoading
  } = useTemplateLikes({
    templateIds: visibleTemplateIds, // 基于排序后的分页模板
    enableAutoRefresh: false,
    priority: 'high' // 添加优先级
  })

  // 🚀 将可见模板的点赞状态合并到全局状态中
  useEffect(() => {
    if (visibleLikeStatuses.size > 0) {
      setAllLikeStatuses(prev => {
        const newMap = new Map(prev)
        visibleLikeStatuses.forEach((status, templateId) => {
          newMap.set(templateId, status)
        })
        return newMap
      })
    }
  }, [visibleLikeStatuses])

  // 🚀 优化：判断可见区域的点赞数据是否已加载（不再等待所有数据）
  const isVisibleLikeDataLoaded = useMemo(() => {
    // 如果没有可见模版，认为已加载
    if (visibleTemplateIds.length === 0) return true
    
    // 如果正在加载，但没有任何缓存数据，认为未加载
    if (likesLoading && visibleLikeStatuses.size === 0) return false
    
    // 检查是否所有可见模版都有点赞状态数据（包括默认的0点赞）
    return visibleTemplateIds.every(templateId => 
      visibleLikeStatuses.has(templateId)
    )
  }, [visibleTemplateIds, likesLoading, visibleLikeStatuses])

  // 保留原有的全部数据加载状态（用于性能监控）
  const isLikeDataLoaded = useMemo(() => {
    return allTemplateIds.every(templateId => 
      allLikeStatuses.has(templateId)
    )
  }, [allTemplateIds, allLikeStatuses])

  // 📊 监控点赞数据加载性能 - 基于可见数据加载状态
  useEffect(() => {
    if (isVisibleLikeDataLoaded && !templateLoadingState.likesLoaded) {
      const likeDataLoadTime = performance.now() - performanceMetrics.pageLoadStart
      
      setPerformanceMetrics(prev => ({
        ...prev,
        likeDataLoadTime,
        networkRequestCount: prev.networkRequestCount + visibleTemplateIds.length
      }))
      
      setTemplateLoadingState(prev => ({ ...prev, likesLoaded: true }))
      
      console.log(`[TemplatePerformance] 👍 点赞数据加载: ${likeDataLoadTime.toFixed(1)}ms`)
    }
  }, [isVisibleLikeDataLoaded, templateLoadingState.likesLoaded, visibleTemplateIds.length, performanceMetrics.pageLoadStart])

  // 📊 监控模板数据加载性能 - 必须在 filteredAndSortedTemplates 定义之后
  useEffect(() => {
    if (filteredAndSortedTemplates.length > 0 && !templateLoadingState.templatesLoaded) {
      const templateLoadTime = performance.now() - performanceMetrics.pageLoadStart
      
      setPerformanceMetrics(prev => ({
        ...prev,
        templateLoadTime,
        templateCount: filteredAndSortedTemplates.length
      }))
      
      setTemplateLoadingState(prev => ({ ...prev, templatesLoaded: true }))
      
      console.log(`[TemplatePerformance] 📋 模板数据加载: ${templateLoadTime.toFixed(1)}ms (${filteredAndSortedTemplates.length}个模板)`)
    }
  }, [filteredAndSortedTemplates.length, templateLoadingState.templatesLoaded, performanceMetrics.pageLoadStart])
  
  // 使用之前获取的所有点赞状态数据
  const getLikeStatus = useCallback((templateId: string) => {
    return allLikeStatuses.get(templateId)
  }, [allLikeStatuses])
  
  const updateStatus = useCallback((templateId: string, status: any) => {
    // 这里可以添加更新逻辑，暂时留空
    console.log('更新点赞状态:', templateId, status)
  }, [])
  
  // 避免未使用变量警告
  void likesLoading

  // 支持热更新
  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(
        '@/features/video-creator/data/templates/index',
        (newModule) => {
          if (newModule) {
            console.log('Templates hot reloaded!')
            setTemplates(newModule.templateList || [])
          }
        }
      )
    }
  }, [])

  // 监听滚动事件，显示/隐藏返回顶部按钮 - 使用防抖和状态检查
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    let lastShowBackToTop = showBackToTop

    const handleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      timeoutId = setTimeout(() => {
        // 只有当状态真正改变时才dispatch
        const shouldShow = window.scrollY > 300
        if (shouldShow !== lastShowBackToTop) {
          lastShowBackToTop = shouldShow
          dispatch({ type: 'SET_SHOW_BACK_TO_TOP', payload: shouldShow })
        }
      }, 100) // 100ms防抖
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [showBackToTop])

  // 移除了不再需要的 refreshTemplates 函数

  // 返回顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }


  // 页面边界检查 - 仅在初始化完成后执行
  useEffect(() => {
    if (!isInitialized || hasInitializationError) return
    
    // 安全的页面边界检查，避免循环
    if (currentPage > totalPages && totalPages > 0) {
      console.log(`[TemplatesPage] 页面边界检查: ${currentPage} > ${totalPages}，重置到第1页`)
      dispatch({ type: 'SET_PAGE', payload: 1 })
    }
  }, [isInitialized, hasInitializationError, totalPages]) // 故意不包含currentPage避免循环

  // 简化的错误恢复机制
  useEffect(() => {
    if (!hasInitializationError) return
    
    console.warn('[TemplatesPage] 错误恢复启动')
    errorRecoveryCountRef.current++
    
    if (errorRecoveryCountRef.current > 3) {
      console.error('[TemplatesPage] 错误恢复失败，超过最大重试次数')
      return
    }
    
    const recoveryTimeout = setTimeout(() => {
      console.log('[TemplatesPage] 尝试错误恢复')
      dispatch({ type: 'RESET_TO_DEFAULTS' })
    }, 2000)
    
    return () => clearTimeout(recoveryTimeout)
  }, [hasInitializationError])
  
  // 现在使用 useReducer 的内置批量更新机制
  
  // 分页处理函数
  const handlePageChange = useCallback((page: number) => {
    if (!isInitialized || hasInitializationError) {
      console.warn('[TemplatesPage] 组件未完全初始化，跳过页面切换')
      return
    }
    
    // 📊 性能监控：分页响应时间
    const startTime = performance.now()
    
    dispatch({ type: 'SET_PAGE', payload: page })
    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // 记录分页性能
    const endTime = performance.now()
    const responseTime = endTime - startTime
    setPerformanceMetrics(prev => ({
      ...prev,
      paginationResponseTime: responseTime
    }))
    
    // 跟踪分页使用
    trackEvent({
      action: 'pagination_click',
      category: 'user_navigation',
      label: `page_${page}`,
      custom_parameters: {
        total_pages: totalPages,
        page_size: pageSize,
        sort_by: sortBy,
        response_time: responseTime
      }
    })
  }, [isInitialized, hasInitializationError, totalPages, pageSize, sortBy, trackEvent, dispatch])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    if (!isInitialized || hasInitializationError) {
      console.warn('[TemplatesPage] 组件未完全初始化，跳过页面大小切换')
      return
    }
    
    // 计算新页码，保持当前查看的大致位置
    const currentFirstIndex = (currentPage - 1) * pageSize
    const newPage = Math.floor(currentFirstIndex / newPageSize) + 1
    
    // 使用批量更新
    dispatch({ type: 'BATCH_UPDATE', payload: {
      pageSize: newPageSize,
      currentPage: newPage
    }})
    
    // 跟踪页面大小切换
    trackEvent({
      action: 'page_size_change',
      category: 'user_preference',
      label: `size_${newPageSize}`,
      custom_parameters: {
        old_page_size: pageSize,
        new_page_size: newPageSize,
        total_items: totalItems
      }
    })
  }, [isInitialized, hasInitializationError, currentPage, pageSize, totalItems, trackEvent, dispatch])

  const handleSortChange = useCallback((newSort: SortOption) => {
    if (!isInitialized || hasInitializationError) {
      console.warn('[TemplatesPage] 组件未完全初始化，跳过排序切换')
      return
    }
    
    // 📊 性能监控：排序响应时间
    const startTime = performance.now()
    
    // 使用批量更新
    dispatch({ type: 'BATCH_UPDATE', payload: {
      sortBy: newSort,
      currentPage: 1 // 切换排序时回到第一页
    }})
    
    // 记录排序性能和筛选性能
    const endTime = performance.now()
    const responseTime = endTime - startTime
    setPerformanceMetrics(prev => ({
      ...prev,
      sortResponseTime: responseTime,
      filterResponseTime: Math.max(prev.filterResponseTime, responseTime) // 更新筛选性能
    }))
    
    trackFilter('sort', newSort)
    
    console.log(`[TemplatePerformance] 🔄 排序切换响应时间: ${responseTime.toFixed(1)}ms`)
  }, [isInitialized, hasInitializationError, trackFilter, dispatch])

  const handleTagClick = useCallback((tag: string) => {
    if (!isInitialized || hasInitializationError) {
      console.warn('[TemplatesPage] 组件未完全初始化，跳过标签切换')
      return
    }
    
    // 📊 性能监控：标签点击响应时间
    const startTime = performance.now()
    
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag) // 取消选中
      : [...selectedTags, tag] // 添加选中
    
    // 使用批量更新
    dispatch({ type: 'BATCH_UPDATE', payload: {
      selectedTags: newSelectedTags,
      currentPage: 1 // 切换标签时回到第一页
    }})
    
    // 记录标签点击性能和筛选性能
    const endTime = performance.now()
    const responseTime = endTime - startTime
    setPerformanceMetrics(prev => ({
      ...prev,
      tagClickResponseTime: responseTime,
      filterResponseTime: Math.max(prev.filterResponseTime, responseTime) // 更新筛选性能
    }))
    
    // 跟踪标签筛选事件
    trackEvent({
      action: 'tag_filter',
      category: 'user_navigation',
      label: tag,
      custom_parameters: {
        selected_tags: newSelectedTags,
        filter_action: selectedTags.includes(tag) ? 'remove' : 'add',
        response_time: responseTime
      }
    })
    
    console.log(`[TemplatePerformance] 🏷️ 标签点击响应时间: ${responseTime.toFixed(1)}ms`)
  }, [isInitialized, hasInitializationError, selectedTags, trackEvent, dispatch])

  // 使用useCallback优化回调函数，避免TemplateCard不必要的重渲染
  const handleUseTemplate = useCallback((url: string) => {
    navigate(url)
  }, [navigate])

  const handleLikeChange = useCallback((id: string, status: any) => {
    updateStatus(id, status)
  }, [updateStatus])

  const handleGetLikeStatus = useCallback((id: string) => {
    return getLikeStatus(id)
  }, [getLikeStatus])

  // 简化的清理函数
  useEffect(() => {
    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current)
      }
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current)
      }
    }
  }, [])
  
  // 渲染错误恢复界面
  if (hasInitializationError && errorRecoveryCountRef.current > 3) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">页面加载遇到问题</h2>
          <p className="text-gray-600 mb-4">模板页面正在自动恢复中，请稍候...</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            刷新页面
          </button>
        </div>
      </div>
    )
  }
  
  // 渲染加载状态
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p className="text-gray-600">正在加载模板列表...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 标签筛选区域 */}
      <div className="space-y-3">
        {/* 移动端：排序选择器独占一行，桌面端：与第一排标签同行 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          {/* 排序选择器 - 移动端在上方独占一行 */}
          <div className="order-1 md:order-2 flex justify-end">
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full max-w-[180px] md:w-[180px] flex-shrink-0">
                <SelectValue placeholder={t('template.sortBy.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <TrendingUp className="h-4 w-4" />
                    {t('template.sortBy.popular')}
                  </span>
                </SelectItem>
                <SelectItem value="latest">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <Sparkles className="h-4 w-4" />
                    {t('template.sortBy.latest')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 第一排标签 - 移动端在下方占满宽度 */}
          <div className="order-2 md:order-1 flex flex-wrap gap-1.5 md:gap-2 flex-1 md:flex-none">
            {popularTags.slice(0, 6).map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "secondary"}
                className={`cursor-pointer transition-all duration-200 hover:scale-105 text-xs md:text-sm px-2 md:px-3 py-1 ${
                  selectedTags.includes(tag) 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'hover:bg-primary/10 hover:border-primary/20'
                }`}
                onClick={() => handleTagClick(tag)}
              >
                <Hash className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* 第二排标签 - 紧凑布局 */}
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {popularTags.slice(6, 16).map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "secondary"}
              className={`cursor-pointer transition-all duration-200 hover:scale-105 text-xs md:text-sm px-2 md:px-3 py-1 ${
                selectedTags.includes(tag) 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-primary/10 hover:border-primary/20'
              }`}
              onClick={() => handleTagClick(tag)}
            >
              <Hash className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
        
        {/* 筛选结果提示 */}
        {selectedTags.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('template.filterConditions')}</span>
            {selectedTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
                <button
                  onClick={() => handleTagClick(tag)}
                  className="ml-1 hover:text-destructive"
                  aria-label={t('template.removeTagAria', { tag })}
                >
                  ×
                </button>
              </Badge>
            ))}
            <span className="text-primary font-medium">
              {t('template.countDisplay', { count: totalItems })}
            </span>
          </div>
        )}
      </div>

      {/* 模版网格或骨架屏 */}
      {sortBy === 'popular' && !isVisibleLikeDataLoaded ? (
        <TemplatesSkeleton 
          count={pageSize} 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {paginatedTemplates.map((template: any, index: number) => (
            <TemplateCard 
              key={template.id}
              template={template}
              index={index}
              onUseTemplate={handleUseTemplate}
              onLikeChange={handleLikeChange}
              getLikeStatus={handleGetLikeStatus}
              trackTemplateView={trackTemplateView}
              trackEvent={trackEvent}
            />
          ))}
        </div>
      )}

      {/* 分页组件 - 只在数据加载完成且有多页时显示 */}
      {totalPages > 1 && !(sortBy === 'popular' && !isVisibleLikeDataLoaded) && (
        <div className="flex justify-center mt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            showPageSizeSelector={false}
            pageSizeOptions={[9, 12, 18, 24]}
            showInfo={false}
          />
        </div>
      )}

      {/* 返回顶部按钮 */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 rounded-full shadow-lg"
          size="icon"
          variant="default"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}

      {/* 📊 性能监控面板 - 开发环境显示 */}
      {import.meta.env.DEV && (
        <>
          <TemplatePerformanceStats
            metrics={performanceMetrics}
            isMobile={isMobile}
            loadingState={templateLoadingState}
            filterStats={{
              selectedTags,
              sortBy,
              currentPage,
              totalPages
            }}
          />
        </>
      )}
    </div>
  )
}

// 优化的模版卡片组件，使用React.memo减少重渲染
const TemplateCard = memo(({ 
  template, 
  index, 
  onUseTemplate, 
  onLikeChange, 
  getLikeStatus, 
  trackTemplateView, 
  trackEvent 
}: {
  template: any
  index: number
  onUseTemplate: (url: string) => void
  onLikeChange: (id: string, status: any) => void
  getLikeStatus: (id: string) => any
  trackTemplateView: (id: string, category: string) => void
  trackEvent: (event: any) => void
}) => {
  const { t } = useTranslation()
  
  // 检测移动端，禁用autoPlayOnHover以节省资源
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  const handleUseTemplate = () => {
    // 跟踪模板使用事件
    trackTemplateView(template.id, template.category)
    trackEvent({
      action: 'template_use_click',
      category: 'product_usage',
      label: template.id,
      custom_parameters: {
        template_name: template.name,
        template_category: template.category,
        credit_cost: template.credits
      }
    })
    onUseTemplate(`/create?template=${template.slug}`)
  }

  const likeStatus = getLikeStatus(template.id)
  const likeCount = likeStatus?.like_count ?? 0
  const isLiked = likeStatus?.is_liked ?? false

  return (
    <Card className="overflow-hidden shadow-md flex flex-col">
      <div className="aspect-video bg-muted relative group">
        {template.previewUrl ? (
          <div className="relative w-full h-full">
            {/* 缓存的缩略图作为背景 */}
            {template.thumbnailUrl && (
              <CachedImage 
                src={template.thumbnailUrl}
                alt={template.name}
                className="absolute inset-0 w-full h-full object-cover"
                cacheKey={`template_${template.id}`}
                maxAge={24 * 60 * 60 * 1000} // 24小时缓存
              />
            )}
            {/* 视频播放器在上层 */}
            <SimpleVideoPlayer
              src={template.previewUrl}
              poster={template.thumbnailUrl}
              className="relative z-10 w-full h-full"
              objectFit="cover"
              showPlayButton={true}
              autoPlayOnHover={!isMobile} // 移动端禁用自动播放
              muted={false} // 默认有声音播放
              alt={template.name}
              videoId={template.id}
              videoTitle={template.name}
              onPlay={() => {
                // 跟踪视频播放事件
                trackEvent({
                  action: 'template_video_play',
                  category: 'user_engagement',
                  label: template.id,
                  custom_parameters: {
                    template_name: template.name,
                    template_category: template.category || 'unknown'
                  }
                })
              }}
            />
          </div>
        ) : template.thumbnailUrl ? (
          <CachedImage 
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover"
            cacheKey={`template_${template.id}`}
            maxAge={24 * 60 * 60 * 1000} // 24小时缓存
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Play className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm font-medium">{template.name}</p>
              <p className="text-xs opacity-70 mt-1">{template.icon} {template.description}</p>
            </div>
          </div>
        )}
        
        {/* 生成按钮（底部中间，移动端始终显示，桌面端悬停显示） */}
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-20">
          <Button 
            variant="outline"
            size="sm"
            className="bg-black/20 border-white/40 text-white hover:text-white hover:bg-gradient-to-r hover:from-blue-500/30 hover:to-purple-500/30 hover:border-white/60 hover:scale-105 backdrop-blur-md transition-all duration-300 text-xs font-semibold px-4 py-2 shadow-xl [&:hover]:text-white"
            onClick={handleUseTemplate}
            style={{
              textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.5), 0 0 24px rgba(0,0,0,0.3)',
              color: 'white'
            }}
          >
            <Video className="h-3.5 w-3.5 mr-1.5 drop-shadow-lg text-white" />
            <span className="drop-shadow-lg text-white">{t('template.generate')}</span>
          </Button>
        </div>
        
        {/* 可交互的点赞区域（左上角） */}
        <div className="absolute top-2 left-2 z-10">
          <LikeCounterButton
            templateId={template.id}
            initialLikeCount={likeCount}
            initialIsLiked={isLiked}
            size="sm"
            variant="default"
            showIcon={true}
            animated={true}
            dataLoading={!likeStatus} // 🚀 点赞数据加载中状态
            skeleton={false} // 不使用完整骨架屏，使用dataLoading状态
            onLikeChange={(liked, count) => {
              onLikeChange(template.id, { is_liked: liked, like_count: count })
            }}
          />
        </div>
      </div>
      <CardContent className="flex-1 flex flex-col justify-between p-4">
        <div className="space-y-3">
          {/* 描述信息 */}
          <p className="text-xs text-muted-foreground line-clamp-3">
            {template.description}
          </p>
          
          {/* 标签 */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded-sm"
                >
                  <Hash className="h-2 w-2" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})