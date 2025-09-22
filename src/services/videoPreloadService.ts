/**
 * 智能视频预加载服务 - 移动端体验优化
 * 在用户访问"我的视频"页面前预加载数据，实现零延迟体验
 */

import supabaseVideoService from './supabaseVideoService'
import { videoCacheService } from './videoCacheService'

interface PreloadOptions {
  priority?: 'high' | 'medium' | 'low'
  timeout?: number
  useIdleCallback?: boolean
}

interface PreloadTask {
  id: string
  userId: string
  type: 'videos' | 'tasks' | 'subscription'
  priority: 'high' | 'medium' | 'low'
  createdAt: number
  promise?: Promise<any>
}

class VideoPreloadService {
  private preloadQueue: PreloadTask[] = []
  private isProcessing = false
  private completedTasks = new Set<string>()
  
  // 设备性能检测
  private deviceCapabilities = {
    isLowEnd: false,
    connectionType: 'fast',
    memoryGB: 4
  }
  
  constructor() {
    this.detectDeviceCapabilities()
    this.setupPageVisibilityHandlers()
  }

  /**
   * 🔍 检测设备性能
   */
  private detectDeviceCapabilities(): void {
    try {
      // CPU核心数检测
      const cores = navigator.hardwareConcurrency || 4
      
      // 网络状况检测
      const connection = (navigator as any).connection
      const effectiveType = connection?.effectiveType || '4g'
      
      // 内存检测（如果支持）
      const memory = (performance as any).memory
      const memoryGB = memory ? Math.round(memory.totalJSHeapSize / 1024 / 1024 / 1024) : 4
      
      this.deviceCapabilities = {
        isLowEnd: cores <= 2 || effectiveType === '2g' || effectiveType === 'slow-2g',
        connectionType: effectiveType === '4g' ? 'fast' : effectiveType === '3g' ? 'medium' : 'slow',
        memoryGB
      }
      
    } catch (error) {
      // 设备检测失败，使用默认配置
    }
  }

