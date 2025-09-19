/**
 * 缓存命中追踪服务 - 统一管理各类缓存的命中统计
 * 用于准确追踪图片、视频、模板、API等各种缓存的使用情况
 */

export interface CacheHitStats {
  hits: number
  misses: number
  total: number
  hitRate: number // 百分比
  lastHitTime?: number
  lastMissTime?: number
}

export interface DetailedCacheStats {
  // 分类统计
  image: CacheHitStats
  video: CacheHitStats
  template: CacheHitStats
  api: CacheHitStats
  
  // 总体统计
  overall: CacheHitStats
  
  // 详细分析
  recentHits: Array<{
    type: 'image' | 'video' | 'template' | 'api'
    result: 'hit' | 'miss'
    timestamp: number
    resource?: string
    cacheType?: string // localStorage, proxy, memory等
  }>
  
  // 性能指标
  averageHitTime: number
  averageMissTime: number
  
  // 统计开始时间
  startTime: number
  
  // 实时效率趋势（最近10分钟）
  recentTrend: {
    timestamp: number
    hitRate: number
  }[]
}

class CacheHitTracker {
  private stats: DetailedCacheStats = {
    image: { hits: 0, misses: 0, total: 0, hitRate: 0 },
    video: { hits: 0, misses: 0, total: 0, hitRate: 0 },
    template: { hits: 0, misses: 0, total: 0, hitRate: 0 },
    api: { hits: 0, misses: 0, total: 0, hitRate: 0 },
    overall: { hits: 0, misses: 0, total: 0, hitRate: 0 },
    recentHits: [],
    averageHitTime: 0,
    averageMissTime: 0,
    startTime: Date.now(),
    recentTrend: []
  }
  
  private readonly MAX_RECENT_HITS = 100 // 保留最近100次记录
  private readonly TREND_INTERVAL = 10 * 60 * 1000 // 10分钟趋势
  private readonly MAX_TREND_POINTS = 50 // 最多50个趋势点
  
  /**
   * 记录图片缓存命中
   */
  recordImageHit(resource?: string, cacheType?: string): void {
    this.recordHit('image', resource, cacheType)
  }
  
  /**
   * 记录图片缓存未命中
   */
  recordImageMiss(resource?: string): void {
    this.recordMiss('image', resource)
    console.log(`[CacheHitTracker] 🖼️ 图片缓存未命中: ${resource?.substring(0, 60)}...`)
  }
  
  /**
   * 记录视频缓存命中
   */
  recordVideoHit(resource?: string, cacheType?: string): void {
    this.recordHit('video', resource, cacheType)
  }
  
  /**
   * 记录视频缓存未命中
   */
  recordVideoMiss(resource?: string): void {
    this.recordMiss('video', resource)
    console.log(`[CacheHitTracker] 🎬 视频缓存未命中: ${resource?.substring(0, 60)}...`)
  }
  
  /**
   * 记录模板缓存命中
   */
  recordTemplateHit(resource?: string, cacheType?: string): void {
    this.recordHit('template', resource, cacheType)
  }
  
  /**
   * 记录模板缓存未命中
   */
  recordTemplateMiss(resource?: string): void {
    this.recordMiss('template', resource)
    console.log(`[CacheHitTracker] 📋 模板缓存未命中: ${resource || 'template'}`)
  }
  
  /**
   * 记录API缓存命中
   */
  recordApiHit(resource?: string, cacheType?: string): void {
    this.recordHit('api', resource, cacheType)
    console.log(`[CacheHitTracker] 🔗 API缓存命中: ${resource || 'api'} (${cacheType || 'unknown'})`)
  }
  
  /**
   * 记录API缓存未命中
   */
  recordApiMiss(resource?: string): void {
    this.recordMiss('api', resource)
    console.log(`[CacheHitTracker] 🔗 API缓存未命中: ${resource || 'api'}`)
  }
  
  /**
   * 获取当前统计数据
   */
  getStats(): DetailedCacheStats {
    // 更新趋势数据
    this.updateTrend()
    
    return {
      ...this.stats,
      recentHits: [...this.stats.recentHits], // 返回副本
      recentTrend: [...this.stats.recentTrend] // 返回副本
    }
  }
  
  /**
   * 获取简化的统计摘要
   */
  getSummary(): {
    totalHits: number
    totalMisses: number
    overallHitRate: number
    imageHitRate: number
    videoHitRate: number
    templateHitRate: number
    apiHitRate: number
    uptime: string
  } {
    const uptime = this.formatUptime(Date.now() - this.stats.startTime)
    
    return {
      totalHits: this.stats.overall.hits,
      totalMisses: this.stats.overall.misses,
      overallHitRate: this.stats.overall.hitRate,
      imageHitRate: this.stats.image.hitRate,
      videoHitRate: this.stats.video.hitRate,
      templateHitRate: this.stats.template.hitRate,
      apiHitRate: this.stats.api.hitRate,
      uptime
    }
  }
  
