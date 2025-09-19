/**
 * 重构后的 VideosPage 组件
 * 使用新的 VideoTaskManager 和 VideoPollingService
 * 简化状态管理，提升可靠性
 */

import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Download, 
  Share2, 
  Trash2, 
  Eye, 
  Search,
  Grid,
  List,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  Lock
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import supabaseVideoService from '@/services/supabaseVideoService'
import videoShareService from '@/services/videoShareService'
import { getPlayerUrl, getUrlInfo, getBestVideoUrl } from '@/utils/videoUrlPriority'
import VideoShareModal from '@/components/share/VideoShareModal'
import { videoTaskManager, type VideoTask } from '@/services/VideoTaskManager'
import { videoPollingService } from '@/services/VideoPollingService'
import { progressManager, type VideoProgress } from '@/services/progressManager'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthContext } from '@/contexts/AuthContext'
import type { Database } from '@/lib/supabase'
import { formatRelativeTime, formatDuration } from '@/utils/timeFormat'
import { toast } from 'sonner'
import { SubscriptionService } from '@/services/subscriptionService'
import { useSEO } from '@/hooks/useSEO'
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'
import { videoCacheService } from '@/services/videoCacheService'
import analyticsService from '@/services/analyticsService'
import PerformanceStats from '@/components/debug/PerformanceStats'
import VirtualizedVideoGrid from '@/components/video/VirtualizedVideoGrid'

type Video = Database['public']['Tables']['videos']['Row']

