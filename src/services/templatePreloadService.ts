/**
 * 模板预加载服务 - 提升模板页面体验
 * 智能预加载模板视频和缩略图，减少用户等待时间
 */

import { templatesApiService, TemplateListParams } from './templatesApiService'
import { userBehaviorTracker } from './userBehaviorTracker'

interface TemplatePreloadOptions {
  priority?: 'high' | 'medium' | 'low'
  timeout?: number
  maxConcurrent?: number
  preloadVideos?: boolean
  preloadThumbnails?: boolean
}

interface PreloadTask {
  id: string
  type: 'video' | 'thumbnail' | 'templates'
  templateId?: string
  url: string
  priority: 'high' | 'medium' | 'low'
  createdAt: number
  promise?: Promise<void>
  element?: HTMLVideoElement | HTMLImageElement
}

interface UserBehaviorPattern {
  hoveredTemplates: Set<string>
  viewedCategories: Set<string>
  averageHoverTime: number
  scrollSpeed: number
  deviceType: 'mobile' | 'desktop'
  lastInteractionTime: number
}

class TemplatePreloadService {
  private preloadQueue: PreloadTask[] = []
  private isProcessing = false
  private completedUrls = new Set<string>()
  private preloadCache = new Map<string, HTMLVideoElement | HTMLImageElement>()
  private userBehavior: UserBehaviorPattern
  
  // 设备和网络检测
  private deviceCapabilities = {
    isLowEnd: false,
    connectionType: 'fast' as 'fast' | 'medium' | 'slow',
    maxConcurrentPreloads: 3
  }

  constructor() {
    this.userBehavior = {
      hoveredTemplates: new Set(),
      viewedCategories: new Set(),
      averageHoverTime: 0,
      scrollSpeed: 0,
      deviceType: window.innerWidth <= 768 ? 'mobile' : 'desktop',
      lastInteractionTime: Date.now()
    }
    
    this.detectDeviceCapabilities()
    this.setupBehaviorTracking()
    this.setupPageVisibilityHandlers()
  }

  /**
   * 🔍 检测设备性能和网络条件
   */
  private detectDeviceCapabilities(): void {
    try {
      // CPU核心数检测
      const cores = navigator.hardwareConcurrency || 4
      
      // 网络状况检测
      const connection = (navigator as any).connection
      const effectiveType = connection?.effectiveType || '4g'
      
      // 设备内存检测
      const memory = (performance as any).memory
      const memoryGB = memory ? Math.round(memory.totalJSHeapSize / 1024 / 1024 / 1024) : 4

      this.deviceCapabilities = {
        isLowEnd: cores <= 2 || effectiveType === '2g' || effectiveType === 'slow-2g' || memoryGB < 2,
        connectionType: effectiveType === '4g' ? 'fast' : effectiveType === '3g' ? 'medium' : 'slow',
        maxConcurrentPreloads: this.deviceCapabilities.isLowEnd ? 2 : effectiveType === '4g' ? 4 : 3
      }

      console.log('[TemplatePreload] 📱 设备性能检测:', this.deviceCapabilities)
    } catch (error) {
      console.warn('[TemplatePreload] 设备检测失败，使用默认配置:', error)
    }
  }

  /**
   * 📊 设置用户行为追踪
   */
  private setupBehaviorTracking(): void {
    // 检测设备类型变化（窗口大小改变）
    window.addEventListener('resize', () => {
      this.userBehavior.deviceType = window.innerWidth <= 768 ? 'mobile' : 'desktop'
    })

    // 滚动速度检测
    let lastScrollTime = Date.now()
    let lastScrollY = window.scrollY
    
    window.addEventListener('scroll', () => {
      const now = Date.now()
      const scrollDiff = Math.abs(window.scrollY - lastScrollY)
      const timeDiff = now - lastScrollTime
      
      if (timeDiff > 0) {
        this.userBehavior.scrollSpeed = scrollDiff / timeDiff
        this.userBehavior.lastInteractionTime = now
      }
      
      lastScrollTime = now
      lastScrollY = window.scrollY
    }, { passive: true })
  }

