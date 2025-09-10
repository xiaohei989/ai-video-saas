/**
 * 智能视频预加载服务
 * 
 * 实现基于用户行为的预测性加载
 * 优化视频加载体验，减少等待时间
 * 
 * 策略：
 * - 视口检测：根据元素距离视口的位置分级加载
 * - 用户行为预测：鼠标悬停、滚动方向预测
 * - 网络自适应：根据网络状况调整加载策略
 * - 渐进式加载：先加载低质量，后台加载高质量
 */

import { multiLevelCache, CACHE_PREFIX, TTL_STRATEGY } from './MultiLevelCacheService'
import videoLoaderService, { NetworkQuality } from './VideoLoaderService'
import thumbnailCacheService from './ThumbnailCacheService'

export interface PreloadStrategy {
  viewport: {
    immediate: number     // 视口内立即加载（屏幕数）
    thumbnail: number     // 加载缩略图范围（屏幕数）
    metadata: number      // 预加载元数据范围（屏幕数）
    preconnect: number    // 预连接CDN范围（屏幕数）
  }
  hover: {
    delay: number         // 悬停延迟触发（毫秒）
    preloadDuration: number // 预加载视频长度（秒）
  }
  quality: {
    initial: 'auto' | 'low' | 'medium' | 'high'
    progressive: boolean  // 是否渐进式加载
    backgroundUpgrade: boolean // 是否后台升级质量
  }
  limits: {
    maxConcurrent: number // 最大并发加载数
    maxPreload: number    // 最大预加载数量
    maxCacheSize: number  // 最大缓存大小（MB）
  }
}

export interface VideoItem {
  id: string
  url: string
  thumbnailUrl?: string
  duration?: number
  size?: number
  quality?: 'low' | 'medium' | 'high'
  priority?: number
}

export interface PreloadTask {
  videoId: string
  type: 'thumbnail' | 'metadata' | 'preview' | 'full'
  priority: number
  status: 'pending' | 'loading' | 'completed' | 'failed'
  progress: number
  startTime: number
  retryCount: number
}

export interface PreloadStats {
  totalPreloaded: number
  thumbnailsLoaded: number
  videosLoaded: number
  cacheHits: number
  cacheMisses: number
  networkBytes: number
  averageLoadTime: number
}

class SmartVideoPreloadService {
  // 预加载队列
  private preloadQueue = new Map<string, PreloadTask>()
  private loadingTasks = new Map<string, PreloadTask>()
  private completedTasks = new Set<string>()
  
  // 观察器
  private observers = new Map<string, IntersectionObserver>()
  private hoverTimers = new Map<string, NodeJS.Timeout>()
  
  // 网络状态
  private networkQuality: NetworkQuality | null = null
  private isOnline = navigator.onLine
  
  // 统计信息
  private stats: PreloadStats = {
    totalPreloaded: 0,
    thumbnailsLoaded: 0,
    videosLoaded: 0,
    cacheHits: 0,
    cacheMisses: 0,
    networkBytes: 0,
    averageLoadTime: 0
  }
  
  // 默认策略
  private strategy: PreloadStrategy = {
    viewport: {
      immediate: 0,
      thumbnail: 1,
      metadata: 2,
      preconnect: 3
    },
    hover: {
      delay: 500,
      preloadDuration: 3
    },
    quality: {
      initial: 'auto',
      progressive: true,
      backgroundUpgrade: true
    },
    limits: {
      maxConcurrent: 3,
      maxPreload: 10,
      maxCacheSize: 500
    }
  }

  constructor() {
    this.initializeNetworkMonitor()
    this.startPreloadProcessor()
  }

