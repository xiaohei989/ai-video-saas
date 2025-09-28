import { useState, useEffect, useMemo, useCallback, memo, useRef, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Play, Hash, TrendingUp, Sparkles, ArrowUp, Video } from 'lucide-react'
import { templateList as initialTemplates, getPopularTags, getTemplatesByTags, localizeTemplate } from '@/features/video-creator/data/templates/index'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'
import LikeCounterButton from '@/components/templates/LikeCounterButton'
import Pagination from '@/components/ui/pagination'
import CachedImage from '@/components/ui/CachedImage'
import { useTemplateLikes } from '@/hooks/useTemplateLikes'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'
import { likesCacheService } from '@/services/likesCacheService'
import { templateLikeService } from '@/services/templateLikeService'
// 移除了复杂的性能监控组件
type TemplateLoadingState = {
  templatesLoaded: boolean
  likesLoaded: boolean
  assetsLoaded: boolean
  fullReady: boolean
  cacheUpdateTrigger: number // 🚀 添加缓存更新触发器
}
// 移除了缓存命中追踪器

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
  
  // 🚀 新增：性能监控状态
  performanceMetrics: {
    pageLoadStart: number
    templateCount: number
  }
  
  // 🚀 新增：模板加载状态
  templateLoadingState: TemplateLoadingState
  
  // 🚀 新增：热门排序状态
  popularSortedTemplates: any[]
  isPopularSortLoading: boolean
  popularSortError: string | null
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
  // 🚀 新增：性能监控Action
  | { type: 'SET_PERFORMANCE_METRICS'; payload: { pageLoadStart: number; templateCount: number } }
  // 🚀 新增：模板加载状态Action
  | { type: 'SET_TEMPLATE_LOADING_STATE'; payload: Partial<TemplateLoadingState> }
  // 🚀 新增：热门排序Action
  | { type: 'SET_POPULAR_SORTED_TEMPLATES'; payload: any[] }
  | { type: 'SET_POPULAR_SORT_LOADING'; payload: boolean }
  | { type: 'SET_POPULAR_SORT_ERROR'; payload: string | null }

// 循环检测和熔断机制
const MAX_UPDATES_PER_SECOND = 5
const UPDATE_WINDOW_MS = 1000

// Reducer 函数 - 统一状态管理，内置循环检测
function templatesReducer(state: TemplatesState, action: TemplatesAction): TemplatesState {
  const now = Date.now()
  
  // 🚀 移除了无意义的状态跟踪更新，避免每个action都创建新state引用
  
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
      
    // 🚀 新增：性能监控Action处理
    case 'SET_PERFORMANCE_METRICS':
      return { ...state, performanceMetrics: action.payload }
      
    // 🚀 新增：模板加载状态Action处理
    case 'SET_TEMPLATE_LOADING_STATE':
      return { 
        ...state, 
        templateLoadingState: { ...state.templateLoadingState, ...action.payload }
      }
      
    // 🚀 新增：热门排序Action处理
    case 'SET_POPULAR_SORTED_TEMPLATES':
      return { ...state, popularSortedTemplates: action.payload }
      
    case 'SET_POPULAR_SORT_LOADING':
      return { ...state, isPopularSortLoading: action.payload }
      
    case 'SET_POPULAR_SORT_ERROR':
      return { ...state, popularSortError: action.payload }
      
    default:
      return state
  }
}

