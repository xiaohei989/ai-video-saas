/**
 * Likes Cache Service
 * 点赞信息缓存管理服务
 */

export interface CachedLikeStatus {
  template_id: string
  is_liked: boolean
  like_count: number
  cached_at: number
  ttl: number
}

export interface BatchLikeData {
  templateIds: string[]
  data: Map<string, CachedLikeStatus>
  cached_at: number
}

class LikesCacheService {
  private cache: Map<string, CachedLikeStatus> = new Map()
  private batchCache: Map<string, BatchLikeData> = new Map()
  // 🚀 优化：延长缓存TTL，提高缓存命中率
  private readonly DEFAULT_TTL = 30 * 60 * 1000 // 30分钟缓存（从5分钟延长）
  private readonly BATCH_TTL = 60 * 60 * 1000 // 批量数据1小时缓存（从3分钟延长）
  private readonly HIGH_PRIORITY_TTL = 2 * 60 * 60 * 1000 // 高优先级2小时缓存
  private readonly LOW_PRIORITY_TTL = 15 * 60 * 1000 // 低优先级15分钟缓存
  private cleanupInterval: NodeJS.Timeout | null = null
  // 🚀 新增：预加载缓存管理
  private preloadQueue: Set<string> = new Set()
  private preloadInProgress: Set<string> = new Set()

  constructor() {
    // 启动定期清理过期缓存
    this.startCleanup()
  }

  /**
   * 获取单个模板的点赞状态
   */
  get(templateId: string): CachedLikeStatus | null {
    const cached = this.cache.get(templateId)
    if (!cached) return null

    // 检查是否过期
    if (Date.now() > cached.cached_at + cached.ttl) {
      this.cache.delete(templateId)
      return null
    }

    return cached
  }

  /**
   * 设置单个模板的点赞状态
   */
  set(templateId: string, status: Omit<CachedLikeStatus, 'cached_at' | 'ttl'>): void {
    const cached: CachedLikeStatus = {
      ...status,
      cached_at: Date.now(),
      ttl: this.DEFAULT_TTL
    }
    
    this.cache.set(templateId, cached)
    
    // 同时更新批量缓存中的数据
    this.updateBatchCaches(templateId, cached)
  }

  /**
   * 批量获取多个模板的点赞状态
   */
  getBatch(templateIds: string[]): Map<string, CachedLikeStatus> | null {
    const sortedIds = [...templateIds].sort()
    const batchKey = sortedIds.join(',')
    
    const batchData = this.batchCache.get(batchKey)
    if (!batchData) return null

    // 检查是否过期
    if (Date.now() > batchData.cached_at + this.BATCH_TTL) {
      this.batchCache.delete(batchKey)
      return null
    }

    return batchData.data
  }

  /**
   * 批量设置多个模板的点赞状态
   */
  setBatch(templateIds: string[], statuses: CachedLikeStatus[]): void {
    const now = Date.now()
    const statusMap = new Map<string, CachedLikeStatus>()

    // 更新单个缓存
    statuses.forEach(status => {
      const cached: CachedLikeStatus = {
        ...status,
        cached_at: now,
        ttl: this.DEFAULT_TTL
      }
      
      this.cache.set(status.template_id, cached)
      statusMap.set(status.template_id, cached)
    })

    // 为缺失的模板创建默认状态
    templateIds.forEach(templateId => {
      if (!statusMap.has(templateId)) {
        const defaultStatus: CachedLikeStatus = {
          template_id: templateId,
          is_liked: false,
          like_count: 0,
          cached_at: now,
          ttl: this.DEFAULT_TTL
        }
        
        this.cache.set(templateId, defaultStatus)
        statusMap.set(templateId, defaultStatus)
      }
    })

    // 存储批量缓存
    const sortedIds = [...templateIds].sort()
    const batchKey = sortedIds.join(',')
    
    this.batchCache.set(batchKey, {
      templateIds: sortedIds,
      data: statusMap,
      cached_at: now
    })
  }

  /**
   * 更新模板点赞状态（用于点赞/取消点赞操作后）
   */
  updateLikeStatus(templateId: string, isLiked: boolean, newLikeCount: number): void {
    // const existing = this.cache.get(templateId) // unused
    
    const updated: CachedLikeStatus = {
      template_id: templateId,
      is_liked: isLiked,
      like_count: newLikeCount,
      cached_at: Date.now(),
      ttl: this.DEFAULT_TTL
    }

    this.cache.set(templateId, updated)
    
    // 更新批量缓存
    this.updateBatchCaches(templateId, updated)
  }

  /**
   * 增加点赞数（乐观更新）
   */
  incrementLikeCount(templateId: string): void {
    const cached = this.get(templateId)
    if (cached && !cached.is_liked) {
      this.updateLikeStatus(templateId, true, cached.like_count + 1)
    }
  }

  /**
   * 减少点赞数（乐观更新）
   */
  decrementLikeCount(templateId: string): void {
    const cached = this.get(templateId)
    if (cached && cached.is_liked) {
      this.updateLikeStatus(templateId, false, Math.max(0, cached.like_count - 1))
    }
  }

  /**
   * 检查缓存中是否有指定模板的数据
   */
  has(templateId: string): boolean {
    return this.get(templateId) !== null
  }

  /**
   * 检查是否有批量缓存
   */
  hasBatch(templateIds: string[]): boolean {
    return this.getBatch(templateIds) !== null
  }

