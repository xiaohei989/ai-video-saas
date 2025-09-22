/**
 * Templates Data Hook - 数据库版本
 * 使用Supabase数据库API获取模板数据，支持真正的分页和服务端筛选
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { templatesApiService, TemplateListItem, TemplateListParams } from '@/services/templatesApiService'
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

export function useTemplatesData() {
  const { i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  
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
      loading: true,
      error: null,
      totalItems: 0,
      totalPages: 1,
      showBackToTop: false
    }
  })

  // 加载模板数据
  const loadTemplates = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const params: TemplateListParams = {
        page: state.pagination.page,
        pageSize: state.pagination.pageSize,
        sort: state.filters.sort,
        tags: state.filters.tags.length > 0 ? state.filters.tags : undefined,
        category: state.filters.category,
        search: state.filters.search || undefined
      }

      console.log('[useTemplatesData] 加载模板数据:', params)
      
      const response = await templatesApiService.getTemplateList(params)
      
      // 转换数据库模板为组件期望的格式并本地化
      const convertedTemplates = response.data.map(template => 
        convertDatabaseTemplateToComponentFormat(template, i18n.language)
      )

      setState(prev => ({
        ...prev,
        templates: convertedTemplates,
        totalItems: response.totalCount,
        totalPages: response.totalPages,
        loading: false,
        error: null
      }))

      console.log(`[useTemplatesData] 加载成功: ${convertedTemplates.length}/${response.totalCount} 个模板`)
    } catch (error) {
      console.error('[useTemplatesData] 加载失败:', error)
      setState(prev => ({
        ...prev,
        templates: [],
        totalItems: 0,
        totalPages: 1,
        loading: false,
        error: error instanceof Error ? error : new Error('加载模板失败')
      }))
    }
  }, [state.pagination.page, state.pagination.pageSize, state.filters.sort, state.filters.tags, state.filters.category, state.filters.search, i18n.language])

  // 当筛选条件或分页变化时重新加载数据
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

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
    
    // 操作
    updateFilters,
    updatePagination
  }
}