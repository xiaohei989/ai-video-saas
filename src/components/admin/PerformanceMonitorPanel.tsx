/**
 * 性能监控面板
 * 
 * 展示缓存服务、视频加载等性能指标
 * 仅在开发环境或管理员模式下显示
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Monitor, 
  Database, 
  Wifi, 
  HardDrive,
  Clock,
  Activity,
  RefreshCw,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import { multiLevelCache } from '@/services/MultiLevelCacheService'
import { smartPreloadService } from '@/services/SmartVideoPreloadService'
import { idb } from '@/services/idbService'

interface PerformanceData {
  cacheStats: any
  preloadStats: any
  storageInfo: any
  networkInfo: any
  systemInfo: any
}

export default function PerformanceMonitorPanel() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  /**
   * 收集性能数据
   */
  const collectData = async (): Promise<PerformanceData> => {
    // 缓存统计
    const cacheStats = multiLevelCache.getStats()
    
    // 预加载统计
    const preloadStats = smartPreloadService.getStats()
    
    // 存储信息
    const storageInfo = await idb.getStorageInfo()
    
    // 网络信息
    const networkInfo = 'connection' in navigator ? {
      type: (navigator as any).connection?.effectiveType || 'unknown',
      downlink: (navigator as any).connection?.downlink || 0,
      rtt: (navigator as any).connection?.rtt || 0,
      saveData: (navigator as any).connection?.saveData || false
    } : null
    
    // 系统信息
    const systemInfo = {
      memory: (navigator as any).deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
      userAgent: navigator.userAgent,
      onLine: navigator.onLine
    }
    
    return {
      cacheStats,
      preloadStats,
      storageInfo,
      networkInfo,
      systemInfo
    }
  }

  /**
   * 刷新数据
   */
  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      const newData = await collectData()
      setData(newData)
    } catch (error) {
      console.error('收集性能数据失败:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // 初始化和自动刷新
  useEffect(() => {
    refreshData()
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, 2000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>正在收集性能数据...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              性能监控面板
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
              >
                <Activity className={`h-4 w-4 mr-1 ${autoRefresh ? 'text-green-600' : ''}`} />
                {autoRefresh ? '实时监控' : '手动刷新'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 多级缓存统计 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              多级缓存
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">总体命中率</span>
                <Badge variant={
                  parseFloat(data.cacheStats.overallHitRate) > 70 ? 'default' :
                  parseFloat(data.cacheStats.overallHitRate) > 40 ? 'secondary' : 'destructive'
                }>
                  {data.cacheStats.overallHitRate}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>L1 (内存)</span>
                  <span className="text-green-600">{data.cacheStats.l1HitRate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>L2 (IDB)</span>
                  <span className="text-blue-600">{data.cacheStats.l2HitRate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>L3 (Redis)</span>
                  <span className="text-purple-600">{data.cacheStats.l3HitRate}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span>内存使用</span>
                  <span>{data.cacheStats.memoryCacheSize}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>缓存项数量</span>
                  <span>{data.cacheStats.memoryCacheCount}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 智能预加载统计 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              智能预加载
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">预加载成功</span>
                <Badge variant="default">
                  {data.preloadStats.totalPreloaded}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>缩略图</span>
                  <span className="text-blue-600">{data.preloadStats.thumbnailsLoaded}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>视频</span>
                  <span className="text-green-600">{data.preloadStats.videosLoaded}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>缓存命中</span>
                  <span className="text-purple-600">{data.preloadStats.cacheHits}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>缓存未命中</span>
                  <span className="text-orange-600">{data.preloadStats.cacheMisses}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span>平均加载时间</span>
                  <span>{Math.round(data.preloadStats.averageLoadTime)}ms</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 存储信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              存储状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">存储使用率</span>
                <Badge variant={
                  data.storageInfo.percentage > 80 ? 'destructive' :
                  data.storageInfo.percentage > 60 ? 'secondary' : 'default'
                }>
                  {data.storageInfo.percentage.toFixed(1)}%
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>已用空间</span>
                  <span>{(data.storageInfo.usage / 1024 / 1024).toFixed(1)}MB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>总配额</span>
                  <span>{(data.storageInfo.quota / 1024 / 1024 / 1024).toFixed(1)}GB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>缓存项数</span>
                  <span>{data.storageInfo.itemCount}</span>
                </div>
              </div>
              
              {/* 存储进度条 */}
              <div className="pt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      data.storageInfo.percentage > 80 ? 'bg-red-500' :
                      data.storageInfo.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(data.storageInfo.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 网络状态 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              网络状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.networkInfo ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">连接类型</span>
                    <Badge variant={
                      data.networkInfo.type === '4g' ? 'default' :
                      data.networkInfo.type === '3g' ? 'secondary' : 'outline'
                    }>
                      {data.networkInfo.type.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>下载速度</span>
                      <span className="text-blue-600">{data.networkInfo.downlink}Mbps</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>延迟</span>
                      <span className="text-green-600">{data.networkInfo.rtt}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>省流模式</span>
                      <span className={data.networkInfo.saveData ? 'text-orange-600' : 'text-gray-500'}>
                        {data.networkInfo.saveData ? '已启用' : '已关闭'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center text-sm text-gray-500">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  网络信息不可用
                </div>
              )}
              
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span>在线状态</span>
                  <Badge variant={data.systemInfo.onLine ? 'default' : 'destructive'}>
                    {data.systemInfo.onLine ? '在线' : '离线'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 系统信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              系统信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>设备内存</span>
                  <span className="text-blue-600">
                    {data.systemInfo.memory !== 'unknown' ? `${data.systemInfo.memory}GB` : '未知'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>CPU核心</span>
                  <span className="text-green-600">
                    {data.systemInfo.cores !== 'unknown' ? `${data.systemInfo.cores}核` : '未知'}
                  </span>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="text-xs text-gray-500 break-all">
                  {data.systemInfo.userAgent.split(' ').slice(0, 3).join(' ')}...
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 缓存操作 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              缓存操作
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  multiLevelCache.resetStats()
                  refreshData()
                }}
                className="w-full"
              >
                重置缓存统计
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  smartPreloadService.clearAll()
                  refreshData()
                }}
                className="w-full"
              >
                清理预加载队列
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await idb.clearAll()
                  refreshData()
                }}
                className="w-full"
              >
                清空本地缓存
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}