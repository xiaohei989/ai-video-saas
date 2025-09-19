/**
 * 缓存健康检查工具
 * 用于诊断和监控图片缓存的健康状态
 */

export interface CacheHealthReport {
  // 总体状态
  status: 'healthy' | 'warning' | 'critical'
  score: number // 0-100 健康评分
  
  // 基础检查
  localStorageAvailable: boolean
  corsSupport: boolean
  canvasSupport: boolean
  
  // 缓存统计
  totalCachedImages: number
  totalCacheSize: number // KB
  cacheHitRate: number // 百分比
  averageLoadTime: number // ms
  
  // 错误统计
  corsErrors: number
  canvasTaintErrors: number
  quotaExceededErrors: number
  loadFailures: number
  
  // 性能指标
  averageCacheTime: number // ms
  averageImageSize: number // KB
  cacheUtilization: number // 百分比
  
  // 建议
  recommendations: string[]
  
  // 详细信息
  details: {
    oldestCacheItem?: { key: string; timestamp: number; age: string }
    newestCacheItem?: { key: string; timestamp: number }
    largestCacheItem?: { key: string; size: number }
    failedUrls: string[]
    deviceType: 'Mobile' | 'Desktop'
    lastCheckTime: number
  }
}

interface CacheMetrics {
  attempts: number
  successes: number
  corsErrors: number
  canvasTaintErrors: number
  quotaErrors: number
  loadFailures: number
  totalTime: number
  totalSize: number
}

class CacheHealthChecker {
  private metrics: CacheMetrics = {
    attempts: 0,
    successes: 0,
    corsErrors: 0,
    canvasTaintErrors: 0,
    quotaErrors: 0,
    loadFailures: 0,
    totalTime: 0,
    totalSize: 0
  }
  
  private failedUrls: Set<string> = new Set()
  
  /**
   * 记录缓存尝试
   */
  recordCacheAttempt(): void {
    this.metrics.attempts++
  }
  
  /**
   * 记录缓存成功
   */
  recordCacheSuccess(size: number, time: number): void {
    this.metrics.successes++
    this.metrics.totalSize += size
    this.metrics.totalTime += time
  }
  
  /**
   * 记录CORS错误
   */
  recordCorsError(url: string): void {
    this.metrics.corsErrors++
    this.failedUrls.add(url)
  }
  
  /**
   * 记录Canvas污染错误
   */
  recordCanvasTaintError(url: string): void {
    this.metrics.canvasTaintErrors++
    this.failedUrls.add(url)
  }
  
  /**
   * 记录配额超限错误
   */
  recordQuotaError(): void {
    this.metrics.quotaErrors++
  }
  
  /**
   * 记录加载失败
   */
  recordLoadFailure(url: string): void {
    this.metrics.loadFailures++
    this.failedUrls.add(url)
  }
  
