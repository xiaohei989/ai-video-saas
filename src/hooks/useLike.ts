/**
 * useLike Hook
 * 管理单个模板的点赞状态和交互
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { templateLikeService, type ToggleLikeResult } from '@/services/templateLikeService'
import { useAuthState } from '@/hooks/useAuthState'
import { likesCacheService } from '@/services/likesCacheService'

interface UseLikeOptions {
  templateId: string
  initialLikeCount?: number
  initialIsLiked?: boolean
  onLikeChange?: (isLiked: boolean, likeCount: number) => void
  enableOptimisticUpdate?: boolean
  subscribeToCache?: boolean // 是否订阅全局likes缓存更新（列表页可禁用以避免覆盖）
  disableBaselineLoad?: boolean // 是否禁用挂载时的基线拉取（列表页可禁用）
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
  enableOptimisticUpdate = true,
  subscribeToCache = true,
  disableBaselineLoad = false
}: UseLikeOptions): UseLikeReturn {
  const { user } = useAuthState()
  const [isLiked, setIsLiked] = useState(initialIsLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 防抖状态，防止重复点击
  const [isToggling, setIsToggling] = useState(false)
  // 🚀 一致性优先架构：状态版本管理
  const lastOperationTime = useRef<number>(0)
  const stateVersion = useRef<number>(0)
  const MIN_OPERATION_INTERVAL = 300 // 300ms最小操作间隔
  // 记录当前是否处于切换过程，用于避免过期响应覆盖乐观/最终结果
  const isTogglingRef = useRef<boolean>(false)
  useEffect(() => { isTogglingRef.current = isToggling }, [isToggling])
  // 避免因 onLikeChange 的引用变化触发副作用重跑
  const onLikeChangeRef = useRef<typeof onLikeChange | undefined>(onLikeChange)
  useEffect(() => {
    onLikeChangeRef.current = onLikeChange
  }, [onLikeChange])

  // 刷新点赞状态
  const refresh = useCallback(async () => {
    if (!user || !templateId) return

    try {
      setLoading(true)
      const requestStartedAt = Date.now()
      const startVersion = stateVersion.current
      const status = await templateLikeService.checkLikeStatus(templateId)
      
      // 避免过期响应覆盖用户刚刚的点击结果
      if (status && !isTogglingRef.current && stateVersion.current === startVersion && lastOperationTime.current <= requestStartedAt) {
        setIsLiked(status.is_liked)
        setLikeCount(status.like_count)
        onLikeChangeRef.current?.(status.is_liked, status.like_count)
      }
    } catch (err) {
      console.error('Error refreshing like status:', err)
      setError('获取点赞状态失败')
    } finally {
      setLoading(false)
    }
  }, [user, templateId])

  // 组件挂载时获取初始状态：先用初始值渲染，必要时静默校对服务器真实状态
  useEffect(() => {
    if (!templateId) return

    const hasInitial = (initialIsLiked !== undefined || initialLikeCount !== undefined)

    // 若父组件传入初始值，先直接使用以保证首帧体验
    if (hasInitial) {
      setIsLiked(initialIsLiked || false)
      setLikeCount(initialLikeCount || 0)
    }

    // 列表等场景可禁用基线拉取，完全依赖点击后的真实结果
    if (disableBaselineLoad) {
      return
    }

    // 先尝试从缓存加载
    if (!hasInitial) {
      const cached = likesCacheService.get(templateId)
      if (cached) {
        setIsLiked(cached.is_liked)
        setLikeCount(cached.like_count)
        onLikeChangeRef.current?.(cached.is_liked, cached.like_count)
        console.log(`[useLike] Using cached data for ${templateId}`)
        return
      }
    }

    // 登录用户：静默校对服务器真实状态
    if (user) {
      let isMounted = true
      const enableLoading = !hasInitial // 有初始值时不展示loading动画，静默刷新

      // 添加超时机制避免无限loading，但不显示错误提示
      const timeoutId = setTimeout(() => {
        if (isMounted && loading) {
          console.warn('useLike: Loading timeout for template', templateId)
          setLoading(false)
        }
      }, 5000)

      const loadStatus = async () => {
        try {
          if (enableLoading) setLoading(true)
          setError(null)
          const requestStartedAt = Date.now()
          const startVersion = stateVersion.current
          
          // 🚀 智能基线加载：检查是否有最近的用户操作
          const cached = likesCacheService.get(templateId)
          const hasRecentUserAction = cached && 
            (cached.source === 'optimistic' || cached.source === 'sync') &&
            (Date.now() - cached.cached_at < 5 * 60 * 1000) // 5分钟内的用户操作
          
          if (hasRecentUserAction) {
            console.debug(`[useLike] 跳过基线加载，保护用户操作: ${templateId} (${cached.source}, ${Math.round((Date.now() - cached.cached_at) / 1000)}s前)`)
            if (enableLoading) setLoading(false)
            return
          }
          
          // 强制绕过缓存，确保与服务器一致，避免"先+1再-1"的回弹
          console.debug(`[useLike] 执行基线加载: ${templateId}`)
          const status = await templateLikeService.checkLikeStatus(templateId, { forceRefresh: true, silent: true })
          
          if (isMounted) {
            // 🚀 二次检查：如果在请求期间用户进行了操作，丢弃本次结果
            const latestCached = likesCacheService.get(templateId)
            const hasNewUserAction = latestCached && 
              (latestCached.source === 'optimistic' || latestCached.source === 'sync') &&
              latestCached.cached_at > requestStartedAt
            
            if (hasNewUserAction) {
              console.debug(`[useLike] 基线加载期间有用户操作，丢弃结果: ${templateId}`)
              if (enableLoading) setLoading(false)
              return
            }
            
            // 如果期间用户进行了切换，丢弃本次结果，避免覆盖乐观/最终状态
            if (status && !isTogglingRef.current && stateVersion.current === startVersion && lastOperationTime.current <= requestStartedAt) {
              setIsLiked(status.is_liked)
              setLikeCount(status.like_count)
              onLikeChangeRef.current?.(status.is_liked, status.like_count)
              console.debug(`[useLike] 基线加载完成: ${templateId}`, { liked: status.is_liked, count: status.like_count })
            }
            if (enableLoading) setLoading(false)
          }
        } catch (err) {
          console.error('Error loading initial like status:', err)
          if (isMounted) {
            // 静默处理错误，不显示用户提示
            if (enableLoading) setLoading(false)
          }
        }
      }

      loadStatus()

      return () => {
        isMounted = false
        clearTimeout(timeoutId)
      }
    }
  }, [user?.id, templateId]) // 仅在用户或模板变化时运行，避免因回调引用变化重置

  // 🚀 订阅缓存更新，当缓存中的数据更新时自动重新渲染
  useEffect(() => {
    if (!templateId || !subscribeToCache) return

    const unsubscribe = likesCacheService.subscribe(templateId, (updatedStatus) => {
      // 防递归：只更新状态，不调用onLikeChange避免触发父组件重渲染
      setIsLiked(updatedStatus.is_liked)
      setLikeCount(updatedStatus.like_count)
    })

    return unsubscribe
  }, [templateId, subscribeToCache])

  // 🚀 一致性优先架构：原子化点赞操作
  const toggleLike = useCallback(async () => {
    if (!user) {
      setError('请先登录')
      return
    }

    if (!templateId) {
      setError('模板ID无效')
      return
    }

    // 🚀 强化防抖保护：检查操作时间间隔
    const now = Date.now()
    const timeSinceLastOperation = now - lastOperationTime.current
    
    if (isToggling) {
      console.debug(`[useLike] 操作进行中，跳过重复点击: ${templateId}`)
      return // 防止重复点击
    }

    if (timeSinceLastOperation < MIN_OPERATION_INTERVAL) {
      console.debug(`[useLike] 操作过于频繁，跳过: ${templateId}，距离上次操作${timeSinceLastOperation}ms`)
      return // 防止过于频繁的操作
    }

    lastOperationTime.current = now
    setIsToggling(true)
    setError(null)

    try {
      console.log(`[useLike] 🎯 开始一致性优先操作: ${templateId}`)
      
      // 🚀 步骤1：获取准确的服务器基准状态（修复跳变问题）
      let baselineState: { is_liked: boolean; like_count: number } | null = null
      let opVersion: number | null = null
      if (enableOptimisticUpdate) {
        // 🚀 智能基准获取：检查本地缓存新鲜度
        const cached = likesCacheService.get(templateId)
        const cacheAge = likesCacheService.getCacheAge(templateId)
        const cacheIsFresh = likesCacheService.isCacheFresh(templateId, 60 * 1000) // 1分钟新鲜度
        
        // 🚀 增强基准获取逻辑：对于用户操作数据，使用更严格的新鲜度要求
        const isUserActionCache = cached && (cached.source === 'optimistic' || cached.source === 'sync')
        const strictFreshness = isUserActionCache ? likesCacheService.isCacheFresh(templateId, 10 * 1000) : cacheIsFresh // 用户操作缓存要求10秒内新鲜
        const shouldFetchBaseline = !disableBaselineLoad || !strictFreshness
        
        if (shouldFetchBaseline) {
          const cacheInfo = cached ? `${Math.round(cacheAge/1000)}s前,${cached.source}` : '无'
          const freshInfo = !strictFreshness ? (isUserActionCache ? ',用户操作缓存需更严格新鲜度' : ',已过期') : ''
          console.log(`[useLike] 📡 获取服务器基准状态... (缓存${cacheInfo}${freshInfo})`)
          // 获取准确的服务器基准状态，避免基于过期数据计算
          baselineState = await templateLikeService.checkLikeStatus(templateId, { forceRefresh: true, silent: true })
          if (!baselineState) {
            throw new Error('无法获取模板状态')
          }
          opVersion = ++stateVersion.current
          console.log(`[useLike] ✅ 基准状态获取成功 (v${opVersion}):`, {
            isLiked: baselineState.is_liked,
            likeCount: baselineState.like_count,
            source: '服务器'
          })
        } else {
          // 使用新鲜的缓存数据作为基线
          baselineState = { 
            is_liked: cached.is_liked, 
            like_count: cached.like_count 
          }
          opVersion = ++stateVersion.current
          console.log(`[useLike] ✅ 使用新鲜缓存作为基准 (v${opVersion}):`, {
            isLiked: baselineState.is_liked,
            likeCount: baselineState.like_count,
            source: `缓存(${cached.source})`,
            age: `${Math.round(cacheAge/1000)}s前`,
            strictCheck: isUserActionCache ? '严格检查' : '标准检查'
          })
        }
        
        // 🚀 基于准确基线进行乐观更新计算（支持状态异常时的重新计算）
        let optimisticIsLiked = !baselineState.is_liked
        let optimisticCount = optimisticIsLiked
          ? baselineState.like_count + 1
          : Math.max(0, baselineState.like_count - 1)
        
        // 🚀 额外验证：检查乐观更新是否合理
        const action = optimisticIsLiked ? '点赞' : '取消点赞'
        const isValidUpdate = optimisticIsLiked ? 
          (baselineState.is_liked === false) : 
          (baselineState.is_liked === true)
        
        console.log(`[useLike] 🚀 乐观更新计算 (v${opVersion}):`, {
          from: { liked: baselineState.is_liked, count: baselineState.like_count },
          to: { liked: optimisticIsLiked, count: optimisticCount },
          action,
          valid: isValidUpdate ? '✅ 状态转换合理' : '⚠️ 状态转换异常'
        })
        
        // 🚀 如果状态转换不合理，强制获取最新服务器状态
        if (!isValidUpdate) {
          console.warn(`[useLike] ⚠️ 检测到异常状态转换，强制获取最新服务器状态`)
          const latestState = await templateLikeService.checkLikeStatus(templateId, { forceRefresh: true, silent: true })
          if (latestState) {
            baselineState = latestState
            optimisticIsLiked = !baselineState.is_liked
            optimisticCount = optimisticIsLiked
              ? baselineState.like_count + 1
              : Math.max(0, baselineState.like_count - 1)
            
            console.log(`[useLike] 🔄 基于最新服务器状态重新计算 (v${opVersion}):`, {
              from: { liked: baselineState.is_liked, count: baselineState.like_count },
              to: { liked: optimisticIsLiked, count: optimisticCount },
              action: optimisticIsLiked ? '点赞' : '取消点赞'
            })
          }
        }
        
        // 立即更新UI（零延迟）
        setIsLiked(optimisticIsLiked)
        setLikeCount(optimisticCount)
        onLikeChangeRef.current?.(optimisticIsLiked, optimisticCount)
        likesCacheService.updateLikeStatus(templateId, optimisticIsLiked, optimisticCount, 'optimistic')
      } else {
        setLoading(true)
      }

      // 🚀 步骤3：执行服务器操作
      console.log(`[useLike] 🔄 执行服务器操作...`)
      // 若未启用乐观更新，此时补充版本号，保证日志一致
      if (opVersion === null) opVersion = ++stateVersion.current
      const result: ToggleLikeResult = await templateLikeService.toggleLike(templateId)

      if (result.success) {
        console.log(`[useLike] ✅ 服务器操作成功 (v${opVersion}):`, {
          isLiked: result.is_liked,
          likeCount: result.like_count
        })
        
        // 🚀 步骤4：验证服务器结果并智能应用
        // 检查服务器返回的结果是否符合预期的操作结果
        const expectedIsLiked = baselineState ? !baselineState.is_liked : result.is_liked
        const serverResultMismatch = result.is_liked !== expectedIsLiked
        
        if (serverResultMismatch) {
          console.warn(`[useLike] ⚠️ 服务器结果与预期不符: 预期${expectedIsLiked ? '点赞' : '取消点赞'}, 实际${result.is_liked ? '点赞' : '取消点赞'}`)
          
          // 服务器结果不符合预期，可能有其他用户同时操作，直接使用服务器结果但记录警告
          console.warn(`[useLike] 🔄 使用服务器权威结果: ${result.is_liked ? '已点赞' : '未点赞'}, 点赞数: ${result.like_count}`)
        }
        
        // 直接应用服务器的权威结果
        setIsLiked(result.is_liked)
        setLikeCount(result.like_count)
        onLikeChangeRef.current?.(result.is_liked, result.like_count)
        
        // 确保所有缓存层数据一致（同一操作的服务器确认结果）
        likesCacheService.updateLikeStatus(templateId, result.is_liked, result.like_count, 'sync')
        
        console.log(`[useLike] 🎉 操作完成，状态已同步 (v${opVersion})`)
        
      } else {
        console.error(`[useLike] ❌ 服务器操作失败:`, result.error)
        
        // 操作失败，恢复到基准状态
        if (baselineState) {
          setIsLiked(baselineState.is_liked)
          setLikeCount(baselineState.like_count)
          onLikeChangeRef.current?.(baselineState.is_liked, baselineState.like_count)
        }
        
        // 恢复缓存（回滚到基准状态）
        if (baselineState) {
          likesCacheService.updateLikeStatus(templateId, baselineState.is_liked, baselineState.like_count, 'sync')
        }
        
        setError(result.error || '操作失败')
      }
    } catch (err) {
      console.error(`[useLike] 💥 操作异常:`, err)
      
      // 发生异常，刷新状态
      try {
        const currentState = await templateLikeService.checkLikeStatus(templateId)
        if (currentState) {
          setIsLiked(currentState.is_liked)
          setLikeCount(currentState.like_count)
          onLikeChangeRef.current?.(currentState.is_liked, currentState.like_count)
          likesCacheService.updateLikeStatus(templateId, currentState.is_liked, currentState.like_count, 'sync')
        }
      } catch (refreshErr) {
        console.error(`[useLike] 状态刷新失败:`, refreshErr)
      }
      
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
      setIsToggling(false)
    }
  }, [
    user, 
    templateId, 
    isToggling, 
    enableOptimisticUpdate
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
