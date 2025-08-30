/**
 * React Query hooks for template likes
 * 使用 React Query 提供缓存和优化的点赞数据管理
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { templateLikeService, type LikeStatus, type ToggleLikeResult } from '@/services/templateLikeService'
import { useAuthState } from '@/hooks/useAuthState'

// Query Keys
export const templateLikeKeys = {
  all: ['templateLikes'] as const,
  list: (templateIds: string[]) => [...templateLikeKeys.all, 'list', templateIds] as const,
  single: (templateId: string) => [...templateLikeKeys.all, 'single', templateId] as const,
  userLiked: (userId: string) => [...templateLikeKeys.all, 'userLiked', userId] as const,
  popular: (timeframe: string) => [...templateLikeKeys.all, 'popular', timeframe] as const,
  stats: (userId: string) => [...templateLikeKeys.all, 'stats', userId] as const,
}

/**
 * 查询单个模板的点赞状态
 */
export function useTemplateLikeStatus(templateId: string) {
  const { user } = useAuthState()

  return useQuery({
    queryKey: templateLikeKeys.single(templateId),
    queryFn: () => templateLikeService.checkLikeStatus(templateId),
    enabled: !!user && !!templateId,
    staleTime: 2 * 60 * 1000, // 2分钟缓存
    gcTime: 5 * 60 * 1000,    // 5分钟垃圾回收
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  })
}

/**
 * 批量查询多个模板的点赞状态
 */
export function useMultipleTemplateLikeStatus(templateIds: string[]) {
  const { user } = useAuthState()

  return useQuery({
    queryKey: templateLikeKeys.list(templateIds),
    queryFn: () => templateLikeService.checkMultipleLikeStatus(templateIds),
    enabled: !!user && templateIds.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  })
}

/**
 * 查询用户点赞的模板列表
 */
export function useUserLikedTemplates(userId?: string, page = 1, pageSize = 20) {
  const { user } = useAuthState()
  const targetUserId = userId || user?.id

  return useQuery({
    queryKey: [...templateLikeKeys.userLiked(targetUserId || ''), page, pageSize],
    queryFn: () => templateLikeService.getUserLikedTemplates(targetUserId, page, pageSize),
    enabled: !!targetUserId,
    staleTime: 1 * 60 * 1000, // 1分钟缓存
    gcTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}

/**
 * 查询热门模板
 */
export function usePopularTemplates(
  limit = 10, 
  timeframe: 'day' | 'week' | 'month' | 'all' = 'all'
) {
  return useQuery({
    queryKey: templateLikeKeys.popular(`${timeframe}-${limit}`),
    queryFn: () => templateLikeService.getPopularTemplates(limit, timeframe),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}

/**
 * 查询用户点赞统计
 */
export function useUserLikeStats(userId?: string) {
  const { user } = useAuthState()
  const targetUserId = userId || user?.id

  return useQuery({
    queryKey: templateLikeKeys.stats(targetUserId || ''),
    queryFn: () => templateLikeService.getUserLikeStats(targetUserId),
    enabled: !!targetUserId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}

/**
 * 点赞/取消点赞 Mutation
 */
export function useToggleLikeMutation() {
  const queryClient = useQueryClient()
  const { user } = useAuthState()

  return useMutation({
    mutationFn: async (templateId: string): Promise<ToggleLikeResult> => {
      return templateLikeService.toggleLike(templateId)
    },
    onMutate: async (templateId: string) => {
      // 取消相关的查询以避免与乐观更新冲突
      await queryClient.cancelQueries({
        queryKey: templateLikeKeys.single(templateId)
      })

      // 获取当前数据
      const previousStatus = queryClient.getQueryData<LikeStatus>(
        templateLikeKeys.single(templateId)
      )

      // 乐观更新
      if (previousStatus) {
        const newStatus: LikeStatus = {
          ...previousStatus,
          is_liked: !previousStatus.is_liked,
          like_count: previousStatus.is_liked
            ? Math.max(0, previousStatus.like_count - 1)
            : previousStatus.like_count + 1
        }

        queryClient.setQueryData(templateLikeKeys.single(templateId), newStatus)

        // 更新批量查询缓存
        const batchQueries = queryClient.getQueriesData({
          queryKey: templateLikeKeys.all
        })

        batchQueries.forEach(([queryKey, data]) => {
          if (Array.isArray(data)) {
            const updatedData = data.map((item: LikeStatus) =>
              item.template_id === templateId ? newStatus : item
            )
            queryClient.setQueryData(queryKey, updatedData)
          }
        })
      }

      return { previousStatus }
    },
    onError: (err, templateId, context) => {
      // 回滚乐观更新
      if (context?.previousStatus) {
        queryClient.setQueryData(
          templateLikeKeys.single(templateId),
          context.previousStatus
        )
      }
    },
    onSuccess: (result, templateId) => {
      if (result.success) {
        // 更新缓存为真实数据
        const newStatus: LikeStatus = {
          template_id: templateId,
          is_liked: result.is_liked,
          like_count: result.like_count
        }

        queryClient.setQueryData(templateLikeKeys.single(templateId), newStatus)

        // 使相关查询失效
        queryClient.invalidateQueries({
          queryKey: templateLikeKeys.userLiked(user?.id || '')
        })
        queryClient.invalidateQueries({
          queryKey: templateLikeKeys.stats(user?.id || '')
        })
        queryClient.invalidateQueries({
          queryKey: templateLikeKeys.popular('all')
        })
      }
    },
    onSettled: () => {
      // 确保相关查询最终同步
      queryClient.invalidateQueries({
        queryKey: templateLikeKeys.all
      })
    },
    retry: 2,
    retryDelay: 1000
  })
}

/**
 * 预加载模板点赞状态
 */
export function usePrefetchTemplateLikes() {
  const queryClient = useQueryClient()
  const { user } = useAuthState()

  const prefetchLikeStatus = (templateId: string) => {
    if (!user) return

    queryClient.prefetchQuery({
      queryKey: templateLikeKeys.single(templateId),
      queryFn: () => templateLikeService.checkLikeStatus(templateId),
      staleTime: 2 * 60 * 1000
    })
  }

  const prefetchMultipleLikeStatus = (templateIds: string[]) => {
    if (!user || templateIds.length === 0) return

    queryClient.prefetchQuery({
      queryKey: templateLikeKeys.list(templateIds),
      queryFn: () => templateLikeService.checkMultipleLikeStatus(templateIds),
      staleTime: 2 * 60 * 1000
    })
  }

  return {
    prefetchLikeStatus,
    prefetchMultipleLikeStatus
  }
}