/**
 * 简化版模板预加载服务
 * 只预加载最先展示给用户的内容，避免复杂逻辑
 */

interface SimplePreloadTask {
  templateId: string
  videoUrl: string
  thumbnailUrl?: string
  priority: number // 0-最高优先级
}

class SimpleTemplatePreloadService {
  private preloadedVideos = new Set<string>()
  private preloadedThumbnails = new Set<string>()
  private cachedVideos = new Set<string>() // 跟踪已完整缓存的视频
  private isProcessing = false
  private activePreloads = 0 // 当前活跃的预加载任务数
  private readonly MAX_CONCURRENT = 2 // 最大并发预加载数量
  private activeVideoElements = new Set<HTMLVideoElement>() // 跟踪活跃的视频元素

  constructor() {
    // 🛑 页面刷新时立即清理所有预加载任务
    window.addEventListener('beforeunload', () => {
      this.clearAllPreloads()
    })
    
    // 🛑 页面可见性变化时的处理
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearAllPreloads()
      }
    })
  }

  /**
   * 🚀 预加载首屏可见的模板内容
   */
  preloadFirstScreen(templates: Array<{
    id: string
    previewUrl?: string
    thumbnailUrl?: string
  }>): void {
    console.log('[SimplePreload] 开始预加载首屏模板:', templates.length)
    
    // 🔧 紧急修复：只预加载前3个模板，避免页面卡住
    const firstScreenTemplates = templates.slice(0, 3)
    
    firstScreenTemplates.forEach((template, index) => {
      // 🚦 并发控制：检查当前活跃任务数
      if (this.activePreloads >= this.MAX_CONCURRENT) {
        console.log(`[SimplePreload] 跳过预加载，已达到最大并发数: ${this.MAX_CONCURRENT}`)
        return
      }

      // 优先预加载缩略图（更轻量）
      if (template.thumbnailUrl) {
        this.preloadThumbnail(template.id, template.thumbnailUrl)
      }
      
      // 然后预加载视频（如果还有余量）
      if (template.previewUrl && this.activePreloads < this.MAX_CONCURRENT) {
        this.preloadVideo(template.id, template.previewUrl, index)
      }
    })
  }

  /**
   * 🎯 鼠标悬停时预加载
   * @returns 返回应该使用的视频URL（可能是缓存URL）
   */
  async preloadOnHover(templateId: string, videoUrl: string): Promise<string> {
    // 检查元数据预加载
    if (!this.preloadedVideos.has(videoUrl)) {
      console.log('[SimplePreload] 🎯 悬停预加载:', templateId)
      this.preloadVideo(templateId, videoUrl, 0) // 高优先级
    }

    // 检查真实的视频缓存状态
    const { smartPreloadService } = await import('./SmartVideoPreloadService')
    const isActuallyCached = await smartPreloadService.isVideoCached(templateId)

    if (!isActuallyCached) {
      console.log('[SimplePreload] 🚀 开始完整视频缓存:', templateId)
      this.cachedVideos.add(videoUrl) // 标记为正在缓存，防止重复
      this.cacheVideoOnHover(templateId, videoUrl)
      return videoUrl // 返回原始URL
    } else {
      console.log('[SimplePreload] ⚡ 视频已缓存，获取本地URL:', templateId)
      this.cachedVideos.add(videoUrl) // 同步内存状态

      // 获取本地缓存URL
      const localUrl = await smartPreloadService.getLocalVideoUrl(templateId)
      if (localUrl) {
        console.log('[SimplePreload] 🚀 返回缓存URL，无需网络下载!')
        return localUrl // 返回缓存URL
      }
      return videoUrl // 降级到原始URL
    }
  }

  /**
   * 🎯 悬停时缓存完整视频
   */
  private async cacheVideoOnHover(templateId: string, videoUrl: string): Promise<void> {
    try {
      // 导入 smartPreloadService
      const { smartPreloadService } = await import('./SmartVideoPreloadService')

      console.log('[SimplePreload] 🎯 开始缓存完整视频:', templateId)

      // 调用完整视频缓存
      const success = await smartPreloadService.cacheVideoManually(templateId, videoUrl)

      if (success) {
        console.log('[SimplePreload] ✅ 悬停视频缓存成功:', templateId)
      } else {
        console.log('[SimplePreload] ⚠️ 悬停视频缓存失败:', templateId)
      }
    } catch (error) {
      console.error('[SimplePreload] ❌ 悬停视频缓存错误:', error)
    }
  }

  /**
   * 🎥 预加载视频（只加载元数据）
   */
  private preloadVideo(templateId: string, videoUrl: string, priority: number): void {
    if (this.preloadedVideos.has(videoUrl)) return

    // 🚦 并发控制：检查是否可以开始新的预加载
    if (this.activePreloads >= this.MAX_CONCURRENT) {
      console.log(`[SimplePreload] 视频预加载跳过，已达到最大并发数: ${templateId}`)
      return
    }

    this.preloadedVideos.add(videoUrl)
    this.activePreloads++ // 增加活跃任务计数
    
    const video = document.createElement('video')
    video.preload = 'metadata' // 只加载元数据，不加载完整视频
    video.muted = true
    video.crossOrigin = 'anonymous'
    
    // 🔍 跟踪活跃的视频元素
    this.activeVideoElements.add(video)
    
    // 🔧 减少超时时间到2秒，快速失败
    const timeout = setTimeout(() => {
      this.activePreloads-- // 减少活跃任务计数
      video.src = ''
      this.preloadedVideos.delete(videoUrl)
      console.warn(`[SimplePreload] ⏰ 视频预加载超时: ${templateId}`)
    }, 2000)

    video.addEventListener('loadedmetadata', () => {
      this.activePreloads-- // 减少活跃任务计数
      this.activeVideoElements.delete(video) // 移除跟踪
      clearTimeout(timeout)
      console.log(`[SimplePreload] ✅ 视频元数据预加载完成: ${templateId}`)
    }, { once: true })

    video.addEventListener('error', () => {
      this.activePreloads-- // 减少活跃任务计数
      this.activeVideoElements.delete(video) // 移除跟踪
      clearTimeout(timeout)
      video.src = ''
      this.preloadedVideos.delete(videoUrl)
      console.warn(`[SimplePreload] ❌ 视频预加载失败: ${templateId}`)
    }, { once: true })

    video.src = videoUrl
  }

  /**
   * 🖼️ 预加载缩略图
   */
  private preloadThumbnail(templateId: string, thumbnailUrl: string): void {
    if (this.preloadedThumbnails.has(thumbnailUrl)) return

    this.preloadedThumbnails.add(thumbnailUrl)
    
    const img = new Image()
    img.onload = () => {
      console.log(`[SimplePreload] ✅ 缩略图预加载完成: ${templateId}`)
    }
    img.onerror = () => {
      this.preloadedThumbnails.delete(thumbnailUrl)
      console.warn(`[SimplePreload] ❌ 缩略图预加载失败: ${templateId}`)
    }
    img.src = thumbnailUrl
  }

  /**
   * 📊 获取预加载状态
   */
  getPreloadStatus(): {
    preloadedVideos: number
    preloadedThumbnails: number
  } {
    return {
      preloadedVideos: this.preloadedVideos.size,
      preloadedThumbnails: this.preloadedThumbnails.size
    }
  }

  /**
   * 🛑 立即清理所有预加载任务
   */
  private clearAllPreloads(): void {
    console.log('[SimplePreload] 🛑 清理所有预加载任务')
    
    // 停止所有活跃的视频元素
    this.activeVideoElements.forEach(video => {
      video.src = ''
      video.load() // 强制停止加载
    })
    
    // 清理状态
    this.activeVideoElements.clear()
    this.activePreloads = 0
    this.isProcessing = false
    
    console.log('[SimplePreload] ✅ 所有预加载任务已停止')
  }

  /**
   * 🗑️ 清理预加载缓存
   */
  clearCache(): void {
    this.clearAllPreloads() // 先停止所有任务
    this.preloadedVideos.clear()
    this.preloadedThumbnails.clear()
    this.cachedVideos.clear() // 清理完整缓存跟踪
    console.log('[SimplePreload] 🗑️ 预加载缓存已清理')
  }
}

// 导出单例
export const simpleTemplatePreload = new SimpleTemplatePreloadService()