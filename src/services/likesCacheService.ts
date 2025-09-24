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
  // 🚀 版本化状态管理：确保时序正确性
  version: number
  source: 'api' | 'optimistic' | 'cache' | 'sync'
}

export interface BatchLikeData {
  templateIds: string[]
  data: Map<string, CachedLikeStatus>
  cached_at: number
}

class LikesCacheService {
  private cache: Map<string, CachedLikeStatus> = new Map()
  private batchCache: Map<string, BatchLikeData> = new Map()
  // 🚀 优化：调整缓存TTL，提高用户操作数据的持久性
  private readonly DEFAULT_TTL = 60 * 60 * 1000 // 1小时缓存（用户操作数据）
  private readonly API_TTL = 30 * 60 * 1000 // 30分钟缓存（API数据）
  private readonly BATCH_TTL = 60 * 60 * 1000 // 批量数据1小时缓存
  private readonly HIGH_PRIORITY_TTL = 2 * 60 * 60 * 1000 // 高优先级2小时缓存
  private readonly LOW_PRIORITY_TTL = 15 * 60 * 1000 // 低优先级15分钟缓存
  private readonly USER_ACTION_TTL = 24 * 60 * 60 * 1000 // 用户操作24小时持久化
  private cleanupInterval: NodeJS.Timeout | null = null
  // 🚀 新增：预加载缓存管理
  private preloadQueue: Set<string> = new Set()
  private preloadInProgress: Set<string> = new Set()
  // 🚀 新增：事件监听器，用于通知组件缓存更新
  private listeners: Map<string, Set<(status: CachedLikeStatus) => void>> = new Map()
  // 🔧 防递归保护
  private notificationQueue: Set<string> = new Set()
  private isNotifying: boolean = false
  // 🚀 去抖动机制：合并短时间内的多次通知
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private pendingNotifications: Map<string, CachedLikeStatus> = new Map()
  // 🚀 版本化状态管理：确保时序正确性
  private globalVersionCounter: number = 0
  private templateVersions: Map<string, number> = new Map()

  constructor() {
    // 启动定期清理过期缓存
    this.startCleanup()
  }

  /**
   * 🚀 生成新的版本号（确保递增）
   */
  private generateVersion(): number {
    return ++this.globalVersionCounter
  }

  /**
   * 🚀 验证状态版本：只有更新的版本才能覆盖现有状态（增强数据源优先级保护）
   */
  private shouldAcceptVersion(templateId: string, newVersion: number, source: string): boolean {
    const current = this.cache.get(templateId)
    const currentVersion = this.templateVersions.get(templateId) || 0
    
    // 🚀 数据源优先级保护：用户操作数据具有最高优先级
    if (current) {
      const isCurrentUserAction = current.source === 'optimistic' || current.source === 'sync'
      const isNewApiData = source === 'api'
      const isNewSyncData = source === 'sync'
      const isCurrentOptimistic = current.source === 'optimistic'
      
      // 🚀 特殊处理：sync数据源（服务器确认）可以覆盖optimistic数据源（乐观更新）
      if (isCurrentOptimistic && isNewSyncData) {
        console.debug(`[LikesCacheService] ✅ Sync数据覆盖乐观更新: ${templateId} (${current.source} -> ${source})`)
        return true // sync数据源总是可以覆盖optimistic，不受版本和时间限制
      }
      
      // 用户操作数据在5分钟内不能被API数据覆盖
      if (isCurrentUserAction && isNewApiData) {
        const userActionAge = Date.now() - current.cached_at
        const protectionPeriod = 5 * 60 * 1000 // 5分钟保护期
        
        if (userActionAge < protectionPeriod) {
          console.debug(`[LikesCacheService] 🛡️ 保护用户操作数据: ${templateId} (${current.source}, ${Math.round(userActionAge / 1000)}s前) vs ${source}`)
          return false
        }
      }
      
      // 🚀 同类型数据源的时间优先级：较新的数据优先
      if (current.source === source) {
        const timeDiff = Date.now() - current.cached_at
        const minUpdateInterval = source === 'api' ? 30 * 1000 : 5 * 1000 // API数据30s最小更新间隔，其他5s
        
        if (timeDiff < minUpdateInterval && newVersion <= currentVersion) {
          console.debug(`[LikesCacheService] ⏱️ 跳过频繁更新: ${templateId} (${source}, ${Math.round(timeDiff / 1000)}s内)`)
          return false
        }
      }
    }
    
    // 版本验证
    const shouldAccept = newVersion >= currentVersion
    
    if (!shouldAccept) {
      console.debug(`[LikesCacheService] 拒绝旧版本状态: ${templateId} v${newVersion} < v${currentVersion} (${source})`)
    } else if (newVersion > currentVersion) {
      console.debug(`[LikesCacheService] ✅ 接受新版本状态: ${templateId} v${currentVersion} -> v${newVersion} (${source})`)
    }
    
    return shouldAccept
  }

