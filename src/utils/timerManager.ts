/**
 * 全局定时器管理器
 * 用于优化大量setTimeout/setInterval的性能，特别是在移动端
 */

import { log } from '@/utils/logger'

interface TimerTask {
  id: string
  callback: () => void
  delay: number
  createdAt: number
  priority: number
  type: 'timeout' | 'interval'
  intervalId?: number
}

class TimerManager {
  private tasks = new Map<string, TimerTask>()
  private masterTimer: number | null = null
  private isRunning = false
  private tickInterval = 50 // 50ms检查间隔，避免过于频繁

  // 性能配置
  private maxTasksPerTick: number = 10
  private isMobile: boolean = false

  constructor() {
    this.detectDevice()
    this.setupVisibilityHandlers()
  }

  /**
   * 检测设备并调整性能配置
   */
  private detectDevice(): void {
    if (typeof window === 'undefined') return

    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    // 移动端减少每次检查的任务数量
    this.maxTasksPerTick = this.isMobile ? 5 : 10
    
    log.debug('定时器管理器初始化', {
      isMobile: this.isMobile,
      maxTasksPerTick: this.maxTasksPerTick
    })
  }

  /**
   * 设置页面可见性处理
   */
  private setupVisibilityHandlers(): void {
    if (typeof document === 'undefined') return

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause()
      } else {
        this.resume()
      }
    })
  }

  /**
   * 添加延时任务
   */
  addTimeout(
    id: string, 
    callback: () => void, 
    delay: number, 
    priority: number = 0
  ): void {
    // 如果已存在同ID任务，先清除
    if (this.tasks.has(id)) {
      this.clearTask(id)
    }

    const task: TimerTask = {
      id,
      callback,
      delay,
      createdAt: Date.now(),
      priority,
      type: 'timeout'
    }

    this.tasks.set(id, task)
    this.startMasterTimer()

    log.debug('添加定时任务', { id, delay, priority, totalTasks: this.tasks.size })
  }

  /**
   * 添加间隔任务
   */
  addInterval(
    id: string, 
    callback: () => void, 
    interval: number, 
    priority: number = 0
  ): void {
    // 如果已存在同ID任务，先清除
    if (this.tasks.has(id)) {
      this.clearTask(id)
    }

    const task: TimerTask = {
      id,
      callback,
      delay: interval,
      createdAt: Date.now(),
      priority,
      type: 'interval'
    }

    this.tasks.set(id, task)
    this.startMasterTimer()

    log.debug('添加间隔任务', { id, interval, priority, totalTasks: this.tasks.size })
  }

  /**
   * 清除任务
   */
  clearTask(id: string): boolean {
    const existed = this.tasks.has(id)
    this.tasks.delete(id)
    
    if (existed) {
      log.debug('清除定时任务', { id, remainingTasks: this.tasks.size })
    }

    // 如果没有任务了，停止主定时器
    if (this.tasks.size === 0) {
      this.stopMasterTimer()
    }

    return existed
  }

  /**
   * 清除所有任务
   */
  clearAll(): void {
    const taskCount = this.tasks.size
    this.tasks.clear()
    this.stopMasterTimer()
    
    if (taskCount > 0) {
      log.debug('清除所有定时任务', { count: taskCount })
    }
  }

  /**
   * 启动主定时器
   */
  private startMasterTimer(): void {
    if (this.masterTimer || this.tasks.size === 0) return

    this.isRunning = true
    this.masterTimer = window.setInterval(() => {
      this.tick()
    }, this.tickInterval)

    log.debug('主定时器启动')
  }

  /**
   * 停止主定时器
   */
  private stopMasterTimer(): void {
    if (this.masterTimer) {
      clearInterval(this.masterTimer)
      this.masterTimer = null
      this.isRunning = false
      log.debug('主定时器停止')
    }
  }

  /**
   * 暂停定时器
   */
  pause(): void {
    if (this.isRunning) {
      this.stopMasterTimer()
      log.debug('定时器管理器暂停')
    }
  }

  /**
   * 恢复定时器
   */
  resume(): void {
    if (!this.isRunning && this.tasks.size > 0) {
      this.startMasterTimer()
      log.debug('定时器管理器恢复')
    }
  }

  /**
   * 定时器时钟周期
   */
  private tick(): void {
    if (!this.isRunning) return

    const now = Date.now()
    const readyTasks: TimerTask[] = []
    const completedTasks: string[] = []

    // 收集准备执行的任务
    for (const [id, task] of this.tasks) {
      const elapsed = now - task.createdAt
      
      if (task.type === 'timeout') {
        // 一次性任务
        if (elapsed >= task.delay) {
          readyTasks.push(task)
          completedTasks.push(id)
        }
      } else if (task.type === 'interval') {
        // 间隔任务
        const intervalCount = Math.floor(elapsed / task.delay)
        if (intervalCount > (task.intervalId || 0)) {
          readyTasks.push(task)
          task.intervalId = intervalCount
        }
      }
    }

    // 按优先级排序（高优先级先执行）
    readyTasks.sort((a, b) => b.priority - a.priority)

    // 限制每次执行的任务数量
    const tasksToExecute = readyTasks.slice(0, this.maxTasksPerTick)

    // 执行任务
    for (const task of tasksToExecute) {
      try {
        task.callback()
      } catch (error) {
        log.warn('定时任务执行错误', { taskId: task.id, error })
      }
    }

    // 清除完成的一次性任务
    for (const taskId of completedTasks) {
      this.tasks.delete(taskId)
    }

    // 如果没有任务了，停止主定时器
    if (this.tasks.size === 0) {
      this.stopMasterTimer()
    }
  }

  /**
   * 获取管理器状态
   */
  getStatus(): {
    isRunning: boolean
    taskCount: number
    maxTasksPerTick: number
    tickInterval: number
    isMobile: boolean
  } {
    return {
      isRunning: this.isRunning,
      taskCount: this.tasks.size,
      maxTasksPerTick: this.maxTasksPerTick,
      tickInterval: this.tickInterval,
      isMobile: this.isMobile
    }
  }

  /**
   * 获取任务列表（调试用）
   */
  getTasks(): Array<{
    id: string
    type: string
    delay: number
    priority: number
    elapsed: number
  }> {
    const now = Date.now()
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      type: task.type,
      delay: task.delay,
      priority: task.priority,
      elapsed: now - task.createdAt
    }))
  }

  /**
   * 动态调整性能参数
   */
  setPerformanceMode(mode: 'high' | 'normal' | 'low'): void {
    switch (mode) {
      case 'high':
        this.maxTasksPerTick = 15
        this.tickInterval = 33 // ~30fps
        break
      case 'normal':
        this.maxTasksPerTick = this.isMobile ? 5 : 10
        this.tickInterval = 50 // 20fps
        break
      case 'low':
        this.maxTasksPerTick = 3
        this.tickInterval = 100 // 10fps
        break
    }

    log.info('定时器性能模式调整', { 
      mode, 
      maxTasksPerTick: this.maxTasksPerTick, 
      tickInterval: this.tickInterval 
    })

    // 重启定时器以应用新配置
    if (this.isRunning) {
      this.stopMasterTimer()
      this.startMasterTimer()
    }
  }
}

// 创建全局单例
const timerManager = new TimerManager()

// 导出便捷函数
export const addTimeout = (id: string, callback: () => void, delay: number, priority?: number) => {
  timerManager.addTimeout(id, callback, delay, priority)
}

export const addInterval = (id: string, callback: () => void, interval: number, priority?: number) => {
  timerManager.addInterval(id, callback, interval, priority)
}

export const clearTimer = (id: string) => {
  timerManager.clearTask(id)
}

export const clearAllTimers = () => {
  timerManager.clearAll()
}

export { timerManager }
export default timerManager

// 在开发环境下，将管理器挂载到全局对象方便调试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__TIMER_MANAGER__ = {
    manager: timerManager,
    status: () => timerManager.getStatus(),
    tasks: () => timerManager.getTasks(),
    setPerformanceMode: (mode: 'high' | 'normal' | 'low') => timerManager.setPerformanceMode(mode),
    clearAll: () => timerManager.clearAll()
  }
}