  /**
   * 重置统计数据
   */
  reset(): void {
    this.stats = {
      image: { hits: 0, misses: 0, total: 0, hitRate: 0 },
      video: { hits: 0, misses: 0, total: 0, hitRate: 0 },
      template: { hits: 0, misses: 0, total: 0, hitRate: 0 },
      api: { hits: 0, misses: 0, total: 0, hitRate: 0 },
      overall: { hits: 0, misses: 0, total: 0, hitRate: 0 },
      recentHits: [],
      averageHitTime: 0,
      averageMissTime: 0,
      startTime: Date.now(),
      recentTrend: []
    }
    
    console.log('[CacheHitTracker] 📊 统计数据已重置')
  }
  
  /**
   * 导出统计数据（用于调试）
   */
  exportStats(): string {
    const stats = this.getStats()
    const summary = this.getSummary()
    
    return JSON.stringify({
      summary,
      detailedStats: stats,
      exportTime: new Date().toISOString()
    }, null, 2)
  }
  
  // ============ 私有方法 ============
  
  /**
   * 记录命中
   */
  private recordHit(
    type: 'image' | 'video' | 'template' | 'api',
    resource?: string,
    cacheType?: string
  ): void {
    const timestamp = Date.now()
    
    // 更新分类统计
    this.stats[type].hits++
    this.stats[type].total++
    this.stats[type].hitRate = (this.stats[type].hits / this.stats[type].total) * 100
    this.stats[type].lastHitTime = timestamp
    
    // 更新总体统计
    this.stats.overall.hits++
    this.stats.overall.total++
    this.stats.overall.hitRate = (this.stats.overall.hits / this.stats.overall.total) * 100
    
    // 记录详细信息
    this.addRecentHit({
      type,
      result: 'hit',
      timestamp,
      resource: resource?.substring(0, 100), // 限制长度
      cacheType
    })
  }
  
  /**
   * 记录未命中
   */
  private recordMiss(
    type: 'image' | 'video' | 'template' | 'api',
    resource?: string
  ): void {
    const timestamp = Date.now()
    
    // 更新分类统计
    this.stats[type].misses++
    this.stats[type].total++
    this.stats[type].hitRate = this.stats[type].total > 0 
      ? (this.stats[type].hits / this.stats[type].total) * 100 
      : 0
    this.stats[type].lastMissTime = timestamp
    
    // 更新总体统计
    this.stats.overall.misses++
    this.stats.overall.total++
    this.stats.overall.hitRate = this.stats.overall.total > 0
      ? (this.stats.overall.hits / this.stats.overall.total) * 100
      : 0
    
    // 记录详细信息
    this.addRecentHit({
      type,
      result: 'miss',
      timestamp,
      resource: resource?.substring(0, 100) // 限制长度
    })
  }
  
  /**
   * 添加最近命中记录
   */
  private addRecentHit(hit: {
    type: 'image' | 'video' | 'template' | 'api'
    result: 'hit' | 'miss'
    timestamp: number
    resource?: string
    cacheType?: string
  }): void {
    this.stats.recentHits.push(hit)
    
    // 保持最近记录数量限制
    if (this.stats.recentHits.length > this.MAX_RECENT_HITS) {
      this.stats.recentHits = this.stats.recentHits.slice(-this.MAX_RECENT_HITS)
    }
  }
  
  /**
   * 更新趋势数据
   */
  private updateTrend(): void {
    const now = Date.now()
    const lastTrend = this.stats.recentTrend[this.stats.recentTrend.length - 1]
    
    // 如果距离上次记录超过1分钟，或者没有记录，则添加新的趋势点
    if (!lastTrend || (now - lastTrend.timestamp) > 60000) {
      this.stats.recentTrend.push({
        timestamp: now,
        hitRate: this.stats.overall.hitRate
      })
      
      // 保持趋势点数量限制
      if (this.stats.recentTrend.length > this.MAX_TREND_POINTS) {
        this.stats.recentTrend = this.stats.recentTrend.slice(-this.MAX_TREND_POINTS)
      }
    }
  }
  
  /**
   * 格式化运行时间
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
}

// 导出单例实例
export const cacheHitTracker = new CacheHitTracker()

// 开发环境下添加到全局对象，方便调试
if (import.meta.env.DEV) {
  ;(window as any).cacheHitTracker = cacheHitTracker
  
  console.log('🎯 缓存命中追踪器已加载:')
  console.log('- window.cacheHitTracker.getStats() - 获取详细统计')
  console.log('- window.cacheHitTracker.getSummary() - 获取统计摘要')
  console.log('- window.cacheHitTracker.reset() - 重置统计')
  console.log('- window.cacheHitTracker.exportStats() - 导出统计数据')
}