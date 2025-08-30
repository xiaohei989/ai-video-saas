/**
 * 视频任务管理器
 * 统一管理所有视频生成任务的生命周期
 * 以数据库为唯一真相源，简化状态同步
 */

import i18n from '@/i18n/config'
import supabaseVideoService from './supabaseVideoService'
import type { Database } from '@/lib/supabase'

type Video = Database['public']['Tables']['videos']['Row']

export interface VideoTask {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  statusText: string
  videoUrl?: string
  errorMessage?: string
  veo3JobId?: string
  startedAt: Date
  estimatedCompletion?: Date
}

export interface TaskUpdateCallback {
  (task: VideoTask): void
}

class VideoTaskManager {
  private activeTasks = new Map<string, VideoTask>()
  private subscribers = new Map<string, Set<TaskUpdateCallback>>()
  private initialized = false

  /**
   * 初始化任务管理器，从数据库加载活跃任务
   */
  async initialize(userId: string): Promise<VideoTask[]> {
    if (this.initialized) {
      return Array.from(this.activeTasks.values())
    }

    
    try {
      // 获取所有进行中的任务
      const processingResult = await supabaseVideoService.getUserVideos(userId, {
        status: 'processing'
      })
      
      const pendingResult = await supabaseVideoService.getUserVideos(userId, {
        status: 'pending'
      })
      
      const allActiveVideos = [...processingResult.videos, ...pendingResult.videos]
      
      // 转换为任务对象
      for (const video of allActiveVideos) {
        const task = this.videoToTask(video)
        this.activeTasks.set(video.id, task)
        console.log(`[TASK MANAGER] 加载任务: ${video.id} (${task.status})`)
      }
      
      this.initialized = true
      console.log(`[TASK MANAGER] 初始化完成，加载了 ${this.activeTasks.size} 个活跃任务`)
      
      return Array.from(this.activeTasks.values())
    } catch (error) {
      console.error('[TASK MANAGER] 初始化失败:', error)
      this.initialized = true
      return []
    }
  }

  /**
   * 获取所有活跃任务
   */
  getActiveTasks(): VideoTask[] {
    return Array.from(this.activeTasks.values())
  }

  /**
   * 获取特定任务
   */
  getTask(taskId: string): VideoTask | null {
    return this.activeTasks.get(taskId) || null
  }

  /**
   * 从数据库更新单个任务状态
   */
  async updateTaskFromDB(taskId: string): Promise<VideoTask | null> {
    try {
      const video = await supabaseVideoService.getVideo(taskId)
      if (!video) {
        // 视频不存在，移除任务
        this.removeTaskInternal(taskId)
        return null
      }

      const task = this.videoToTask(video)
      
      // 如果任务已完成或失败，移除活跃任务
      if (task.status === 'completed' || task.status === 'failed') {
        this.activeTasks.delete(taskId)
        console.log(`[TASK MANAGER] 任务结束，从活跃列表移除: ${taskId}`)
      } else {
        this.activeTasks.set(taskId, task)
      }

      // 通知订阅者
      this.notifySubscribers(taskId, task)
      
      return task
    } catch (error) {
      console.error(`[TASK MANAGER] 更新任务失败 ${taskId}:`, error)
      return null
    }
  }

