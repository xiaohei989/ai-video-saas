/**
 * useLike Hook
 * 管理单个模板的点赞状态和交互
 */

import { useState, useEffect, useCallback } from 'react'
import { templateLikeService, type ToggleLikeResult } from '@/services/templateLikeService'
import { useAuthState } from '@/hooks/useAuthState'
import { likesCacheService } from '@/services/likesCacheService'

interface UseLikeOptions {
  templateId: string
  initialLikeCount?: number
  initialIsLiked?: boolean
  onLikeChange?: (isLiked: boolean, likeCount: number) => void
  enableOptimisticUpdate?: boolean
}

interface UseLikeReturn {
  isLiked: boolean
  likeCount: number
  loading: boolean
  error: string | null
  toggleLike: () => Promise<void>
  refresh: () => Promise<void>
}

export function useLike({
  templateId,
  initialLikeCount = 0,
  initialIsLiked = false,
  onLikeChange,
  enableOptimisticUpdate = true
}: UseLikeOptions): UseLikeReturn {
  const { user } = useAuthState()
  const [isLiked, setIsLiked] = useState(initialIsLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 防抖状态，防止重复点击
  const [isToggling, setIsToggling] = useState(false)

  // 刷新点赞状态
  const refresh = useCallback(async () => {
    if (!user || !templateId) return

    try {
      setLoading(true)
      const status = await templateLikeService.checkLikeStatus(templateId)
      
      if (status) {
        setIsLiked(status.is_liked)
        setLikeCount(status.like_count)
        onLikeChange?.(status.is_liked, status.like_count)
      }
    } catch (err) {
      console.error('Error refreshing like status:', err)
      setError('获取点赞状态失败')
    } finally {
      setLoading(false)
    }
  }, [user, templateId, onLikeChange])

  // 组件挂载时获取初始状态（优先使用缓存）
  useEffect(() => {
    if (!templateId) return

    // 如果有初始值，直接使用
    if (initialIsLiked !== undefined || initialLikeCount !== undefined) {
      setIsLiked(initialIsLiked || false)
      setLikeCount(initialLikeCount || 0)
      return
    }

    // 先尝试从缓存加载
    const cached = likesCacheService.get(templateId)
    if (cached) {
      setIsLiked(cached.is_liked)
      setLikeCount(cached.like_count)
      onLikeChange?.(cached.is_liked, cached.like_count)
      console.log(`[useLike] Using cached data for ${templateId}`)
      return
    }

    // 只有登录用户且没有缓存时才请求API
    if (user) {
      let isMounted = true
      
      // 添加超时机制避免无限loading，但不显示错误提示
      const timeoutId = setTimeout(() => {
        if (isMounted && loading) {
          console.warn('useLike: Loading timeout for template', templateId)
          setLoading(false)
          // 移除超时错误提示，静默处理
        }
      }, 5000) // 减少到5秒超时

      const loadStatus = async () => {
        try {
          setLoading(true)
          setError(null)
          const status = await templateLikeService.checkLikeStatus(templateId)
          
          if (isMounted) {
            if (status) {
              setIsLiked(status.is_liked)
              setLikeCount(status.like_count)
              onLikeChange?.(status.is_liked, status.like_count)
            }
            setLoading(false)
          }
        } catch (err) {
          console.error('Error loading initial like status:', err)
          if (isMounted) {
            // 静默处理错误，不显示用户提示
            setLoading(false)
          }
        }
      }

      loadStatus()

      return () => {
        isMounted = false
        clearTimeout(timeoutId)
      }
    }
  }, [user?.id, templateId, initialIsLiked, initialLikeCount, onLikeChange]) // 简化依赖，避免无限循环

  // 🚀 订阅缓存更新，当缓存中的数据更新时自动重新渲染
  useEffect(() => {
    if (!templateId) return

    const unsubscribe = likesCacheService.subscribe(templateId, (updatedStatus) => {
      // 防递归：只更新状态，不调用onLikeChange避免触发父组件重渲染
      setIsLiked(updatedStatus.is_liked)
      setLikeCount(updatedStatus.like_count)
      // 注释掉这行避免递归调用：onLikeChange?.(updatedStatus.is_liked, updatedStatus.like_count)
    })

    return unsubscribe
  }, [templateId]) // 移除 onLikeChange 依赖避免不必要的重新订阅

  // 切换点赞状态
  const toggleLike = useCallback(async () => {
    if (!user) {
      setError('请先登录')
      return
    }

    if (!templateId) {
      setError('模板ID无效')
      return
    }

    if (isToggling) {
      return // 防止重复点击
    }

    setIsToggling(true)
    setError(null)

    // 保存当前状态用于回滚
    const previousIsLiked = isLiked
    const previousLikeCount = likeCount

    try {
      // 乐观更新（包括缓存）
      if (enableOptimisticUpdate) {
        const newIsLiked = !isLiked
        const newLikeCount = newIsLiked 
          ? likeCount + 1 
          : Math.max(0, likeCount - 1)
        
        setIsLiked(newIsLiked)
        setLikeCount(newLikeCount)
        onLikeChange?.(newIsLiked, newLikeCount)
        
        // 乐观更新缓存
        if (newIsLiked) {
          likesCacheService.incrementLikeCount(templateId)
        } else {
          likesCacheService.decrementLikeCount(templateId)
        }
      } else {
        setLoading(true)
      }

      // API调用
      const result: ToggleLikeResult = await templateLikeService.toggleLike(templateId)

      if (result.success) {
        // 如果启用了乐观更新，检查服务器返回的数据是否与乐观更新一致
        if (enableOptimisticUpdate) {
          const optimisticIsLiked = !previousIsLiked
          const optimisticCount = optimisticIsLiked 
            ? previousLikeCount + 1 
            : Math.max(0, previousLikeCount - 1)
          
          // 只有在服务器数据与乐观更新不一致时才更新UI
          if (result.is_liked !== optimisticIsLiked || result.like_count !== optimisticCount) {
            console.log(`[useLike] Server data differs from optimistic update, syncing:`, {
              optimistic: { liked: optimisticIsLiked, count: optimisticCount },
              server: { liked: result.is_liked, count: result.like_count }
            })
            setIsLiked(result.is_liked)
            setLikeCount(result.like_count)
            onLikeChange?.(result.is_liked, result.like_count)
          } else {
            console.log(`[useLike] Server data matches optimistic update, no UI update needed`)
          }
        } else {
          // 没有乐观更新时，直接使用服务器数据
          setIsLiked(result.is_liked)
          setLikeCount(result.like_count)
          onLikeChange?.(result.is_liked, result.like_count)
        }
        
        // API成功后缓存会在templateLikeService中自动更新
      } else {
        // 操作失败，回滚乐观更新
        if (enableOptimisticUpdate) {
          setIsLiked(previousIsLiked)
          setLikeCount(previousLikeCount)
          onLikeChange?.(previousIsLiked, previousLikeCount)
          
          // 回滚缓存
          likesCacheService.updateLikeStatus(templateId, previousIsLiked, previousLikeCount)
        }
        setError(result.error || '操作失败')
      }
    } catch (err) {
      console.error('Error toggling like:', err)
      
      // 回滚乐观更新和缓存
      if (enableOptimisticUpdate) {
        setIsLiked(previousIsLiked)
        setLikeCount(previousLikeCount)
        onLikeChange?.(previousIsLiked, previousLikeCount)
        
        // 回滚缓存
        likesCacheService.updateLikeStatus(templateId, previousIsLiked, previousLikeCount)
      }
      
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
      setIsToggling(false)
    }
  }, [
    user, 
    templateId, 
    isLiked, 
    likeCount, 
    isToggling, 
    enableOptimisticUpdate, 
    onLikeChange
  ])

  return {
    isLiked,
    likeCount,
    loading,
    error,
    toggleLike,
    refresh
  }
}

export default useLike