  /**
   * 删除单个模板的缓存
   */
  delete(templateId: string): void {
    this.cache.delete(templateId)
    
    // 清理相关的批量缓存
    this.cleanupBatchCaches(templateId)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.batchCache.clear()
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    cacheSize: number
    batchCacheSize: number
    hitRate: number
  } {
    return {
      cacheSize: this.cache.size,
      batchCacheSize: this.batchCache.size,
      hitRate: 0 // 可以后续添加命中率统计
    }
  }

  /**
   * 预热缓存 - 批量加载初始数据
   */
  warmup(templateIds: string[], statuses: CachedLikeStatus[]): void {
    this.setBatch(templateIds, statuses)
  }

  /**
   * 检查缓存是否需要刷新
   */
  needsRefresh(templateIds: string[], maxAge: number = this.BATCH_TTL): boolean {
    const batchData = this.getBatch(templateIds)
    if (!batchData) return true

    const sortedIds = [...templateIds].sort()
    const batchKey = sortedIds.join(',')
    const cached = this.batchCache.get(batchKey)
    
    if (!cached) return true
    
    return Date.now() > cached.cached_at + maxAge
  }

  /**
   * 更新批量缓存中的单个数据
   */
  private updateBatchCaches(templateId: string, status: CachedLikeStatus): void {
    this.batchCache.forEach((batchData) => {
      if (batchData.data.has(templateId)) {
        batchData.data.set(templateId, status)
      }
    })
  }

  /**
   * 清理包含指定模板的批量缓存
   */
  private cleanupBatchCaches(templateId: string): void {
    const keysToDelete: string[] = []
    
    this.batchCache.forEach((batchData, key) => {
      if (batchData.templateIds.includes(templateId)) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => {
      this.batchCache.delete(key)
    })
  }

  /**
   * 启动定期清理任务
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000) // 每分钟清理一次
  }

  /**
   * 🚀 智能预加载：根据优先级预加载模板点赞数据
   */
  schedulePreload(templateIds: string[], priority: 'high' | 'normal' | 'low' = 'normal'): void {
    templateIds.forEach(id => {
      if (!this.has(id) && !this.preloadInProgress.has(id)) {
        this.preloadQueue.add(id)
      }
    })
    
    // 高优先级立即处理，其他延迟处理
    if (priority === 'high') {
      this.processPreloadQueue()
    } else {
      setTimeout(() => this.processPreloadQueue(), priority === 'normal' ? 1000 : 3000)
    }
  }

  /**
   * 🚀 处理预加载队列（背景预加载，不阻塞主流程）
   */
  private processPreloadQueue(): void {
    if (this.preloadQueue.size === 0) return
    
    // 分批处理预加载队列，避免过多并发请求
    const batchSize = 5
    const currentBatch = Array.from(this.preloadQueue).slice(0, batchSize)
    
    currentBatch.forEach(templateId => {
      this.preloadQueue.delete(templateId)
      this.preloadInProgress.add(templateId)
    })
    
    // 使用requestIdleCallback进行后台预加载
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        this.executePreload(currentBatch)
      })
    } else {
      // 回退：使用setTimeout
      setTimeout(() => {
        this.executePreload(currentBatch)
      }, 100)
    }
  }

  /**
   * 🚀 执行实际的预加载操作
   */
  private async executePreload(templateIds: string[]): Promise<void> {
    try {
      // 这里需要调用templateLikeService来获取数据
      // 为了避免循环引用，我们通过事件或回调的方式通知外部服务
      const event = new CustomEvent('cache-preload-request', {
        detail: { templateIds }
      })
      window.dispatchEvent(event)
      
      console.log(`[LikesCacheService] 🔄 后台预加载: ${templateIds.length}个模板`)
    } catch (error) {
      console.warn('[LikesCacheService] 预加载失败:', error)
    } finally {
      // 清理预加载状态
      templateIds.forEach(id => {
        this.preloadInProgress.delete(id)
      })
      
      // 继续处理剩余队列
      if (this.preloadQueue.size > 0) {
        setTimeout(() => this.processPreloadQueue(), 500)
      }
    }
  }

  /**
   * 🚀 根据优先级获取TTL
   */
  getTTLByPriority(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return this.HIGH_PRIORITY_TTL
      case 'low': return this.LOW_PRIORITY_TTL
      default: return this.DEFAULT_TTL
    }
  }

  /**
   * 🚀 智能缓存策略：根据访问模式调整缓存
   */
  markAsAccessed(templateId: string): void {
    const cached = this.cache.get(templateId)
    if (cached) {
      // 频繁访问的数据延长缓存时间
      const now = Date.now()
      const timeSinceCache = now - cached.cached_at
      const remainingTime = cached.ttl - timeSinceCache
      
      if (remainingTime < cached.ttl * 0.5) {
        // 如果缓存时间已过半，延长TTL
        cached.ttl = Math.min(cached.ttl * 1.5, this.HIGH_PRIORITY_TTL)
        console.log(`[LikesCacheService] 📈 延长热门模板缓存: ${templateId}`)
      }
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()
    
    // 清理单个缓存
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.cached_at + cached.ttl) {
        this.cache.delete(key)
      }
    }

    // 清理批量缓存
    for (const [key, batchData] of this.batchCache.entries()) {
      if (now > batchData.cached_at + this.BATCH_TTL) {
        this.batchCache.delete(key)
      }
    }

  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// 导出单例实例
export const likesCacheService = new LikesCacheService()
export default likesCacheService