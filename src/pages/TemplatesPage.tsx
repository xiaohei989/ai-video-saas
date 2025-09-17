import { useState, useEffect, useMemo, useCallback, memo, useRef, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Play, Hash, TrendingUp, Sparkles, ArrowUp, Video } from 'lucide-react'
import { templateList as initialTemplates, getPopularTags, getTemplatesByTags } from '@/features/video-creator/data/templates/index'
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import LikeCounterButton from '@/components/templates/LikeCounterButton'
import TemplatesSkeleton from '@/components/templates/TemplatesSkeleton'
import Pagination from '@/components/ui/pagination'
import { useTemplateLikes } from '@/hooks/useTemplateLikes'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'

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
        sortBy: 'popular',
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
  const { t } = useTranslation()
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
      sortBy: sort && ['popular', 'latest'].includes(sort) ? sort : 'popular',
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
  
  // 获取所有模板的点赞状态
  const {
    likeStatuses: allLikeStatuses,
    loading: likesLoading
  } = useTemplateLikes({
    templateIds: allTemplateIds,
    enableAutoRefresh: false
  })

  // 判断点赞数据是否已完全加载
  const isLikeDataLoaded = useMemo(() => {
    // 如果没有模版，认为已加载
    if (allTemplateIds.length === 0) return true
    
    // 如果正在加载，认为未完全加载
    if (likesLoading) return false
    
    // 检查是否所有模版都有点赞状态数据（包括默认的0点赞）
    return allTemplateIds.every(templateId => 
      allLikeStatuses.has(templateId)
    )
  }, [allTemplateIds, likesLoading, allLikeStatuses])

  // 根据标签筛选和排序的模板列表
  const filteredAndSortedTemplates = useMemo(() => {
    // 首先根据选中的标签筛选模板
    const filteredTemplates = getTemplatesByTags(selectedTags)
    
    // 然后排序
    switch (sortBy) {
      case 'latest':
        // 按创建时间降序排序（最新的在前）
        return filteredTemplates.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        })
      
      case 'popular':
      default:
        // 如果点赞数据未完全加载，先按创建时间排序避免闪烁
        if (!isLikeDataLoaded) {
          return filteredTemplates.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return dateB - dateA
          })
        }
        
        // 按点赞数降序排序（最受欢迎的在前）
        return filteredTemplates.sort((a, b) => {
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
  }, [selectedTags, sortBy, allLikeStatuses, isLikeDataLoaded])

  // 分页计算
  const totalItems = filteredAndSortedTemplates.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTemplates = filteredAndSortedTemplates.slice(startIndex, endIndex)
  
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
    
    dispatch({ type: 'SET_PAGE', payload: page })
    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // 跟踪分页使用
    trackEvent({
      action: 'pagination_click',
      category: 'user_navigation',
      label: `page_${page}`,
      custom_parameters: {
        total_pages: totalPages,
        page_size: pageSize,
        sort_by: sortBy
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
    
    // 使用批量更新
    dispatch({ type: 'BATCH_UPDATE', payload: {
      sortBy: newSort,
      currentPage: 1 // 切换排序时回到第一页
    }})
    
    trackFilter('sort', newSort)
  }, [isInitialized, hasInitializationError, trackFilter, dispatch])

  const handleTagClick = useCallback((tag: string) => {
    if (!isInitialized || hasInitializationError) {
      console.warn('[TemplatesPage] 组件未完全初始化，跳过标签切换')
      return
    }
    
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag) // 取消选中
      : [...selectedTags, tag] // 添加选中
    
    // 使用批量更新
    dispatch({ type: 'BATCH_UPDATE', payload: {
      selectedTags: newSelectedTags,
      currentPage: 1 // 切换标签时回到第一页
    }})
    
    // 跟踪标签筛选事件
    trackEvent({
      action: 'tag_filter',
      category: 'user_navigation',
      label: tag,
      custom_parameters: {
        selected_tags: newSelectedTags,
        filter_action: selectedTags.includes(tag) ? 'remove' : 'add'
      }
    })
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
      {sortBy === 'popular' && !isLikeDataLoaded ? (
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
      {totalPages > 1 && !(sortBy === 'popular' && !isLikeDataLoaded) && (
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
          <SimpleVideoPlayer
            src={template.previewUrl}
            poster={template.thumbnailUrl}
            className="w-full h-full"
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
        ) : template.thumbnailUrl ? (
          <img 
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover"
            loading="lazy"
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