  /**
   * 🚀 更新模板版本号
   */
  private updateVersion(templateId: string, version: number): void {
    this.templateVersions.set(templateId, version)
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
   * 🚀 版本化设置单个模板的点赞状态
   */
  set(templateId: string, status: Omit<CachedLikeStatus, 'cached_at' | 'ttl' | 'version' | 'source'>, source: 'api' | 'optimistic' | 'cache' | 'sync' = 'cache'): void {
    const version = this.generateVersion()
    
    // 版本验证：确保不会被旧版本覆盖
    if (!this.shouldAcceptVersion(templateId, version, source)) {
      return
    }

    // 🚀 根据数据源选择合适的TTL
    let ttl: number
    switch (source) {
      case 'optimistic':
      case 'sync':
        ttl = this.USER_ACTION_TTL // 用户操作数据24小时持久化
        break
      case 'api':
        ttl = this.API_TTL // API数据30分钟
        break
      default:
        ttl = this.DEFAULT_TTL // 默认1小时
    }

    const cached: CachedLikeStatus = {
      ...status,
      cached_at: Date.now(),
      ttl,
      version,
      source
    }
    
    this.cache.set(templateId, cached)
    this.updateVersion(templateId, version)
    
    // 同时更新批量缓存中的数据
    this.updateBatchCaches(templateId, cached)
    
    // 🚀 通知监听器缓存已更新
    this.notifyListeners(templateId, cached)
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
   * 🚀 版本化批量设置多个模板的点赞状态
   */
  setBatch(templateIds: string[], statuses: Omit<CachedLikeStatus, 'cached_at' | 'ttl' | 'version' | 'source'>[], source: 'api' | 'cache' | 'sync' = 'api'): void {
    const now = Date.now()
    const statusMap = new Map<string, CachedLikeStatus>()

    // 更新单个缓存（带版本验证）
    statuses.forEach(status => {
      const version = this.generateVersion()
      
      // 版本验证
      if (!this.shouldAcceptVersion(status.template_id, version, source)) {
        return
      }

      const cached: CachedLikeStatus = {
        ...status,
        cached_at: now,
        ttl: this.DEFAULT_TTL,
        version,
        source
      }
      
      this.cache.set(status.template_id, cached)
      this.updateVersion(status.template_id, version)
      statusMap.set(status.template_id, cached)
    })

    // 为缺失的模板创建默认状态
    templateIds.forEach(templateId => {
      if (!statusMap.has(templateId)) {
        const version = this.generateVersion()
        
        if (!this.shouldAcceptVersion(templateId, version, source)) {
          return
        }

        const defaultStatus: CachedLikeStatus = {
          template_id: templateId,
          is_liked: false,
          like_count: 0,
          cached_at: now,
          ttl: this.DEFAULT_TTL,
          version,
          source
        }
        
        this.cache.set(templateId, defaultStatus)
        this.updateVersion(templateId, version)
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
   * 🚀 版本化更新模板点赞状态（用于点赞/取消点赞操作后）增强版
   */
  updateLikeStatus(templateId: string, isLiked: boolean, newLikeCount: number, source: 'api' | 'optimistic' | 'sync' = 'api'): void {
    const existing = this.cache.get(templateId)
    const version = this.generateVersion()
    
    // 🚀 用户操作优先级特殊处理
    const isUserAction = source === 'optimistic' || source === 'sync'
    const isApiUpdate = source === 'api'
    const isSyncUpdate = source === 'sync'
    
    // 🚀 特殊处理：sync数据源（服务器确认）可以覆盖optimistic数据源（乐观更新）
    if (existing && existing.source === 'optimistic' && isSyncUpdate) {
      console.debug(`[LikesCacheService] ✅ Sync更新覆盖乐观更新: ${templateId} (${existing.source} -> ${source})`)
      // 继续执行，允许sync覆盖optimistic
    }
    // 如果是API更新但存在最近的用户操作，直接拒绝
    else if (isApiUpdate && existing) {
      const isExistingUserAction = existing.source === 'optimistic' || existing.source === 'sync'
      const userActionAge = Date.now() - existing.cached_at
      const protectionPeriod = 5 * 60 * 1000 // 5分钟保护期
      
      if (isExistingUserAction && userActionAge < protectionPeriod) {
        console.debug(`[LikesCacheService] 🛡️ API更新被拒绝，保护用户操作: ${templateId} (${existing.source}, ${Math.round(userActionAge / 1000)}s前)`)
        return
      }
    }
    
    // 🚀 版本验证：确保只有更新的状态才能覆盖现有状态
    if (!this.shouldAcceptVersion(templateId, version, source)) {
      console.debug(`[LikesCacheService] 跳过版本验证失败的更新: ${templateId} ${source}`)
      return
    }
    
    // 🚀 检查是否真的发生了变化，避免无效通知
    const hasChanged = !existing || 
      existing.is_liked !== isLiked || 
      existing.like_count !== newLikeCount
    
    // 🚀 根据数据源选择合适的TTL
    let ttl: number
    switch (source) {
      case 'optimistic':
      case 'sync':
        ttl = this.USER_ACTION_TTL // 用户操作数据24小时持久化
        break
      case 'api':
        ttl = this.API_TTL // API数据30分钟
        break
      default:
        ttl = this.DEFAULT_TTL // 默认1小时
    }
    
    const updated: CachedLikeStatus = {
      template_id: templateId,
      is_liked: isLiked,
      like_count: newLikeCount,
      cached_at: Date.now(),
      ttl,
      version,
      source
    }

    this.cache.set(templateId, updated)
    this.updateVersion(templateId, version)
    
    // 更新批量缓存
    this.updateBatchCaches(templateId, updated)
    
    // 🚀 只有在真正发生变化时才通知监听器
    if (hasChanged) {
      const changeType = isUserAction ? '👤 用户操作' : '📡 API更新'
      console.debug(`[LikesCacheService] v${version} ${changeType} ${templateId} (${source}):`, {
        from: existing ? { liked: existing.is_liked, count: existing.like_count, v: existing.version, source: existing.source } : null,
        to: { liked: isLiked, count: newLikeCount, v: version, source }
      })
      this.notifyListeners(templateId, updated)
    } else {
      console.debug(`[LikesCacheService] v${version} 无变化 ${templateId} (${source}), 跳过通知`)
    }
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
   * 🚀 检查缓存数据是否新鲜（未过期）
   */
  isCacheFresh(templateId: string, maxAge: number = 60 * 1000): boolean {
    const cached = this.cache.get(templateId)
    if (!cached) return false
    
    const age = Date.now() - cached.cached_at
    const isExpired = age > cached.ttl
    const isStale = age > maxAge
    
    if (isExpired) {
      console.debug(`[LikesCacheService] 缓存已过期: ${templateId} (${Math.round(age/1000)}s > ${cached.ttl/1000}s)`)
      return false
    }
    
    if (isStale) {
      console.debug(`[LikesCacheService] 缓存过旧: ${templateId} (${Math.round(age/1000)}s > ${maxAge/1000}s)`)
      return false
    }
    
    return true
  }

  /**
   * 🚀 获取缓存年龄（毫秒）
   */
  getCacheAge(templateId: string): number {
    const cached = this.cache.get(templateId)
    if (!cached) return Infinity
    return Date.now() - cached.cached_at
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
   * 🚀 添加缓存更新监听器
   */
  subscribe(templateId: string, callback: (status: CachedLikeStatus) => void): () => void {
    if (!this.listeners.has(templateId)) {
      this.listeners.set(templateId, new Set())
    }
    
    this.listeners.get(templateId)!.add(callback)
    
    // 返回取消订阅函数
    return () => {
      const listeners = this.listeners.get(templateId)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.listeners.delete(templateId)
        }
      }
    }
  }

  /**
   * 🚀 通知监听器缓存已更新（防递归+去抖动版本）
   */
  private notifyListeners(templateId: string, status: CachedLikeStatus): void {
    // 防递归：如果已在通知队列中，跳过
    if (this.notificationQueue.has(templateId)) {
      console.debug(`[LikesCacheService] 跳过重复通知: ${templateId}`)
      return
    }

    // 🚀 去抖动：清除之前的定时器，合并短时间内的多次通知
    const existingTimer = this.debounceTimers.get(templateId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 保存最新的状态
    this.pendingNotifications.set(templateId, status)

    // 设置新的去抖动定时器
    const timer = setTimeout(() => {
      const latestStatus = this.pendingNotifications.get(templateId)
      if (!latestStatus) return

      // 加入通知队列
      this.notificationQueue.add(templateId)

      try {
        const listeners = this.listeners.get(templateId)
        if (listeners) {
          console.debug(`[LikesCacheService] 发送去抖动后的通知: ${templateId}`, latestStatus)
          listeners.forEach(callback => {
            try {
              callback(latestStatus)
            } catch (error) {
              console.error('[LikesCacheService] Listener callback error:', error)
            }
          })
        }
      } finally {
        // 清理状态
        this.notificationQueue.delete(templateId)
        this.debounceTimers.delete(templateId)
        this.pendingNotifications.delete(templateId)
      }
    }, 50) // 50ms去抖动延迟，合并快速连续的更新

    this.debounceTimers.set(templateId, timer)
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    // 🚀 清理去抖动定时器
    this.debounceTimers.forEach(timer => clearTimeout(timer))
    this.debounceTimers.clear()
    this.pendingNotifications.clear()
    
    this.clear()
    this.listeners.clear()
    // 清理防递归状态
    this.notificationQueue.clear()
    this.isNotifying = false
  }
}

// 导出单例实例
export const likesCacheService = new LikesCacheService()
export default likesCacheService