  /**
   * 📱 设置页面可见性处理
   */
  private setupPageVisibilityHandlers(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[TemplatePreload] 页面不可见，暂停预加载')
        this.pausePreload()
      } else {
        console.log('[TemplatePreload] 页面可见，恢复预加载')
        this.resumePreload()
      }
    })
  }

  /**
   * 🎯 模板鼠标悬停预加载
   */
  preloadOnHover(templateId: string, previewUrl?: string, thumbnailUrl?: string): void {
    // 记录用户行为
    this.userBehavior.hoveredTemplates.add(templateId)
    this.userBehavior.lastInteractionTime = Date.now()

    const options: TemplatePreloadOptions = {
      priority: 'high', // 悬停时高优先级
      preloadVideos: true,
      preloadThumbnails: true,
      maxConcurrent: this.userBehavior.deviceType === 'mobile' ? 1 : 2
    }

    // 预加载视频
    if (previewUrl && !this.completedUrls.has(previewUrl)) {
      this.addPreloadTask({
        id: `video_${templateId}_${Date.now()}`,
        type: 'video',
        templateId,
        url: previewUrl,
        priority: options.priority!,
        createdAt: Date.now()
      })
    }

    // 预加载缩略图（低优先级，因为通常已经加载）
    if (thumbnailUrl && !this.completedUrls.has(thumbnailUrl)) {
      this.addPreloadTask({
        id: `thumbnail_${templateId}_${Date.now()}`,
        type: 'thumbnail', 
        templateId,
        url: thumbnailUrl,
        priority: 'low',
        createdAt: Date.now()
      })
    }

    this.processQueue()
  }

  /**
   * 🔮 智能预测预加载 - 基于用户行为模式
   */
  predictivePreload(visibleTemplates: Array<{id: string, previewUrl?: string, thumbnailUrl?: string, category?: string, tags?: string[], name?: string}>): void {
    if (this.deviceCapabilities.isLowEnd) {
      console.log('[TemplatePreload] 低端设备跳过预测预加载')
      return
    }

    const now = Date.now()
    const timeSinceLastInteraction = now - this.userBehavior.lastInteractionTime

    // 如果用户最近没有交互，降低预加载优先级
    if (timeSinceLastInteraction > 30000) { // 30秒
      console.log('[TemplatePreload] 用户非活跃状态，跳过预测预加载')
      return
    }

    // 🧠 使用用户行为分析预测兴趣度
    const interestPredictions = userBehaviorTracker.predictTemplateInterest(visibleTemplates)
    
    console.log('[TemplatePreload] 🔮 基于行为分析的预测结果:', 
      interestPredictions.slice(0, 3).map(p => ({ id: p.templateId, score: p.score, reasons: p.reasons }))
    )

    // 根据兴趣度分数决定预加载优先级和数量
    interestPredictions.forEach((prediction, index) => {
      const template = visibleTemplates.find(t => t.id === prediction.templateId)
      if (!template || !template.previewUrl || this.completedUrls.has(template.previewUrl)) {
        return
      }

      // 记录查看的分类
      if (template.category) {
        this.userBehavior.viewedCategories.add(template.category)
      }

      // 根据兴趣度分数确定优先级
      let priority: 'high' | 'medium' | 'low' = 'low'
      if (prediction.score >= 80) {
        priority = 'high'
      } else if (prediction.score >= 60) {
        priority = 'medium'
      }

      // 只预加载前几个高分模板，避免过度预加载
      const maxPreloadCount = this.userBehavior.deviceType === 'mobile' ? 3 : 6
      if (index < maxPreloadCount || prediction.score >= 70) {
        this.addPreloadTask({
          id: `predictive_${template.id}_${Date.now()}`,
          type: 'video',
          templateId: template.id,
          url: template.previewUrl,
          priority,
          createdAt: Date.now()
        })

        console.log(`[TemplatePreload] 🎯 预测预加载: ${template.id} (分数: ${prediction.score}, 优先级: ${priority})`)
      }
    })

    // 避免过度预加载
    requestIdleCallback(() => {
      this.processQueue()
    })
  }

  /**
   * 🧠 判断是否应该进行预测性预加载
   */
  private shouldPredictivePreload(template: {id: string, category?: string}): boolean {
    // 如果用户已经悬停过相同分类的模板，更可能感兴趣
    if (template.category && this.userBehavior.viewedCategories.has(template.category)) {
      return true
    }

    // 如果用户滚动速度较慢，说明在仔细查看
    if (this.userBehavior.scrollSpeed < 0.5) {
      return true
    }

    // 桌面端更积极的预加载
    if (this.userBehavior.deviceType === 'desktop') {
      return true
    }

    return false
  }

  /**
   * 📱 移动端优化的视口预加载
   */
  preloadInViewport(visibleTemplates: Array<{id: string, previewUrl?: string}>): void {
    if (this.userBehavior.deviceType !== 'mobile') return

    // 移动端只预加载前几个可见的模板
    const limit = this.deviceCapabilities.isLowEnd ? 1 : 2
    
    visibleTemplates.slice(0, limit).forEach(template => {
      if (template.previewUrl && !this.completedUrls.has(template.previewUrl)) {
        this.addPreloadTask({
          id: `viewport_${template.id}_${Date.now()}`,
          type: 'video',
          templateId: template.id,
          url: template.previewUrl,
          priority: 'medium',
          createdAt: Date.now()
        })
      }
    })

    this.processQueue()
  }

  /**
   * ➕ 添加预加载任务到队列
   */
  private addPreloadTask(task: PreloadTask): void {
    // 检查是否已经在队列中
    const existingTask = this.preloadQueue.find(t => t.url === task.url)
    if (existingTask) {
      // 如果新任务优先级更高，更新优先级
      if (this.getPriorityValue(task.priority) > this.getPriorityValue(existingTask.priority)) {
        existingTask.priority = task.priority
        this.sortQueueByPriority()
      }
      return
    }

    this.preloadQueue.push(task)
    this.sortQueueByPriority()
    
    console.log(`[TemplatePreload] 📥 添加预加载任务: ${task.type} (${task.priority}) - ${task.url.substring(0, 50)}...`)
  }

  /**
   * ⚡ 处理预加载队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.preloadQueue.length === 0) return
    if (document.hidden) {
      console.log('[TemplatePreload] 页面不可见，暂停队列处理')
      return
    }

    this.isProcessing = true
    const maxConcurrent = this.deviceCapabilities.maxConcurrentPreloads
    const activeTasks: Promise<void>[] = []

    while (this.preloadQueue.length > 0 && activeTasks.length < maxConcurrent) {
      const task = this.preloadQueue.shift()
      if (!task) continue

      // 检查是否已经完成
      if (this.completedUrls.has(task.url)) {
        continue
      }

      const taskPromise = this.executePreloadTask(task)
      activeTasks.push(taskPromise)

      // 任务完成后从活跃列表中移除
      taskPromise.finally(() => {
        const index = activeTasks.indexOf(taskPromise)
        if (index > -1) {
          activeTasks.splice(index, 1)
        }
      })
    }

    // 等待当前批次任务完成
    await Promise.allSettled(activeTasks)

    this.isProcessing = false

    // 如果队列还有任务，继续处理
    if (this.preloadQueue.length > 0) {
      requestIdleCallback(() => {
        this.processQueue()
      })
    }
  }

  /**
   * 🎬 执行具体的预加载任务
   */
  private async executePreloadTask(task: PreloadTask): Promise<void> {
    try {
      console.log(`[TemplatePreload] 🚀 执行预加载: ${task.type} - ${task.url.substring(0, 50)}...`)

      if (task.type === 'video') {
        await this.preloadVideo(task.url, task.templateId!)
      } else if (task.type === 'thumbnail') {
        await this.preloadImage(task.url)
      }

      this.completedUrls.add(task.url)
      console.log(`[TemplatePreload] ✅ 预加载完成: ${task.type} - ${task.templateId}`)

    } catch (error) {
      console.warn(`[TemplatePreload] ❌ 预加载失败: ${task.type} - ${task.url}`, error)
    }
  }

  /**
   * 🎥 预加载视频
   */
  private async preloadVideo(url: string, templateId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata' // 只加载元数据，不加载完整视频
      video.muted = true
      video.crossOrigin = 'anonymous'
      
      const timeout = setTimeout(() => {
        video.src = ''
        reject(new Error('预加载超时'))
      }, 10000) // 10秒超时

      video.addEventListener('loadedmetadata', () => {
        clearTimeout(timeout)
        
        // 缓存预加载的视频元素
        this.preloadCache.set(`video_${templateId}`, video)
        
        console.log(`[TemplatePreload] 📹 视频元数据加载完成: ${templateId}`)
        resolve()
      }, { once: true })

      video.addEventListener('error', () => {
        clearTimeout(timeout)
        video.src = ''
        reject(new Error('视频加载失败'))
      }, { once: true })

      video.src = url
    })
  }

  /**
   * 🖼️ 预加载图片
   */
  private async preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      const timeout = setTimeout(() => {
        img.src = ''
        reject(new Error('图片预加载超时'))
      }, 5000) // 5秒超时

      img.onload = () => {
        clearTimeout(timeout)
        resolve()
      }

      img.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('图片加载失败'))
      }

      img.src = url
    })
  }

  /**
   * 📊 按优先级排序队列
   */
  private sortQueueByPriority(): void {
    this.preloadQueue.sort((a, b) => {
      return this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority)
    })
  }

  /**
   * 🔢 获取优先级数值
   */
  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    const values = { high: 3, medium: 2, low: 1 }
    return values[priority]
  }

  /**
   * ⏸️ 暂停预加载
   */
  private pausePreload(): void {
    // 清空队列中的低优先级任务
    this.preloadQueue = this.preloadQueue.filter(task => task.priority === 'high')
    console.log('[TemplatePreload] ⏸️ 已暂停预加载，保留高优先级任务')
  }

  /**
   * ▶️ 恢复预加载
   */
  private resumePreload(): void {
    if (!this.isProcessing && this.preloadQueue.length > 0) {
      console.log('[TemplatePreload] ▶️ 恢复预加载处理')
      this.processQueue()
    }
  }

  /**
   * 🔍 检查预加载缓存
   */
  isPreloaded(templateId: string, type: 'video' | 'thumbnail'): boolean {
    const key = `${type}_${templateId}`
    return this.preloadCache.has(key) || this.completedUrls.has(templateId)
  }

  /**
   * 📈 获取预加载统计
   */
  getPreloadStats(): {
    queueSize: number
    completedCount: number
    cacheSize: number
    userBehavior: UserBehaviorPattern
    deviceCapabilities: typeof this.deviceCapabilities
  } {
    return {
      queueSize: this.preloadQueue.length,
      completedCount: this.completedUrls.size,
      cacheSize: this.preloadCache.size,
      userBehavior: {
        ...this.userBehavior,
        hoveredTemplates: new Set(this.userBehavior.hoveredTemplates), // 创建副本
        viewedCategories: new Set(this.userBehavior.viewedCategories)
      },
      deviceCapabilities: this.deviceCapabilities
    }
  }

  /**
   * 🗑️ 清理预加载缓存
   */
  clearPreloadCache(): void {
    // 清理video元素
    this.preloadCache.forEach(element => {
      if (element instanceof HTMLVideoElement) {
        element.src = ''
        element.load()
      }
    })
    
    this.preloadCache.clear()
    this.completedUrls.clear()
    this.preloadQueue = []
    
    console.log('[TemplatePreload] 🗑️ 预加载缓存已清理')
  }
}

// 导出单例实例
export const templatePreloadService = new TemplatePreloadService()