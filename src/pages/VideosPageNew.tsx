/**
 * 重构后的 VideosPage 组件
 * 使用新的 VideoTaskManager 和 VideoPollingService
 * 简化状态管理，提升可靠性
 */

import React, { useState, useEffect, useContext } from 'react'
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
import LazyVideoPlayer from '@/components/video/LazyVideoPlayer'
import supabaseVideoService from '@/services/supabaseVideoService'
import videoShareService from '@/services/videoShareService'
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
  // 🚀 关键优化：初始loading设为false，避免显示loading界面
  const [loading /* setLoading */] = useState(false)
  // 🚀 添加初始数据加载状态跟踪
  const [isInitialLoad, setIsInitialLoad] = useState(true)
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

  // 通知状态（已移除，改用toast）

  // 删除对话框
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    video: Video | null
  }>({ open: false, video: null })

  // 分享状态
  const [videoShareModalOpen, setVideoShareModalOpen] = useState(false)
  const [selectedShareVideo, setSelectedShareVideo] = useState<Video | null>(null)

  /**
   * 初始化页面数据
   */
  useEffect(() => {
    if (!user) return

    const initializePage = async () => {
      // 🚀 关键优化：不设置loading=true，避免显示loading界面

      try {
        // 1. 并行加载视频列表、初始化任务管理器和检测订阅状态，提升速度
        const [, tasks, subscription] = await Promise.all([
          loadVideos(),
          videoTaskManager.initialize(user.id),
          SubscriptionService.getCurrentSubscription(user.id)
        ])
        
        // 设置订阅状态
        setIsPaidUser(subscription?.status === 'active' || false)
        setSubscriptionLoading(false)
        
        const taskMap = new Map(tasks.map(task => [task.id, task]))
        setActiveTasks(taskMap)

        // 3. 启动轮询服务
        if (tasks.length > 0) {
          videoPollingService.start({
            userId: user.id,
            onTaskUpdate: handleTaskUpdate,
            onTaskComplete: handleTaskComplete,
            onTaskFailed: handleTaskFailed
          })
          console.log(`[VideosPage] 🔄 轮询服务已启动，监控 ${tasks.length} 个任务`)
          
          // 4. 订阅 ProgressManager 获取实时进度更新
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
            
            // 订阅实时进度更新
            progressManager.subscribe(task.id, (progress) => {
              setVideoProgress(prev => {
                const newMap = new Map(prev)
                newMap.set(task.id, progress)
                return newMap
              })
            })
            
            // 保存清理函数（简化版本，在组件卸载时清理）
          })
        }

      } catch (error) {
        console.error('[VideosPage] 初始化失败:', error)
        // 即使失败也不设置loading状态，保持页面可见
      } finally {
        // 🚀 标记初始加载完成
        setIsInitialLoad(false)
      }
    }

    initializePage()

    // 清理函数
    return () => {
      videoPollingService.stop()
      videoTaskManager.cleanup()
    }
  }, [user])

  // 实时更新定时器 - 每秒更新一次用于显示耗时
  useEffect(() => {
    // 只有当有活跃任务时才启动定时器
    if (activeTasks.size > 0) {
      const timer = setInterval(() => {
        setCurrentTime(Date.now())
      }, 1000) // 每秒更新一次
      
      return () => clearInterval(timer)
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

  /**
   * 加载视频列表
   */
  const loadVideos = async () => {
    if (!user) return

    try {
      // 获取所有视频，不使用服务端分页
      const result = await supabaseVideoService.getUserVideos(
        user.id, 
        undefined, // filter
        { page: 1, pageSize: 1000 } // 获取更多视频用于前端分页
      )
      setVideos(result.videos)
    } catch (error) {
      console.error('[VideosPage] 加载视频失败:', error)
      toast.error(t('videos.loadVideosFailed'))
    }
  }

  /**
   * 处理任务更新
   */
  const handleTaskUpdate = (task: VideoTask) => {
    console.log(`[VideosPage] 任务进度更新: ${task.id} - ${task.progress}%`)
    
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

    // 付费用户 - 直接下载
    if (!video.video_url) {
      toast.error(t('videos.videoUrlNotExists'))
      return
    }

    try {
      // 直接使用浏览器下载
      const link = document.createElement('a')
      link.href = video.video_url
      link.download = `${video.title || 'video'}-${video.id}.mp4`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

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

  // 🚀 关键优化：在初始加载期间且无视频数据时显示skeleton，提供更好的视觉体验
  if (loading || (isInitialLoad && videos.length === 0)) {
    return (
      <div className="container mx-auto p-6">
        {/* 页面头部skeleton */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        
        {/* 过滤器skeleton */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="h-10 flex-1 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        
        {/* 视频网格skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
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
      {paginatedVideos.length === 0 ? (
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
      ) : (
        <div className={viewMode === 'grid' ? 
          'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 
          'space-y-4'
        }>
          {paginatedVideos.map((video) => {
            const task = getVideoTask(video.id)
            return (
              <Card 
                key={video.id}
                className="overflow-hidden hover:shadow-lg transition-all duration-300"
              >
                <div className="aspect-video relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-600">
                  {/* 视频渲染逻辑 - 简化且清晰 */}
                  {video.video_url ? (
                    // 有视频URL - 显示视频播放器
                    <LazyVideoPlayer
                      src={video.video_url}
                      poster={video.thumbnail_url || undefined}
                      className="w-full h-full"
                      objectFit="cover"
                      showPlayButton={false} // 桌面端隐藏播放按钮，移动端会自动显示
                      showVolumeControl={true}
                      autoPlayOnHover={true} // 启用悬浮自动播放
                      userId={user?.id}
                      videoId={video.id}
                      videoTitle={video.title || 'video'}
                      enableDownloadProtection={true}
                      alt={video.title || 'Video preview'}
                      enableLazyLoad={false}
                      enableThumbnailCache={true}
                      enableNetworkAdaptive={false}
                      enableProgressiveLoading={true}
                    />
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
                  ) : video.thumbnail_url ? (
                    // 有缩略图但无视频
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title || 'Video thumbnail'}
                      className="w-full h-full object-cover"
                    />
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
                                onClick={() => {
                                  const templateId = video.metadata?.templateId || video.template_id
                                  if (templateId) {
                                    const params = video.parameters || {}
                                    const paramsStr = encodeURIComponent(JSON.stringify(params))
                                    navigate(`/create?template=${templateId}&params=${paramsStr}`)
                                  } else {
                                    navigate('/create')
                                  }
                                }}
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
                                    onClick={() => {
                                      setSelectedShareVideo(video)
                                      setVideoShareModalOpen(true)
                                    }}
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
                                onClick={() => setDeleteDialog({ open: true, video })}
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

    </div>
  )
}