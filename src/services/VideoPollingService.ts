/**
 * 视频轮询服务
 * 统一管理所有视频任务的轮询，减少数据库压力
 */

import i18n from '@/i18n/config'
import { videoTaskManager, type VideoTask } from './VideoTaskManager'
import supabaseVideoService from './supabaseVideoService'
import { detectApiProvider, getApiProviderDisplayName } from '@/utils/apiProviderDetector'

// 超时配置（基于10分钟正常生成时间）
const TIMEOUT_START = 8 * 60 * 1000      // 8分钟后开始检查
const TIMEOUT_FORCE_COMPLETE = 12 * 60 * 1000  // 12分钟强制完成（99%）
const TIMEOUT_FORCE_FAIL = 15 * 60 * 1000      // 15分钟强制失败
const LOG_INTERVAL = 60 * 1000                 // 每分钟最多输出一次日志

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
  private lastTimeoutLog = new Map<string, number>() // 控制日志频率

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
    this.lastTimeoutLog.clear() // 清理超时日志记录
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
   * 🚀 统一的任务完成处理方法（防重复+原子操作）
   */
  private async handleTaskCompletion(taskId: string, videoUrl: string, task: VideoTask, source: string): Promise<boolean> {
    // 🚀 原子性检查和标记，防止竞态条件
    if (this.completedTasks.has(taskId)) {
      console.log(`[POLLING] 任务 ${taskId} 已经处理过完成，跳过重复处理 (来源: ${source})`)
      return false
    }
    
    // 🚀 立即标记以防止竞态条件
    this.completedTasks.add(taskId)

    console.log(`[POLLING] ✅ 处理任务完成: ${taskId} (来源: ${source})`)
    
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
      // 🚀 出错时移除标记，允许后续重试
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

      // 🚀 快速路径：如果有视频URL，立即标记完成并返回
      const hasVideoUrl = !!(video.video_url || video.r2_url)
      if (hasVideoUrl) {
        const videoUrl = video.video_url || video.r2_url || ''
        console.log(`[POLLING] 🎯 检测到视频URL存在，立即标记完成: ${taskId}`)
        
        const currentTask = videoTaskManager.getTask(taskId)
        if (currentTask && currentTask.status !== 'completed') {
          // 使用统一的完成处理方法
          const latestTask = this.videoToTask(video)
          await this.handleTaskCompletion(taskId, videoUrl, latestTask, 'URL可用性检测')
          
          // 如果数据库状态还不是completed，同步更新
          if (video.status !== 'completed') {
            try {
              await supabaseVideoService.updateVideoAsSystem(taskId, {
                status: 'completed',
                processing_completed_at: new Date().toISOString()
              })
              console.log(`[POLLING] ✅ 已同步数据库状态为completed: ${taskId}`)
            } catch (updateError) {
              console.error(`[POLLING] 同步数据库状态失败: ${taskId}`, updateError)
            }
          }
        }
        return // 直接返回，不再进行后续状态检查
      }

      const currentTask = videoTaskManager.getTask(taskId)
      const latestTask = this.videoToTask(video)

      // 🔧 智能恢复机制：检查API连接状态
      if ((video.status === 'processing' || video.status === 'pending') && video.veo3_job_id) {
        await this.checkAndRestoreAPI(video, taskId)
      }

      // 🚀 增强完成检测逻辑（注：上面已经检查过URL存在性，这里是备用检查）
      const dbHasVideoUrl = !!(video.video_url && video.video_url.length > 0)
      const isProcessingInDB = video.status === 'processing' || video.status === 'pending'
      
      // 如果数据库有视频URL但状态还是processing，强制标记为完成
      if (dbHasVideoUrl && isProcessingInDB) {
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
      
      // 🕐 超时检测 - 基于10分钟正常生成时间的超时处理
      if (currentTask && currentTask.status === 'processing') {
        const elapsedTime = Date.now() - currentTask.startedAt.getTime()
        const elapsedMinutes = Math.round(elapsedTime / (1000 * 60))
        
        // 8分钟后开始检查
        if (elapsedTime > TIMEOUT_START) {
          const now = Date.now()
          const lastLog = this.lastTimeoutLog.get(taskId) || 0
          
          // 控制日志频率：每分钟最多输出一次
          if (now - lastLog > LOG_INTERVAL) {
            console.log(`[POLLING] ⏰ 任务运行 ${elapsedMinutes} 分钟，进度 ${currentTask.progress}%: ${taskId}`)
            this.lastTimeoutLog.set(taskId, now)
          }
          
          // 强制失败 - 15分钟后任何进度都失败
          if (elapsedTime > TIMEOUT_FORCE_FAIL) {
            console.log(`[POLLING] 🚨 任务运行超过15分钟强制失败: ${taskId}`)
            await videoTaskManager.markTaskFailed(taskId, '任务超时')
            this.config?.onTaskFailed({ ...currentTask, status: 'failed', errorMessage: '任务超时' })
            return
          }
          
          // 99%进度强制完成 - 12分钟后如果是99%进度则强制完成
          if (elapsedTime > TIMEOUT_FORCE_COMPLETE && currentTask.progress >= 99) {
            console.log(`[POLLING] 🎯 99%进度运行超过12分钟，强制完成检测: ${taskId}`)
            
            // 重新获取最新视频状态
            const latestVideo = await supabaseVideoService.getVideo(taskId)
            if (latestVideo?.video_url && latestVideo.video_url.length > 0) {
              console.log(`[POLLING] ✅ 发现视频URL，强制标记完成: ${taskId}`)
              
              // 使用统一的完成处理方法
              const handled = await this.handleTaskCompletion(taskId, latestVideo.video_url, currentTask, '强制完成')
              if (handled) {
                // 更新数据库状态
                try {
                  await supabaseVideoService.updateVideoAsSystem(taskId, {
                    status: 'completed',
                    processing_completed_at: new Date().toISOString()
                  })
                  console.log(`[POLLING] 强制完成已更新数据库状态: ${taskId}`)
                } catch (updateError) {
                  console.error(`[POLLING] 强制完成更新数据库失败: ${taskId}`, updateError)
                }
              }
            } else {
              console.log(`[POLLING] ⚠️ 99%进度但无视频URL，继续等待: ${taskId}`)
            }
          }
        }
      }
    } catch (error) {
      console.error(`[POLLING] 检查任务失败 ${taskId}:`, error)
    }
  }

  /**
   * 🚀 调度下次轮询（简化复杂判断逻辑）
   */
  private scheduleNextPoll(customDelay?: number): void {
    if (!this.isPolling) return

    const activeTasks = videoTaskManager.getActiveTasks()
    let delay = customDelay

    if (!delay) {
      // 🚀 简化的轮询间隔策略
      delay = this.getOptimalPollingDelay(activeTasks)
    }

    this.pollingInterval = setTimeout(() => {
      this.poll()
    }, delay)
  }

  /**
   * 🚀 获取最优轮询间隔（基于任务状态的固定策略）
   */
  private getOptimalPollingDelay(activeTasks: VideoTask[]): number {
    // 无任务时延长间隔
    if (activeTasks.length === 0) {
      return 30000 // 30秒
    }

    // 基于任务数量的基础间隔
    const baseDelay = activeTasks.length <= 3 ? 3000 : 5000

    // 检查是否有长时间运行的任务
    const hasLongRunningTask = activeTasks.some(task => {
      const taskAge = Date.now() - task.startedAt.getTime()
      return taskAge > 5 * 60 * 1000 // 5分钟以上
    })

    // 长时间任务适当延长间隔，避免过度轮询
    return hasLongRunningTask ? Math.min(baseDelay * 1.5, 8000) : baseDelay
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
   * 检查并恢复API连接（支持Wuyin和APICore）
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
        // console.log(`[POLLING] ⚠️ 检测到${apiDisplayName}连接丢失: ${video.id}，尝试恢复...`)
        
        // 尝试恢复API轮询（根据API提供商自动选择方法）
        const restored = await veo3Service.restoreJob(video.veo3_job_id, video.id, apiProvider)
        
        if (restored) {
          console.log(`[POLLING] ✅ ${apiDisplayName}连接恢复成功: ${video.id}`)
          
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
          } else if (apiProvider === 'wuyin') {
            progressUpdate.wuyinTaskId = video.veo3_job_id;
          }

          progressManager.updateProgress(video.id, progressUpdate)
        } else {
          console.warn(`[POLLING] ❌ ${apiDisplayName}连接恢复失败: ${video.id}`)
          
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
            } else if (apiProvider === 'wuyin') {
              timeoutUpdate.wuyinTaskId = video.veo3_job_id;
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
        } else if (apiProvider === 'wuyin') {
          normalUpdate.wuyinTaskId = video.veo3_job_id;
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