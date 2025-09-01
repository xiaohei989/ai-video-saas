/**
 * useTemplateLikes Hook
 * 批量管理多个模板的点赞状态（带缓存优化）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { templateLikeService, type LikeStatus } from '@/services/templateLikeService'
import { useAuthState } from '@/hooks/useAuthState'
import { likesCacheService, type CachedLikeStatus } from '@/services/likesCacheService'

interface UseTemplateLikesOptions {
  templateIds: string[]
  enableAutoRefresh?: boolean
  refreshInterval?: number
}

interface UseTemplateLikesReturn {
  likeStatuses: Map<string, LikeStatus>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateStatus: (templateId: string, status: Partial<LikeStatus>) => void
  getLikeStatus: (templateId: string) => LikeStatus | undefined
}

export function useTemplateLikes({
  templateIds,
  enableAutoRefresh = false,
  refreshInterval = 60000 // 1分钟
}: UseTemplateLikesOptions): UseTemplateLikesReturn {
  const { user } = useAuthState()
  const [likeStatuses, setLikeStatuses] = useState<Map<string, LikeStatus>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 防抖状态
  const lastRefreshRef = useRef<number>(0)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 稳定的模板ID数组
  const stableTemplateIds = useMemo(() => 
    [...templateIds].sort(), 
    [templateIds]
  )

  // 获取点赞状态
  const getLikeStatus = useCallback((templateId: string): LikeStatus | undefined => {
    return likeStatuses.get(templateId)
  }, [likeStatuses])

  // 更新单个模板的点赞状态（同步缓存）
  const updateStatus = useCallback((templateId: string, status: Partial<LikeStatus>) => {
    setLikeStatuses(prev => {
      const newMap = new Map(prev)
      const existingStatus = newMap.get(templateId)
      
      const updatedStatus = existingStatus 
        ? { ...existingStatus, ...status }
        : {
            template_id: templateId,
            is_liked: false,
            like_count: 0,
            ...status
          }
      
      newMap.set(templateId, updatedStatus)
      
      // 同步更新缓存
      likesCacheService.set(templateId, updatedStatus)
      
      return newMap
    })
  }, [])

  // 从缓存加载点赞状态
  const loadFromCache = useCallback(() => {
    if (stableTemplateIds.length === 0) return false

    // 先尝试批量缓存
    const cachedBatch = likesCacheService.getBatch(stableTemplateIds)
    if (cachedBatch) {
      const newMap = new Map<string, LikeStatus>()
      stableTemplateIds.forEach(templateId => {
        const cached = cachedBatch.get(templateId)
        if (cached) {
          newMap.set(templateId, {
            template_id: cached.template_id,
            is_liked: cached.is_liked,
            like_count: cached.like_count
          })
        }
      })
      setLikeStatuses(newMap)
      return true
    }

    // 尝试单个缓存
    let hasAnyCache = false
    const newMap = new Map<string, LikeStatus>()
    
    stableTemplateIds.forEach(templateId => {
      const cached = likesCacheService.get(templateId)
      if (cached) {
        newMap.set(templateId, {
          template_id: cached.template_id,
          is_liked: cached.is_liked,
          like_count: cached.like_count
        })
        hasAnyCache = true
      }
    })

    if (hasAnyCache) {
      setLikeStatuses(newMap)
      return true
    }

    return false
  }, [stableTemplateIds])

  // 刷新所有模板的点赞状态（带防抖）
  const refresh = useCallback(async (force: boolean = false) => {
    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefreshRef.current

    // 防抖：1秒内不重复刷新
    if (!force && timeSinceLastRefresh < 1000) {
      console.log('[useTemplateLikes] Skipping refresh due to debounce')
      return
    }

    if (stableTemplateIds.length === 0) {
      setLikeStatuses(new Map())
      return
    }

    // 如果未登录，仍然尝试获取点赞数据（但is_liked为false）
    if (!user) {
      const hasCache = loadFromCache()
      if (!hasCache && !force) {
        // 未登录且无缓存时，也调用API获取点赞数
      }
      // 继续执行，让未登录用户也能获取点赞数
    }

    // 检查是否需要刷新缓存
    const needsRefresh = force || likesCacheService.needsRefresh(stableTemplateIds)
    
    if (!needsRefresh) {
      console.log('[useTemplateLikes] Using cached data, skipping API call')
      loadFromCache()
      return
    }

    try {
      setLoading(true)
      setError(null)
      lastRefreshRef.current = now

      const statuses = await templateLikeService.checkMultipleLikeStatus(stableTemplateIds)
      
      // 转换为缓存格式并存储
      const cachedStatuses: CachedLikeStatus[] = statuses.map(status => ({
        template_id: status.template_id,
        is_liked: status.is_liked,
        like_count: status.like_count,
        cached_at: now,
        ttl: 5 * 60 * 1000 // 5分钟
      }))

      // 存储到缓存
      likesCacheService.setBatch(stableTemplateIds, cachedStatuses)

      // 更新状态
      const newMap = new Map<string, LikeStatus>()
      statuses.forEach(status => {
        newMap.set(status.template_id, status)
      })

      // 对于没有返回状态的模板，设置默认状态
      stableTemplateIds.forEach(templateId => {
        if (!newMap.has(templateId)) {
          const defaultStatus = {
            template_id: templateId,
            is_liked: false,
            like_count: 0
          }
          newMap.set(templateId, defaultStatus)
          
          // 也缓存默认状态
          likesCacheService.set(templateId, defaultStatus)
        }
      })

      setLikeStatuses(newMap)
      
    } catch (err) {
      console.error('Error refreshing template likes:', err)
      setError('获取点赞状态失败')
      
      // 出错时尝试使用缓存
      const hasCache = loadFromCache()
      if (!hasCache) {
        // 如果没有缓存且用户已登录，设置默认状态
        if (user) {
          const newMap = new Map<string, LikeStatus>()
          stableTemplateIds.forEach(templateId => {
            newMap.set(templateId, {
              template_id: templateId,
              is_liked: false,
              like_count: 0
            })
          })
          setLikeStatuses(newMap)
        } else {
          // 未登录用户出错时，设置默认状态（点赞数为0）
          const newMap = new Map<string, LikeStatus>()
          stableTemplateIds.forEach(templateId => {
            newMap.set(templateId, {
              template_id: templateId,
              is_liked: false,
              like_count: 0
            })
          })
          setLikeStatuses(newMap)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [user, stableTemplateIds, loadFromCache])

  // 初始化时获取点赞状态（优先从缓存加载）
  useEffect(() => {
    if (stableTemplateIds.length === 0) return

    // 清理之前的定时器
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    // 先尝试从缓存加载
    const hasCache = loadFromCache()
    
    if (!hasCache) {
      // 没有缓存时，延迟一小段时间再请求（避免组件初始化时大量请求）
      refreshTimeoutRef.current = setTimeout(() => {
        refresh()
      }, 100)
    } else if (likesCacheService.needsRefresh(stableTemplateIds)) {
      // 有缓存但需要刷新时，在后台更新
      refreshTimeoutRef.current = setTimeout(() => {
        refresh()
      }, 500)
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
    }
  }, [stableTemplateIds.join(',')]) // 使用稳定的ID数组

  // 用户登录状态变化时重新获取
  useEffect(() => {
    if (stableTemplateIds.length === 0) return

    // 用户状态变化时强制刷新
    const timeoutId = setTimeout(() => {
      refresh(true) // 强制刷新
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [user?.id, refresh])

  // 自动刷新（仅在缓存过期时）
  useEffect(() => {
    if (!enableAutoRefresh || !user || stableTemplateIds.length === 0) return

    const intervalId = setInterval(() => {
      // 只有在缓存需要刷新时才进行自动刷新
      if (likesCacheService.needsRefresh(stableTemplateIds)) {
        refresh()
      }
    }, refreshInterval)
    
    return () => clearInterval(intervalId)
  }, [enableAutoRefresh, refreshInterval, refresh, user, stableTemplateIds])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  return {
    likeStatuses,
    loading,
    error,
    refresh,
    updateStatus,
    getLikeStatus
  }
}

export default useTemplateLikes