  /**
   * 初始化网络监控
   */
  private initializeNetworkMonitor(): void {
    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.isOnline = true
      this.resumePreloading()
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
      this.pausePreloading()
    })
    
    // 监听网络质量变化
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', () => {
        this.updateNetworkQuality()
        this.adjustStrategy()
      })
    }
    
    // 初始检测
    this.updateNetworkQuality()
  }

  /**
   * 更新网络质量
   */
  private updateNetworkQuality(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      this.networkQuality = {
        type: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 1,
        rtt: connection.rtt || 300,
        saveData: connection.saveData || false
      }
      
      console.log('[SmartPreload] 网络质量更新:', this.networkQuality)
    }
  }

  /**
   * 根据网络质量调整策略
   */
  private adjustStrategy(): void {
    if (!this.networkQuality) return
    
    const { type, saveData } = this.networkQuality
    
    // 流量节省模式
    if (saveData) {
      this.strategy.viewport.immediate = 0
      this.strategy.viewport.thumbnail = 0.5
      this.strategy.quality.initial = 'low'
      this.strategy.quality.progressive = false
      this.strategy.quality.backgroundUpgrade = false
      this.strategy.limits.maxConcurrent = 1
      return
    }
    
    // 根据网络类型调整
    switch (type) {
      case '4g':
        this.strategy.viewport.immediate = 0
        this.strategy.viewport.thumbnail = 2
        this.strategy.viewport.metadata = 3
        this.strategy.quality.initial = 'high'
        this.strategy.quality.progressive = true
        this.strategy.quality.backgroundUpgrade = true
        this.strategy.limits.maxConcurrent = 5
        break
        
      case '3g':
        this.strategy.viewport.immediate = 0
        this.strategy.viewport.thumbnail = 1
        this.strategy.viewport.metadata = 1.5
        this.strategy.quality.initial = 'medium'
        this.strategy.quality.progressive = true
        this.strategy.quality.backgroundUpgrade = false
        this.strategy.limits.maxConcurrent = 2
        break
        
      case '2g':
      case 'slow-2g':
        this.strategy.viewport.immediate = 0
        this.strategy.viewport.thumbnail = 0.5
        this.strategy.viewport.metadata = 0
        this.strategy.quality.initial = 'low'
        this.strategy.quality.progressive = false
        this.strategy.quality.backgroundUpgrade = false
        this.strategy.limits.maxConcurrent = 1
        break
        
      default:
        // 使用默认策略
        break
    }
  }

  /**
   * 注册视频元素进行预加载
   */
  registerVideo(
    element: HTMLElement,
    video: VideoItem,
    options: {
      autoPreload?: boolean
      priority?: number
      onProgress?: (progress: number) => void
      onComplete?: () => void
      onError?: (error: Error) => void
    } = {}
  ): () => void {
    const { autoPreload = true, priority = 0 } = options
    
    // 创建视口观察器
    const observer = this.createViewportObserver(video, priority)
    observer.observe(element)
    this.observers.set(video.id, observer)
    
    // 添加鼠标悬停监听
    const handleMouseEnter = () => this.handleHover(video, true)
    const handleMouseLeave = () => this.handleHover(video, false)
    
    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)
    
    // 如果启用自动预加载，添加到队列
    if (autoPreload) {
      this.addToQueue(video, 'metadata', priority)
    }
    
    // 返回清理函数
    return () => {
      observer.unobserve(element)
      observer.disconnect()
      this.observers.delete(video.id)
      
      element.removeEventListener('mouseenter', handleMouseEnter)
      element.removeEventListener('mouseleave', handleMouseLeave)
      
      this.cancelPreload(video.id)
    }
  }

  /**
   * 创建视口观察器
   */
  private createViewportObserver(video: VideoItem, priority: number): IntersectionObserver {
    const thresholds = [0, 0.25, 0.5, 0.75, 1]
    
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const distance = this.calculateViewportDistance(entry)
        
        if (entry.isIntersecting) {
          // 在视口内 - 立即加载
          this.addToQueue(video, 'full', priority + 100)
        } else if (distance <= this.strategy.viewport.thumbnail) {
          // 缩略图范围
          this.addToQueue(video, 'thumbnail', priority + 50)
        } else if (distance <= this.strategy.viewport.metadata) {
          // 元数据范围
          this.addToQueue(video, 'metadata', priority + 25)
        } else if (distance <= this.strategy.viewport.preconnect) {
          // 预连接范围
          this.preconnectCDN(video.url)
        }
      })
    }, {
      rootMargin: `${this.strategy.viewport.preconnect * 100}%`,
      threshold: thresholds
    })
  }

  /**
   * 计算元素到视口的距离（屏幕数）
   */
  private calculateViewportDistance(entry: IntersectionObserverEntry): number {
    const rect = entry.boundingClientRect
    const viewportHeight = window.innerHeight
    
    if (entry.isIntersecting) return 0
    
    // 元素在视口上方
    if (rect.bottom < 0) {
      return Math.abs(rect.bottom) / viewportHeight
    }
    
    // 元素在视口下方
    if (rect.top > viewportHeight) {
      return (rect.top - viewportHeight) / viewportHeight
    }
    
    return 0
  }

  /**
   * 处理鼠标悬停
   */
  private handleHover(video: VideoItem, isHovering: boolean): void {
    const timerId = this.hoverTimers.get(video.id)
    
    if (isHovering) {
      // 开始悬停 - 设置延迟触发
      const timer = setTimeout(() => {
        this.addToQueue(video, 'preview', 90)
        this.hoverTimers.delete(video.id)
      }, this.strategy.hover.delay)
      
      this.hoverTimers.set(video.id, timer)
    } else {
      // 结束悬停 - 取消计时器
      if (timerId) {
        clearTimeout(timerId)
        this.hoverTimers.delete(video.id)
      }
    }
  }

  /**
   * 添加到预加载队列
   */
  private addToQueue(
    video: VideoItem,
    type: PreloadTask['type'],
    priority: number
  ): void {
    const taskId = `${video.id}-${type}`
    
    // 如果已完成，跳过
    if (this.completedTasks.has(taskId)) {
      this.stats.cacheHits++
      return
    }
    
    // 如果已在队列或加载中，更新优先级
    const existingTask = this.preloadQueue.get(taskId) || this.loadingTasks.get(taskId)
    if (existingTask) {
      existingTask.priority = Math.max(existingTask.priority, priority)
      return
    }
    
    // 创建新任务
    const task: PreloadTask = {
      videoId: video.id,
      type,
      priority,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
      retryCount: 0
    }
    
    this.preloadQueue.set(taskId, task)
    this.stats.cacheMisses++
  }

  /**
   * 预加载处理器
   */
  private async startPreloadProcessor(): Promise<void> {
    setInterval(() => {
      if (!this.isOnline) return
      if (this.loadingTasks.size >= this.strategy.limits.maxConcurrent) return
      
      const nextTask = this.getNextTask()
      if (nextTask) {
        this.processTask(nextTask)
      }
    }, 100)
  }

  /**
   * 获取下一个任务
   */
  private getNextTask(): PreloadTask | null {
    if (this.preloadQueue.size === 0) return null
    
    // 按优先级排序
    const tasks = Array.from(this.preloadQueue.values())
      .sort((a, b) => b.priority - a.priority)
    
    const task = tasks[0]
    if (task) {
      const taskId = `${task.videoId}-${task.type}`
      this.preloadQueue.delete(taskId)
      this.loadingTasks.set(taskId, task)
    }
    
    return task
  }

  /**
   * 处理预加载任务
   */
  private async processTask(task: PreloadTask): Promise<void> {
    const taskId = `${task.videoId}-${task.type}`
    task.status = 'loading'
    
    try {
      const startTime = Date.now()
      
      switch (task.type) {
        case 'thumbnail':
          await this.preloadThumbnail(task.videoId)
          this.stats.thumbnailsLoaded++
          break
          
        case 'metadata':
          await this.preloadMetadata(task.videoId)
          break
          
        case 'preview':
          await this.preloadPreview(task.videoId, this.strategy.hover.preloadDuration)
          break
          
        case 'full':
          await this.preloadFullVideo(task.videoId)
          this.stats.videosLoaded++
          break
      }
      
      task.status = 'completed'
      task.progress = 100
      this.completedTasks.add(taskId)
      this.stats.totalPreloaded++
      
      // 更新平均加载时间
      const loadTime = Date.now() - startTime
      this.stats.averageLoadTime = 
        (this.stats.averageLoadTime * (this.stats.totalPreloaded - 1) + loadTime) / 
        this.stats.totalPreloaded
      
      console.log(`[SmartPreload] ✅ 预加载完成: ${taskId}`)
    } catch (error) {
      console.error(`[SmartPreload] ❌ 预加载失败: ${taskId}`, error)
      
      task.status = 'failed'
      task.retryCount++
      
      // 重试逻辑
      if (task.retryCount < 3) {
        task.status = 'pending'
        task.priority -= 10 // 降低优先级
        this.preloadQueue.set(taskId, task)
      }
    } finally {
      this.loadingTasks.delete(taskId)
    }
  }

  /**
   * 预加载缩略图
   */
  private async preloadThumbnail(videoId: string): Promise<void> {
    const cacheKey = `${CACHE_PREFIX.THUMBNAIL}${videoId}`
    
    // 先检查缓存
    const cached = await multiLevelCache.get(cacheKey)
    if (cached) return
    
    // 从视频提取缩略图
    const thumbnail = await thumbnailCacheService.getThumbnail(
      `/videos/${videoId}`,
      { quality: 'medium', frameTime: 0.1 }
    )
    
    // 缓存缩略图
    await multiLevelCache.set(cacheKey, thumbnail, {
      ttl: TTL_STRATEGY.STATIC
    })
  }

  /**
   * 预加载元数据
   */
  private async preloadMetadata(videoId: string): Promise<void> {
    const cacheKey = `${CACHE_PREFIX.VIDEO}meta:${videoId}`
    
    // 先检查缓存
    const cached = await multiLevelCache.get(cacheKey)
    if (cached) return
    
    // 获取视频元数据（仅加载头部信息）
    const response = await fetch(`/videos/${videoId}`, {
      method: 'HEAD'
    })
    
    const metadata = {
      size: parseInt(response.headers.get('content-length') || '0'),
      type: response.headers.get('content-type'),
      lastModified: response.headers.get('last-modified')
    }
    
    // 缓存元数据
    await multiLevelCache.set(cacheKey, metadata, {
      ttl: TTL_STRATEGY.USER
    })
  }

  /**
   * 预加载视频预览（前N秒）
   */
  private async preloadPreview(videoId: string, duration: number): Promise<void> {
    const cacheKey = `${CACHE_PREFIX.VIDEO}preview:${videoId}`
    
    // 先检查缓存
    const cached = await multiLevelCache.get(cacheKey)
    if (cached) return
    
    // 使用Range请求加载前N秒
    const video = document.createElement('video')
    video.src = `/videos/${videoId}`
    video.preload = 'metadata'
    video.currentTime = 0
    
    await new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', resolve)
      video.addEventListener('error', reject)
      
      // 设置超时
      setTimeout(() => reject(new Error('Preview load timeout')), 10000)
    })
    
    // 标记为已缓存
    await multiLevelCache.set(cacheKey, true, {
      ttl: TTL_STRATEGY.USER,
      level: 'L1' // 仅在内存缓存
    })
  }

  /**
   * 预加载完整视频
   */
  private async preloadFullVideo(videoId: string): Promise<void> {
    // 根据质量策略选择版本
    const quality = this.getTargetQuality()
    const url = `/videos/${videoId}?quality=${quality}`
    
    // 使用VideoLoaderService加载
    await videoLoaderService.loadVideo(url, {
      quality,
      preload: 'auto',
      enableRangeRequests: true
    })
    
    // 如果需要后台升级质量
    if (this.strategy.quality.backgroundUpgrade && quality !== 'high') {
      setTimeout(() => {
        this.addToQueue(
          { id: videoId, url: `/videos/${videoId}?quality=high` },
          'full',
          10 // 低优先级
        )
      }, 5000)
    }
  }

  /**
   * 预连接CDN
   */
  private preconnectCDN(url: string): void {
    try {
      const urlObj = new URL(url, window.location.origin)
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = urlObj.origin
      document.head.appendChild(link)
    } catch (error) {
      console.error('[SmartPreload] 预连接失败:', error)
    }
  }

  /**
   * 获取目标质量
   */
  private getTargetQuality(): 'low' | 'medium' | 'high' {
    if (this.strategy.quality.initial !== 'auto') {
      return this.strategy.quality.initial
    }
    
    // 根据网络质量自动选择
    if (!this.networkQuality) return 'medium'
    
    const { type, downlink } = this.networkQuality
    
    if (type === '4g' || downlink > 5) return 'high'
    if (type === '3g' || downlink > 1.5) return 'medium'
    return 'low'
  }

  /**
   * 暂停预加载
   */
  private pausePreloading(): void {
    console.log('[SmartPreload] ⏸️ 预加载已暂停（离线）')
  }

  /**
   * 恢复预加载
   */
  private resumePreloading(): void {
    console.log('[SmartPreload] ▶️ 预加载已恢复（在线）')
  }

  /**
   * 取消预加载
   */
  cancelPreload(videoId: string): void {
    ['thumbnail', 'metadata', 'preview', 'full'].forEach(type => {
      const taskId = `${videoId}-${type}`
      this.preloadQueue.delete(taskId)
      this.loadingTasks.delete(taskId)
    })
  }

  /**
   * 清理所有预加载
   */
  clearAll(): void {
    this.preloadQueue.clear()
    this.loadingTasks.clear()
    this.completedTasks.clear()
    
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
    
    this.hoverTimers.forEach(timer => clearTimeout(timer))
    this.hoverTimers.clear()
  }

  /**
   * 获取统计信息
   */
  getStats(): PreloadStats {
    return { ...this.stats }
  }

  /**
   * 更新策略
   */
  updateStrategy(updates: Partial<PreloadStrategy>): void {
    this.strategy = {
      ...this.strategy,
      ...updates,
      viewport: { ...this.strategy.viewport, ...updates.viewport },
      hover: { ...this.strategy.hover, ...updates.hover },
      quality: { ...this.strategy.quality, ...updates.quality },
      limits: { ...this.strategy.limits, ...updates.limits }
    }
    
    console.log('[SmartPreload] 策略已更新:', this.strategy)
  }
}

// 导出单例
export const smartPreloadService = new SmartVideoPreloadService()