export default function TemplatesPage() {
  // 🔍 关键调试日志
  console.log('🚀 [TemplatesPage] 组件初始化')

  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { trackTemplateView, trackEvent, trackFilter } = useAnalytics()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // hooks初始化完成
  
  // 创建初始状态 - 从URL参数初始化
  const createInitialState = (): TemplatesState => {
    // 解析URL参数
    
    const page = searchParams.get('page')
    const size = searchParams.get('size')
    const sort = searchParams.get('sort') as SortOption
    const tags = searchParams.get('tags')
    
    const initialState = {
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
      templates: initialTemplates,
      
      // 🚀 新增：性能监控状态初始值
      performanceMetrics: {
        pageLoadStart: performance.now(),
        templateCount: 0
      },
      
      // 🚀 新增：模板加载状态初始值
      templateLoadingState: {
        templatesLoaded: false,
        likesLoaded: false,
        assetsLoaded: false,
        fullReady: false,
        cacheUpdateTrigger: 0
      },
      
      // 🚀 新增：热门排序状态初始值
      popularSortedTemplates: [],
      isPopularSortLoading: false,
      popularSortError: null
    }
    
    // 初始状态创建完成
    
    return initialState
  }
  
  // 使用 useReducer 统一管理所有状态
  const [state, dispatch] = useReducer(templatesReducer, null, createInitialState)
  
  // 状态管理器初始化完成
  
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
    templates,
    // 🚀 新增：解构新的状态字段
    performanceMetrics,
    templateLoadingState,
    popularSortedTemplates,
    isPopularSortLoading,
    popularSortError
  } = state
  
  // 🔍 调试日志：状态解构完成
  console.log('🧩 [TemplatesPage] 状态解构完成', {
    currentPage,
    pageSize,
    sortBy,
    selectedTagsCount: selectedTags.length,
    isInitialized,
    templatesCount: templates.length
  })
  
  // 简化的ref管理 - 只保留必要的定时器
  const urlSyncTimeoutRef = useRef<NodeJS.Timeout>()
  const errorRecoveryCountRef = useRef(0)
  
  // 🚀 优化：使用useMemo缓存热门标签计算，避免每次渲染都重新获取
  const popularTags = useMemo(() => getPopularTags(16), [])

  // SEO优化
  useSEO('templates')
  
  // 🚀 性能监控状态和模板加载状态现在由useReducer管理 - 移除了重复的useState
  
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




  // 🚀 优化：合并资源加载监控，减少useEffect数量和依赖
  useEffect(() => {
    const { templatesLoaded, likesLoaded, assetsLoaded, fullReady } = templateLoadingState
    
    // 检查是否需要标记资源已加载
    if (templatesLoaded && likesLoaded && !assetsLoaded) {
      dispatch({ type: 'SET_TEMPLATE_LOADING_STATE', payload: { assetsLoaded: true } })
      return // 避免在同一次渲染中多次dispatch
    }
    
    // 检查是否需要标记完全准备就绪
    if (assetsLoaded && !fullReady) {
      dispatch({ type: 'SET_TEMPLATE_LOADING_STATE', payload: { fullReady: true } })
    }
  }, [templateLoadingState]) // 🚀 只依赖整个状态对象，让React自动处理浅比较

  // 简化后移除了缓存使用监控

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
    // 移除初始化检查，只保留严重错误检查
    if (hasInitializationError && errorRecoveryCountRef.current > 3) return
    
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
  }, [hasInitializationError, searchParams, setSearchParams]) // 移除初始化依赖

  // 🚀 优化：同步初始化逻辑 - 移除延迟，立即执行
  useEffect(() => {
    // 初始化useEffect触发
    
    if (isInitialized) {
      // 已初始化，跳过重复初始化
      return // 防止重复初始化
    }
    
    // 🚀 关键修复：立即同步执行初始化，移除100ms延迟
    try {
      // 执行初始化逻辑
      
      // 移动端自动调整页面大小
      if (isMobile && pageSize === 12) {
        // 移动端调整页面大小
        dispatch({ type: 'BATCH_UPDATE', payload: { pageSize: 6 } })
      }
      
      // 标记初始化完成
      dispatch({ type: 'SET_INITIALIZED', payload: true })
      
      // 初始化逻辑执行完成
      console.log('✅ [TemplatesPage] 同步初始化完成')
      
    } catch (error) {
      console.error('❌ [TemplatesPage] 初始化错误:', error)
      dispatch({ type: 'BATCH_UPDATE', payload: {
        hasInitializationError: true,
        isInitialized: true
      }})
    }
  }, [isInitialized, isMobile, pageSize]) // 依赖必要的状态

  // 移除了allLikeStatuses，不再需要实时维护全局点赞状态

  // 🚀 筛选和本地化模板（独立于排序逻辑）
  const filteredAndLocalizedTemplates = useMemo(() => {
    const filteredTemplates = getTemplatesByTags(selectedTags)
    const localizedTemplates = filteredTemplates.map(template => localizeTemplate(template, i18n.language))
    return localizedTemplates
  }, [selectedTags, i18n.language])

  // 🚀 时间排序（完全独立，不依赖点赞数据）
  const timeBasedSortedTemplates = useMemo(() => {
    return [...filteredAndLocalizedTemplates].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    })
  }, [filteredAndLocalizedTemplates])

  // 🚀 热门排序状态现在由useReducer管理 - 移除了重复的useState

  // 🚀 根据排序方式选择最终的模板列表
  const filteredAndSortedTemplates = useMemo(() => {
    switch (sortBy) {
      case 'latest':
        return timeBasedSortedTemplates
      case 'popular':
        // 如果有热门排序结果就用，否则降级为时间排序
        return popularSortedTemplates.length > 0 ? popularSortedTemplates : timeBasedSortedTemplates
      default:
        return timeBasedSortedTemplates
    }
  }, [sortBy, timeBasedSortedTemplates, popularSortedTemplates])

  // 🚀 热门排序的按需获取逻辑（仅在用户切换到热门排序时触发）
  useEffect(() => {
    const shouldLoadPopularData = sortBy === 'popular' && popularSortedTemplates.length === 0 && !isPopularSortLoading

    if (shouldLoadPopularData) {
      dispatch({ type: 'SET_POPULAR_SORT_LOADING', payload: true })
      dispatch({ type: 'SET_POPULAR_SORT_ERROR', payload: null })
      
      // 获取所有模板ID用于获取点赞数据
      const allTemplateIds = timeBasedSortedTemplates.map(t => t.id)
      
      console.log('🔥 [TemplatesPage] 开始获取热门排序数据', {
        templateCount: allTemplateIds.length,
        reason: '用户切换到热门排序'
      })

      // 使用templateLikeService获取所有模板的点赞数据
      import('@/services/templateLikeService').then(({ templateLikeService }) => {
        return templateLikeService.checkMultipleLikeStatus(allTemplateIds)
      }).then(likeStatusArray => {
        // 将数组转换为Map格式
        const likeStatusMap = new Map()
        likeStatusArray.forEach(status => {
          likeStatusMap.set(status.template_id, status)
        })
        // 根据点赞数据对模板进行排序
        const sortedTemplates = [...timeBasedSortedTemplates].sort((a, b) => {
          const likeCountA = likeStatusMap.get(a.id)?.like_count || 0
          const likeCountB = likeStatusMap.get(b.id)?.like_count || 0
          
          if (likeCountB === likeCountA) {
            // 点赞数相同时按时间排序
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return dateB - dateA
          }
          
          return likeCountB - likeCountA
        })
        
        dispatch({ type: 'SET_POPULAR_SORTED_TEMPLATES', payload: sortedTemplates })
        dispatch({ type: 'SET_POPULAR_SORT_LOADING', payload: false })
        
        // 🚀 将点赞数据同步到单个模板缓存，让所有排序模式都能显示点赞数
        try {
          likeStatusArray.forEach(status => {
            likesCacheService.set(status.template_id, {
              template_id: status.template_id,
              is_liked: status.is_liked,
              like_count: status.like_count
            })
          })
          console.log('📦 [TemplatesPage] 点赞数据已同步到缓存', {
            syncedCount: likeStatusArray.length
          })
        } catch (error) {
          console.warn('缓存同步失败:', error)
        }
        
        console.log('✅ [TemplatesPage] 热门排序数据获取完成', {
          sortedCount: sortedTemplates.length,
          topTemplate: sortedTemplates[0]?.title,
          topLikes: likeStatusMap.get(sortedTemplates[0]?.id)?.like_count || 0
        })
      }).catch(error => {
        console.error('❌ [TemplatesPage] 热门排序数据获取失败:', error)
        dispatch({ type: 'SET_POPULAR_SORT_ERROR', payload: '获取热门数据失败' })
        dispatch({ type: 'SET_POPULAR_SORT_LOADING', payload: false })
      })
    }
  }, [sortBy, popularSortedTemplates.length, isPopularSortLoading, timeBasedSortedTemplates])

  // 🚀 优化：使用useMemo缓存分页计算，避免每次渲染都重新计算
  const paginationData = useMemo(() => {
    const totalItems = filteredAndSortedTemplates.length
    const totalPages = Math.ceil(totalItems / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedTemplates = filteredAndSortedTemplates.slice(startIndex, endIndex)
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      paginatedTemplates
    }
  }, [filteredAndSortedTemplates, pageSize, currentPage])
  
  // 解构分页数据
  const { totalItems, totalPages, paginatedTemplates } = paginationData

  // 🚀 移除了实时点赞数据获取，改为按需获取（仅热门排序时）

  // 🚀 渐进式加载：总是显示模板卡片，让每个卡片独立处理图片加载
  // 移除阻塞性的数据准备检查，实现真正的渐进式显示
  const isDataReady = true // 始终允许显示卡片
  
  // 热门排序的加载状态仅用于显示加载指示器，不阻塞内容渲染
  const isLoadingPopularData = sortBy === 'popular' && isPopularSortLoading

  // 🚀 优化：移除performanceMetrics循环依赖，避免无限重渲染
  useEffect(() => {
    if (filteredAndSortedTemplates.length > 0 && !templateLoadingState.templatesLoaded) {
      dispatch({ type: 'SET_TEMPLATE_LOADING_STATE', payload: { templatesLoaded: true } })
      // 🚀 使用函数式更新避免依赖performanceMetrics
      dispatch({ 
        type: 'SET_PERFORMANCE_METRICS', 
        payload: {
          pageLoadStart: performanceMetrics.pageLoadStart, // 保留原始值
          templateCount: filteredAndSortedTemplates.length
        }
      })
    }
  }, [filteredAndSortedTemplates.length, templateLoadingState.templatesLoaded]) // 🚀 移除performanceMetrics依赖
  
  // 🚀 从缓存获取点赞状态（不会导致死循环，只读取已缓存数据）
  const getLikeStatus = useCallback((templateId: string) => {
    // 导入缓存服务并获取数据，只读取已缓存的数据，不触发新请求
    // cacheUpdateTrigger 确保缓存更新时组件重新渲染
    try {
      return likesCacheService.get(templateId)
    } catch (error) {
      // 如果缓存服务不可用，返回undefined
      return undefined
    }
  }, [templateLoadingState.cacheUpdateTrigger])
  
  // 🚀 为默认的时间排序初始化点赞数据
  useEffect(() => {
    // 移除初始化检查，只在非热门排序且有模板时执行
    if (sortBy === 'popular' || filteredAndSortedTemplates.length === 0) {
      return
    }
    
    // 获取当前页面显示的模板ID
    const currentPageTemplates = filteredAndSortedTemplates.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    )
    
    // 检查是否有模板缺少点赞数据
    const templatesNeedingLikes = currentPageTemplates.filter(template => {
      const likeStatus = likesCacheService.get(template.id)
      return !likeStatus
    })
    
    // 如果有模板需要点赞数据，则获取
    if (templatesNeedingLikes.length > 0) {
      console.log('🔄 [TemplatesPage] 为当前页面获取点赞数据', {
        totalTemplates: currentPageTemplates.length,
        needingLikes: templatesNeedingLikes.length,
        page: currentPage
      })
      
      // 异步获取点赞数据
      templateLikeService.checkMultipleLikeStatus(templatesNeedingLikes.map(t => t.id))
        .then(likeStatusArray => {
          // 同步到缓存
          likeStatusArray.forEach(status => {
            likesCacheService.set(status.template_id, {
              template_id: status.template_id,
              is_liked: status.is_liked,
              like_count: status.like_count
            })
          })
          
          console.log('✅ [TemplatesPage] 当前页面点赞数据获取完成', {
            loadedCount: likeStatusArray.length
          })
          
          // 触发重新渲染以显示点赞数
          // 通过更新一个状态来强制组件重新渲染
          dispatch({ type: 'SET_TEMPLATE_LOADING_STATE', payload: { likesLoaded: true } })
        })
        .catch(error => {
          console.warn('❌ [TemplatesPage] 获取当前页面点赞数据失败:', error)
        })
    }
  }, [sortBy, filteredAndSortedTemplates.length, currentPage, pageSize]) // 🚀 只依赖模板数量而不是整个数组，减少重渲染
  
  const updateStatus = useCallback((_templateId: string, _status: any) => {
    // 占位函数，暂不实现
  }, [])

  // 🚀 优化：使用useMemo计算当前页面模板ID，避免因排序变化而重新设置监听器
  const currentPageTemplateIds = useMemo(() => {
    const currentPageTemplates = filteredAndSortedTemplates.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    )
    return currentPageTemplates.map(template => template.id)
  }, [filteredAndSortedTemplates, currentPage, pageSize])

  // 🚀 监听缓存更新，触发组件重新渲染
  useEffect(() => {
    // 为当前页面的所有模板添加缓存更新监听器
    const unsubscribeFunctions: (() => void)[] = []
    
    currentPageTemplateIds.forEach(templateId => {
      const unsubscribe = likesCacheService.subscribe(templateId, (updatedStatus) => {
        // 触发重新渲染
        dispatch({ 
          type: 'SET_TEMPLATE_LOADING_STATE', 
          payload: { 
            cacheUpdateTrigger: templateLoadingState.cacheUpdateTrigger + 1 
          } 
        })
      })
      unsubscribeFunctions.push(unsubscribe)
    })
    
    // 清理函数
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    }
  }, [currentPageTemplateIds]) // 🚀 只依赖模板ID数组，避免因模板对象变化而重新设置监听器

  // 支持热更新
  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(
        '@/features/video-creator/data/templates/index',
        (newModule) => {
          if (newModule) {
            dispatch({ type: 'SET_TEMPLATES', payload: newModule.templateList || [] })
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


  // 页面边界检查 - 移除初始化依赖，但保留严重错误检查
  useEffect(() => {
    if (hasInitializationError && errorRecoveryCountRef.current > 3) return
    
    // 安全的页面边界检查，避免循环
    if (currentPage > totalPages && totalPages > 0) {
      dispatch({ type: 'SET_PAGE', payload: 1 })
    }
  }, [hasInitializationError, totalPages]) // 故意不包含currentPage避免循环

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
      dispatch({ type: 'RESET_TO_DEFAULTS' })
    }, 2000)
    
    return () => clearTimeout(recoveryTimeout)
  }, [hasInitializationError])
  
  // 现在使用 useReducer 的内置批量更新机制
  
  // 分页处理函数
  const handlePageChange = useCallback((page: number) => {
    // 移除初始化检查，只保留严重错误检查
    if (hasInitializationError && errorRecoveryCountRef.current > 3) {
      console.warn('[TemplatesPage] 严重错误状态，跳过页面切换')
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
    dispatch({ 
      type: 'SET_PERFORMANCE_METRICS', 
      payload: {
        ...performanceMetrics,
        paginationResponseTime: responseTime
      }
    })
    
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
  }, [hasInitializationError, totalPages, pageSize, sortBy, trackEvent, dispatch])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    // 移除初始化检查，只保留严重错误检查
    if (hasInitializationError && errorRecoveryCountRef.current > 3) {
      console.warn('[TemplatesPage] 严重错误状态，跳过页面大小切换')
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
  }, [hasInitializationError, currentPage, pageSize, totalItems, trackEvent, dispatch])

  const handleSortChange = useCallback((newSort: SortOption) => {
    // 移除初始化检查，只保留严重错误检查
    if (hasInitializationError && errorRecoveryCountRef.current > 3) {
      console.warn('[TemplatesPage] 严重错误状态，跳过排序切换')
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
    dispatch({ 
      type: 'SET_PERFORMANCE_METRICS', 
      payload: {
        ...performanceMetrics,
        sortResponseTime: responseTime,
        filterResponseTime: Math.max(performanceMetrics.filterResponseTime || 0, responseTime) // 更新筛选性能
      }
    })
    
    trackFilter('sort', newSort)
    
  }, [hasInitializationError, trackFilter, dispatch])

  const handleTagClick = useCallback((tag: string) => {
    // 移除初始化检查，只保留严重错误检查
    if (hasInitializationError && errorRecoveryCountRef.current > 3) {
      console.warn('[TemplatesPage] 严重错误状态，跳过标签切换')
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
    dispatch({ 
      type: 'SET_PERFORMANCE_METRICS', 
      payload: {
        ...performanceMetrics,
        tagClickResponseTime: responseTime,
        filterResponseTime: Math.max(performanceMetrics.filterResponseTime || 0, responseTime) // 更新筛选性能
      }
    })
    
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
    
  }, [hasInitializationError, selectedTags, trackEvent, dispatch])

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
    }
  }, [])
  
  // 渲染决策前的状态检查

  // 渲染错误恢复界面
  if (hasInitializationError && errorRecoveryCountRef.current > 3) {
    // 渲染错误恢复界面
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
  
  // 移除阻塞式初始化检查，允许页面立即渲染
  // 注释：原本的 !isInitialized 检查会导致几秒钟的空白页面
  // 现在直接渲染内容，让用户立即看到页面结构
  
  // 开始渲染主要内容

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


      {/* 模版网格 - 渐进式加载，立即显示卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {paginatedTemplates.map((template: any, index: number) => {
              // 渲染模板卡片 - 每个卡片独立处理图片加载
              return (
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
              )
        })}
      </div>

      {/* 分页组件 - 只在有多页时显示 */}
      {totalPages > 1 && (
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

      {/* 简化后移除了性能监控面板 */}
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
            {/* 快速预览缩略图作为背景 */}
            {template.thumbnailUrl && (
              <CachedImage 
                src={template.thumbnailUrl}
                alt={template.name}
                className="absolute inset-0 w-full h-full object-cover"
                fastPreview={true}
                previewQuality={30}
                previewSize={300}
                transitionDuration={300}
              />
            )}
            {/* 视频播放器在上层 */}
            <ReactVideoPlayer
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
            fastPreview={true}
            previewQuality={30}
            previewSize={300}
            transitionDuration={300}
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