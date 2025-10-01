/**
 * 缓存性能监控组件
 * 提供统一缓存系统的实时监控和统计信息
 */

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Activity, Database, HardDrive, Zap, TrendingUp, RefreshCw, Trash2, BarChart3 } from '@/components/icons'
import { unifiedCache, type CategoryStats } from '@/services/UnifiedCacheService'
import { templatesCacheService } from '@/services/templatesCacheService'
import { videoCacheService } from '@/services/videoCacheService'

interface CacheStats {
  categories: CategoryStats[]
  summary: {
    totalItems: number
    totalSize: string
    totalMaxSize: string
    averageHitRate: string
    migrationCompleted: boolean
    idbReady: boolean
  }
}

export function CachePerformanceMonitor() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 获取统计数据
  const fetchStats = async () => {
    try {
      setIsRefreshing(true)
      
      // 获取统一缓存系统统计
      const globalStats = unifiedCache.getGlobalStats()
      
      // 获取具体服务的统计
      const templateStats = templatesCacheService.getCacheStats()
      const videoStats = videoCacheService.getCacheStats()
      
      setStats({
        categories: globalStats.categories,
        summary: globalStats.summary
      })
    } catch (error) {
      console.error('[CacheMonitor] 获取统计失败:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // 清理所有缓存
  const handleClearAllCache = async () => {
    if (confirm('确定要清理所有缓存吗？这将影响加载性能。')) {
      try {
        await unifiedCache.clearAll()
        await templatesCacheService.clearAllCache()
        await fetchStats()
        console.log('[CacheMonitor] 所有缓存已清理')
      } catch (error) {
        console.error('[CacheMonitor] 清理缓存失败:', error)
      }
    }
  }

  // 自动刷新
  useEffect(() => {
    fetchStats()
    
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 5000) // 每5秒刷新
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  // 格式化大小显示
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  // 获取状态颜色
  const getStatusColor = (hitRate: number) => {
    if (hitRate >= 0.8) return 'text-green-600'
    if (hitRate >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            加载缓存统计中...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题和控制 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">缓存性能监控</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <Activity className="w-4 h-4 mr-2" />
            {autoRefresh ? '自动刷新' : '手动刷新'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAllCache}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清理缓存
          </Button>
        </div>
      </div>

      {/* 全局摘要 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">缓存项总数</p>
                <p className="text-2xl font-bold">{stats.summary.totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">存储使用</p>
                <p className="text-2xl font-bold">{stats.summary.totalSize}</p>
                <p className="text-xs text-gray-500">/ {stats.summary.totalMaxSize}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">平均命中率</p>
                <p className="text-2xl font-bold">{stats.summary.averageHitRate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">系统状态</p>
                <p className="text-2xl font-bold">{stats.summary.idbReady ? '在线' : '离线'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 系统状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>系统状态</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">IndexedDB:</span>
              <Badge variant={stats.summary.idbReady ? 'default' : 'destructive'}>
                {stats.summary.idbReady ? '已连接' : '未连接'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">数据迁移:</span>
              <Badge variant={stats.summary.migrationCompleted ? 'default' : 'secondary'}>
                {stats.summary.migrationCompleted ? '已完成' : '进行中'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">自动刷新:</span>
              <Badge variant={autoRefresh ? 'default' : 'outline'}>
                {autoRefresh ? '开启' : '关闭'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 分类详情 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>分类统计</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.categories.map((category) => {
              const usage = category.size / category.maxSize
              const usagePercent = Math.round(usage * 100)
              
              return (
                <div key={category.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="capitalize">
                        {category.name}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {category.count} 项
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${getStatusColor(category.hitRate)}`}>
                        命中率: {(category.hitRate * 100).toFixed(1)}%
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatSize(category.size)}
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={usagePercent} 
                    className="h-2"
                    aria-label={`${category.name} 存储使用率: ${usagePercent}%`}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>使用 {usagePercent}%</span>
                    <span>最大 {formatSize(category.maxSize)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 性能建议 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>性能建议</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.categories.map((category) => {
              const suggestions = []
              
              if (category.hitRate < 0.6) {
                suggestions.push(`${category.name} 缓存命中率偏低，考虑增加缓存时间`)
              }
              
              if (category.size / category.maxSize > 0.9) {
                suggestions.push(`${category.name} 存储使用率过高，建议清理或增加限制`)
              }
              
              if (category.count === 0) {
                suggestions.push(`${category.name} 缓存未使用，可能存在配置问题`)
              }
              
              return suggestions.map((suggestion, index) => (
                <div key={`${category.name}-${index}`} className="flex items-start space-x-2 p-2 bg-yellow-50 rounded-md">
                  <Activity className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-yellow-800">{suggestion}</span>
                </div>
              ))
            }).flat()}
            
            {stats.categories.every(cat => cat.hitRate >= 0.6 && cat.size / cat.maxSize <= 0.9) && (
              <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-md">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-800">缓存系统运行良好！</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}