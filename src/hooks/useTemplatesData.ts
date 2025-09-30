/**
 * Templates Data Hook - 数据库版本
 * 使用Supabase数据库API获取模板数据，支持真正的分页和服务端筛选
 * 优化版：支持多层缓存和快速加载，避免页面切换时的骨架屏
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { templatesApiService, TemplateListItem, TemplateListParams } from '@/services/templatesApiService'
import { templatesCacheService } from '@/services/templatesCacheService'
import { likesCacheService } from '@/services/likesCacheService'
import { useTranslation } from 'react-i18next'

export type SortOption = 'popular' | 'latest' | 'credits'

interface FilterState {
  sort: SortOption
  tags: string[]
  search: string
  category?: string
}

interface PaginationState {
  page: number
  pageSize: number
}

interface TemplatesDataState {
  templates: TemplateListItem[]
  loading: boolean
  error: Error | null
  totalItems: number
  totalPages: number
  showBackToTop: boolean
  filters: FilterState
  pagination: PaginationState
  // 🚀 新增快速加载状态管理
  initialLoad: boolean // 是否是初始加载
  cacheLoaded: boolean // 是否已从缓存加载
  // 🚀 性能监控
  performanceMetrics: {
    pageLoadStart: number
    cacheHitCount: number
    networkRequestCount: number
    lastLoadTime: number
  }
}

// 多语言文本解析函数
function resolveMultilingualText(text: any, currentLang?: string): string {
  if (!text) {
    return '';
  }
  
  // 如果是字符串，检查是否是JSON字符串
  if (typeof text === 'string') {
    // 尝试解析JSON字符串
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        text = parsed; // 继续处理解析后的对象
      } catch (error) {
        return text; // 解析失败就直接返回原字符串
      }
    } else {
      return text; // 普通字符串直接返回
    }
  }
  
  if (typeof text !== 'object' || Array.isArray(text)) {
    return String(text);
  }
  
  const lang = currentLang || 'zh'; // 默认使用中文
  
  
  // 优先返回当前语言版本
  if (text[lang]) {
    return text[lang];
  }
  
  // 回退到中文
  if (text['zh']) {
    return text['zh'];
  }
  
  // 回退到英语
  if (text['en']) {
    return text['en'];
  }
  
  // 最后回退：返回任意可用语言
  const availableKeys = Object.keys(text);
  const fallback = availableKeys.length > 0 ? text[availableKeys[0]] : '';
  return fallback;
}

// 将数据库模板转换为组件期望的格式
function convertDatabaseTemplateToComponentFormat(template: TemplateListItem, currentLang?: string): any {
  return {
    id: template.id,
    slug: template.slug,
    name: resolveMultilingualText(template.name, currentLang),
    description: resolveMultilingualText(template.description, currentLang),
    // 字段映射：数据库 -> 组件期望
    thumbnailUrl: template.thumbnail_url,
    previewUrl: template.preview_url,
    category: template.category,
    credits: template.credit_cost,
    tags: template.tags,
    // 保留其他字段
    likeCount: template.like_count,
    isActive: template.is_active,
    isPublic: template.is_public,
    version: template.version,
    auditStatus: template.audit_status
  };
}

// 🚀 同步模板数据到点赞缓存（保护用户操作优先级）
function syncTemplatesToLikesCache(templates: TemplateListItem[]): void {
  templates.forEach(template => {
    const existing = likesCacheService.get(template.id)
    
    // 🚀 智能同步策略：保护用户操作数据
    if (!existing) {
      // 没有缓存数据时，创建初始状态
      likesCacheService.set(template.id, {
        template_id: template.id,
        is_liked: false, // API不返回用户点赞状态，默认false
        like_count: template.like_count || 0
      }, 'api')
      console.debug(`[syncTemplatesToLikesCache] 创建初始缓存: ${template.id}`)
    } else {
      // 🚀 有缓存数据时，根据数据源和时间决定是否更新
      const isUserAction = existing.source === 'optimistic' || existing.source === 'sync'
      const isRecentUserAction = isUserAction && (Date.now() - existing.cached_at < 5 * 60 * 1000) // 5分钟保护期
      
      if (isRecentUserAction) {
        // 用户最近有操作，完全跳过同步，保护用户状态
        console.debug(`[syncTemplatesToLikesCache] 保护用户操作数据: ${template.id} (${existing.source}, ${Math.round((Date.now() - existing.cached_at) / 1000)}s前)`)
      } else if (existing.source === 'api' && Date.now() - existing.cached_at > 5 * 60 * 1000) {
        // 只有API数据且超过5分钟时才更新
        likesCacheService.set(template.id, {
          template_id: template.id,
          is_liked: false,
          like_count: template.like_count || 0
        }, 'api')
        console.debug(`[syncTemplatesToLikesCache] 更新过期API数据: ${template.id}`)
      } else {
        // 其他情况保持现有缓存不变
        console.debug(`[syncTemplatesToLikesCache] 保持现有缓存: ${template.id} (${existing.source})`)
      }
    }
  })
}

export function useTemplatesData() {
  const { i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  // 🔧 修复: 使用 useRef 防止并发加载导致重复缓存写入
  const isLoadingRef = React.useRef(false)

  // 从URL参数初始化状态
  const [state, setState] = useState<TemplatesDataState>(() => {
    const page = searchParams.get('page')
    const size = searchParams.get('size')
    const sort = searchParams.get('sort') as SortOption
    const tags = searchParams.get('tags')
    const category = searchParams.get('category')
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
    
    return {
      templates: [],
      filters: {
        sort: sort && ['popular', 'latest', 'credits'].includes(sort) ? sort : 'latest',
        tags: tags ? tags.split(',').filter(Boolean) : [],
        search: '',
        category: category || undefined
      },
      pagination: {
        page: page ? Math.max(1, parseInt(page, 10)) : 1,
        pageSize: size ? Math.max(6, parseInt(size, 10)) : (isMobile ? 6 : 12)
      },
      loading: true, // 🚀 初始值保持true，但会通过快速加载优化
      error: null,
      totalItems: 0,
      totalPages: 1,
      showBackToTop: false,
      initialLoad: true, // 🚀 标记为初始加载
      cacheLoaded: false, // 🚀 缓存加载标记
      performanceMetrics: { // 🚀 性能监控初始化
        pageLoadStart: performance.now(),
        cacheHitCount: 0,
        networkRequestCount: 0,
        lastLoadTime: 0
      }
    }
  })

  // 🚀 快速加载：优先从缓存显示，后台更新数据
  const quickLoad = useCallback(async () => {
    // 🔧 修复: 防止并发调用
    if (isLoadingRef.current) {
      console.log('[useTemplatesData] ⚠️ 加载已在进行中，跳过重复调用')
      return
    }

    isLoadingRef.current = true

    try {
      const params: TemplateListParams = {
        page: state.pagination.page,
        pageSize: state.pagination.pageSize,
        sort: state.filters.sort,
        tags: state.filters.tags.length > 0 ? state.filters.tags : undefined,
        category: state.filters.category,
        search: state.filters.search || undefined
      }

      const startTime = performance.now()
      console.log('[useTemplatesData] 🚀 开始快速加载流程:', params)

    // 1. 首先检查缓存
    const cached = await templatesCacheService.getCachedTemplates(params)
    
    if (cached) {
      // 缓存命中：立即显示缓存数据
      const convertedTemplates = cached.templates.map(template => 
        convertDatabaseTemplateToComponentFormat(template, i18n.language)
      )

      // 🚀 同步模板数据到点赞缓存
      syncTemplatesToLikesCache(cached.templates)

      const cacheTime = performance.now() - startTime
      
      // 🚀 更新状态和性能指标
      setState(prev => ({
        ...prev,
        templates: convertedTemplates,
        totalItems: cached.totalCount,
        totalPages: cached.totalPages,
        loading: false, // 🚀 关键：立即关闭loading状态
        error: null,
        cacheLoaded: true,
        initialLoad: false,
        performanceMetrics: {
          ...prev.performanceMetrics,
          cacheHitCount: prev.performanceMetrics.cacheHitCount + 1,
          lastLoadTime: cacheTime
        }
      }))

      console.log(`[useTemplatesData] 📦 缓存命中！立即显示${convertedTemplates.length}个模板 (${cacheTime.toFixed(1)}ms)`)
      
      // 后台更新数据
      try {
        const networkStartTime = performance.now()
        const response = await templatesApiService.getTemplateList(params)
        const networkTime = performance.now() - networkStartTime
        
        await templatesCacheService.cacheTemplates(response, params)
        
        // 🚀 更新网络请求计数
        setState(prev => ({
          ...prev,
          performanceMetrics: {
            ...prev.performanceMetrics,
            networkRequestCount: prev.performanceMetrics.networkRequestCount + 1
          }
        }))
        
        // 如果后台数据与缓存不同，更新界面
        if (response.data.length !== cached.templates.length || 
            response.totalCount !== cached.totalCount) {
          const freshTemplates = response.data.map(template => 
            convertDatabaseTemplateToComponentFormat(template, i18n.language)
          )
          
          // 🚀 同步新数据到点赞缓存
          syncTemplatesToLikesCache(response.data)
          
          setState(prev => ({
            ...prev,
            templates: freshTemplates,
            totalItems: response.totalCount,
            totalPages: response.totalPages
          }))
          
          console.log(`[useTemplatesData] 🔄 后台更新完成: ${response.data.length}个模板 (网络耗时: ${networkTime.toFixed(1)}ms)`)
        }
      } catch (error) {
        console.warn('[useTemplatesData] 后台更新失败:', error)
      }

      return true // 缓存命中
    }

    return false // 缓存未命中
    } finally {
      // 🔧 修复: 释放锁
      isLoadingRef.current = false
    }
  }, [state.pagination.page, state.pagination.pageSize, state.filters.sort, state.filters.tags, state.filters.category, state.filters.search, i18n.language])

  // 🚀 标准加载：从网络获取数据
  const loadTemplates = useCallback(async () => {
    // 如果不是初始加载或已从缓存加载，显示loading状态
    if (!state.initialLoad || !state.cacheLoaded) {
      setState(prev => ({ ...prev, loading: true, error: null }))
    }

    const networkStartTime = performance.now()

    try {
      const params: TemplateListParams = {
        page: state.pagination.page,
        pageSize: state.pagination.pageSize,
        sort: state.filters.sort,
        tags: state.filters.tags.length > 0 ? state.filters.tags : undefined,
        category: state.filters.category,
        search: state.filters.search || undefined
      }

      console.log('[useTemplatesData] 🌐 网络加载模板数据:', params)
      
      const response = await templatesApiService.getTemplateList(params)
      const networkTime = performance.now() - networkStartTime
      
      // 缓存新数据
      await templatesCacheService.cacheTemplates(response, params)
      
      // 转换数据库模板为组件期望的格式并本地化
      const convertedTemplates = response.data.map(template => 
        convertDatabaseTemplateToComponentFormat(template, i18n.language)
      )

      // 🚀 同步模板数据到点赞缓存
      syncTemplatesToLikesCache(response.data)

      // 🚀 更新状态和性能指标
      setState(prev => ({
        ...prev,
        templates: convertedTemplates,
        totalItems: response.totalCount,
        totalPages: response.totalPages,
        loading: false,
        error: null,
        initialLoad: false,
        cacheLoaded: true,
        performanceMetrics: {
          ...prev.performanceMetrics,
          networkRequestCount: prev.performanceMetrics.networkRequestCount + 1,
          lastLoadTime: networkTime
        }
      }))

      console.log(`[useTemplatesData] ✅ 网络加载成功: ${convertedTemplates.length}/${response.totalCount} 个模板 (网络耗时: ${networkTime.toFixed(1)}ms)`)
    } catch (error) {
      const networkTime = performance.now() - networkStartTime
      console.error('[useTemplatesData] 加载失败:', error)
      
      setState(prev => ({
        ...prev,
        templates: [],
        totalItems: 0,
        totalPages: 1,
        loading: false,
        error: error instanceof Error ? error : new Error('加载模板失败'),
        initialLoad: false,
        performanceMetrics: {
          ...prev.performanceMetrics,
          networkRequestCount: prev.performanceMetrics.networkRequestCount + 1,
          lastLoadTime: networkTime
        }
      }))
    }
  }, [state.pagination.page, state.pagination.pageSize, state.filters.sort, state.filters.tags, state.filters.category, state.filters.search, i18n.language, state.initialLoad, state.cacheLoaded])

  // 🚀 当筛选条件或分页变化时，优先尝试快速加载
  useEffect(() => {
    const handleDataLoad = async () => {
      // 先尝试快速加载（缓存）
      const cacheHit = await quickLoad()
      
      // 如果缓存未命中，使用标准加载
      if (!cacheHit) {
        await loadTemplates()
      }
    }
    
    handleDataLoad()
  }, [quickLoad, loadTemplates])

  // 🚀 性能监控输出（开发环境）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !state.loading && state.templates.length > 0) {
      const metrics = state.performanceMetrics
      const totalLoadTime = performance.now() - metrics.pageLoadStart
      const cacheHitRate = metrics.networkRequestCount > 0 
        ? (metrics.cacheHitCount / (metrics.cacheHitCount + metrics.networkRequestCount) * 100).toFixed(1)
        : '0'
      
      console.log(`[模板性能监控] 📊 加载统计:`, {
        '总耗时': `${totalLoadTime.toFixed(1)}ms`,
        '缓存命中': `${metrics.cacheHitCount}次`,
        '网络请求': `${metrics.networkRequestCount}次`, 
        '缓存命中率': `${cacheHitRate}%`,
        '最后操作耗时': `${metrics.lastLoadTime.toFixed(1)}ms`,
        '模板数量': state.templates.length
      })
    }
  }, [state.loading, state.templates.length, state.performanceMetrics])

  // URL同步
  useEffect(() => {
    const params = new URLSearchParams()
    
    if (state.pagination.page > 1) {
      params.set('page', state.pagination.page.toString())
    }
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
    const defaultPageSize = isMobile ? 6 : 12
    if (state.pagination.pageSize !== defaultPageSize) {
      params.set('size', state.pagination.pageSize.toString())
    }
    
    if (state.filters.sort !== 'latest') {
      params.set('sort', state.filters.sort)
    }
    
    if (state.filters.tags.length > 0) {
      params.set('tags', state.filters.tags.join(','))
    }

    if (state.filters.category) {
      params.set('category', state.filters.category)
    }
    
    const newSearch = params.toString()
    const currentSearch = searchParams.toString()
    
    if (newSearch !== currentSearch) {
      setSearchParams(params, { replace: true })
    }
  }, [state.filters, state.pagination, searchParams, setSearchParams])

  // 滚动监听 - 显示返回顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > 300
      if (shouldShow !== state.showBackToTop) {
        setState(prev => ({ ...prev, showBackToTop: shouldShow }))
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [state.showBackToTop])

  // 移除额外的点赞数据加载 - 直接使用API返回的数据
  // useEffect(() => {
  //   const loadLikesData = async () => {
  //     if (state.templates.length === 0) return
  //     
  //     const templateIds = state.templates.map(t => t.id)
  //     const needsLikes = templateIds.filter(id => !likesCacheService.has(id))
  //     
  //     if (needsLikes.length > 0) {
  //       try {
  //         const likeStatuses = await templateLikeService.checkMultipleLikeStatus(needsLikes)
  //         likeStatuses.forEach(status => {
  //           likesCacheService.set(status.template_id, {
  //             template_id: status.template_id,
  //             is_liked: status.is_liked,
  //             like_count: status.like_count
  //           })
  //         })
  //       } catch (error) {
  //         console.warn('[useTemplatesData] 加载点赞数据失败:', error)
  //       }
  //     }
  //   }

  //   loadLikesData()
  // }, [state.templates])

  // 操作函数
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      pagination: { ...prev.pagination, page: 1 } // 筛选时重置页码
    }))

  }, [])

  const updatePagination = useCallback((newPagination: Partial<PaginationState>) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, ...newPagination }
    }))
  }, [])

  // 移除缓存相关函数 - 直接使用API数据
  // const getLikeStatus = useCallback((templateId: string) => {
  //   return likesCacheService.get(templateId)
  // }, [])

  // const handleLikeChange = useCallback((templateId: string, isLiked: boolean, likeCount: number) => {
  //   likesCacheService.updateLikeStatus(templateId, isLiked, likeCount)
  // }, [])


  return {
    // 数据
    templates: state.templates,
    totalItems: state.totalItems,
    totalPages: state.totalPages,
    
    // 状态
    loading: state.loading,
    error: state.error,
    filters: state.filters,
    pagination: state.pagination,
    showBackToTop: state.showBackToTop,
    
    // 🚀 新增：智能骨架屏控制
    // 只在初始加载且无缓存数据时显示骨架屏
    showSkeleton: state.loading && state.initialLoad && !state.cacheLoaded,
    
    // 🚀 性能监控指标
    performanceMetrics: {
      ...state.performanceMetrics,
      totalLoadTime: performance.now() - state.performanceMetrics.pageLoadStart,
      cacheHitRate: state.performanceMetrics.networkRequestCount > 0 
        ? (state.performanceMetrics.cacheHitCount / (state.performanceMetrics.cacheHitCount + state.performanceMetrics.networkRequestCount) * 100).toFixed(1) + '%'
        : '0%'
    },
    
    // 操作
    updateFilters,
    updatePagination
  }
}