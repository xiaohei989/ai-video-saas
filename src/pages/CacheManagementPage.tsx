/**
 * 缓存管理页面
 * 提供缓存系统的监控、管理和调试功能
 */

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, BarChart3, Activity, Database, AlertTriangle, CheckCircle } from '@/components/icons'
import { CachePerformanceMonitor } from '@/components/debug/CachePerformanceMonitor'
import { CachePerformanceChart } from '@/components/debug/CachePerformanceChart'
import { unifiedCache } from '@/services/UnifiedCacheService'
import { templatesCacheService } from '@/services/templatesCacheService'
import { videoCacheService } from '@/services/videoCacheService'

interface SystemStatus {
  unifiedCache: boolean
  templates: boolean
  videos: boolean
  indexedDB: boolean
}

export default function CacheManagementPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    unifiedCache: true,
    templates: true,
    videos: true,
    indexedDB: true
  })

  // 检查系统状态
  const checkSystemStatus = async () => {
    try {
      const status: SystemStatus = {
        unifiedCache: true,
        templates: true,
        videos: true,
        indexedDB: true
      }

      // 检查统一缓存系统
      try {
        const stats = unifiedCache.getGlobalStats()
        status.unifiedCache = stats.summary.idbReady
        status.indexedDB = stats.summary.idbReady
      } catch (error) {
        status.unifiedCache = false
        console.error('统一缓存系统检查失败:', error)
      }

      // 检查模板缓存服务
      try {
        templatesCacheService.getCacheStats()
      } catch (error) {
        status.templates = false
        console.error('模板缓存服务检查失败:', error)
      }

      // 检查视频缓存服务
      try {
        videoCacheService.getCacheStats()
      } catch (error) {
        status.videos = false
        console.error('视频缓存服务检查失败:', error)
      }

      setSystemStatus(status)
    } catch (error) {
      console.error('系统状态检查失败:', error)
    }
  }

  // 重置缓存系统
  const resetCacheSystem = async () => {
    if (confirm('确定要重置整个缓存系统吗？这将清除所有缓存数据并重新初始化系统。')) {
      try {
        await unifiedCache.clearAll()
        await templatesCacheService.clearAllCache()
        
        // 重新检查状态
        await checkSystemStatus()
        
        alert('缓存系统已重置')
      } catch (error) {
        console.error('重置缓存系统失败:', error)
        alert('重置失败，请检查控制台')
      }
    }
  }

  // 运行健康检查
  const runHealthCheck = async () => {
    await checkSystemStatus()
    
    const issues = []
    if (!systemStatus.unifiedCache) issues.push('统一缓存系统')
    if (!systemStatus.templates) issues.push('模板缓存')
    if (!systemStatus.videos) issues.push('视频缓存')
    if (!systemStatus.indexedDB) issues.push('IndexedDB连接')
    
    if (issues.length === 0) {
      alert('✅ 系统健康检查通过！所有服务运行正常。')
    } else {
      alert(`⚠️ 发现以下问题：\n${issues.map(issue => `• ${issue}`).join('\n')}`)
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: boolean) => status ? 'text-green-600' : 'text-red-600'
  const getStatusIcon = (status: boolean) => 
    status ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />

  React.useEffect(() => {
    checkSystemStatus()
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">缓存管理中心</h1>
            <p className="text-gray-600">监控和管理应用缓存系统</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={runHealthCheck}>
            <Activity className="w-4 h-4 mr-2" />
            健康检查
          </Button>
          <Button variant="outline" onClick={checkSystemStatus}>
            刷新状态
          </Button>
          <Button variant="destructive" onClick={resetCacheSystem}>
            <Settings className="w-4 h-4 mr-2" />
            重置系统
          </Button>
        </div>
      </div>

      {/* 系统状态概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>系统状态概览</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              {getStatusIcon(systemStatus.unifiedCache)}
              <div>
                <p className="font-semibold">统一缓存</p>
                <p className={`text-sm ${getStatusColor(systemStatus.unifiedCache)}`}>
                  {systemStatus.unifiedCache ? '运行正常' : '服务异常'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {getStatusIcon(systemStatus.templates)}
              <div>
                <p className="font-semibold">模板缓存</p>
                <p className={`text-sm ${getStatusColor(systemStatus.templates)}`}>
                  {systemStatus.templates ? '运行正常' : '服务异常'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {getStatusIcon(systemStatus.videos)}
              <div>
                <p className="font-semibold">视频缓存</p>
                <p className={`text-sm ${getStatusColor(systemStatus.videos)}`}>
                  {systemStatus.videos ? '运行正常' : '服务异常'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {getStatusIcon(systemStatus.indexedDB)}
              <div>
                <p className="font-semibold">IndexedDB</p>
                <p className={`text-sm ${getStatusColor(systemStatus.indexedDB)}`}>
                  {systemStatus.indexedDB ? '连接正常' : '连接异常'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center space-x-2">
            <Badge variant={
              Object.values(systemStatus).every(status => status) ? 'default' : 'destructive'
            }>
              {Object.values(systemStatus).every(status => status) ? '系统健康' : '存在问题'}
            </Badge>
            <span className="text-sm text-gray-600">
              上次检查: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 功能标签页 */}
      <Tabs defaultValue="monitor" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitor" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>实时监控</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>性能分析</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>设置管理</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="space-y-6">
          <CachePerformanceMonitor />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <CachePerformanceChart />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>缓存配置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-2">图片缓存</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>最大大小:</span>
                          <span className="font-mono">25MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>最大项数:</span>
                          <span className="font-mono">100</span>
                        </div>
                        <div className="flex justify-between">
                          <span>默认TTL:</span>
                          <span className="font-mono">24小时</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-2">模板缓存</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>最大大小:</span>
                          <span className="font-mono">8MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>最大项数:</span>
                          <span className="font-mono">200</span>
                        </div>
                        <div className="flex justify-between">
                          <span>默认TTL:</span>
                          <span className="font-mono">12小时</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-2">视频缓存</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>最大大小:</span>
                          <span className="font-mono">12MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>最大项数:</span>
                          <span className="font-mono">50</span>
                        </div>
                        <div className="flex justify-between">
                          <span>默认TTL:</span>
                          <span className="font-mono">6小时</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-2">用户数据</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>最大大小:</span>
                          <span className="font-mono">5MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>最大项数:</span>
                          <span className="font-mono">200</span>
                        </div>
                        <div className="flex justify-between">
                          <span>默认TTL:</span>
                          <span className="font-mono">2小时</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">环境变量配置</h4>
                  <div className="bg-gray-50 p-3 rounded text-sm font-mono space-y-1">
                    <div>VITE_ENABLE_CACHE = {import.meta.env.VITE_ENABLE_CACHE || 'true'}</div>
                    <div>VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE = {import.meta.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE || 'false'}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}