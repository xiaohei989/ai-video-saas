/**
 * 缩略图管理面板
 * 提供缩略图系统的监控和管理功能
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ImageIcon, 
  Database, 
  RefreshCw, 
  TrendingUp, 
  HardDrive,
  Loader2,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
// thumbnailGenerator 服务已简化，现在使用浏览器原生 Media Fragments
import { localThumbnailExtractor } from '@/services/LocalThumbnailExtractor'
import { useTranslation } from 'react-i18next'

interface ThumbnailStats {
  totalVideos: number
  videosWithRealThumbnails: number
  videosWithSVGOnly: number
  cacheSize: number
  extractionQueue: number
  activeExtractions: number
}

export default function ThumbnailManagementPanel() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<ThumbnailStats>({
    totalVideos: 0,
    videosWithRealThumbnails: 0,
    videosWithSVGOnly: 0,
    cacheSize: 0,
    extractionQueue: 0,
    activeExtractions: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 加载统计数据
  const loadStats = async () => {
    try {
      setIsRefreshing(true)

      // 获取提取器状态
      const extractorStatus = localThumbnailExtractor.getExtractionStatus()

      // 估算缓存大小 (这需要在实际实现中完善)
      const estimatedCacheSize = 0 // MB

      setStats({
        totalVideos: 0, // 需要从实际数据源获取
        videosWithRealThumbnails: 0,
        videosWithSVGOnly: 0,
        cacheSize: estimatedCacheSize,
        extractionQueue: extractorStatus.queueLength,
        activeExtractions: extractorStatus.activeExtractions
      })

    } catch (error) {
      console.error('加载缩略图统计失败:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadStats()
  }, [])

  // 定期刷新状态
  useEffect(() => {
    const interval = setInterval(loadStats, 5000) // 每5秒刷新
    return () => clearInterval(interval)
  }, [])

  const coveragePercentage = stats.totalVideos > 0 
    ? Math.round((stats.videosWithRealThumbnails / stats.totalVideos) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* 标题和刷新按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6" />
            缩略图管理中心
          </h2>
          <p className="text-muted-foreground mt-1">
            监控和管理视频缩略图系统
          </p>
        </div>
        <Button 
          onClick={loadStats} 
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          刷新
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 覆盖率统计 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">真实缩略图覆盖率</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{coveragePercentage}%</div>
              <Progress value={coveragePercentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {stats.videosWithRealThumbnails} / {stats.totalVideos} 个视频
              </p>
            </CardContent>
          </Card>

          {/* 提取队列状态 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">提取队列</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.extractionQueue}</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={stats.activeExtractions > 0 ? "default" : "secondary"}>
                  {stats.activeExtractions} 进行中
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                队列中的待处理任务
              </p>
            </CardContent>
          </Card>

          {/* 缓存使用情况 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">本地缓存大小</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cacheSize.toFixed(1)} MB</div>
              <p className="text-xs text-muted-foreground mt-2">
                IndexedDB + 内存缓存
              </p>
            </CardContent>
          </Card>

          {/* 系统状态 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">系统状态</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {stats.activeExtractions > 0 ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">运行中</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-medium">空闲</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                本地提取系统状态
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 详细统计 */}
      <Card>
        <CardHeader>
          <CardTitle>系统详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                真实缩略图
              </h4>
              <p className="text-2xl font-bold text-green-600">
                {stats.videosWithRealThumbnails}
              </p>
              <p className="text-sm text-muted-foreground">
                已提取真实视频帧的视频数量
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                SVG占位图
              </h4>
              <p className="text-2xl font-bold text-blue-600">
                {stats.videosWithSVGOnly}
              </p>
              <p className="text-sm text-muted-foreground">
                仅使用SVG占位图的视频数量
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                处理中
              </h4>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.activeExtractions}
              </p>
              <p className="text-sm text-muted-foreground">
                正在提取缩略图的视频数量
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>管理操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => {
                console.log('开始批量提取现有视频缩略图')
                // 这里可以调用批量提取功能
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              批量提取现有视频
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                // 清理缓存功能
                console.log('清理本地缓存')
              }}
              className="flex items-center gap-2"
            >
              <HardDrive className="w-4 h-4" />
              清理缓存
            </Button>

            <Button 
              variant="outline"
              onClick={() => {
                // 导出统计报告
                const report = {
                  timestamp: new Date().toISOString(),
                  stats: stats,
                  systemInfo: {
                    userAgent: navigator.userAgent,
                    storage: 'IndexedDB + Memory'
                  }
                }
                console.log('缩略图系统报告:', report)
              }}
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              导出报告
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}