export default function VideosPageNew() {
  const { t } = useTranslation()
  const authContext = useContext(AuthContext)
  const user = authContext?.user
  const navigate = useNavigate()
  const [/* searchParams */] = useSearchParams()

  // SEO优化
  useSEO('videos')

  // 状态管理
  const [videos, setVideos] = useState<Video[]>([])
  const [activeTasks, setActiveTasks] = useState<Map<string, VideoTask>>(new Map())
  const [/* videoProgress */, setVideoProgress] = useState<Map<string, VideoProgress>>(new Map())
  // 🚀 多级加载状态管理 - 解决长时间骨架UI问题
  const [loadingState, setLoadingState] = useState({
    initial: true,      // 初始骨架UI状态
    basicLoaded: false, // 基础数据已加载（首屏视频）
    fullLoaded: false   // 完整数据已加载（任务状态、订阅等）
  })
  // 兼容性：保留原有的loading和isInitialLoad状态
  const loading = loadingState.initial
  const isInitialLoad = loadingState.initial
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  
  // 订阅状态管理
  const [isPaidUser, setIsPaidUser] = useState<boolean>(false)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)
  
  // 实时更新状态 - 用于触发耗时显示的重新渲染
  const [currentTime, setCurrentTime] = useState(Date.now())

  // 分页常量
  const ITEMS_PER_PAGE = 10
  
  // 移动端检测和动态分页配置
  const isMobile = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  // 🚀 移动端优化：动态分页大小
  const getOptimalPageSize = () => {
    const viewportWidth = window.innerWidth
    if (viewportWidth < 640) return 6      // 手机：6个视频
    if (viewportWidth < 1024) return 9     // 平板：9个视频
    return 12                              // 桌面：12个视频
  }
  
  const QUICK_LOAD_PAGE_SIZE = isMobile ? 6 : 9  // 快速加载的视频数量
  
  // 📊 性能监控状态
  const [performanceMetrics, setPerformanceMetrics] = useState({
    pageLoadStart: 0,
    firstContentfulPaint: 0,
    timeToInteractive: 0,
    cacheHitCount: 0,
    networkRequestCount: 0,
    totalLoadTime: 0
  })

  // 通知状态（已移除，改用toast）

  // 删除对话框
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    video: Video | null
  }>({ open: false, video: null })

  // 分享状态
  const [videoShareModalOpen, setVideoShareModalOpen] = useState(false)
  const [selectedShareVideo, setSelectedShareVideo] = useState<Video | null>(null)

  // 虚拟滚动配置
  const [useVirtualization, setUseVirtualization] = useState(false)
  const [containerDimensions, setContainerDimensions] = useState({ width: 1200, height: 600 })

  /**
   * 📊 初始化性能监控
   */
  useEffect(() => {
    if (!user) return
    
    const pageLoadStart = performance.now()
    setPerformanceMetrics(prev => ({ ...prev, pageLoadStart }))
    
    // 监控首次内容绘制时间
    const measureFCP = () => {
      if ('getEntriesByType' in performance) {
        const paintEntries = performance.getEntriesByType('paint')
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
        
        if (fcpEntry) {
          setPerformanceMetrics(prev => ({
            ...prev,
            firstContentfulPaint: fcpEntry.startTime
          }))
          
          console.log(`[Performance] 🎨 FCP: ${fcpEntry.startTime.toFixed(1)}ms`)
          
          // 发送分析数据
          if (analyticsService && typeof analyticsService.track === 'function') {
            analyticsService.track('page_performance', {
              metric: 'first_contentful_paint',
              value: fcpEntry.startTime,
              device_type: isMobile ? 'mobile' : 'desktop',
              page: 'videos'
            })
          }
        }
      }
    }
    
    // 延迟测量FCP，确保渲染完成
    setTimeout(measureFCP, 100)
    
    return () => {
      // 组件卸载时发送最终性能数据
      const totalTime = performance.now() - pageLoadStart
      console.log(`[Performance] 📊 总加载时间: ${totalTime.toFixed(1)}ms`)
      
      if (analyticsService && typeof analyticsService.track === 'function') {
        analyticsService.track('page_performance_summary', {
          total_time: totalTime,
          cache_hit_count: performanceMetrics.cacheHitCount,
          network_request_count: performanceMetrics.networkRequestCount,
          device_type: isMobile ? 'mobile' : 'desktop',
          page: 'videos'
        })
      }
    }
  }, [user])
  
  /**
   * 🚀 快速加载：优先从缓存显示，后台更新数据
   */
  const quickLoad = async () => {
    const startTime = performance.now()
    const loadingPhase = isMobile ? 'mobile_quick_load' : 'desktop_quick_load'
    
    try {
      console.log('[VideosPage] 🚀 开始快速加载流程...')
      
      // 🚀 Step 1: 立即检查缓存
      const cacheResult = videoCacheService.getCachedVideos(
        user!.id,
        undefined,
        { page: 1, pageSize: QUICK_LOAD_PAGE_SIZE }
      )
      
      if (cacheResult) {
        // 立即显示缓存数据，隐藏骨架UI
        setVideos(cacheResult.videos)
        setLoadingState(prev => ({
          ...prev,
          initial: false,
          basicLoaded: true
        }))
        
        const cacheTime = performance.now() - startTime
        
        // 📊 更新性能指标
        setPerformanceMetrics(prev => ({
          ...prev,
          cacheHitCount: prev.cacheHitCount + 1,
          timeToInteractive: cacheTime,
          totalLoadTime: cacheTime
        }))
        
        console.log(`[VideosPage] 📦 缓存命中！立即显示${cacheResult.videos.length}个视频 (${cacheTime.toFixed(1)}ms)`)
        
        // 📊 发送缓存命中分析
        if (analyticsService && typeof analyticsService.track === 'function') {
          analyticsService.track('cache_performance', {
            type: 'cache_hit',
            load_time: cacheTime,
            video_count: cacheResult.videos.length,
            device_type: isMobile ? 'mobile' : 'desktop',
            phase: loadingPhase
          })
        }
        
        // 后台更新数据
        backgroundLoad(true) // 传入true表示是缓存命中后的更新
        return
      }
      
      // 🚀 Step 2: 缓存未命中，加载新数据
      console.log('[VideosPage] 🌐 缓存未命中，从网络加载数据...')
      
      const networkStartTime = performance.now()
      
      const result = await supabaseVideoService.getUserVideos(
        user!.id, 
        undefined,
        { page: 1, pageSize: QUICK_LOAD_PAGE_SIZE }
      )
      
      const networkEndTime = performance.now()
      const networkTime = networkEndTime - networkStartTime
      const totalTime = networkEndTime - startTime
      
      // 显示数据并缓存
      setVideos(result.videos)
      videoCacheService.cacheVideos(
        user!.id,
        result.videos,
        result.total,
        result.page,
        result.pageSize,
        undefined,
        { page: 1, pageSize: QUICK_LOAD_PAGE_SIZE }
      )
      
      // 隐藏骨架UI
      setLoadingState(prev => ({
        ...prev,
        initial: false,
        basicLoaded: true
      }))
      
      // 📊 更新性能指标
      setPerformanceMetrics(prev => ({
        ...prev,
        networkRequestCount: prev.networkRequestCount + 1,
        timeToInteractive: totalTime,
        totalLoadTime: totalTime
      }))
      
      console.log(`[VideosPage] ✅ 网络加载完成，获取${result.videos.length}个视频 (网络:${networkTime.toFixed(1)}ms, 总计:${totalTime.toFixed(1)}ms)`)
      
      // 📊 发送网络加载分析
      if (analyticsService && typeof analyticsService.track === 'function') {
        analyticsService.track('network_performance', {
          type: 'cache_miss',
          network_time: networkTime,
          total_time: totalTime,
          video_count: result.videos.length,
          device_type: isMobile ? 'mobile' : 'desktop',
          phase: loadingPhase
        })
      }
      
      // 启动后台加载
      backgroundLoad(false)
      
    } catch (error) {
      const errorTime = performance.now() - startTime
      
      console.error('[VideosPage] 快速加载失败:', error)
      
      // 📊 记录错误指标
      if (analyticsService && typeof analyticsService.track === 'function') {
        analyticsService.track('loading_error', {
          error_type: 'quick_load_failed',
          error_time: errorTime,
          device_type: isMobile ? 'mobile' : 'desktop',
          error_message: error instanceof Error ? error.message : 'unknown'
        })
      }
      
      // 失败时尝试使用过期缓存
      const fallbackCache = videoCacheService.getCachedVideos(
        user!.id,
        undefined,
        { page: 1, pageSize: QUICK_LOAD_PAGE_SIZE }
      )
      
      if (fallbackCache) {
        console.log('[VideosPage] 🚑 使用备用缓存数据')
        setVideos(fallbackCache.videos)
        toast.info('网络不稳定，显示缓存数据')
      }
      
      // 无论如何都要隐藏骨架UI
      setLoadingState(prev => ({
        ...prev,
        initial: false,
        basicLoaded: true
      }))
    }
  }
  
  /**
   * 📚 后台加载：加载任务状态、订阅信息等非关键数据
   */
  const backgroundLoad = async (isCacheHit = false) => {
    try {
      console.log('[VideosPage] 📚 开始后台加载非关键数据...')
      
      // 并行加载任务状态和订阅信息
      const [tasks, subscription] = await Promise.all([
        videoTaskManager.initialize(user!.id),
        SubscriptionService.getCurrentSubscription(user!.id)
      ])
      
      // 设置订阅状态
      setIsPaidUser(subscription?.status === 'active' || false)
      setSubscriptionLoading(false)
      
      const taskMap = new Map(tasks.map(task => [task.id, task]))
      setActiveTasks(taskMap)

      // 启动轮询服务
      if (tasks.length > 0) {
        videoPollingService.start({
          userId: user!.id,
          onTaskUpdate: handleTaskUpdate,
          onTaskComplete: handleTaskComplete,
          onTaskFailed: handleTaskFailed
        })
        console.log(`[VideosPage] 🔄 轮询服务已启动，监控 ${tasks.length} 个任务`)
        
        // 订阅进度更新
        tasks.forEach(task => {
          progressManager.getProgressWithFallback(task.id, 'processing').then(initialProgress => {
            if (initialProgress) {
              setVideoProgress(prev => {
                const newMap = new Map(prev)
                newMap.set(task.id, initialProgress)
                return newMap
              })
            }
          })
          
          progressManager.subscribe(task.id, (progress) => {
            setVideoProgress(prev => {
              const newMap = new Map(prev)
              newMap.set(task.id, progress)
              return newMap
            })
          })
        })
      }
      
      // 加载更多视频（如果用户有超过首屏数量的视频）
      await loadMoreVideosIfNeeded(isCacheHit)
      
      // 标记全部加载完成
      setLoadingState(prev => ({
        ...prev,
        fullLoaded: true
      }))
      
      // 📊 记录页面可交互时间
      const timeToInteractive = performance.now() - performanceMetrics.pageLoadStart
      setPerformanceMetrics(prev => ({
        ...prev,
        timeToInteractive,
        totalLoadTime: timeToInteractive
      }))
      
      console.log(`[Performance] 🚀 页面可交互: ${timeToInteractive.toFixed(1)}ms`)
      console.log(`[VideosPage] ✅ 后台加载完成 ${isCacheHit ? '(缓存命中)' : '(直接加载)'}`)
      
      // 📊 发送完整加载性能分析数据  
      if (analyticsService && typeof analyticsService.track === 'function') {
        analyticsService.track('videos_page_load_complete', {
          time_to_interactive: timeToInteractive,
          cache_hit: isCacheHit,
          device_type: isMobile ? 'mobile' : 'desktop',
          videos_count: videos.length,
          loading_strategy: 'layered_loading'
        })
      }
      
    } catch (error) {
      console.error('[VideosPage] 后台加载失败:', error)
      // 后台加载失败不影响基础UI显示
    }
  }
  
  /**
   * 加载更多视频（如果用户有更多视频）
   */
  const loadMoreVideosIfNeeded = async (isCacheHit = false) => {
    try {
      let shouldUpdate = true
      
      if (isCacheHit) {
        // 缓存命中时，静悄更新数据
        const freshResult = await supabaseVideoService.getUserVideos(
          user!.id, 
          undefined,
          { page: 1, pageSize: QUICK_LOAD_PAGE_SIZE }
        )
        
        // 检查数据是否有变化
        const currentVideoIds = videos.map(v => v.id).sort()
        const freshVideoIds = freshResult.videos.map(v => v.id).sort()
        const hasChanges = JSON.stringify(currentVideoIds) !== JSON.stringify(freshVideoIds)
        
        if (hasChanges) {
          console.log('[VideosPage] 🔄 检测到数据变化，更新显示')
          setVideos(freshResult.videos)
          
          // 更新缓存
          videoCacheService.cacheVideos(
            user!.id,
            freshResult.videos,
            freshResult.total,
            freshResult.page,
            freshResult.pageSize,
            undefined,
            { page: 1, pageSize: QUICK_LOAD_PAGE_SIZE }
          )
        } else {
          console.log('[VideosPage] ✅ 缓存数据仍然最新')
        }
      }
      
      // 加载更多视频
      const totalResult = await supabaseVideoService.getUserVideos(
        user!.id, 
        undefined,
        { page: 1, pageSize: 50 }
      )
      
      if (totalResult.videos.length > QUICK_LOAD_PAGE_SIZE) {
        setVideos(totalResult.videos)
        
        // 缓存全量数据
        videoCacheService.cacheVideos(
          user!.id,
          totalResult.videos,
          totalResult.total,
          totalResult.page,
          totalResult.pageSize,
          undefined,
          { page: 1, pageSize: 50 }
        )
        
        console.log(`[VideosPage] 加载更多视频，总数: ${totalResult.videos.length}`)
      }
    } catch (error) {
      console.error('[VideosPage] 加载更多视频失败:', error)
    }
  }

  /**
   * 初始化页面数据 - 优化依赖，避免重复渲染
   */
  useEffect(() => {
    if (!user?.id) return

    console.log('[VideosPage] 🚀 初始化移动端优化加载流程')
    
    // 立即开始快速加载，不等待
    quickLoad()

    // 清理函数
    return () => {
      videoPollingService.stop()
      videoTaskManager.cleanup()
    }
  }, [user?.id]) // 🚀 仅依赖用户ID，避免重复渲染

  // 智能实时更新定时器 - 根据设备性能和页面可见性优化
  useEffect(() => {
    // 只有当有活跃任务时才启动定时器
    if (activeTasks.size > 0) {
      // 检测设备类型和性能
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const isLowPerformance = navigator.hardwareConcurrency <= 4 // CPU核心数少于等于4的设备
      
      // 根据设备性能调整更新频率：移动端10秒，低性能设备8秒，正常设备5秒
      const updateInterval = isMobile ? 10000 : (isLowPerformance ? 8000 : 5000)
      
      let isPageVisible = !document.hidden
      
      // 页面可见性监听
      const handleVisibilityChange = () => {
        isPageVisible = !document.hidden
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      const timer = setInterval(() => {
        // 只在页面可见时更新，节省资源
        if (isPageVisible) {
          setCurrentTime(Date.now())
        }
      }, updateInterval)
      
      return () => {
        clearInterval(timer)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [activeTasks.size])

  // 订阅处理中视频的 ProgressManager 进度更新
  useEffect(() => {
    if (!user) return

    const subscriptions: (() => void)[] = []
    
    // 为所有处理中的视频订阅进度更新
    videos.forEach(video => {
      if (video.status === 'processing' || video.status === 'pending') {
        const unsubscribe = progressManager.subscribe(video.id, (progress) => {
          // 同时更新 activeTasks 中的进度
          setActiveTasks(prev => {
            const newMap = new Map(prev)
            const existingTask = newMap.get(video.id)
            if (existingTask) {
              newMap.set(video.id, {
                ...existingTask,
                progress: progress.progress,
                statusText: progress.statusText || existingTask.statusText
              })
            }
            return newMap
          })
        })
        
        subscriptions.push(unsubscribe)
      }
    })

    return () => {
      subscriptions.forEach(unsub => unsub())
    }
  }, [videos, user])

  // 移除复杂的缓存初始化逻辑 - 改为LazyVideoPlayer按需生成

  /**
   * 加载视频列表 - 保留兼容性，但现在主要由quickLoad和loadMoreVideosIfNeeded使用
   */
  const loadVideos = async (pageSize?: number) => {
    if (!user) return

    try {
      const result = await supabaseVideoService.getUserVideos(
        user.id, 
        undefined, // filter
        { page: 1, pageSize: pageSize || getOptimalPageSize() } // 使用优化的分页大小
      )
      setVideos(result.videos)
      return result
    } catch (error) {
      console.error('[VideosPage] 加载视频失败:', error)
      toast.error(t('videos.loadVideosFailed'))
      throw error
    }
  }

  /**
   * 处理任务更新
   */
  const handleTaskUpdate = (task: VideoTask) => {
    // console.log(`[VideosPage] 任务进度更新: ${task.id} - ${task.progress}%`)
    
    // 获取 ProgressManager 的最新进度，优先使用智能模拟进度
    const smartProgress = progressManager.getProgress(task.id)
    const finalTask = smartProgress ? {
      ...task,
      progress: smartProgress.progress,
      statusText: smartProgress.statusText || task.statusText
    } : task
    
    setActiveTasks(prev => {
      const newMap = new Map(prev)
      newMap.set(task.id, finalTask)
      return newMap
    })
  }

  /**
   * 处理任务完成
   */
  const handleTaskComplete = async (task: VideoTask) => {
    console.log(`[VideosPage] 任务完成: ${task.id}`)
    
    // 1. 移除活跃任务
    setActiveTasks(prev => {
      const newMap = new Map(prev)
      newMap.delete(task.id)
      return newMap
    })
    
    // 2. 清理进度数据
    setVideoProgress(prev => {
      const newMap = new Map(prev)
      newMap.delete(task.id)
      return newMap
    })

    // 2. 重新加载视频列表以获取最新数据
    await loadVideos()

    // 3. 显示简单的toast提示
    const latestVideo = await supabaseVideoService.getVideo(task.id)
    if (latestVideo) {
      toast.success(t('videos.videoGenerationComplete'), {
        description: latestVideo.title || t('videos.videoGenerationCompleteDescription')
      })
    }

    // 停止轮询（如果没有其他活跃任务）
    if (videoTaskManager.getActiveTasks().length === 0) {
      videoPollingService.stop()
    }
  }

  /**
   * 处理任务失败
   */
  const handleTaskFailed = async (task: VideoTask) => {
    console.log(`[VideosPage] 任务失败: ${task.id}`)
    
    // 1. 移除活跃任务
    setActiveTasks(prev => {
      const newMap = new Map(prev)
      newMap.delete(task.id)
      return newMap
    })

    // 2. 重新加载视频列表
    await loadVideos()

    // 3. 显示错误通知
    toast.error(t('videos.videoGenerationFailed'), {
      description: task.errorMessage || t('videos.generationError')
    })

    // 停止轮询（如果没有其他活跃任务）
    if (videoTaskManager.getActiveTasks().length === 0) {
      videoPollingService.stop()
    }
  }

  /**
   * 获取视频的当前任务状态
   */
  const getVideoTask = (videoId: string): VideoTask | null => {
    return activeTasks.get(videoId) || null
  }

  /**
   * 计算任务耗时（秒）
   */
  const getTaskElapsedTime = (task: VideoTask): number => {
    const elapsed = currentTime - task.startedAt.getTime()
    return Math.floor(elapsed / 1000) // 转换为秒
  }

  /**
   * 检查视频是否正在处理
   */
  const isVideoProcessing = (video: Video): boolean => {
    const task = getVideoTask(video.id)
    return task ? (task.status === 'processing' || task.status === 'pending') : false
  }

  /**
   * 删除视频
   */
  const handleDeleteVideo = async (video: Video) => {
    if (!user) {
      console.error('[VideosPageNew] 删除视频失败：用户未登录')
      toast.error(t('videos.loginRequired'))
      return
    }

    try {
      console.log(`[VideosPageNew] 开始永久删除视频: ${video.id}, 用户: ${user.id}`)
      
      const success = await supabaseVideoService.hardDeleteVideo(video.id, user.id)
      
      if (!success) {
        throw new Error('硬删除操作失败')
      }
      
      // 关键：立即从任务管理器中移除任务，避免继续轮询
      if (activeTasks.has(video.id)) {
        // 从任务管理器中移除（立即停止轮询）
        await videoTaskManager.removeTask(video.id)
        
        // 从本地状态中移除
        setActiveTasks(prev => {
          const newMap = new Map(prev)
          newMap.delete(video.id)
          return newMap
        })
        
        console.log(`[VideosPageNew] 已从任务管理器移除任务: ${video.id}`)
      }
      
      await loadVideos()
      setDeleteDialog({ open: false, video: null })
      
      console.log(`[VideosPageNew] 视频删除成功: ${video.id}`)
      toast.success(t('videos.videoDeleted'))
    } catch (error) {
      console.error('[VideosPageNew] 删除视频失败:', error)
      toast.error(t('videos.deleteFailed'))
    }
  }

  /**
   * 分享视频
   */
  const handleShareVideo = async (video: Video) => {
    try {
      const shareData = await videoShareService.generateShareLink(video.id)
      
      if (navigator.share) {
        await navigator.share({
          title: video.title || 'AI Generated Video',
          text: video.description || 'Check out this AI generated video!',
          url: typeof shareData === 'string' ? shareData : shareData.shareUrl
        })
      } else {
        await navigator.clipboard.writeText(typeof shareData === 'string' ? shareData : shareData.shareUrl)
        toast.success(t('videos.shareLinkCopied'))
      }
      
      await supabaseVideoService.incrementInteraction(video.id, 'share_count')
    } catch (error) {
      console.error('[VideosPage] 分享失败:', error)
      toast.error(t('videos.shareFailed'))
    }
  }

  /**
   * 虚拟滚动回调函数
   */
  const handleVirtualPlay = useCallback(async (video: Video) => {
    await supabaseVideoService.incrementInteraction(video.id, 'view_count')
  }, [])

  const handleVirtualRegenerate = useCallback((video: Video) => {
    const templateId = video.metadata?.templateId || video.template_id
    if (templateId) {
      const params = video.parameters || {}
      const paramsStr = encodeURIComponent(JSON.stringify(params))
      navigate(`/create?template=${templateId}&params=${paramsStr}`)
    } else {
      navigate('/create')
    }
  }, [navigate])

  const handleVirtualShare = useCallback((video: Video) => {
    setSelectedShareVideo(video)
    setVideoShareModalOpen(true)
  }, [])

  const handleVirtualDelete = useCallback((video: Video) => {
    setDeleteDialog({ open: true, video })
  }, [])

  /**
   * 处理下载按钮点击
   */
  const handleDownloadClick = async (video: Video) => {
    if (!user) {
      toast.error(t('videos.loginRequired'))
      return
    }

    if (!isPaidUser) {
      // 免费用户 - 显示升级提示并跳转到定价页面
      toast.info(t('videos.upgradePrompt.title'), {
        description: t('videos.upgradePrompt.description'),
        duration: 4000,
        action: {
          label: t('videos.upgradePrompt.upgradeNow'),
          onClick: () => navigate('/pricing')
        }
      })
      
      // 延迟跳转，让用户看到提示
      setTimeout(() => {
        navigate('/pricing')
      }, 1500)
      return
    }

    // 付费用户 - 直接下载，优先使用R2 URL
    const bestUrl = getPlayerUrl(video)
    if (!bestUrl) {
      toast.error(t('videos.videoUrlNotExists'))
      return
    }

    try {
      const link = document.createElement('a')
      link.href = bestUrl
      link.download = `${video.title || 'video'}-${video.id}.mp4`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 记录URL使用情况（调试用）
      const urlInfo = getUrlInfo(video)
      if (urlInfo) {
        console.log(`[VideosPage] 下载使用 ${urlInfo.source} URL:`, urlInfo.selected)
      }

      // 更新下载计数
      await supabaseVideoService.incrementInteraction(video.id, 'download_count')
      
      // 重新加载视频列表以更新计数
      loadVideos()
      
      toast.success(t('videos.downloadStarted'), {
        duration: 3000
      })
      
    } catch (error) {
      console.error('[VideosPage] 下载失败:', error)
      toast.error(t('videos.downloadFailed'), {
        duration: 3000
      })
    }
  }

  // 过滤视频
  const filteredVideos = videos.filter(video => {
    // 搜索过滤
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = 
        video.title?.toLowerCase().includes(searchLower) ||
        video.description?.toLowerCase().includes(searchLower) ||
        video.prompt?.toLowerCase().includes(searchLower)
      
      if (!matchesSearch) return false
    }

    // 状态过滤
    if (filter === 'all') return true
    if (filter === 'processing') {
      return video.status === 'processing' || video.status === 'pending' || isVideoProcessing(video)
    }
    return video.status === filter
  })

  // 分页逻辑
  const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE)
  const paginatedVideos = filteredVideos.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  // 当过滤条件改变时重置页码
  React.useEffect(() => {
    setPage(1)
  }, [filter, searchTerm])

  // 智能虚拟滚动：当视频数量超过阈值时自动启用
  React.useEffect(() => {
    const VIRTUALIZATION_THRESHOLD = isMobile ? 20 : 50
    const shouldUseVirtualization = filteredVideos.length > VIRTUALIZATION_THRESHOLD
    
    if (shouldUseVirtualization !== useVirtualization) {
      setUseVirtualization(shouldUseVirtualization)
      console.log(`[VideosPage] ${shouldUseVirtualization ? '启用' : '禁用'}虚拟滚动 (${filteredVideos.length} 个视频)`)
    }
  }, [filteredVideos.length, isMobile, useVirtualization])

  // 响应式容器尺寸更新
  React.useEffect(() => {
    const updateContainerSize = () => {
      const width = window.innerWidth - 48 // 减去padding
      const height = Math.max(600, window.innerHeight - 300) // 减去header等高度
      setContainerDimensions({ width, height })
    }
    
    updateContainerSize()
    window.addEventListener('resize', updateContainerSize)
    return () => window.removeEventListener('resize', updateContainerSize)
  }, [])

  // 🚀 智能骨架UI：仅在初始加载时显示，根据设备类型动态调整数量
  if (loadingState.initial) {
    // 动态计算骨架UI数量
    const getSkeletonCount = () => {
      const viewportHeight = window.innerHeight
      const cardHeight = isMobile ? 350 : 400 // 移动端卡片更紧凑
      const visibleCount = Math.ceil(viewportHeight / cardHeight) + 1
      return Math.min(visibleCount, QUICK_LOAD_PAGE_SIZE) // 不超过首屏数量
    }
    
    const skeletonCount = getSkeletonCount()
    
    return (
      <div className="container mx-auto p-6">
        {/* 页面头部skeleton - 移动端优化 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className={`h-6 md:h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2 ${
              isMobile ? 'w-40' : 'w-48'
            }`}></div>
            <div className={`h-3 md:h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${
              isMobile ? 'w-48' : 'w-64'
            }`}></div>
          </div>
          <div className={`h-8 md:h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${
            isMobile ? 'w-32' : 'w-40'
          }`}></div>
        </div>
        
        {/* 过滤器skeleton - 移动端垂直布局 */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="h-8 md:h-10 flex-1 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-8 md:h-10 w-28 md:w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-8 md:h-10 w-16 md:w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        
        {/* 视频网格skeleton - 响应式网格 */}
        <div className={isMobile 
          ? 'grid grid-cols-2 gap-3' 
          : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6'
        }>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="space-y-2 md:space-y-3">
              <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-3 md:h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-2 md:h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              {/* 移动端显示更少的skeleton元素 */}
              {!isMobile && (
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              )}
            </div>
          ))}
        </div>
        
        {/* 移动端加载提示 */}
        {isMobile && (
          <div className="text-center mt-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              {t('videos.loadingOptimized')}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* 页面头部 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t('videos.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('videos.description', { 
              count: filteredVideos.length, 
              pagination: totalPages > 1 ? t('videos.paginationText', { current: page, total: totalPages }) : ''
            })}
          </p>
        </div>
        
        <Link to="/create">
          <Button className="w-full md:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            {t('videos.createNewVideo')}
          </Button>
        </Link>
      </div>

      {/* 过滤器和搜索 */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('videos.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="all">{t('videos.filterAll')}</option>
          <option value="completed">{t('videos.filterCompleted')}</option>
          <option value="processing">{t('videos.filterProcessing')}</option>
          <option value="failed">{t('videos.filterFailed')}</option>
        </select>

        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>


      {/* 视频列表 */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Eye className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {videos.length === 0 ? t('videos.noVideos') : t('videos.noMatchingVideos')}
          </h3>
          <p className="text-muted-foreground mb-6">
            {videos.length === 0 ? t('videos.noVideosDescription') : t('videos.noMatchingDescription')}
          </p>
          {videos.length === 0 && (
            <Link to="/create">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t('videos.createVideo')}
              </Button>
            </Link>
          )}
        </div>
      ) : useVirtualization ? (
        // 虚拟滚动模式：大量视频时自动启用
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              🚀 虚拟滚动已启用 ({filteredVideos.length} 个视频)
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUseVirtualization(false)}
              className="text-xs"
            >
              切换到普通模式
            </Button>
          </div>
          <VirtualizedVideoGrid
            videos={filteredVideos}
            viewMode={viewMode}
            isPaidUser={isPaidUser}
            subscriptionLoading={subscriptionLoading}
            isMobile={isMobile}
            getVideoTask={getVideoTask}
            getTaskElapsedTime={getTaskElapsedTime}
            onDownload={handleDownloadClick}
            onShare={handleVirtualShare}
            onDelete={handleVirtualDelete}
            onRegenerate={handleVirtualRegenerate}
            onPlay={handleVirtualPlay}
            containerWidth={containerDimensions.width}
            containerHeight={containerDimensions.height}
          />
        </div>
      ) : (
        // 传统分页模式：少量视频时使用
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              传统分页模式 ({paginatedVideos.length} / {filteredVideos.length} 个视频)
            </p>
            {filteredVideos.length > (isMobile ? 20 : 50) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseVirtualization(true)}
                className="text-xs"
              >
                启用虚拟滚动
              </Button>
            )}
          </div>
          <div className={viewMode === 'grid' ? 
            'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 
            'space-y-4'
          }>
            {paginatedVideos.map((video) => {
              // 加强验证video数据完整性，跳过无效记录
              if (!video?.id || typeof video.id !== 'string' || !video.id.trim()) {
                console.warn('[VideosPage] 跳过无效视频记录:', video)
                return null
              }
              
              const task = getVideoTask(video.id)
              return (
                <Card 
                  key={video.id}
                  className="overflow-hidden hover:shadow-lg transition-all duration-300"
                >
                  <div className="aspect-video relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-600">
                    {/* 视频渲染逻辑 - 添加额外的ID验证 */}
                    {(video.video_url || video.r2_url) && video.id ? (
                      (() => {
                        const urlResult = getBestVideoUrl(video)
                        const primaryUrl = getPlayerUrl(video) || getProxyVideoUrl(video.video_url || '')
                        const fallbackUrl = urlResult?.fallbackUrl ? getProxyVideoUrl(urlResult.fallbackUrl) : undefined
                        
                        return (
                          // 有视频URL - 显示视频播放器，优先使用R2 URL
                          <SimpleVideoPlayer
                            src={primaryUrl}
                            fallbackSrc={fallbackUrl}
                            poster={video.thumbnail_url || undefined}
                            className="w-full h-full"
                            autoPlayOnHover={!isMobile}
                            showPlayButton={true}
                            muted={false}
                            objectFit="cover"
                            videoId={video.id}
                            videoTitle={video.title || 'video'}
                            alt={video.title || 'Video preview'}
                            onPlay={() => {
                              // 增加播放计数
                              supabaseVideoService.incrementInteraction(video.id, 'view_count')
                            }}
                          />
                        )
                      })()
                    ) : task && (task.status === 'processing' || task.status === 'pending') ? (
                      // 正在处理 - 显示进度（流体背景）
                      <div className="w-full h-full flowing-background flex items-center justify-center">
                        {/* 流体气泡效果层 */}
                        <div className="fluid-bubbles"></div>
                        
                        <div className="text-center px-4 z-10 relative">
                          <Loader2 className="h-10 w-10 animate-spin text-white/90 mx-auto mb-2" strokeWidth={1.5} />
                          <div className="text-xl font-bold text-white mb-1">
                            {Math.round(task.progress)}%
                          </div>
                          <div className="text-xs text-white/80 mb-0.5">
                            {task.statusText}
                          </div>
                          {/* 耗时显示 */}
                          <div className="text-xs text-white/70 mb-2">
                            {t('videos.elapsedTime')}: {formatDuration(getTaskElapsedTime(task))}
                          </div>
                          <div className="w-32 bg-white/30 rounded-full h-1 overflow-hidden mx-auto">
                            <div 
                              className="bg-gradient-to-r from-white to-white/80 h-1 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${Math.max(task.progress, 2)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : video.status === 'failed' || task?.status === 'failed' ? (
                      // 失败状态 - 显示错误信息
                      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
                        <div className="text-center p-4">
                          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" strokeWidth={1.5} />
                          <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                            {t('videos.generationFailed')}
                          </div>
                          <div className="text-xs text-red-600 dark:text-red-400 max-w-xs">
                            {video.error_message || task?.errorMessage || '未知错误'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 默认占位符 - 使用渐变背景
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center text-gray-600 dark:text-gray-300">
                          <Eye className="h-12 w-12 mx-auto mb-2" strokeWidth={1.5} />
                          <div className="text-sm">{t('videos.waitingForProcessing')}</div>
                        </div>
                      </div>
                    )}

                  </div>

                  <CardContent className="p-3">
                    {/* 视频信息 */}
                    <div className="space-y-2">
                      <div>
                        <h3 className="font-medium text-sm line-clamp-2 min-h-[2rem]">
                          {video.title || t('videos.untitledVideo')}
                        </h3>
                        {video.description && (
                          <p className="text-xs text-muted-foreground mt-0 line-clamp-4">
                            {video.description}
                          </p>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex justify-between items-center">
                        <TooltipProvider>
                          <div className="flex gap-1">
                            {/* 使用相同配置重新生成按钮 */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleVirtualRegenerate(video)}
                                >
                                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('videos.regenerateTitle')}</p>
                              </TooltipContent>
                            </Tooltip>

                            {video.video_url && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDownloadClick(video)}
                                      disabled={subscriptionLoading}
                                    >
                                      {subscriptionLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                                      ) : isPaidUser ? (
                                        <Download className="w-4 h-4" strokeWidth={1.5} />
                                      ) : (
                                        <Lock className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {subscriptionLoading 
                                        ? t('videos.upgradePrompt.checkingSubscription')
                                        : isPaidUser 
                                          ? t('videos.downloadHD') 
                                          : t('videos.upgradeToDownload')
                                      }
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleVirtualShare(video)}
                                    >
                                      <Share2 className="w-4 h-4" strokeWidth={1.5} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t('videos.share')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleVirtualDelete(video)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('videos.delete')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                        
                        <div className="text-xs text-muted-foreground">
                          {formatRelativeTime(video.created_at)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* 🚀 后台加载指示器 - 只在基础数据加载完成但全部加载未完成时显示 */}
      {loadingState.basicLoaded && !loadingState.fullLoaded && (
        <div className="text-center mt-8 py-6">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">
              {isMobile ? '后台加载中...' : '后台加载任务状态和更多数据...'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
            {isMobile ? '页面已可用，后台数据同步中' : '基础内容已加载，正在后台获取任务状态和更多视频'}
          </p>
        </div>
      )}
      

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button 
            variant="outline" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            size="sm"
          >
            {t('videos.previousPage')}
          </Button>
          <div className="flex items-center px-4 text-sm text-muted-foreground">
            {t('videos.pageInfo', { current: page, total: totalPages })}
          </div>
          <Button 
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            size="sm"
          >
            {t('videos.nextPage')}
          </Button>
        </div>
      )}

      {/* 完成通知已改为toast提示 */}

      {/* 删除确认对话框 */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, video: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('videos.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('videos.confirmDeleteDescription', { title: deleteDialog.video?.title || t('videos.untitledVideo') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('videos.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteDialog.video && handleDeleteVideo(deleteDialog.video)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('videos.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 视频分享模态框 */}
      <VideoShareModal
        open={videoShareModalOpen}
        onOpenChange={setVideoShareModalOpen}
        video={selectedShareVideo || { id: '', title: null, description: null, video_url: null, template_id: null, metadata: {}, thumbnail_url: null }}
      />
      
      {/* 📊 性能统计组件（仅在开发环境显示） */}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceStats 
          metrics={performanceMetrics} 
          isMobile={isMobile}
          videosCount={videos.length}
          loadingState={loadingState}
        />
      )}

    </div>
  )
}