  /**
   * 标记任务完成
   */
  async markTaskComplete(taskId: string, videoUrl: string): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) return

    console.log(`[TASK MANAGER] 标记任务完成: ${taskId}`)

    // 更新本地任务状态
    const completedTask: VideoTask = {
      ...task,
      status: 'completed',
      progress: 100,
      statusText: '生成完成！',
      videoUrl
    }

    // 通知订阅者任务完成
    this.notifySubscribers(taskId, completedTask)
    
    // 从活跃任务中移除
    this.activeTasks.delete(taskId)
    
    console.log(`[TASK MANAGER] 任务完成处理完毕: ${taskId}`)
  }

  /**
   * 标记任务失败
   */
  async markTaskFailed(taskId: string, errorMessage: string): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) return

    console.log(`[TASK MANAGER] 标记任务失败: ${taskId}`)

    // 更新本地任务状态
    const failedTask: VideoTask = {
      ...task,
      status: 'failed',
      statusText: '生成失败',
      errorMessage
    }

    // 通知订阅者任务失败
    this.notifySubscribers(taskId, failedTask)
    
    // 从活跃任务中移除
    this.activeTasks.delete(taskId)
    
    console.log(`[TASK MANAGER] 任务失败处理完毕: ${taskId}`)
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(taskId: string, progress: number, statusText?: string): void {
    const task = this.activeTasks.get(taskId)
    if (!task || task.status === 'completed' || task.status === 'failed') {
      // 已完成或失败的任务不接受进度更新
      return
    }

    const updatedTask: VideoTask = {
      ...task,
      progress: Math.min(progress, 99), // 防止在未真正完成时显示100%
      statusText: statusText || task.statusText,
      estimatedCompletion: this.calculateEstimatedCompletion(task.startedAt, progress)
    }

    this.activeTasks.set(taskId, updatedTask)
    this.notifySubscribers(taskId, updatedTask)
  }

  /**
   * 订阅任务更新
   */
  subscribe(taskId: string, callback: TaskUpdateCallback): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set())
    }
    
    this.subscribers.get(taskId)!.add(callback)
    
    // 立即发送当前状态
    const task = this.activeTasks.get(taskId)
    if (task) {
      callback(task)
    }

    // 返回取消订阅函数
    return () => {
      const taskSubscribers = this.subscribers.get(taskId)
      if (taskSubscribers) {
        taskSubscribers.delete(callback)
        if (taskSubscribers.size === 0) {
          this.subscribers.delete(taskId)
        }
      }
    }
  }

  /**
   * 公开的移除任务方法
   * 用于在视频被删除时立即停止轮询
   */
  async removeTask(taskId: string): Promise<void> {
    this.activeTasks.delete(taskId)
    this.subscribers.delete(taskId)
    console.log(`[TASK MANAGER] 主动移除任务: ${taskId}`)
  }

  /**
   * 私有的移除任务方法（内部使用）
   */
  private removeTaskInternal(taskId: string): void {
    this.activeTasks.delete(taskId)
    this.subscribers.delete(taskId)
    console.log(`[TASK MANAGER] 内部移除任务: ${taskId}`)
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(taskId: string, task: VideoTask): void {
    const taskSubscribers = this.subscribers.get(taskId)
    if (taskSubscribers) {
      taskSubscribers.forEach(callback => {
        try {
          callback(task)
        } catch (error) {
          console.error(`[TASK MANAGER] 订阅者回调错误:`, error)
        }
      })
    }
  }

  /**
   * 将数据库视频记录转换为任务对象
   */
  private videoToTask(video: Video): VideoTask {
    const startedAt = video.processing_started_at 
      ? new Date(video.processing_started_at)
      : new Date(video.created_at)

    let progress = 0
    let statusText = '准备中...'

    // 从metadata中提取进度信息
    if (video.metadata?.progressData) {
      progress = video.metadata.progressData.percentage || 0
      statusText = video.metadata.progressData.statusText || statusText
    } else {
      // 基于时间智能推算进度
      const elapsed = Date.now() - startedAt.getTime()
      const elapsedMinutes = elapsed / (1000 * 60)
      
      if (video.status === 'pending') {
        progress = Math.min(10, elapsedMinutes * 2)
        statusText = '准备中...'
      } else if (video.status === 'processing') {
        progress = Math.min(99, 10 + (elapsedMinutes / 1.5) * 89)
        statusText = progress > 80 ? i18n.t('videoCreator.almostComplete') : i18n.t('videoCreator.generating')
      }
    }

    return {
      id: video.id,
      status: video.status as VideoTask['status'],
      progress: Math.max(0, progress),
      statusText,
      videoUrl: video.video_url || undefined,
      errorMessage: video.error_message || undefined,
      veo3JobId: video.veo3_job_id || undefined,
      startedAt,
      estimatedCompletion: this.calculateEstimatedCompletion(startedAt, progress)
    }
  }

  /**
   * 计算预计完成时间
   */
  private calculateEstimatedCompletion(startedAt: Date, progress: number): Date | undefined {
    if (progress <= 0) return undefined
    
    const elapsed = Date.now() - startedAt.getTime()
    const totalEstimated = (elapsed / progress) * 100
    const remaining = totalEstimated - elapsed
    
    return new Date(Date.now() + remaining)
  }

  /**
   * 清理所有订阅
   */
  cleanup(): void {
    this.subscribers.clear()
    this.activeTasks.clear()
    this.initialized = false
  }
}

// 导出单例实例
export const videoTaskManager = new VideoTaskManager()
export default videoTaskManager