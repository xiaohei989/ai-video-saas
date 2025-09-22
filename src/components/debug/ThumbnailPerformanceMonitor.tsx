/**
 * 缩略图性能监控组件
 * 专门监控渐进式缩略图加载的性能指标
 */

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Image, 
  Zap, 
  Clock, 
  Database, 
  TrendingUp,
  Activity
} from 'lucide-react'
import { thumbnailOptimizer } from '@/utils/thumbnailOptimizer'
import { cacheHitTracker } from '@/utils/cacheHitTracker'

interface ThumbnailPerformanceMetrics {
  // 加载性能
  firstThumbnailTime: number      // 首个缩略图显示时间
  visibleThumbnailsTime: number   // 可见缩略图全部加载时间
  allThumbnailsTime: number       // 所有缩略图加载时间
  
  // 优化效果
  optimizedUrlsGenerated: number  // 生成的优化URL数量
  blurPlaceholdersShown: number   // 显示的模糊占位图数量
  progressiveTransitions: number  // 渐进式过渡次数
  
  // 缓存性能
  cacheHitRatio: number          // 缓存命中率
  webpAdoptionRate: number       // WebP采用率
  avgThumbnailSize: number       // 平均缩略图大小
  bandwidthSaved: number         // 节省的带宽
  
  // 设备信息
  deviceType: string             // 设备类型
  devicePixelRatio: number       // 设备像素比
  webpSupported: boolean         // WebP支持
  
  // 实时统计
  totalRequests: number          // 总请求数
  successfulLoads: number        // 成功加载数
  failedLoads: number           // 失败加载数
  averageLoadTime: number        // 平均加载时间
}

interface ThumbnailPerformanceMonitorProps {
  visible?: boolean
  position?: 'top-right' | 'bottom-right' | 'bottom-left'
}

