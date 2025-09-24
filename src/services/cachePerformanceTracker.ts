/**
 * 缓存性能追踪服务
 * 记录和分析缓存系统的性能指标历史数据
 */

interface PerformanceSnapshot {
  timestamp: number
  totalItems: number
  totalSize: number
  hitRate: number
  compressionRatio: number
  categories: {
    [key: string]: {
      items: number
      size: number
      hitRate: number
    }
  }
}

interface PerformanceMetrics {
  averageHitRate: number
  peakUsage: number
  compressionEfficiency: number
  trendDirection: 'improving' | 'declining' | 'stable'
  recommendations: string[]
}

class CachePerformanceTracker {
  private snapshots: PerformanceSnapshot[] = []
  private readonly maxSnapshots = 100 // 保留最近100个快照
  private readonly storageKey = 'cache_performance_history'

  constructor() {
    this.loadHistory()
    // 每5分钟记录一次性能快照
    setInterval(() => this.captureSnapshot(), 5 * 60 * 1000)
  }

  /**
   * 记录性能快照
   */
  async captureSnapshot(): Promise<void> {
    try {
      const { unifiedCache } = await import('./UnifiedCacheService')
      const stats = unifiedCache.getGlobalStats()
      
      const snapshot: PerformanceSnapshot = {
        timestamp: Date.now(),
        totalItems: stats.summary.totalItems,
        totalSize: this.parseSizeString(stats.summary.totalSize),
        hitRate: this.parsePercentage(stats.summary.averageHitRate),
        categories: {}
      }

      // 记录分类数据
      stats.categories.forEach(category => {
        snapshot.categories[category.name] = {
          items: category.count,
          size: category.size,
          hitRate: category.hitRate
        }
      })

      this.snapshots.push(snapshot)

      // 限制快照数量
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots = this.snapshots.slice(-this.maxSnapshots)
      }

      this.saveHistory()
      console.log('[CachePerformanceTracker] 📸 性能快照已记录')
    } catch (error) {
      console.error('[CachePerformanceTracker] 快照记录失败:', error)
    }
  }

  /**
   * 获取性能趋势分析
   */
  getPerformanceMetrics(timeRange: '1h' | '6h' | '24h' | 'all' = '24h'): PerformanceMetrics {
    const filteredSnapshots = this.getSnapshotsInRange(timeRange)
    
    if (filteredSnapshots.length < 2) {
      return {
        averageHitRate: 0,
        peakUsage: 0,
        compressionEfficiency: 0,
        trendDirection: 'stable',
        recommendations: ['需要更多数据来分析趋势']
      }
    }

    const averageHitRate = filteredSnapshots.reduce((sum, s) => sum + s.hitRate, 0) / filteredSnapshots.length
    const peakUsage = Math.max(...filteredSnapshots.map(s => s.totalSize))
    // 压缩统计已移除

    // 计算趋势
    const recent = filteredSnapshots.slice(-5)
    const earlier = filteredSnapshots.slice(0, 5)
    const recentAvg = recent.reduce((sum, s) => sum + s.hitRate, 0) / recent.length
    const earlierAvg = earlier.reduce((sum, s) => sum + s.hitRate, 0) / earlier.length
    
    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable'
    const diff = recentAvg - earlierAvg
    if (Math.abs(diff) > 0.05) {
      trendDirection = diff > 0 ? 'improving' : 'declining'
    }

    return {
      averageHitRate,
      peakUsage,
      trendDirection,
      recommendations: this.generateRecommendations(filteredSnapshots, trendDirection)
    }
  }

  /**
   * 获取历史数据用于图表展示
   */
  getChartData(timeRange: '1h' | '6h' | '24h' | 'all' = '24h') {
    const snapshots = this.getSnapshotsInRange(timeRange)
    
    return {
      timestamps: snapshots.map(s => new Date(s.timestamp).toLocaleTimeString()),
      hitRates: snapshots.map(s => (s.hitRate * 100).toFixed(1)),
      sizes: snapshots.map(s => (s.totalSize / 1024 / 1024).toFixed(1)), // MB
      items: snapshots.map(s => s.totalItems),
      categories: this.getCategoryTrends(snapshots)
    }
  }

  /**
   * 获取分类趋势数据
   */
  private getCategoryTrends(snapshots: PerformanceSnapshot[]) {
    const categories = ['image', 'template', 'video', 'user']
    const trends: { [key: string]: number[] } = {}

    categories.forEach(category => {
      trends[category] = snapshots.map(s => 
        s.categories[category]?.hitRate || 0
      )
    })

    return trends
  }

  /**
   * 生成性能建议
   */
  private generateRecommendations(
    snapshots: PerformanceSnapshot[], 
    trend: 'improving' | 'declining' | 'stable'
  ): string[] {
    const recommendations: string[] = []
    const latest = snapshots[snapshots.length - 1]
    
    // 整体趋势建议
    if (trend === 'declining') {
      recommendations.push('缓存命中率呈下降趋势，建议检查缓存配置')
    } else if (trend === 'improving') {
      recommendations.push('缓存性能正在改善，当前优化策略有效')
    }

    // 命中率建议
    if (latest.hitRate < 0.6) {
      recommendations.push('整体缓存命中率偏低，建议增加缓存有效期或预加载策略')
    } else if (latest.hitRate > 0.9) {
      recommendations.push('缓存命中率很高，系统运行良好')
    }

    // 存储使用建议
    const avgSize = snapshots.reduce((sum, s) => sum + s.totalSize, 0) / snapshots.length
    if (latest.totalSize > avgSize * 1.5) {
      recommendations.push('当前存储使用量显著高于平均值，建议检查是否有内存泄漏')
    }

    // 分类特定建议
    Object.entries(latest.categories).forEach(([category, data]) => {
      if (data.hitRate < 0.5) {
        recommendations.push(`${category} 分类缓存效率较低，建议优化该分类的缓存策略`)
      }
    })

    // 压缩效率建议
    if (latest.compressionRatio < avgSize * 0.1) {
      recommendations.push('图片压缩效果有限，可能需要调整压缩参数')
    }

    return recommendations.length > 0 ? recommendations : ['缓存系统运行正常，无需特殊优化']
  }

  /**
   * 获取时间范围内的快照
   */
  private getSnapshotsInRange(timeRange: '1h' | '6h' | '24h' | 'all'): PerformanceSnapshot[] {
    if (timeRange === 'all') return this.snapshots

    const now = Date.now()
    const ranges = {
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    }
    
    const cutoff = now - ranges[timeRange]
    return this.snapshots.filter(s => s.timestamp >= cutoff)
  }

  /**
   * 解析大小字符串
   */
  private parseSizeString(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)$/)
    if (!match) return 0

    const value = parseFloat(match[1])
    const unit = match[2]
    
    const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }
    return value * (multipliers[unit as keyof typeof multipliers] || 1)
  }

  /**
   * 解析百分比字符串
   */
  private parsePercentage(percentStr: string): number {
    const match = percentStr.match(/^([\d.]+)%$/)
    return match ? parseFloat(match[1]) / 100 : 0
  }

  /**
   * 保存历史数据
   */
  private saveHistory(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.snapshots))
    } catch (error) {
      console.warn('[CachePerformanceTracker] 保存历史失败:', error)
    }
  }

  /**
   * 加载历史数据
   */
  private loadHistory(): void {
    try {
      const saved = localStorage.getItem(this.storageKey)
      if (saved) {
        this.snapshots = JSON.parse(saved)
        console.log(`[CachePerformanceTracker] 📚 加载了${this.snapshots.length}个历史快照`)
      }
    } catch (error) {
      console.warn('[CachePerformanceTracker] 加载历史失败:', error)
      this.snapshots = []
    }
  }

  /**
   * 清理历史数据
   */
  clearHistory(): void {
    this.snapshots = []
    localStorage.removeItem(this.storageKey)
    console.log('[CachePerformanceTracker] 🗑️ 历史数据已清理')
  }

  /**
   * 导出性能报告
   */
  exportReport(): string {
    const metrics = this.getPerformanceMetrics('all')
    const chartData = this.getChartData('all')
    
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalSnapshots: this.snapshots.length,
        timeRange: {
          start: new Date(this.snapshots[0]?.timestamp).toISOString(),
          end: new Date(this.snapshots[this.snapshots.length - 1]?.timestamp).toISOString()
        },
        metrics
      },
      chartData,
      rawData: this.snapshots
    }

    return JSON.stringify(report, null, 2)
  }
}

export const cachePerformanceTracker = new CachePerformanceTracker()
export type { PerformanceMetrics, PerformanceSnapshot }