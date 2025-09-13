/**
 * 智能视频预加载管理器
 * 
 * 功能：
 * 1. 悬浮时延迟预加载视频
 * 2. 优先级队列管理
 * 3. 网络自适应策略
 * 4. 内存和带宽限制
 * 5. 智能缓存清理
 */

interface PreloadOptions {
  delay?: number // 悬浮延迟时间（毫秒）
  priority?: 'low' | 'medium' | 'high' // 预加载优先级
  maxConcurrent?: number // 最大并发预加载数
  enableNetworkAdaptive?: boolean // 是否启用网络自适应
  preloadStrategy?: 'metadata' | 'partial' | 'full' // 预加载策略
}

interface PreloadTask {
  id: string
  videoUrl: string
  element?: HTMLVideoElement
  priority: 'low' | 'medium' | 'high'
  startTime: number
  status: 'pending' | 'loading' | 'loaded' | 'error' | 'cancelled'
  abortController?: AbortController
  onLoad?: () => void
  onError?: (error: Error) => void
}

interface NetworkInfo {
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g' | 'unknown'
  downlink: number // Mbps
  rtt: number // milliseconds
  saveData: boolean
}

class VideoPreloadManager {
  private tasks = new Map<string, PreloadTask>()
  private activePreloads = new Set<string>()
  private hoverTimers = new Map<string, NodeJS.Timeout>()
  private videoElements = new Map<string, HTMLVideoElement>()
  
  // 配置选项
  private readonly DEFAULT_OPTIONS: Required<PreloadOptions> = {
    delay: 500, // 500ms延迟
    priority: 'medium',
    maxConcurrent: 3, // 最多同时预加载3个视频
    enableNetworkAdaptive: true,
    preloadStrategy: 'metadata'
  }
  
  // 性能监控
  private stats = {
    totalPreloads: 0,
    successfulPreloads: 0,
    failedPreloads: 0,
    cancelledPreloads: 0,
    averageLoadTime: 0,
    networkOptimizations: 0
  }

  constructor() {
    this.initializeNetworkMonitoring()
    this.startCleanupInterval()
  }

  /**
   * 开始预加载（悬浮触发）
   */
  startPreload(
    videoId: string, 
    videoUrl: string, 
    options: PreloadOptions = {}
  ): void {
    const config = { ...this.DEFAULT_OPTIONS, ...options }
    
    // 取消现有的悬浮定时器
    this.cancelHoverTimer(videoId)
    
    // 设置延迟定时器
    const timer = setTimeout(() => {
      this.executePreload(videoId, videoUrl, config)
    }, config.delay)
    
    this.hoverTimers.set(videoId, timer)
  }

  /**
   * 取消预加载（鼠标离开）
   */
  cancelPreload(videoId: string): void {
    // 取消悬浮定时器
    this.cancelHoverTimer(videoId)
    
    // 取消正在进行的预加载任务
    const task = this.tasks.get(videoId)
    if (task && task.status === 'loading') {
      task.status = 'cancelled'
      task.abortController?.abort()
      this.activePreloads.delete(videoId)
      this.stats.cancelledPreloads++
      
      console.log(`[VideoPreloadManager] 取消预加载: ${videoId}`)
    }
  }

  /**
   * 获取预加载的视频元素
   */
  getPreloadedVideo(videoId: string): HTMLVideoElement | null {
    const task = this.tasks.get(videoId)
    if (task && task.status === 'loaded' && task.element) {
      return task.element
    }
    return null
  }

  /**
   * 立即预加载（高优先级）
   */
  async preloadImmediately(
    videoId: string, 
    videoUrl: string, 
    options: PreloadOptions = {}
  ): Promise<HTMLVideoElement> {
    const config = { ...this.DEFAULT_OPTIONS, ...options, priority: 'high' as const, delay: 0 }
    return this.executePreload(videoId, videoUrl, config)
  }

  /**
   * 执行预加载
   */
  private async executePreload(
    videoId: string, 
    videoUrl: string, 
    options: Required<PreloadOptions>
  ): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      // 检查是否已经预加载
      const existingTask = this.tasks.get(videoId)
      if (existingTask && existingTask.status === 'loaded' && existingTask.element) {
        resolve(existingTask.element)
        return
      }

      // 检查并发限制
      if (this.activePreloads.size >= options.maxConcurrent) {
        // 取消低优先级任务为新任务让路
        this.evictLowPriorityTasks(options.priority)
      }

      // 网络自适应检查
      if (options.enableNetworkAdaptive && !this.isNetworkSuitable(options.preloadStrategy)) {
        console.log(`[VideoPreloadManager] 网络条件不适合预加载: ${videoId}`)
        reject(new Error('网络条件不适合预加载'))
        return
      }

      // 创建预加载任务
      const abortController = new AbortController()
      const task: PreloadTask = {
        id: videoId,
        videoUrl,
        priority: options.priority,
        startTime: Date.now(),
        status: 'loading',
        abortController,
        onLoad: () => resolve(task.element!),
        onError: reject
      }

      this.tasks.set(videoId, task)
      this.activePreloads.add(videoId)
      this.stats.totalPreloads++

      // 创建视频元素
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      
      // 根据策略设置预加载属性
      switch (options.preloadStrategy) {
        case 'metadata':
          video.preload = 'metadata'
          break
        case 'partial':
          video.preload = 'auto'
          break
        case 'full':
          video.preload = 'auto'
          break
      }

      task.element = video

      // 设置事件监听
      const cleanup = () => {
        video.removeEventListener('canplaythrough', onCanPlayThrough)
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.removeEventListener('error', onError)
        video.removeEventListener('abort', onAbort)
        this.activePreloads.delete(videoId)
      }