export const ThumbnailPerformanceMonitor: React.FC<ThumbnailPerformanceMonitorProps> = ({
  visible = import.meta.env.DEV,
  position = 'bottom-right'
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [metrics, setMetrics] = useState<ThumbnailPerformanceMetrics>({
    firstThumbnailTime: 0,
    visibleThumbnailsTime: 0,
    allThumbnailsTime: 0,
    optimizedUrlsGenerated: 0,
    blurPlaceholdersShown: 0,
    progressiveTransitions: 0,
    cacheHitRatio: 0,
    webpAdoptionRate: 0,
    avgThumbnailSize: 0,
    bandwidthSaved: 0,
    deviceType: 'unknown',
    devicePixelRatio: 1,
    webpSupported: false,
    totalRequests: 0,
    successfulLoads: 0,
    failedLoads: 0,
    averageLoadTime: 0
  })

  // 更新性能指标
  const updateMetrics = () => {
    const optimizerStats = thumbnailOptimizer.getOptimizationStats()
    const cacheSummary = cacheHitTracker.getSummary()
    
    setMetrics({
      firstThumbnailTime: performance.now() - (performance.timeOrigin || 0),
      visibleThumbnailsTime: 0, // 需要从外部传入
      allThumbnailsTime: 0,     // 需要从外部传入
      optimizedUrlsGenerated: 0, // 需要实现计数器
      blurPlaceholdersShown: 0,  // 需要实现计数器
      progressiveTransitions: 0, // 需要实现计数器
      cacheHitRatio: cacheSummary.imageHitRate,
      webpAdoptionRate: optimizerStats.webpSupported ? 100 : 0,
      avgThumbnailSize: 0, // 需要实现
      bandwidthSaved: 0,   // 需要实现
      deviceType: optimizerStats.deviceType,
      devicePixelRatio: optimizerStats.devicePixelRatio,
      webpSupported: optimizerStats.webpSupported,
      totalRequests: cacheSummary.totalHits + cacheSummary.totalMisses,
      successfulLoads: cacheSummary.totalHits,
      failedLoads: cacheSummary.totalMisses,
      averageLoadTime: 0 // 需要实现
    })
  }

  // 定期更新指标
  useEffect(() => {
    if (!visible) return
    
    updateMetrics()
    const interval = setInterval(updateMetrics, 2000) // 每2秒更新
    
    return () => clearInterval(interval)
  }, [visible])

  // 获取性能等级
  const getPerformanceGrade = (hitRate: number) => {
    if (hitRate >= 90) return { grade: 'A+', color: 'text-green-600', bg: 'bg-green-100' }
    if (hitRate >= 80) return { grade: 'A', color: 'text-green-500', bg: 'bg-green-100' }
    if (hitRate >= 70) return { grade: 'B', color: 'text-yellow-500', bg: 'bg-yellow-100' }
    if (hitRate >= 60) return { grade: 'C', color: 'text-orange-500', bg: 'bg-orange-100' }
    return { grade: 'D', color: 'text-red-500', bg: 'bg-red-100' }
  }

  // 获取位置样式
  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-right':
      default:
        return 'bottom-4 right-4'
    }
  }

  if (!visible) return null

  const performanceGrade = getPerformanceGrade(metrics.cacheHitRatio)

  return (
    <div className={`fixed ${getPositionClasses()} z-50 max-w-sm`}>
      <Card className="bg-white/95 backdrop-blur-sm border shadow-lg">
        {/* 头部 - 始终显示 */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">缩略图性能</span>
              <Badge 
                variant="secondary" 
                className={`text-xs ${performanceGrade.color} ${performanceGrade.bg}`}
              >
                {performanceGrade.grade}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 h-6 w-6"
            >
              {isExpanded ? '−' : '+'}
            </Button>
          </div>
          
          {/* 关键指标 */}
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              <span>命中率: {metrics.cacheHitRatio.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>{metrics.deviceType}</span>
            </div>
          </div>
        </div>

        {/* 详细统计 - 展开时显示 */}
        {isExpanded && (
          <div className="p-3 space-y-3">
            {/* 加载性能 */}
            <div>
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                加载性能
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">首图时间:</span>
                  <span className="ml-1 font-mono">
                    {metrics.firstThumbnailTime.toFixed(0)}ms
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">平均加载:</span>
                  <span className="ml-1 font-mono">
                    {metrics.averageLoadTime.toFixed(0)}ms
                  </span>
                </div>
              </div>
            </div>

            {/* 优化效果 */}
            <div>
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                优化效果
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">WebP支持:</span>
                  <span className="ml-1">
                    {metrics.webpSupported ? '✅' : '❌'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">带宽节省:</span>
                  <span className="ml-1 font-mono">
                    {metrics.bandwidthSaved.toFixed(1)}KB
                  </span>
                </div>
              </div>
            </div>

            {/* 缓存统计 */}
            <div>
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                <Database className="h-3 w-3" />
                缓存统计
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">总请求:</span>
                  <span className="ml-1 font-mono">{metrics.totalRequests}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">成功率:</span>
                  <span className="ml-1 font-mono">
                    {((metrics.successfulLoads / metrics.totalRequests) * 100 || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 设备信息 */}
            <div>
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                设备信息
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">设备类型:</span>
                  <span className="ml-1">{metrics.deviceType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">像素比:</span>
                  <span className="ml-1 font-mono">{metrics.devicePixelRatio}x</span>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  cacheHitTracker.reset()
                  updateMetrics()
                }}
                className="flex-1 text-xs h-7"
              >
                重置统计
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const data = {
                    thumbnailMetrics: metrics,
                    optimizerStats: thumbnailOptimizer.getOptimizationStats(),
                    cacheStats: cacheHitTracker.getStats(),
                    timestamp: new Date().toISOString()
                  }
                  console.log('🖼️ 缩略图性能数据:', data)
                  
                  // 可选：导出到剪贴板
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                  }
                }}
                className="flex-1 text-xs h-7"
              >
                导出数据
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default ThumbnailPerformanceMonitor