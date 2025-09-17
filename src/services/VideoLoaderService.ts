/**
 * 视频加载优化服务
 * 
 * 功能包括：
 * 1. 网络质量检测和自适应加载
 * 2. 渐进式加载（Range Requests）
 * 3. 预加载策略管理
 * 4. 加载状态跟踪
 * 5. 带宽优化
 */

export interface NetworkQuality {
  type: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'
  downlink: number // Mbps
  rtt: number // 毫秒
  saveData: boolean
}

export interface VideoLoadOptions {
  quality?: 'high' | 'medium' | 'low' | 'auto'
  preload?: 'none' | 'metadata' | 'auto'
  priority?: 'high' | 'low'
  enableRangeRequests?: boolean
  chunkSize?: number // 分片大小（字节）
}

export interface LoadProgress {
  loaded: number
  total: number
  percentage: number
  speed: number // KB/s
  remainingTime: number // 秒
}

export interface VideoLoadState {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  progress: LoadProgress | null
  error: string | null
  networkQuality: NetworkQuality | null
  adaptedQuality: 'high' | 'medium' | 'low'
}

class VideoLoaderService {
  private loadingVideos = new Map<string, VideoLoadState>()
  private preloadQueue: string[] = []
  private maxConcurrentLoads = 3
  private currentLoads = 0
  private networkInfo: NetworkQuality | null = null
  
  // 网络质量阈值配置
  private readonly NETWORK_THRESHOLDS = {
    HIGH_QUALITY: { downlink: 5, rtt: 100 }, // >= 5Mbps, <= 100ms
    MEDIUM_QUALITY: { downlink: 1.5, rtt: 300 }, // >= 1.5Mbps, <= 300ms
    LOW_QUALITY: { downlink: 0.5, rtt: 1000 } // >= 0.5Mbps, <= 1000ms
  }

  constructor() {
    this.detectNetworkQuality()
    this.setupNetworkListener()
  }