      const onCanPlayThrough = () => {
        if (task.status === 'cancelled') return
        
        task.status = 'loaded'
        this.videoElements.set(videoId, video)
        this.stats.successfulPreloads++
        
        const loadTime = Date.now() - task.startTime
        this.updateAverageLoadTime(loadTime)
        
        console.log(`[VideoPreloadManager] 预加载完成: ${videoId} (${loadTime}ms)`)
        cleanup()
        task.onLoad?.()
      }

      const onLoadedMetadata = () => {
        if (options.preloadStrategy === 'metadata') {
          onCanPlayThrough() // 对于metadata策略，加载元数据就足够了
        }
      }

      const onError = (event: Event) => {
        console.error(`[VideoPreloadManager] 预加载失败: ${videoId}`, event)
        task.status = 'error'
        this.stats.failedPreloads++
        cleanup()
        task.onError?.(new Error('视频预加载失败'))
      }

      const onAbort = () => {
        if (task.status !== 'cancelled') {
          task.status = 'cancelled'
          this.stats.cancelledPreloads++
        }
        cleanup()
      }

      video.addEventListener('canplaythrough', onCanPlayThrough)
      video.addEventListener('loadedmetadata', onLoadedMetadata)
      video.addEventListener('error', onError)
      video.addEventListener('abort', onAbort)

      // 监听取消信号
      abortController.signal.addEventListener('abort', () => {
        video.src = '' // 停止加载
        onAbort()
      })

      // 开始加载
      video.src = videoUrl
      video.load()

      console.log(`[VideoPreloadManager] 开始预加载: ${videoId} (优先级: ${options.priority})`)
    })
  }

  /**
   * 取消悬浮定时器
   */
  private cancelHoverTimer(videoId: string): void {
    const timer = this.hoverTimers.get(videoId)
    if (timer) {
      clearTimeout(timer)
      this.hoverTimers.delete(videoId)
    }
  }

  /**
   * 驱逐低优先级任务
   */
  private evictLowPriorityTasks(newTaskPriority: 'low' | 'medium' | 'high'): void {
    const priorityOrder = { low: 1, medium: 2, high: 3 }
    const newPriorityLevel = priorityOrder[newTaskPriority]

    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'loading' && priorityOrder[task.priority] < newPriorityLevel) {
        console.log(`[VideoPreloadManager] 驱逐低优先级任务: ${taskId}`)
        this.cancelPreload(taskId)
        break // 只驱逐一个任务
      }
    }
  }

  /**
   * 网络适应性检查
   */
  private isNetworkSuitable(strategy: 'metadata' | 'partial' | 'full'): boolean {
    const network = this.getNetworkInfo()
    
    if (network.saveData) {
      return strategy === 'metadata' // 节省数据模式只允许元数据预加载
    }

    switch (network.effectiveType) {
      case 'slow-2g':
      case '2g':
        return strategy === 'metadata'
      case '3g':
        return strategy !== 'full'
      case '4g':
      default:
        return true
    }
  }

  /**
   * 获取网络信息
   */
  private getNetworkInfo(): NetworkInfo {
    const nav = navigator as any
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection

    if (connection) {
      return {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 50,
        saveData: connection.saveData || false
      }
    }

    // 默认值
    return {
      effectiveType: 'unknown',
      downlink: 10,
      rtt: 50,
      saveData: false
    }
  }

  /**
   * 初始化网络监控
   */
  private initializeNetworkMonitoring(): void {
    const nav = navigator as any
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection

    if (connection) {
      connection.addEventListener('change', () => {
        const networkInfo = this.getNetworkInfo()
        console.log('[VideoPreloadManager] 网络状况变化:', networkInfo)
        
        // 如果网络变差，取消部分预加载任务
        if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
          this.pauseLowPriorityPreloads()
        }
      })
    }
  }

  /**
   * 暂停低优先级预加载
   */
  private pauseLowPriorityPreloads(): void {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'loading' && task.priority === 'low') {
        this.cancelPreload(taskId)
      }
    }
    this.stats.networkOptimizations++
  }

  /**
   * 更新平均加载时间
   */
  private updateAverageLoadTime(loadTime: number): void {
    const currentAvg = this.stats.averageLoadTime
    const count = this.stats.successfulPreloads
    this.stats.averageLoadTime = ((currentAvg * (count - 1)) + loadTime) / count
  }

  /**
   * 启动清理定时器
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldTasks()
    }, 60000) // 每分钟清理一次
  }

  /**
   * 清理过期任务
   */
  private cleanupOldTasks(): void {
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5分钟

    for (const [taskId, task] of this.tasks.entries()) {
      const age = now - task.startTime
      if (age > maxAge || task.status === 'error' || task.status === 'cancelled') {
        // 清理视频元素
        if (task.element) {
          task.element.src = ''
          task.element.remove()
        }
        
        this.tasks.delete(taskId)
        this.videoElements.delete(taskId)
        this.activePreloads.delete(taskId)
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      activeTasks: this.activePreloads.size,
      cachedVideos: this.videoElements.size,
      networkInfo: this.getNetworkInfo()
    }
  }

  /**
   * 清理所有资源
   */
  cleanup(): void {
    // 取消所有定时器
    for (const timer of this.hoverTimers.values()) {
      clearTimeout(timer)
    }
    this.hoverTimers.clear()

    // 取消所有预加载任务
    for (const task of this.tasks.values()) {
      task.abortController?.abort()
      if (task.element) {
        task.element.src = ''
        task.element.remove()
      }
    }

    this.tasks.clear()
    this.activePreloads.clear()
    this.videoElements.clear()
  }
}

// 导出单例实例
export const videoPreloadManager = new VideoPreloadManager()
export default videoPreloadManager