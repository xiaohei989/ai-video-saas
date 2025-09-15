/**
 * 全局视频播放管理器
 * 限制同时播放的视频数量，特别针对移动端性能优化
 */

import { log } from '@/utils/logger'

export interface VideoInstance {
  id: string
  element: HTMLVideoElement
  priority: number // 优先级，越高越重要
  startTime: number
}

class VideoPlaybackManager {
  private activeVideos: Map<string, VideoInstance> = new Map()
  private maxConcurrentVideos: number = 3 // 默认最多3个视频同时播放
  private isMobile: boolean = false

  constructor() {
    this.detectDevice()
    this.setupEventListeners()
  }

  /**
   * 检测设备类型并调整限制
   */
  private detectDevice(): void {
    if (typeof window === 'undefined') return

    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isLowPerformance = navigator.hardwareConcurrency <= 4
    
    // 根据设备性能调整并发数量
    if (this.isMobile) {
      this.maxConcurrentVideos = 1 // 移动端只允许1个视频同时播放
    } else if (isLowPerformance) {
      this.maxConcurrentVideos = 2 // 低性能设备最多2个
    } else {
      this.maxConcurrentVideos = 3 // 高性能设备最多3个
    }

    log.debug('视频播放管理器初始化', {
      isMobile: this.isMobile,
      maxConcurrent: this.maxConcurrentVideos,
      hardwareConcurrency: navigator.hardwareConcurrency
    })
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return

    // 页面可见性变化时暂停所有视频
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAllVideos('页面隐藏')
      }
    })

    // 内存压力检测（如果支持）
    if ('memory' in performance && 'usedJSMemorySize' in (performance as any).memory) {
      setInterval(() => {
        const memInfo = (performance as any).memory
        const memoryUsageRatio = memInfo.usedJSMemorySize / memInfo.jsMemoryLimit
        
        // 内存使用超过80%时，限制视频播放
        if (memoryUsageRatio > 0.8) {
          this.pauseAllVideos('内存压力过高')
          this.maxConcurrentVideos = Math.max(1, Math.floor(this.maxConcurrentVideos / 2))
        }
      }, 10000) // 每10秒检查一次
    }
  }

  /**
   * 注册视频实例
   */
  register(videoId: string, element: HTMLVideoElement, priority: number = 0): void {
    if (this.activeVideos.has(videoId)) {
      return // 已经注册过了
    }

    const instance: VideoInstance = {
      id: videoId,
      element,
      priority,
      startTime: Date.now()
    }

    // 检查是否需要暂停其他视频
    if (this.activeVideos.size >= this.maxConcurrentVideos) {
      this.pauseLowerPriorityVideos(priority)
    }

    this.activeVideos.set(videoId, instance)
    
    // 监听视频事件
    element.addEventListener('play', () => this.onVideoPlay(videoId))
    element.addEventListener('pause', () => this.onVideoPause(videoId))
    element.addEventListener('ended', () => this.onVideoEnded(videoId))

    log.debug('视频实例注册', { videoId, priority, activeCount: this.activeVideos.size })
  }

  /**
   * 取消注册视频实例
   */
  unregister(videoId: string): void {
    if (this.activeVideos.has(videoId)) {
      this.activeVideos.delete(videoId)
      log.debug('视频实例取消注册', { videoId, activeCount: this.activeVideos.size })
    }
  }

  /**
   * 请求播放视频
   */
  requestPlay(videoId: string): boolean {
    const instance = this.activeVideos.get(videoId)
    if (!instance) {
      log.warn('尝试播放未注册的视频', { videoId })
      return false
    }

    // 检查当前播放数量
    const currentlyPlaying = this.getCurrentlyPlayingCount()
    
    if (currentlyPlaying >= this.maxConcurrentVideos) {
      // 暂停优先级更低的视频
      const success = this.pauseLowerPriorityVideos(instance.priority)
      if (!success) {
        log.info('无法播放视频：已达到最大并发数', { videoId, currentlyPlaying })
        return false
      }
    }

    return true
  }

  /**
   * 暂停优先级更低的视频
   */
  private pauseLowerPriorityVideos(currentPriority: number): boolean {
    const playingVideos = Array.from(this.activeVideos.values())
      .filter(instance => !instance.element.paused)
      .sort((a, b) => {
        // 按优先级排序，相同优先级按播放时间排序
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        return a.startTime - b.startTime
      })

    let pausedCount = 0
    for (const instance of playingVideos) {
      if (instance.priority < currentPriority) {
        instance.element.pause()
        pausedCount++
        
        if (this.getCurrentlyPlayingCount() < this.maxConcurrentVideos) {
          break
        }
      }
    }

    return pausedCount > 0
  }

  /**
   * 获取当前播放中的视频数量
   */
  private getCurrentlyPlayingCount(): number {
    return Array.from(this.activeVideos.values())
      .filter(instance => !instance.element.paused).length
  }

  /**
   * 暂停所有视频
   */
  private pauseAllVideos(reason: string): void {
    let pausedCount = 0
    for (const instance of this.activeVideos.values()) {
      if (!instance.element.paused) {
        instance.element.pause()
        pausedCount++
      }
    }

    if (pausedCount > 0) {
      log.info('暂停所有视频', { reason, pausedCount })
    }
  }

  /**
   * 视频开始播放事件
   */
  private onVideoPlay(videoId: string): void {
    const instance = this.activeVideos.get(videoId)
    if (instance) {
      instance.startTime = Date.now()
      log.debug('视频开始播放', { videoId, activeCount: this.getCurrentlyPlayingCount() })
    }
  }

  /**
   * 视频暂停事件
   */
  private onVideoPause(videoId: string): void {
    log.debug('视频暂停', { videoId, activeCount: this.getCurrentlyPlayingCount() })
  }

  /**
   * 视频结束事件
   */
  private onVideoEnded(videoId: string): void {
    log.debug('视频播放结束', { videoId, activeCount: this.getCurrentlyPlayingCount() })
  }

  /**
   * 获取管理器状态
   */
  getStatus(): {
    maxConcurrent: number
    activeVideos: number
    playingVideos: number
    isMobile: boolean
  } {
    return {
      maxConcurrent: this.maxConcurrentVideos,
      activeVideos: this.activeVideos.size,
      playingVideos: this.getCurrentlyPlayingCount(),
      isMobile: this.isMobile
    }
  }

  /**
   * 动态调整最大并发数（用于紧急情况）
   */
  setMaxConcurrentVideos(count: number): void {
    const oldCount = this.maxConcurrentVideos
    this.maxConcurrentVideos = Math.max(1, count)
    
    log.info('调整最大并发视频数', { oldCount, newCount: this.maxConcurrentVideos })

    // 如果新限制更低，暂停多余的视频
    const currentlyPlaying = this.getCurrentlyPlayingCount()
    if (currentlyPlaying > this.maxConcurrentVideos) {
      this.pauseLowerPriorityVideos(Number.MAX_SAFE_INTEGER)
    }
  }
}

// 创建全局单例实例
const videoPlaybackManager = new VideoPlaybackManager()

// 导出管理器
export { videoPlaybackManager }
export default videoPlaybackManager

// 在开发环境下，将管理器挂载到全局对象方便调试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__VIDEO_MANAGER__ = {
    manager: videoPlaybackManager,
    status: () => videoPlaybackManager.getStatus(),
    pauseAll: () => videoPlaybackManager['pauseAllVideos']('手动暂停'),
    setMaxConcurrent: (count: number) => videoPlaybackManager.setMaxConcurrentVideos(count)
  }
}