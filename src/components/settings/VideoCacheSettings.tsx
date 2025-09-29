/**
 * 视频缓存设置界面
 *
 * 提供用户控制视频缓存的设置选项
 * 包括缓存开关、大小限制、质量选择等
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  HardDrive,
  Download,
  Trash2,
  Settings,
  Wifi,
  Video,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { simpleVideoCacheService, type CacheSettings, type VideoCacheStats } from '@/services/SimpleVideoCacheService'
import { smartPreloadService } from '@/services/SmartVideoPreloadService'

export function VideoCacheSettings() {
  const [settings, setSettings] = useState<CacheSettings>({
    enableVideoCache: true,
    maxCacheSize: 500,
    autoDownloadOnWifi: false,
    cacheQuality: 'high',
    maxVideosToCache: 100
  })

  const [stats, setStats] = useState<VideoCacheStats>({
    totalVideos: 0,
    totalSize: 0,
    hitRate: 0,
    cacheUsage: 0,
    availableSpace: 0
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isClearing, setIsClearing] = useState(false)

  // 加载设置和统计
  useEffect(() => {
    const loadData = async () => {
      try {
        const currentSettings = simpleVideoCacheService.getSettings()
        setSettings(currentSettings)

        const currentStats = await simpleVideoCacheService.getCacheStats()
        setStats(currentStats)
      } catch (error) {
        console.error('加载缓存设置失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // 更新设置
  const updateSettings = (newSettings: Partial<CacheSettings>) => {
    const updatedSettings = { ...settings, ...newSettings }
    setSettings(updatedSettings)
    simpleVideoCacheService.updateSettings(updatedSettings)
  }

  // 清空缓存
  const handleClearCache = async () => {
    setIsClearing(true)
    try {
      await simpleVideoCacheService.clearAllCache()
      // 重新加载统计
      const newStats = await simpleVideoCacheService.getCacheStats()
      setStats(newStats)
    } catch (error) {
      console.error('清空缓存失败:', error)
    } finally {
      setIsClearing(false)
    }
  }

  // 刷新统计数据
  const refreshStats = async () => {
    try {
      const newStats = await simpleVideoCacheService.getCacheStats()
      setStats(newStats)
    } catch (error) {
      console.error('刷新统计失败:', error)
    }
  }

  // 格式化大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">加载设置中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 基本设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            基本设置
          </CardTitle>
          <CardDescription>
            控制视频缓存的基本行为
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 启用缓存 */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">启用视频缓存</div>
              <div className="text-xs text-muted-foreground">
                将视频文件缓存到本地，提升观看体验
              </div>
            </div>
            <Switch
              checked={settings.enableVideoCache}
              onCheckedChange={(checked) => updateSettings({ enableVideoCache: checked })}
            />
          </div>

          {/* WiFi自动下载 */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                WiFi环境自动缓存
              </div>
              <div className="text-xs text-muted-foreground">
                在WiFi环境下自动缓存推荐视频
              </div>
            </div>
            <Switch
              checked={settings.autoDownloadOnWifi}
              onCheckedChange={(checked) => updateSettings({ autoDownloadOnWifi: checked })}
              disabled={!settings.enableVideoCache}
            />
          </div>

          {/* 缓存质量 */}
          <div className="space-y-3">
            <div className="text-sm font-medium">缓存质量</div>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((quality) => (
                <Button
                  key={quality}
                  variant={settings.cacheQuality === quality ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ cacheQuality: quality })}
                  disabled={!settings.enableVideoCache}
                >
                  {quality === 'low' && '低质量'}
                  {quality === 'medium' && '中等质量'}
                  {quality === 'high' && '高质量'}
                </Button>
              ))}
            </div>
          </div>

          {/* 最大缓存大小 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">最大缓存大小</div>
              <Badge variant="secondary">
                {settings.maxCacheSize}MB
              </Badge>
            </div>
            <Slider
              value={[settings.maxCacheSize]}
              onValueChange={([value]) => updateSettings({ maxCacheSize: value })}
              max={2048}
              min={100}
              step={50}
              disabled={!settings.enableVideoCache}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>100MB</span>
              <span>2GB</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 缓存统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            缓存统计
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshStats}
              className="ml-auto"
            >
              刷新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 存储使用情况 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">存储使用情况</div>
              <div className="text-sm text-muted-foreground">
                {formatSize(stats.totalSize)} / {settings.maxCacheSize}MB
              </div>
            </div>
            <Progress
              value={stats.cacheUsage * 100}
              className="w-full"
            />
          </div>

          {/* 统计指标 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center space-y-1">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalVideos}
              </div>
              <div className="text-xs text-muted-foreground">
                已缓存视频
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="text-2xl font-bold text-green-600">
                {(stats.hitRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                缓存命中率
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="text-2xl font-bold text-purple-600">
                {formatSize(stats.totalSize)}
              </div>
              <div className="text-xs text-muted-foreground">
                缓存大小
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="text-2xl font-bold text-orange-600">
                {(stats.availableSpace / 1024).toFixed(1)}GB
              </div>
              <div className="text-xs text-muted-foreground">
                可用空间
              </div>
            </div>
          </div>

          {/* 状态指示 */}
          <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
            {stats.cacheUsage < 0.8 ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <div className="text-sm">
              {stats.cacheUsage < 0.8
                ? '缓存状态良好，有足够的存储空间'
                : '缓存空间即将用完，建议清理旧视频'
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 缓存管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            缓存管理
          </CardTitle>
          <CardDescription>
            管理已缓存的视频文件
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="destructive"
              onClick={handleClearCache}
              disabled={isClearing || stats.totalVideos === 0}
              className="flex items-center gap-2"
            >
              {isClearing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isClearing ? '清理中...' : '清空所有缓存'}
            </Button>

            <div className="text-sm text-muted-foreground self-center">
              这将删除所有已缓存的视频文件，释放存储空间
            </div>
          </div>

          {stats.totalVideos > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-800">
                💡 提示：清理缓存后，视频需要重新下载才能离线观看
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default VideoCacheSettings