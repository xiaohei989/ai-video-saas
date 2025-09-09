/**
 * 视频轮询服务
 * 统一管理所有视频任务的轮询，减少数据库压力
 */

import i18n from '@/i18n/config'
import { videoTaskManager, type VideoTask } from './VideoTaskManager'
import supabaseVideoService from './supabaseVideoService'
import { detectApiProvider, getApiProviderDisplayName } from '@/utils/apiProviderDetector'

interface PollingConfig {
  userId: string
  onTaskUpdate: (task: VideoTask) => void
  onTaskComplete: (task: VideoTask) => void
  onTaskFailed: (task: VideoTask) => void
}

class VideoPollingService {
  private pollingInterval: NodeJS.Timeout | null = null
  private config: PollingConfig | null = null
  private isPolling = false
  private lastCheckTime = 0
  private completedTasks = new Set<string>() // 防止重复完成处理
  private lastActiveTasksCount = 0 // 追踪活跃任务数量变化

  /**
   * 启动轮询
   */
  start(config: PollingConfig): void {
    if (this.isPolling) {
      this.stop()
    }

    this.config = config
    this.isPolling = true

    // 立即执行一次轮询
    this.poll()
    
    // 开始定时轮询
    this.scheduleNextPoll()
  }

  /**
   * 停止轮询
   */
  stop(): void {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval)
      this.pollingInterval = null
    }
    
    this.isPolling = false
    this.config = null
    this.completedTasks.clear() // 清理已完成任务记录
    this.lastActiveTasksCount = 0
  }

  /**
   * 立即检查一次所有任务
   */
  async checkTasks(): Promise<void> {
    if (!this.config) return
    await this.poll()
  }

  /**
   * 执行轮询
   */
  private async poll(): Promise<void> {
    if (!this.config || !this.isPolling) return

    const activeTasks = videoTaskManager.getActiveTasks()
    
    // 如果没有活跃任务，延长轮询间隔
    if (activeTasks.length === 0) {
      this.scheduleNextPoll(30000) // 30秒后再检查
      return
    }

    // 只在任务数量变化时输出日志
    if (this.lastActiveTasksCount !== activeTasks.length) {
      console.log(`[POLLING] 活跃任务: ${activeTasks.length}`);
      this.lastActiveTasksCount = activeTasks.length;
    }

    try {
      // 批量检查任务状态
      const checkPromises = activeTasks.map(task => this.checkSingleTask(task.id))
      await Promise.allSettled(checkPromises)
      
      this.lastCheckTime = Date.now()
    } catch (error) {
      console.error('[POLLING] 轮询检查失败:', error)
    }

    // 调度下次轮询
    this.scheduleNextPoll()
  }

  /**
   * 统一的任务完成处理方法（防重复）
   */
  private async handleTaskCompletion(taskId: string, videoUrl: string, task: VideoTask, source: string): Promise<boolean> {
    // 检查是否已经处理过这个任务的完成
    if (this.completedTasks.has(taskId)) {
      console.log(`[POLLING] 任务 ${taskId} 已经处理过完成，跳过重复处理 (来源: ${source})`)
      return false
    }

    console.log(`[POLLING] ✅ 处理任务完成: ${taskId} (来源: ${source})`)
    
    // 标记为已处理
    this.completedTasks.add(taskId)
    
    try {
      // 标记任务完成
      await videoTaskManager.markTaskComplete(taskId, videoUrl)
      
      // 创建完成的任务对象
      const completedTask: VideoTask = { 
        ...task, 
        status: 'completed' as const, 
        videoUrl, 
        progress: 100 
      }
      
      // 通知完成
      this.config?.onTaskComplete(completedTask)
      
      console.log(`[POLLING] 任务完成处理完毕: ${taskId}`)
      return true
    } catch (error) {
      console.error(`[POLLING] 处理任务完成时出错 ${taskId}:`, error)
      // 出错时移除标记，允许重试
      this.completedTasks.delete(taskId)
      return false
    }
  }

  /**
   * 检查单个任务状态
   */
  private async checkSingleTask(taskId: string): Promise<void> {
    try {
      const video = await supabaseVideoService.getVideo(taskId)
      if (!video) {
        // 视频不存在（可能已被删除），立即清理任务，不触发失败回调
        const existingTask = videoTaskManager.getTask(taskId)
        if (existingTask) {
          console.log(`[POLLING] 视频已删除，停止轮询并清理任务: ${taskId}`)
          await videoTaskManager.removeTask(taskId)
        }
        return  // 静默处理，不显示错误提示
      }

      const currentTask = videoTaskManager.getTask(taskId)
      const latestTask = this.videoToTask(video)

      // 🔧 智能恢复机制：检查青云API连接状态
      if ((video.status === 'processing' || video.status === 'pending') && video.veo3_job_id) {
        await this.checkAndRestoreAPI(video, taskId)
      }

      // 🚀 增强完成检测逻辑
      const hasVideoUrl = !!(video.video_url && video.video_url.length > 0)
      const isProcessingInDB = video.status === 'processing' || video.status === 'pending'
      
      // 如果数据库有视频URL但状态还是processing，强制标记为完成
      if (hasVideoUrl && isProcessingInDB) {
        console.log(`[POLLING] 🎯 检测到数据库已有视频URL但状态仍为 ${video.status}，尝试标记完成: ${taskId}`)
        console.log(`[POLLING] Video URL: ${video.video_url}`)
        
        // 使用统一的完成处理方法
        const handled = await this.handleTaskCompletion(taskId, video.video_url || '', latestTask, '强制完成检测')
        if (handled) {
          // 更新数据库状态为completed
          try {
            await supabaseVideoService.updateVideoAsSystem(taskId, {
              status: 'completed',
              processing_completed_at: new Date().toISOString()
            })
            console.log(`[POLLING] ✅ 已更新数据库状态为completed: ${taskId}`)
          } catch (updateError) {
            console.error(`[POLLING] 更新数据库状态失败: ${taskId}`, updateError)
          }
          return
        }
      }

      // 检查状态变化
      if (!currentTask || currentTask.status !== latestTask.status) {
        // 只在重要状态变化时输出日志
        if (latestTask.status === 'completed' || latestTask.status === 'failed') {
          console.log(`[POLLING] 任务${latestTask.status}: ${taskId}`);
        }

        if (latestTask.status === 'completed') {
          // 使用统一的完成处理方法
          await this.handleTaskCompletion(taskId, latestTask.videoUrl || '', latestTask, '状态变化检测')
        } else if (latestTask.status === 'failed') {
          await videoTaskManager.markTaskFailed(taskId, latestTask.errorMessage || '未知错误')
          this.config?.onTaskFailed(latestTask)
        } else {
          // 更新进度
          await videoTaskManager.updateTaskFromDB(taskId)
          this.config?.onTaskUpdate(latestTask)
        }
      } else if (latestTask.status === 'processing' && 
                Math.abs(latestTask.progress - (currentTask.progress || 0)) > 1) {
        // 进度有显著变化时更新
        await videoTaskManager.updateTaskFromDB(taskId)
        this.config?.onTaskUpdate(latestTask)
      }
      
      // 🕐 超时检测 - 如果任务运行时间过长且进度接近100%，检查是否应该完成
      if (currentTask && currentTask.status === 'processing' && currentTask.progress >= 95) {
        const elapsedTime = Date.now() - currentTask.startedAt.getTime()
        const elapsedMinutes = elapsedTime / (1000 * 60)
        
        if (elapsedMinutes > 3) { // 超过3分钟
          console.log(`[POLLING] ⏰ 任务运行超时 ${Math.round(elapsedMinutes)} 分钟，进度 ${currentTask.progress}%，检查完成状态: ${taskId}`)
          
          // 重新获取最新视频状态
          const latestVideo = await supabaseVideoService.getVideo(taskId)
          if (latestVideo?.video_url && latestVideo.video_url.length > 0) {
            console.log(`[POLLING] 🎯 超时检测发现视频URL，尝试标记完成: ${taskId}`)
            
            // 使用统一的完成处理方法
            const handled = await this.handleTaskCompletion(taskId, latestVideo.video_url, currentTask, '超时检测')
            if (handled) {
              // 更新数据库状态
              try {
                await supabaseVideoService.updateVideoAsSystem(taskId, {
                  status: 'completed',
                  processing_completed_at: new Date().toISOString()
                })
                console.log(`[POLLING] 超时检测已更新数据库状态为completed: ${taskId}`)
              } catch (updateError) {
                console.error(`[POLLING] 超时检测更新数据库状态失败: ${taskId}`, updateError)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`[POLLING] 检查任务失败 ${taskId}:`, error)
    }
  }

  /**
   * 调度下次轮询
   */
  private scheduleNextPoll(customDelay?: number): void {
    if (!this.isPolling) return

    const activeTasks = videoTaskManager.getActiveTasks()
    let delay = customDelay

    if (!delay) {
      // 根据任务数量和运行时间智能调整轮询间隔
      if (activeTasks.length === 0) {
        delay = 30000 // 无任务时30秒
      } else if (activeTasks.length <= 2) {
        delay = 3000  // 少量任务3秒
      } else if (activeTasks.length <= 5) {
        delay = 5000  // 中等任务5秒
      } else {
        delay = 8000  // 大量任务8秒
      }

      // 根据任务运行时间调整（仅当有活跃任务时）
      if (activeTasks.length > 0) {
        const oldestTask = activeTasks.reduce((oldest, task) => 
          task.startedAt < oldest.startedAt ? task : oldest
        )
        
        const taskAge = Date.now() - oldestTask.startedAt.getTime()
        if (taskAge > 2 * 60 * 1000) { // 超过2分钟的任务
          delay = Math.min(delay * 1.5, 15000) // 延长间隔，最多15秒
        }
      }
    }

    this.pollingInterval = setTimeout(() => {
      this.poll()
    }, delay)
  }

  /**
   * 将数据库视频记录转换为任务对象
   */
  private videoToTask(video: any): VideoTask {
    const startedAt = video.processing_started_at 
      ? new Date(video.processing_started_at)
      : new Date(video.created_at)

    let progress = 0
    let statusText = i18n.t('videoCreator.preparing')

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
        statusText = i18n.t('videoCreator.preparing')
      } else if (video.status === 'processing') {
        progress = Math.min(99, 10 + (elapsedMinutes / 1.5) * 89)
        statusText = progress > 80 ? i18n.t('videoCreator.almostComplete') : i18n.t('videoCreator.generating')
      }
    }

    return {
      id: video.id,
      status: video.status,
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
   * 检查并恢复API连接（支持青云API和APICore）
   * 如果发现任务有veo3_job_id但API轮询不存在，则自动恢复
   */
  private async checkAndRestoreAPI(video: any, taskId: string): Promise<void> {
    // 🔧 根据task ID格式自动检测API提供商
    const apiProvider = detectApiProvider(video.veo3_job_id);
    const apiDisplayName = getApiProviderDisplayName(apiProvider);
    try {
      
      // 动态导入veo3Service以避免循环依赖
      const { veo3Service } = await import('./veo3Service')
      
      // 检查veo3Service中是否有活跃的任务跟踪
      const jobStatus = await veo3Service.getJobStatus(video.veo3_job_id)
      
      if (!jobStatus) {
        console.log(`[POLLING] ⚠️ 检测到${apiDisplayName}连接丢失: ${video.id}，尝试恢复...`)
        
        // 尝试恢复API轮询（根据API提供商自动选择方法）
        const restored = await veo3Service.restoreJob(video.veo3_job_id, video.id, apiProvider)
        
        if (restored) {
          console.log(`[POLLING] ✅ 青云API连接恢复成功: ${video.id}`)
          
          // 更新进度管理器，标记为已恢复
          const { progressManager } = await import('./progressManager')
          const progressUpdate: any = {
            status: video.status as any,
            statusText: i18n.t('videoCreator.generating'), // 多语言状态文本
            lastPollingStatus: 'auto-restored'
          };
          
          // 根据API提供商设置正确的task ID字段
          if (apiProvider === 'apicore') {
            progressUpdate.apicoreTaskId = video.veo3_job_id;
          } else {
            progressUpdate.qingyunTaskId = video.veo3_job_id;
          }
          
          progressManager.updateProgress(video.id, progressUpdate)
        } else {
          console.warn(`[POLLING] ❌ 青云API连接恢复失败: ${video.id}`)
          
          // 检查任务是否已经运行太久，如果是则考虑标记为失败
          const startTime = video.processing_started_at ? new Date(video.processing_started_at) : new Date(video.created_at)
          const elapsedMinutes = (Date.now() - startTime.getTime()) / (1000 * 60)
          
          if (elapsedMinutes > 10) { // 超过10分钟
            console.warn(`[POLLING] ⏰ 任务运行超时 ${Math.round(elapsedMinutes)} 分钟，${apiDisplayName}恢复失败: ${video.id}`)
            
            // 可以考虑标记为失败或发送通知，但这里先记录警告
            const { progressManager } = await import('./progressManager')
            const timeoutUpdate: any = {
              status: video.status as any,
              statusText: i18n.t('videoCreator.processing'), // 多语言状态文本
              lastPollingStatus: 'connection-lost'
            };
            
            // 根据API提供商设置正确的task ID字段
            if (apiProvider === 'apicore') {
              timeoutUpdate.apicoreTaskId = video.veo3_job_id;
            } else {
              timeoutUpdate.qingyunTaskId = video.veo3_job_id;
            }
            
            progressManager.updateProgress(video.id, timeoutUpdate)
          }
        }
      } else {
        // 连接正常，更新最后检查时间
        
        const { progressManager } = await import('./progressManager')
        const normalUpdate: any = {
          status: video.status as any,
          lastPollingStatus: 'connection-verified'
        };
        
        // 根据API提供商设置正确的task ID字段
        if (apiProvider === 'apicore') {
          normalUpdate.apicoreTaskId = video.veo3_job_id;
        } else {
          normalUpdate.qingyunTaskId = video.veo3_job_id;
        }
        
        progressManager.updateProgress(video.id, normalUpdate)
      }
    } catch (error) {
      console.error(`[POLLING] 💥 检查${apiDisplayName}连接时出错 ${video.id}:`, error)
    }
  }

  /**
   * 获取轮询状态
   */
  getStatus(): { isRunning: boolean; activeTasks: number; lastCheck: Date | null } {
    return {
      isRunning: this.isPolling,
      activeTasks: videoTaskManager.getActiveTasks().length,
      lastCheck: this.lastCheckTime > 0 ? new Date(this.lastCheckTime) : null
    }
  }
}

// 导出单例实例
export const videoPollingService = new VideoPollingService()
export default videoPollingService