  /**
   * 检测网络质量
   */
  private detectNetworkQuality(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      this.networkInfo = {
        type: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 1,
        rtt: connection.rtt || 300,
        saveData: connection.saveData || false
      }
      
    } else {
      // 后备方案：通过加载测试来估算网络速度
      this.estimateNetworkSpeed()
    }
  }

  /**
   * 设置网络变化监听器
   */
  private setupNetworkListener(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', () => {
        this.detectNetworkQuality()
        this.adaptAllVideosToNetwork()
      })
    }
  }

  /**
   * 估算网络速度（后备方案）
   */
  private async estimateNetworkSpeed(): Promise<void> {
    try {
      const startTime = Date.now()
      const response = await fetch('/templates/videos/asmr-surreal-toast-spread.mp4', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      const endTime = Date.now()
      
      if (response.ok) {
        const contentLength = parseInt(response.headers.get('content-length') || '0')
        const duration = endTime - startTime
        const speed = contentLength / duration // bytes per ms
        const speedMbps = (speed * 8) / 1000 // Mbps
        
        this.networkInfo = {
          type: speedMbps > 5 ? '4g' : speedMbps > 1.5 ? '3g' : '2g',
          downlink: speedMbps,
          rtt: duration,
          saveData: false
        }
        
        console.log('[VideoLoader] Network speed estimated:', this.networkInfo)
      }
    } catch (error) {
      console.error('[VideoLoader] Failed to estimate network speed:', error)
      // 使用保守的默认值
      this.networkInfo = {
        type: '3g',
        downlink: 1.5,
        rtt: 300,
        saveData: false
      }
    }
  }

  /**
   * 根据网络质量自动选择视频质量
   */
  getOptimalQuality(requestedQuality: 'high' | 'medium' | 'low' | 'auto' = 'auto'): 'high' | 'medium' | 'low' {
    if (requestedQuality !== 'auto') {
      return requestedQuality
    }

    if (!this.networkInfo) {
      return 'medium' // 默认质量
    }

    const { downlink, rtt, saveData } = this.networkInfo

    // 如果用户开启了省流量模式，强制低质量
    if (saveData) {
      return 'low'
    }

    // 根据网络条件选择质量
    if (downlink >= this.NETWORK_THRESHOLDS.HIGH_QUALITY.downlink && 
        rtt <= this.NETWORK_THRESHOLDS.HIGH_QUALITY.rtt) {
      return 'high'
    } else if (downlink >= this.NETWORK_THRESHOLDS.MEDIUM_QUALITY.downlink && 
               rtt <= this.NETWORK_THRESHOLDS.MEDIUM_QUALITY.rtt) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  /**
   * 获取视频加载状态
   */
  getLoadState(videoUrl: string): VideoLoadState {
    return this.loadingVideos.get(videoUrl) || {
      status: 'idle',
      progress: null,
      error: null,
      networkQuality: this.networkInfo,
      adaptedQuality: this.getOptimalQuality()
    }
  }

  /**
   * 加载视频（主要方法）
   */
  async loadVideo(
    videoUrl: string,
    options: VideoLoadOptions = {},
    onProgress?: (progress: LoadProgress) => void
  ): Promise<string> {
    const {
      quality = 'auto',
      preload = 'metadata',
      priority = 'low',
      enableRangeRequests = true,
      chunkSize = 1024 * 1024 // 1MB chunks
    } = options

    // 检查是否已经在加载中
    const currentState = this.loadingVideos.get(videoUrl)
    if (currentState?.status === 'loading') {
      return new Promise((resolve, reject) => {
        // 等待当前加载完成
        const checkStatus = () => {
          const state = this.loadingVideos.get(videoUrl)
          if (state?.status === 'loaded') {
            resolve(videoUrl)
          } else if (state?.status === 'error') {
            reject(new Error(state.error || 'Video load failed'))
          } else {
            setTimeout(checkStatus, 100)
          }
        }
        checkStatus()
      })
    }

    // 如果已经加载完成，直接返回
    if (currentState?.status === 'loaded') {
      return videoUrl
    }

    // 检查并发加载限制
    if (this.currentLoads >= this.maxConcurrentLoads && priority === 'low') {
      // 加入预加载队列
      this.preloadQueue.push(videoUrl)
      return this.waitForQueueProcessing(videoUrl)
    }

    return this.performLoad(videoUrl, options, onProgress)
  }

  /**
   * 执行实际的视频加载
   */
  private async performLoad(
    videoUrl: string,
    options: VideoLoadOptions,
    onProgress?: (progress: LoadProgress) => void
  ): Promise<string> {
    const adaptedQuality = this.getOptimalQuality(options.quality)
    
    // 设置初始状态
    this.loadingVideos.set(videoUrl, {
      status: 'loading',
      progress: { loaded: 0, total: 0, percentage: 0, speed: 0, remainingTime: 0 },
      error: null,
      networkQuality: this.networkInfo,
      adaptedQuality
    })

    this.currentLoads++

    try {
      let result: string

      if (options.enableRangeRequests && this.supportsRangeRequests(videoUrl)) {
        result = await this.loadVideoWithRangeRequests(videoUrl, options, onProgress)
      } else {
        result = await this.loadVideoStandard(videoUrl, options, onProgress)
      }

      // 更新状态为已加载
      this.loadingVideos.set(videoUrl, {
        status: 'loaded',
        progress: { loaded: 100, total: 100, percentage: 100, speed: 0, remainingTime: 0 },
        error: null,
        networkQuality: this.networkInfo,
        adaptedQuality
      })

      return result

    } catch (error) {
      // 更新状态为错误
      this.loadingVideos.set(videoUrl, {
        status: 'error',
        progress: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        networkQuality: this.networkInfo,
        adaptedQuality
      })

      throw error
    } finally {
      this.currentLoads--
      this.processQueue()
    }
  }

  /**
   * 标准视频加载
   */
  private async loadVideoStandard(
    videoUrl: string,
    options: VideoLoadOptions,
    onProgress?: (progress: LoadProgress) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = options.preload || 'metadata'
      video.src = videoUrl
      
      // 导入CORS处理工具函数
      import('../utils/videoUrlProxy').then(({ applyVideoCorsFix }) => {
        applyVideoCorsFix(video, videoUrl)
      }).catch(() => {
        // 如果导入失败，手动设置CORS属性
        if (videoUrl.includes('cdn.veo3video.me') || 
            videoUrl.includes('filesystem.site') ||
            videoUrl.includes('heyoo.oss-ap-southeast-1.aliyuncs.com')) {
          video.crossOrigin = 'anonymous'
          video.setAttribute('crossorigin', 'anonymous')
        }
      })
      
      const startTime = Date.now()
      let lastLoaded = 0

      const updateProgress = () => {
        if (video.buffered.length > 0) {
          const loaded = video.buffered.end(0)
          const total = video.duration || 0
          const percentage = total > 0 ? (loaded / total) * 100 : 0
          
          const currentTime = Date.now()
          const elapsedTime = (currentTime - startTime) / 1000
          const loadedBytes = loaded - lastLoaded
          const speed = loadedBytes > 0 ? loadedBytes / 1024 : 0 // KB/s
          const remainingTime = speed > 0 ? (total - loaded) / speed : 0

          const progress: LoadProgress = {
            loaded,
            total,
            percentage,
            speed,
            remainingTime
          }

          // 更新状态
          const currentState = this.loadingVideos.get(videoUrl)
          if (currentState) {
            currentState.progress = progress
          }

          onProgress?.(progress)
          lastLoaded = loaded
        }
      }

      video.addEventListener('progress', updateProgress)
      video.addEventListener('canplaythrough', () => {
        updateProgress()
        resolve(videoUrl)
      })
      video.addEventListener('error', (e) => {
        reject(new Error(`Video load error: ${e.message || 'Unknown error'}`))
      })

      video.load()
    })
  }

  /**
   * 使用Range Requests的分片加载
   */
  private async loadVideoWithRangeRequests(
    videoUrl: string,
    options: VideoLoadOptions,
    onProgress?: (progress: LoadProgress) => void
  ): Promise<string> {
    try {
      // 首先测试是否支持CORS和Range请求
      const testResponse = await fetch(videoUrl, { 
        method: 'HEAD',
        mode: 'cors'
      }).catch(() => null)
      
      if (!testResponse || !testResponse.ok) {
        console.log('[VideoLoader] HEAD request failed, falling back to standard loading')
        // 记录此域名不支持Range请求
        const hostname = new URL(videoUrl).hostname
        localStorage.setItem(`range_support_${hostname}`, 'false')
        throw new Error('HEAD request failed')
      }

      const totalSize = parseInt(testResponse.headers.get('content-length') || '0')
      const acceptRanges = testResponse.headers.get('accept-ranges')
      
      if (totalSize === 0 || acceptRanges !== 'bytes') {
        // 记录此域名不支持Range请求
        const hostname = new URL(videoUrl).hostname
        localStorage.setItem(`range_support_${hostname}`, 'false')
        throw new Error('Range requests not supported')
      }

      const chunkSize = options.chunkSize || 1024 * 1024

      // 首先加载前面的小块用于快速预览
      const previewSize = Math.min(chunkSize, totalSize * 0.1) // 前10%或1MB
      await this.loadVideoChunk(videoUrl, 0, previewSize, onProgress, totalSize)

      // 根据网络质量决定是否继续加载
      const quality = this.getOptimalQuality(options.quality)
      if (quality === 'low') {
        // 低质量网络只加载预览部分
        return videoUrl
      }

      // 继续加载剩余部分
      let loadedSize = previewSize
      while (loadedSize < totalSize) {
        const endByte = Math.min(loadedSize + chunkSize, totalSize)
        await this.loadVideoChunk(videoUrl, loadedSize, endByte, onProgress, totalSize)
        loadedSize = endByte

        // 检查是否需要暂停加载（网络质量降低）
        if (this.shouldPauseLoading(videoUrl)) {
          break
        }
      }

      // 记录此域名支持Range请求
      const hostname = new URL(videoUrl).hostname
      localStorage.setItem(`range_support_${hostname}`, 'true')
      
      return videoUrl
    } catch (error) {
      // 回退到标准加载
      return this.loadVideoStandard(videoUrl, options, onProgress)
    }
  }

  /**
   * 加载视频分片
   */
  private async loadVideoChunk(
    videoUrl: string,
    startByte: number,
    endByte: number,
    onProgress?: (progress: LoadProgress) => void,
    totalSize: number = 0
  ): Promise<void> {
    const response = await fetch(videoUrl, {
      headers: {
        'Range': `bytes=${startByte}-${endByte - 1}`
      },
      mode: 'cors'
    }).catch((error) => {
      throw error
    })

    if (!response || !response.ok) {
      throw new Error(`Failed to load chunk ${startByte}-${endByte}: ${response?.status || 'Network Error'}`)
    }

    // 更新进度
    const progress: LoadProgress = {
      loaded: endByte,
      total: totalSize,
      percentage: totalSize > 0 ? (endByte / totalSize) * 100 : 0,
      speed: 0, // 这里可以计算实际速度
      remainingTime: 0
    }

    onProgress?.(progress)

    // 更新状态
    const currentState = this.loadingVideos.get(videoUrl)
    if (currentState) {
      currentState.progress = progress
    }
  }

  /**
   * 检查服务器是否支持Range Requests
   */
  private supportsRangeRequests(videoUrl: string): boolean {
    // 本地文件通常支持Range Requests
    if (videoUrl.startsWith('/') || videoUrl.includes(window.location.hostname)) {
      return true
    }
    
    // 对于外部URL，检查是否为已知支持Range Requests的域
    const knownSupportedDomains = [
      'youtube.com',
      'vimeo.com',
      'amazonaws.com',
      'cloudfront.net',
      'googleapis.com'
    ]
    
    // 检查缓存的Range支持信息
    const cacheKey = `range_support_${new URL(videoUrl).hostname}`
    const cached = localStorage.getItem(cacheKey)
    if (cached !== null) {
      return cached === 'true'
    }
    
    // 对于未知域名，默认先假设不支持以避免CORS错误
    const hostname = new URL(videoUrl).hostname
    const isKnownSupported = knownSupportedDomains.some(domain => hostname.includes(domain))
    
    if (!isKnownSupported) {
      // 缓存为不支持，避免重复尝试
      localStorage.setItem(cacheKey, 'false')
      return false
    }
    
    return isKnownSupported
  }

  /**
   * 检查是否应该暂停加载
   */
  private shouldPauseLoading(videoUrl?: string): boolean {
    if (!this.networkInfo) return false
    
    // 对于本地视频文件，网络条件不是限制因素
    if (videoUrl && videoUrl.startsWith('/templates/videos/')) {
      return false
    }
    
    // 如果网络质量变差，暂停加载
    return this.networkInfo.downlink < this.NETWORK_THRESHOLDS.LOW_QUALITY.downlink ||
           this.networkInfo.rtt > this.NETWORK_THRESHOLDS.LOW_QUALITY.rtt ||
           this.networkInfo.saveData
  }

  /**
   * 等待队列处理
   */
  private async waitForQueueProcessing(videoUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 20 // 最大等待10秒
      
      const checkQueue = () => {
        const state = this.loadingVideos.get(videoUrl)
        
        // 如果已加载完成，直接返回
        if (state?.status === 'loaded') {
          resolve(videoUrl)
          return
        }
        
        // 如果有错误但不是取消错误，尝试重新加载
        if (state?.status === 'error') {
          if (state.error === 'Load cancelled' && attempts < 3) {
            // 重置状态，重新尝试
            this.loadingVideos.delete(videoUrl)
            attempts++
            setTimeout(checkQueue, 1000) // 延迟1秒重试
            return
          } else {
            reject(new Error(state.error || 'Video load failed'))
            return
          }
        }
        
        // 如果不在队列中，立即开始加载
        if (!this.preloadQueue.includes(videoUrl)) {
          this.performLoad(videoUrl, { priority: 'high' }, undefined)
            .then(resolve)
            .catch(reject)
          return
        }
        
        // 如果超过最大尝试次数，强制加载
        if (attempts >= maxAttempts) {
          // 从队列中移除并立即加载
          const queueIndex = this.preloadQueue.indexOf(videoUrl)
          if (queueIndex !== -1) {
            this.preloadQueue.splice(queueIndex, 1)
          }
          this.performLoad(videoUrl, { priority: 'high' }, undefined)
            .then(resolve)
            .catch(reject)
          return
        }
        
        attempts++
        setTimeout(checkQueue, 500)
      }
      
      checkQueue()
    })
  }

  /**
   * 处理预加载队列
   */
  private processQueue(): void {
    if (this.preloadQueue.length === 0 || this.currentLoads >= this.maxConcurrentLoads) {
      return
    }

    const nextVideoUrl = this.preloadQueue.shift()
    if (nextVideoUrl) {
      this.performLoad(nextVideoUrl, { priority: 'low' }, undefined)
        .catch(error => {
          console.error('[VideoLoader] Queue item load failed:', error)
        })
    }
  }

  /**
   * 根据网络变化自适应所有视频
   */
  private adaptAllVideosToNetwork(): void {
    for (const [videoUrl, state] of this.loadingVideos.entries()) {
      if (state.status === 'loading') {
        // 更新正在加载的视频的质量策略
        state.adaptedQuality = this.getOptimalQuality()
        state.networkQuality = this.networkInfo
      }
    }
  }

  /**
   * 预加载视频列表
   */
  async preloadVideos(videoUrls: string[], options: VideoLoadOptions = {}): Promise<void> {
    const preloadOptions = {
      ...options,
      preload: 'metadata' as const,
      priority: 'low' as const
    }

    const promises = videoUrls.map(url => 
      this.loadVideo(url, preloadOptions).catch(error => {
        console.error(`[VideoLoader] Preload failed for ${url}:`, error)
      })
    )

    await Promise.allSettled(promises)
  }

  /**
   * 取消视频加载
   */
  cancelLoad(videoUrl: string, force: boolean = false): void {
    const state = this.loadingVideos.get(videoUrl)
    
    // 只有在强制取消或确实需要时才取消
    if (state?.status === 'loading') {
      // 对于本地视频文件，不要轻易取消加载
      const isLocalVideo = videoUrl.startsWith('/templates/videos/')
      if (isLocalVideo && !force) {
        return
      }
      
      this.loadingVideos.set(videoUrl, {
        ...state,
        status: 'error',
        error: 'Load cancelled'
      })
      
    }
    
    // 从预加载队列中移除
    const queueIndex = this.preloadQueue.indexOf(videoUrl)
    if (queueIndex !== -1) {
      this.preloadQueue.splice(queueIndex, 1)
    }
  }

  /**
   * 清理缓存的加载状态
   */
  cleanup(): void {
    this.loadingVideos.clear()
    this.preloadQueue.length = 0
    this.currentLoads = 0
  }

  /**
   * 获取网络质量信息
   */
  getNetworkQuality(): NetworkQuality | null {
    return this.networkInfo
  }

  /**
   * 设置最大并发加载数
   */
  setMaxConcurrentLoads(count: number): void {
    this.maxConcurrentLoads = Math.max(1, Math.min(10, count))
  }
}

// 创建单例实例
export const videoLoaderService = new VideoLoaderService()
export default videoLoaderService