  /**
   * 📱 设置页面可见性处理
   */
  private setupPageVisibilityHandlers(): void {
    // 页面可见性变化时调整预加载策略
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pausePreload()
      } else {
        this.resumePreload()
      }
    })
    
    // 低电量模式检测（如果支持）
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        battery.addEventListener('levelchange', () => {
          if (battery.level < 0.2) {
            this.pausePreload()
          }
        })
      })
    }
  }

  /**
   * 🚀 智能预加载用户视频数据
   */
  async preloadUserVideos(
    userId: string, 
    options: PreloadOptions = {}
  ): Promise<boolean> {
    const taskId = `videos_${userId}_${Date.now()}`
    
    // 检查是否已经预加载过
    if (this.completedTasks.has(`videos_${userId}`) || videoCacheService.getCachedVideos(userId)) {
      return true
    }
    
    // 检查设备是否适合预加载
    if (!this.shouldPreload(options)) {
      return false
    }
    
    const task: PreloadTask = {
      id: taskId,
      userId,
      type: 'videos',
      priority: options.priority || 'medium',
      createdAt: Date.now()
    }
    
    // 添加到队列
    this.preloadQueue.push(task)
    this.sortQueueByPriority()
    
    // 开始处理队列
    if (!this.isProcessing) {
      this.processQueue()
    }
    
    return true
  }

  /**
   * ⏳ 使用空闲时间预加载
   */
  preloadOnIdle(userId: string, priority: 'high' | 'medium' | 'low' = 'low'): void {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(
        () => {
          this.preloadUserVideos(userId, { 
            priority,
            useIdleCallback: true 
          })
        },
        { timeout: 5000 } // 5秒内必须执行
      )
    } else {
      // 降级到setTimeout
      setTimeout(() => {
        this.preloadUserVideos(userId, { priority })
      }, 100)
    }
  }

  /**
   * 🎯 路由预加载 - 在用户即将访问页面时预加载
   */
  preloadOnRouteChange(toRoute: string, userId: string): void {
    
    if (toRoute.includes('/videos') || toRoute.includes('/my-videos')) {
      // 用户即将访问视频页面，高优先级预加载
      this.preloadUserVideos(userId, { priority: 'high' })
    } else if (toRoute.includes('/create')) {
      // 用户在创建页面，中等优先级预加载（用户可能想查看历史视频）
      this.preloadOnIdle(userId, 'medium')
    }
  }

  /**
   * 🧠 智能预测预加载 - 基于用户行为模式
   */
  predictivePreload(userId: string, userBehavior: {
    lastVideoPageVisit?: number
    createToVideoPageRatio?: number
    avgTimeOnVideoPage?: number
  }): void {
    const now = Date.now()
    
    // 如果用户经常访问视频页面
    if (userBehavior.lastVideoPageVisit && (now - userBehavior.lastVideoPageVisit < 10 * 60 * 1000)) {
      this.preloadOnIdle(userId, 'medium')
    }
    
    // 如果用户创建视频后经常查看列表
    if (userBehavior.createToVideoPageRatio && userBehavior.createToVideoPageRatio > 0.7) {
      this.preloadOnIdle(userId, 'high')
    }
  }

  /**
   * ⚡ 处理预加载队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    
    this.isProcessing = true
    
    while (this.preloadQueue.length > 0) {
      const task = this.preloadQueue.shift()
      if (!task) continue
      
      try {
        
        switch (task.type) {
          case 'videos':
            await this.executeVideoPreload(task)
            break
        }
        
        this.completedTasks.add(`${task.type}_${task.userId}`)
        
        // 避免阻塞主线程
        await new Promise(resolve => setTimeout(resolve, 10))
        
      } catch (error) {
      }
    }
    
    this.isProcessing = false
  }

  /**
   * 🎬 执行视频预加载
   */
  private async executeVideoPreload(task: PreloadTask): Promise<void> {
    // 获取设备优化的分页大小
    const pageSize = this.getOptimalPreloadSize()
    
    try {
      
      const result = await supabaseVideoService.getUserVideos(
        task.userId,
        undefined,
        { page: 1, pageSize }
      )
      
      // 缓存预加载的数据
      videoCacheService.cacheVideos(
        task.userId,
        result.videos,
        result.total,
        result.page,
        result.pageSize,
        undefined,
        { page: 1, pageSize }
      )
      
      
    } catch (error) {
      throw error
    }
  }

  /**
   * ⚙️ 获取设备优化的预加载大小
   */
  private getOptimalPreloadSize(): number {
    if (this.deviceCapabilities.isLowEnd) {
      return 3 // 低端设备只预加载3个
    } else if (this.deviceCapabilities.connectionType === 'slow') {
      return 6 // 慢网络预加载6个
    } else {
      return 9 // 正常情况预加载9个
    }
  }

  /**
   * 📊 判断是否应该预加载
   */
  private shouldPreload(options: PreloadOptions): boolean {
    // 低端设备限制预加载
    if (this.deviceCapabilities.isLowEnd && options.priority !== 'high') {
      return false
    }
    
    // 慢网络限制预加载
    if (this.deviceCapabilities.connectionType === 'slow' && options.priority === 'low') {
      return false
    }
    
    // 页面不可见时不预加载（除非高优先级）
    if (document.hidden && options.priority !== 'high') {
      return false
    }
    
    return true
  }

  /**
   * ⏸️ 暂停预加载
   */
  private pausePreload(): void {
    this.preloadQueue.forEach(task => {
      if (task.promise) {
        // 注意：这里不能真正取消Promise，只是标记
      }
    })
  }

  /**
   * ▶️ 恢复预加载
   */
  private resumePreload(): void {
    if (!this.isProcessing && this.preloadQueue.length > 0) {
      this.processQueue()
    }
  }

  /**
   * 📊 按优先级排序队列
   */
  private sortQueueByPriority(): void {
    this.preloadQueue.sort((a, b) => {
      const priorityValues = { high: 3, medium: 2, low: 1 }
      return priorityValues[b.priority] - priorityValues[a.priority]
    })
  }

  /**
   * 🗑️ 清理预加载缓存
   */
  clearPreloadCache(userId?: string): void {
    if (userId) {
      // 清理特定用户的预加载缓存
      this.completedTasks.forEach(taskKey => {
        if (taskKey.includes(userId)) {
          this.completedTasks.delete(taskKey)
        }
      })
      videoCacheService.clearUserCache(userId)
    } else {
      // 清理所有预加载缓存
      this.completedTasks.clear()
    }
    
  }

  /**
   * 📈 获取预加载统计信息
   */
  getPreloadStats(): {
    queueSize: number
    completedTasks: number
    deviceCapabilities: typeof this.deviceCapabilities
    cacheStats: any
  } {
    return {
      queueSize: this.preloadQueue.length,
      completedTasks: this.completedTasks.size,
      deviceCapabilities: this.deviceCapabilities,
      cacheStats: videoCacheService.getCacheStats()
    }
  }
}

// 导出单例实例
export const videoPreloadService = new VideoPreloadService()