  /**
   * 检查localStorage可用性
   */
  private checkLocalStorageAvailable(): boolean {
    try {
      const testKey = '__cache_health_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }
  
  /**
   * 检查CORS支持
   */
  private async checkCorsSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(false)
            return
          }
          
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          ctx.drawImage(img, 0, 0)
          
          // 测试是否可以读取像素数据
          ctx.getImageData(0, 0, 1, 1)
          resolve(true)
        } catch {
          resolve(false)
        }
      }
      
      img.onerror = () => resolve(false)
      
      // 使用一个简单的测试图片
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    })
  }
  
  /**
   * 检查Canvas支持
   */
  private checkCanvasSupport(): boolean {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      return !!ctx
    } catch {
      return false
    }
  }
  
  /**
   * 获取缓存统计信息
   */
  private getCacheStats(): {
    totalItems: number
    totalSize: number
    items: Array<{ key: string; size: number; timestamp: number; data: any }>
  } {
    const items: Array<{ key: string; size: number; timestamp: number; data: any }> = []
    let totalSize = 0
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith('cached_img_')) continue
        
        try {
          const item = localStorage.getItem(key)
          if (!item) continue
          
          const data = JSON.parse(item)
          const size = data.size || 0
          
          items.push({
            key,
            size,
            timestamp: data.timestamp || 0,
            data
          })
          
          totalSize += size
        } catch {
          // 忽略解析失败的项目
        }
      }
    } catch {
      // 忽略localStorage访问失败
    }
    
    return {
      totalItems: items.length,
      totalSize,
      items
    }
  }
  
  /**
   * 生成健康报告
   */
  async generateHealthReport(): Promise<CacheHealthReport> {
    const startTime = performance.now()
    
    // 基础检查
    const localStorageAvailable = this.checkLocalStorageAvailable()
    const corsSupport = await this.checkCorsSupport()
    const canvasSupport = this.checkCanvasSupport()
    
    // 缓存统计
    const cacheStats = this.getCacheStats()
    const { totalItems, totalSize, items } = cacheStats
    
    // 计算指标
    const cacheHitRate = this.metrics.attempts > 0 ? 
      (this.metrics.successes / this.metrics.attempts) * 100 : 0
      
    const averageLoadTime = this.metrics.successes > 0 ? 
      this.metrics.totalTime / this.metrics.successes : 0
      
    const averageCacheTime = this.metrics.successes > 0 ? 
      this.metrics.totalTime / this.metrics.successes : 0
      
    const averageImageSize = this.metrics.successes > 0 ? 
      this.metrics.totalSize / this.metrics.successes : 0
    
    // 设备检测
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const deviceType = isMobile ? 'Mobile' : 'Desktop'
    const maxCacheItems = isMobile ? 50 : 100
    const cacheUtilization = (totalItems / maxCacheItems) * 100
    
    // 找出最老和最新的缓存项
    const sortedByTime = items.sort((a, b) => a.timestamp - b.timestamp)
    const oldestItem = sortedByTime[0]
    const newestItem = sortedByTime[sortedByTime.length - 1]
    
    // 找出最大的缓存项
    const sortedBySize = items.sort((a, b) => b.size - a.size)
    const largestItem = sortedBySize[0]
    
    // 计算健康评分 (0-100)
    let score = 100
    
    if (!localStorageAvailable) score -= 40
    if (!corsSupport) score -= 20
    if (!canvasSupport) score -= 20
    if (cacheHitRate < 50) score -= 10
    if (this.metrics.corsErrors > this.metrics.attempts * 0.3) score -= 5
    if (this.metrics.canvasTaintErrors > this.metrics.attempts * 0.2) score -= 5
    if (this.metrics.quotaErrors > 0) score -= 5
    
    score = Math.max(0, score)
    
    // 确定状态
    let status: 'healthy' | 'warning' | 'critical'
    if (score >= 80) status = 'healthy'
    else if (score >= 60) status = 'warning'
    else status = 'critical'
    
    // 生成建议
    const recommendations: string[] = []
    
    if (!localStorageAvailable) {
      recommendations.push('localStorage不可用，可能处于私人浏览模式')
    }
    
    if (!corsSupport) {
      recommendations.push('CORS支持有问题，考虑配置CDN头部或使用代理')
    }
    
    if (!canvasSupport) {
      recommendations.push('Canvas支持有问题，无法进行图片缓存')
    }
    
    if (cacheHitRate < 50) {
      recommendations.push(`缓存命中率较低 (${cacheHitRate.toFixed(1)}%)，检查CORS配置`)
    }
    
    if (cacheUtilization > 90) {
      recommendations.push('缓存使用率过高，考虑增加清理频率')
    }
    
    if (this.metrics.corsErrors > 0) {
      recommendations.push(`发现${this.metrics.corsErrors}个CORS错误，检查CDN配置`)
    }
    
    if (this.metrics.canvasTaintErrors > 0) {
      recommendations.push(`发现${this.metrics.canvasTaintErrors}个Canvas污染错误`)
    }
    
    if (averageImageSize > (isMobile ? 150 : 300)) {
      recommendations.push('平均图片大小过大，考虑提高压缩率')
    }
    
    return {
      status,
      score,
      localStorageAvailable,
      corsSupport,
      canvasSupport,
      totalCachedImages: totalItems,
      totalCacheSize: totalSize,
      cacheHitRate,
      averageLoadTime,
      corsErrors: this.metrics.corsErrors,
      canvasTaintErrors: this.metrics.canvasTaintErrors,
      quotaExceededErrors: this.metrics.quotaErrors,
      loadFailures: this.metrics.loadFailures,
      averageCacheTime,
      averageImageSize,
      cacheUtilization,
      recommendations,
      details: {
        oldestCacheItem: oldestItem ? {
          key: oldestItem.key,
          timestamp: oldestItem.timestamp,
          age: this.formatAge(Date.now() - oldestItem.timestamp)
        } : undefined,
        newestCacheItem: newestItem ? {
          key: newestItem.key,
          timestamp: newestItem.timestamp
        } : undefined,
        largestCacheItem: largestItem ? {
          key: largestItem.key,
          size: largestItem.size
        } : undefined,
        failedUrls: Array.from(this.failedUrls).slice(0, 10), // 最多显示10个失败URL
        deviceType,
        lastCheckTime: Date.now()
      }
    }
  }
  
  /**
   * 格式化时间差
   */
  private formatAge(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}天前`
    if (hours > 0) return `${hours}小时前`
    if (minutes > 0) return `${minutes}分钟前`
    return `${seconds}秒前`
  }
  
  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      attempts: 0,
      successes: 0,
      corsErrors: 0,
      canvasTaintErrors: 0,
      quotaErrors: 0,
      loadFailures: 0,
      totalTime: 0,
      totalSize: 0
    }
    this.failedUrls.clear()
  }
  
  /**
   * 获取当前指标
   */
  getMetrics(): CacheMetrics & { failedUrls: string[] } {
    return {
      ...this.metrics,
      failedUrls: Array.from(this.failedUrls)
    }
  }
}

// 导出单例
export const cacheHealthChecker = new CacheHealthChecker()

// 在全局对象上暴露诊断工具（仅开发环境）
if (import.meta.env.DEV) {
  ;(window as any).cacheHealthChecker = {
    check: () => cacheHealthChecker.generateHealthReport(),
    reset: () => cacheHealthChecker.resetMetrics(),
    metrics: () => cacheHealthChecker.getMetrics()
  }
  
  console.log('🔍 缓存健康检查工具已加载到全局对象:')
  console.log('- window.cacheHealthChecker.check() - 生成健康报告')
  console.log('- window.cacheHealthChecker.reset() - 重置指标')
  console.log('- window.cacheHealthChecker.metrics() - 查看当前指标')
}