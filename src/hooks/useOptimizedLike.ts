/**
 * useOptimizedLike Hook
 * 优化的点赞Hook，包含防抖、缓存和性能优化
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuthState } from '@/hooks/useAuthState'
import { useToggleLikeMutation, useTemplateLikeStatus } from '@/hooks/queries/useTemplateLikeQueries'
import { toast } from 'sonner'

interface UseOptimizedLikeOptions {
  templateId: string
  initialLikeCount?: number
  initialIsLiked?: boolean
  onLikeChange?: (isLiked: boolean, likeCount: number) => void
  debounceMs?: number
  enableToast?: boolean
}

interface UseOptimizedLikeReturn {
  isLiked: boolean
  likeCount: number
  loading: boolean
  error: string | null
  toggleLike: () => void
  canLike: boolean
}

export function useOptimizedLike({
  templateId,
  initialLikeCount = 0,
  initialIsLiked = false,
  onLikeChange,
  debounceMs = 500,
  enableToast = true
}: UseOptimizedLikeOptions): UseOptimizedLikeReturn {
  const { user } = useAuthState()
  
  // 本地状态
  const [localIsLiked, setLocalIsLiked] = useState(initialIsLiked)
  const [localLikeCount, setLocalLikeCount] = useState(initialLikeCount)
  const [error, setError] = useState<string | null>(null)

  // 防抖相关
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingLikeStateRef = useRef<boolean | null>(null)

  // React Query hooks
  const { data: likeStatus, isLoading: statusLoading } = useTemplateLikeStatus(templateId)
  const toggleLikeMutation = useToggleLikeMutation()

  // 同步远程状态到本地状态
  useEffect(() => {
    if (likeStatus) {
      setLocalIsLiked(likeStatus.is_liked)
      setLocalLikeCount(likeStatus.like_count)
    }
  }, [likeStatus])

  // 防抖执行点赞操作
  const debouncedToggleLike = useCallback(async (targetState: boolean) => {
    if (!user) {
      setError('请先登录')
      if (enableToast) {
        toast.error('请先登录')
      }
      return
    }

    try {
      const result = await toggleLikeMutation.mutateAsync(templateId)
      
      if (result.success) {
        // 更新本地状态为服务器返回的真实状态
        setLocalIsLiked(result.is_liked)
        setLocalLikeCount(result.like_count)
        onLikeChange?.(result.is_liked, result.like_count)
        
        if (enableToast) {
          toast.success(result.is_liked ? '点赞成功' : '已取消点赞')
        }
      } else {
        throw new Error(result.error || '操作失败')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '网络错误，请重试'
      setError(errorMessage)
      
      if (enableToast) {
        toast.error(errorMessage)
      }

      // 回滚本地状态
      const rollbackIsLiked = !targetState
      const rollbackCount = rollbackIsLiked 
        ? localLikeCount + 1 
        : Math.max(0, localLikeCount - 1)
      
      setLocalIsLiked(rollbackIsLiked)
      setLocalLikeCount(rollbackCount)
      onLikeChange?.(rollbackIsLiked, rollbackCount)
    }
  }, [user, templateId, toggleLikeMutation, localLikeCount, onLikeChange, enableToast])

  // 主要的点赞切换函数
  const toggleLike = useCallback(() => {
    if (!user) {
      setError('请先登录')
      if (enableToast) {
        toast.error('请先登录')
      }
      return
    }

    if (toggleLikeMutation.isPending) {
      return // 防止重复点击
    }

    setError(null)

    // 立即更新UI（乐观更新）
    const newIsLiked = !localIsLiked
    const newLikeCount = newIsLiked 
      ? localLikeCount + 1 
      : Math.max(0, localLikeCount - 1)

    setLocalIsLiked(newIsLiked)
    setLocalLikeCount(newLikeCount)
    onLikeChange?.(newIsLiked, newLikeCount)

    // 记录待处理的状态
    pendingLikeStateRef.current = newIsLiked

    // 清除之前的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 设置新的防抖定时器
    debounceTimerRef.current = setTimeout(() => {
      if (pendingLikeStateRef.current !== null) {
        debouncedToggleLike(pendingLikeStateRef.current)
        pendingLikeStateRef.current = null
      }
    }, debounceMs)
  }, [
    user, 
    localIsLiked, 
    localLikeCount, 
    toggleLikeMutation.isPending, 
    onLikeChange, 
    debounceMs, 
    debouncedToggleLike,
    enableToast
  ])

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // 清理错误状态
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  return {
    isLiked: localIsLiked,
    likeCount: localLikeCount,
    loading: statusLoading || toggleLikeMutation.isPending,
    error,
    toggleLike,
    canLike: !!user && !toggleLikeMutation.isPending
  }
}

export default useOptimizedLike