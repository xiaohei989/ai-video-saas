/**
 * 视频任务管理相关的自定义Hook
 * 包含任务状态管理、轮询服务、进度更新等逻辑
 */

import { useState, useEffect, useCallback, useContext } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { videoTaskManager, type VideoTask } from '@/services/VideoTaskManager'
import { videoPollingService } from '@/services/VideoPollingService'
import { progressManager, type VideoProgress } from '@/services/progressManager'
import { AuthContext } from '@/contexts/AuthContext'
import type { Video } from '@/types/video.types'

interface UseVideoTasksOptions {
  onVideoUpdate?: () => void | Promise<void>
  enablePolling?: boolean
}

interface UseVideoTasksReturn {
  // 状态
  activeTasks: Map<string, VideoTask>
  videoProgress: Map<string, VideoProgress>
  currentTime: number

  // 操作
  refreshTasks: () => Promise<void>
  stopPolling: () => void
  startPolling: () => void

  // 任务事件处理器
  handleTaskUpdate: (task: VideoTask) => void
  handleTaskComplete: (task: VideoTask) => Promise<void>
  handleTaskFailed: (task: VideoTask) => Promise<void>
}

export function useVideoTasks(options: UseVideoTasksOptions = {}): UseVideoTasksReturn {
  const {
    onVideoUpdate,
    enablePolling = true
  } = options

  const { t } = useTranslation()
  const authContext = useContext(AuthContext)
  const user = authContext?.user

  // 状态管理
  const [activeTasks, setActiveTasks] = useState<Map<string, VideoTask>>(new Map())
  const [videoProgress, setVideoProgress] = useState<Map<string, VideoProgress>>(new Map())
  const [currentTime, setCurrentTime] = useState(Date.now())

  /**
   * 任务状态更新处理器
   */
  const handleTaskUpdate = useCallback((task: VideoTask) => {
    console.log(`[useVideoTasks] 任务更新: ${task.id}`, {
      status: task.status,
      progress: task.progress,
      statusText: task.statusText
    })

    setActiveTasks(prev => {
      const newMap = new Map(prev)
      newMap.set(task.id, task)
      return newMap
    })

    // 同时更新进度信息
    if (task.progress !== undefined) {
      setVideoProgress(prev => {
        const newMap = new Map(prev)
        newMap.set(task.id, {
          progress: task.progress!,
          statusText: task.statusText || t('videoCreator.processing'),
          lastUpdate: Date.now()
        })
        return newMap
      })
    }
  }, [t])

  /**
   * 任务完成处理器
   */
  const handleTaskComplete = useCallback(async (task: VideoTask) => {
    console.log(`[useVideoTasks] 任务完成: ${task.id}`)

    try {
      // 🆕 立即生成前端临时缩略图
      if (task.videoUrl) {
        console.log('[useVideoTasks] 🎨 任务完成，立即生成前端临时缩略图:', task.id)

        try {
          // 动态导入避免循环依赖
          const { extractVideoThumbnail } = await import('@/utils/videoThumbnail')
          const thumbnail = await extractVideoThumbnail(task.videoUrl, 0.1)

          console.log('[useVideoTasks] ✅ 前端临时缩略图生成成功')

          // 触发自定义事件，通知视频列表更新缩略图
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('video-temporary-thumbnail-generated', {
              detail: {
                videoId: task.id,
                thumbnailUrl: thumbnail,
                fromPolling: true
              }
            }))
          }
        } catch (thumbnailError) {
          console.error('[useVideoTasks] ❌ 前端临时缩略图生成失败:', thumbnailError)
          // 失败不影响视频完成流程
        }
      }

      // 移除完成的任务
      setActiveTasks(prev => {
        const newMap = new Map(prev)
        newMap.delete(task.id)
        return newMap
      })

      setVideoProgress(prev => {
        const newMap = new Map(prev)
        newMap.delete(task.id)
        return newMap
      })

      // 🔄 任务完成后，刷新视频列表以更新状态
      if (onVideoUpdate) {
        console.log('[useVideoTasks] 🔄 任务完成，等待前端缩略图state更新...')

        // ⚠️ 关键：等待React完成临时缩略图的state更新
        // handleTemporaryThumbnail的setVideos是异步的，需要等待它完成
        // 否则refreshVideos会读取到旧的state，导致临时缩略图丢失
        await new Promise(resolve => setTimeout(resolve, 100))

        console.log('[useVideoTasks] 🔄 开始刷新视频列表')
        // 调用回调函数刷新视频列表，这样视频状态会从数据库重新获取
        await onVideoUpdate()
      }

      // 显示成功通知
      toast.success(t('videos.videoGenerationComplete'))

      // 清除进度管理器中的数据
      progressManager.clearProgress(task.id)

    } catch (error) {
      console.error('[useVideoTasks] 处理任务完成失败:', error)
    }
  }, [onVideoUpdate, user?.id, t])

  /**
   * 任务失败处理器
   */
  const handleTaskFailed = useCallback(async (task: VideoTask) => {
    console.log(`[useVideoTasks] 任务失败: ${task.id}`, task.errorMessage)

    try {
      // 移除失败的任务，避免干扰UI渲染
      setActiveTasks(prev => {
        const newMap = new Map(prev)
        newMap.delete(task.id)
        return newMap
      })

      // 移除进度信息
      setVideoProgress(prev => {
        const newMap = new Map(prev)
        newMap.delete(task.id)
        return newMap
      })

      // 🔄 任务失败后，刷新视频列表以更新数据库中的失败状态
      if (onVideoUpdate) {
        console.log('[useVideoTasks] 🔄 任务失败，刷新视频列表以获取最新状态')
        await onVideoUpdate()
      }

      // 显示错误通知
      toast.error(`${t('videos.videoGenerationFailed')}: ${task.errorMessage || t('videos.unknownError')}`)

      // 清除进度管理器中的数据
      progressManager.clearProgress(task.id)

    } catch (error) {
      console.error('[useVideoTasks] 处理任务失败失败:', error)
    }
  }, [onVideoUpdate, t])

  /**
   * 刷新任务列表
   */
  const refreshTasks = useCallback(async () => {
    if (!user?.id) return

    try {
      console.log('[useVideoTasks] 刷新任务列表')
      const tasks = await videoTaskManager.initialize(user.id)

      const taskMap = new Map(tasks.map(task => [task.id, task]))
      setActiveTasks(taskMap)

      // 为每个任务订阅进度更新
      tasks.forEach(task => {
        if (task.status === 'processing' || task.status === 'pending') {
          // 获取初始进度
          progressManager.getProgressWithFallback(task.id, 'processing').then(initialProgress => {
            if (initialProgress) {
              setVideoProgress(prev => {
                const newMap = new Map(prev)
                newMap.set(task.id, initialProgress)
                return newMap
              })
            }
          })

          // 订阅进度更新
          progressManager.subscribe(task.id, (progress) => {
            setVideoProgress(prev => {
              const newMap = new Map(prev)
              newMap.set(task.id, progress)
              return newMap
            })

            // 同时更新任务中的进度信息
            setActiveTasks(prev => {
              const newMap = new Map(prev)
              const existingTask = newMap.get(task.id)
              if (existingTask) {
                newMap.set(task.id, {
                  ...existingTask,
                  progress: progress.progress,
                  statusText: progress.statusText || existingTask.statusText
                })
              }
              return newMap
            })
          })
        }
      })

      console.log(`[useVideoTasks] 任务列表刷新完成，共 ${tasks.length} 个任务`)
    } catch (error) {
      console.error('[useVideoTasks] 刷新任务列表失败:', error)
    }
  }, [user?.id])

  /**
   * 启动轮询服务
   */
  const startPolling = useCallback(() => {
    if (!user?.id || !enablePolling) return

    // 获取当前任务数量
    setActiveTasks(current => {
      if (current.size > 0) {
        videoPollingService.start({
          userId: user.id!,
          onTaskUpdate: handleTaskUpdate,
          onTaskComplete: handleTaskComplete,
          onTaskFailed: handleTaskFailed
        })
        console.log(`[useVideoTasks] 🔄 轮询服务已启动，监控 ${current.size} 个任务`)
      }
      return current
    })
  }, [user?.id, enablePolling, handleTaskUpdate, handleTaskComplete, handleTaskFailed])

  /**
   * 停止轮询服务
   */
  const stopPolling = useCallback(() => {
    videoPollingService.stop()
    videoTaskManager.cleanup()
    console.log('[useVideoTasks] 🛑 轮询服务已停止')
  }, [])

  /**
   * 智能实时更新定时器 - 根据设备性能和页面可见性优化
   */
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

  /**
   * 初始化任务管理
   */
  useEffect(() => {
    if (!user?.id) return

    console.log('[useVideoTasks] 初始化任务管理')

    // 初始化任务列表
    const initializeTasks = async () => {
      try {
        console.log('[useVideoTasks] 刷新任务列表')
        const tasks = await videoTaskManager.initialize(user.id)

        const taskMap = new Map(tasks.map(task => [task.id, task]))
        setActiveTasks(taskMap)

        // 为每个任务订阅进度更新
        tasks.forEach(task => {
          if (task.status === 'processing' || task.status === 'pending') {
            // 获取初始进度
            progressManager.getProgressWithFallback(task.id, 'processing').then(initialProgress => {
              if (initialProgress) {
                setVideoProgress(prev => {
                  const newMap = new Map(prev)
                  newMap.set(task.id, initialProgress)
                  return newMap
                })
              }
            })

            // 订阅进度更新
            progressManager.subscribe(task.id, (progress) => {
              setVideoProgress(prev => {
                const newMap = new Map(prev)
                newMap.set(task.id, progress)
                return newMap
              })
            })
          }
        })

        console.log(`[useVideoTasks] 任务列表刷新完成，共 ${tasks.length} 个任务`)
      } catch (error) {
        console.error('[useVideoTasks] 刷新任务列表失败:', error)
      }
    }

    initializeTasks()

    // 清理函数
    return () => {
      stopPolling()
    }
  }, [user?.id])

  /**
   * 启动轮询（当有任务时）
   */
  useEffect(() => {
    if (enablePolling && activeTasks.size > 0 && user?.id) {
      videoPollingService.start({
        userId: user.id,
        onTaskUpdate: handleTaskUpdate,
        onTaskComplete: handleTaskComplete,
        onTaskFailed: handleTaskFailed
      })
      console.log(`[useVideoTasks] 🔄 轮询服务已启动，监控 ${activeTasks.size} 个任务`)
    } else {
      videoPollingService.stop()
    }
  }, [activeTasks.size, enablePolling, user?.id, handleTaskUpdate, handleTaskComplete, handleTaskFailed])

  /**
   * 🔧 FIX: 监听页面可见性变化，移动端后台恢复时强制同步任务状态
   */
  useEffect(() => {
    if (!enablePolling || !user?.id) return

    const handleVisibilityChange = async () => {
      // 只在页面从隐藏变为可见时处理
      if (!document.hidden && activeTasks.size > 0) {
        console.log('[useVideoTasks] 📱 页面从后台恢复，强制同步任务状态')

        // 强制重新从数据库加载任务状态
        await refreshTasks()

        // 重启轮询服务（带强制同步标志）
        videoPollingService.start({
          userId: user.id,
          onTaskUpdate: handleTaskUpdate,
          onTaskComplete: handleTaskComplete,
          onTaskFailed: handleTaskFailed
        }, true) // forceSync = true
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enablePolling, user?.id, activeTasks.size, refreshTasks, handleTaskUpdate, handleTaskComplete, handleTaskFailed])

  return {
    // 状态
    activeTasks,
    videoProgress,
    currentTime,

    // 操作
    refreshTasks,
    stopPolling,
    startPolling,

    // 任务事件处理器
    handleTaskUpdate,
    handleTaskComplete,
    handleTaskFailed
  }
}