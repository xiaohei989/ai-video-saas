/**
 * 性能监控仪表板
 * 显示系统性能指标和缓存统计
 */

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
// import cacheIntegrationService from '@/services/CacheIntegrationService'
// import { counterEventProcessor } from '@/services/CounterEventProcessor'

interface PerformanceMetrics {
  cache: {
    connected: boolean
    memory_usage?: string
    pending_counters: number
  }
  counter_processor: {
    isProcessing: boolean
    consumerGroup: string
    consumerName: string
    streamKey: string
  }
  integration: {
    initialized: boolean
  }
  stream_stats?: {
    streamLength: number
    pendingMessages: number
  }
}

const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // 获取性能指标
  const fetchMetrics = async () => {
    try {
      setRefreshing(true)
      setError(null)

      // TODO: 集成真实的性能监控服务
      // const healthStatus = await cacheIntegrationService.getHealthStatus()
      // const streamStats = await counterEventProcessor.getStreamStats()

      const combinedMetrics: PerformanceMetrics = {
        cache: {
          connected: true,
          memory_usage: "68MB",
          pending_counters: 0
        },
        counter_processor: {
          isProcessing: false,
          consumerGroup: "default",
          consumerName: "worker-1",
          streamKey: "counter-events"
        },
        integration: {
          initialized: true
        },
        stream_stats: {
          streamLength: 0,
          pendingMessages: 0
        }
      }

      setMetrics(combinedMetrics)
      console.log('[PERFORMANCE DASHBOARD] 指标更新:', combinedMetrics)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取性能指标失败')
      console.error('[PERFORMANCE DASHBOARD] 获取指标失败:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 手动触发计数器处理
  const triggerCounterProcessing = async () => {
    try {
      // TODO: 实现真实的计数器处理逻辑
      // const result = await counterEventProcessor.triggerManualProcessing()
      toast.success(`模拟处理了 10 个事件`)
      await fetchMetrics() // 刷新指标
    } catch (err) {
      toast.error('手动处理失败: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  // 初始化缓存集成服务
  const initializeCacheService = async () => {
    try {
      setRefreshing(true)
      // TODO: 实现真实的缓存服务初始化
      // await cacheIntegrationService.initialize()
      toast.success('模拟缓存集成服务初始化成功')
      await fetchMetrics()
    } catch (err) {
      toast.error('初始化失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setRefreshing(false)
    }
  }

  // 更新热门模板排行榜
  const updatePopularTemplates = async () => {
    try {
      setRefreshing(true)
      // TODO: 实现真实的热门模板排行榜更新
      // await cacheIntegrationService.updatePopularTemplatesRanking()
      toast.success('模拟热门模板排行榜更新成功')
    } catch (err) {
      toast.error('更新失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setRefreshing(false)
    }
  }

  // 组件挂载时获取指标
  useEffect(() => {
    fetchMetrics()
    
    // 设置定时刷新
    const interval = setInterval(fetchMetrics, 30000) // 30秒刷新一次
    return () => clearInterval(interval)
  }, [])

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载性能指标...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">系统性能监控</h2>
        <div className="flex gap-2">
          <Button 
            onClick={fetchMetrics} 
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            {refreshing ? '刷新中...' : '刷新指标'}
          </Button>
          <Button 
            onClick={initializeCacheService}
            disabled={refreshing}
            size="sm"
          >
            初始化缓存
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          <strong>错误:</strong> {error}
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 缓存服务状态 */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${metrics.cache.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              Redis 缓存服务
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">连接状态:</span>
                <span className={metrics.cache.connected ? 'text-green-600' : 'text-red-600'}>
                  {metrics.cache.connected ? '已连接' : '未连接'}
                </span>
              </div>
              {metrics.cache.memory_usage && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">内存使用:</span>
                  <span>{metrics.cache.memory_usage}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">待处理计数器:</span>
                <span>{metrics.cache.pending_counters}</span>
              </div>
            </div>
          </Card>

          {/* 计数器处理器状态 */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${metrics.counter_processor.isProcessing ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              计数器处理器
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">处理状态:</span>
                <span className={metrics.counter_processor.isProcessing ? 'text-green-600' : 'text-yellow-600'}>
                  {metrics.counter_processor.isProcessing ? '运行中' : '已停止'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">消费者组:</span>
                <span className="text-xs font-mono">{metrics.counter_processor.consumerGroup}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">流键:</span>
                <span className="text-xs font-mono">{metrics.counter_processor.streamKey}</span>
              </div>
            </div>
            <div className="mt-4">
              <Button 
                onClick={triggerCounterProcessing}
                size="sm"
                className="w-full"
                disabled={refreshing}
              >
                手动处理事件
              </Button>
            </div>
          </Card>

          {/* Stream 统计 */}
          {metrics.stream_stats && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">事件流统计</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">流长度:</span>
                  <span>{metrics.stream_stats.streamLength}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">待处理消息:</span>
                  <span className={metrics.stream_stats.pendingMessages > 0 ? 'text-yellow-600' : 'text-green-600'}>
                    {metrics.stream_stats.pendingMessages}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* 集成服务状态 */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${metrics.integration.initialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
              集成服务
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">初始化状态:</span>
                <span className={metrics.integration.initialized ? 'text-green-600' : 'text-red-600'}>
                  {metrics.integration.initialized ? '已初始化' : '未初始化'}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <Button 
                onClick={updatePopularTemplates}
                size="sm"
                className="w-full"
                disabled={refreshing}
              >
                更新热门排行榜
              </Button>
            </div>
          </Card>

          {/* 系统概览 */}
          <Card className="p-6 md:col-span-2 lg:col-span-3">
            <h3 className="text-lg font-semibold mb-4">系统概览</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {metrics.cache.connected ? '🟢' : '🔴'}
                </div>
                <div className="text-sm text-muted-foreground">缓存服务</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {metrics.counter_processor.isProcessing ? '⚡' : '⏸️'}
                </div>
                <div className="text-sm text-muted-foreground">事件处理</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {metrics.stream_stats?.pendingMessages || 0}
                </div>
                <div className="text-sm text-muted-foreground">待处理事件</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {metrics.integration.initialized ? '✅' : '❌'}
                </div>
                <div className="text-sm text-muted-foreground">集成状态</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 操作指南 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">性能优化说明</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>缓存服务:</strong> 提供用户订阅、积分、模板统计等数据的高速缓存</p>
          <p><strong>计数器处理器:</strong> 异步批量处理模板点赞、浏览、使用等统计更新</p>
          <p><strong>事件流:</strong> 使用Redis Stream管理计数器更新事件的可靠传递</p>
          <p><strong>集成服务:</strong> 统一管理缓存层与现有服务的集成</p>
        </div>
      </Card>
    </div>
  )
}

export default PerformanceDashboard