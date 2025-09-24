/**
 * 缓存性能实时图表组件
 * 展示缓存系统的性能趋势和历史数据
 */

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, TrendingDown, Minus, Download, Play, Pause } from 'lucide-react'
import { cachePerformanceTracker, type PerformanceMetrics } from '@/services/cachePerformanceTracker'

interface ChartData {
  timestamps: string[]
  hitRates: string[]
  sizes: string[]
  items: number[]
  categories: { [key: string]: number[] }
}

export function CachePerformanceChart() {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | 'all'>('6h')
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isRecording, setIsRecording] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  // 获取数据
  const fetchData = () => {
    try {
      const data = cachePerformanceTracker.getChartData(timeRange)
      const performanceMetrics = cachePerformanceTracker.getPerformanceMetrics(timeRange)
      
      setChartData(data)
      setMetrics(performanceMetrics)
      
      if (isRecording) {
        drawChart(data)
      }
    } catch (error) {
      console.error('[CacheChart] 获取数据失败:', error)
    }
  }

  // 绘制图表
  const drawChart = (data: ChartData) => {
    const canvas = canvasRef.current
    if (!canvas || !data.hitRates.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置画布大小
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const width = rect.width
    const height = rect.height
    const padding = { top: 20, right: 30, bottom: 30, left: 50 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // 清空画布
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // 绘制网格
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 1

    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (chartWidth / 10) * i
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, height - padding.bottom)
      ctx.stroke()
    }

    // 水平网格线
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
    }

    // 绘制命中率线
    if (data.hitRates.length > 1) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.beginPath()

      data.hitRates.forEach((rate, index) => {
        const x = padding.left + (chartWidth / (data.hitRates.length - 1)) * index
        const y = height - padding.bottom - (parseFloat(rate) / 100) * chartHeight
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()

      // 绘制数据点
      ctx.fillStyle = '#3b82f6'
      data.hitRates.forEach((rate, index) => {
        const x = padding.left + (chartWidth / (data.hitRates.length - 1)) * index
        const y = height - padding.bottom - (parseFloat(rate) / 100) * chartHeight
        
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, 2 * Math.PI)
        ctx.fill()
      })
    }

    // 绘制存储大小线（次坐标轴）
    if (data.sizes.length > 1) {
      const maxSize = Math.max(...data.sizes.map(s => parseFloat(s)))
      
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()

      data.sizes.forEach((size, index) => {
        const x = padding.left + (chartWidth / (data.sizes.length - 1)) * index
        const y = height - padding.bottom - (parseFloat(size) / maxSize) * chartHeight * 0.6
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 绘制坐标轴标签
    ctx.fillStyle = '#666666'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'

    // X轴标签（时间）
    const labelStep = Math.ceil(data.timestamps.length / 6)
    data.timestamps.forEach((timestamp, index) => {
      if (index % labelStep === 0) {
        const x = padding.left + (chartWidth / (data.timestamps.length - 1)) * index
        ctx.fillText(timestamp, x, height - 10)
      }
    })

    // Y轴标签
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i
      const value = (100 - (i * 20)).toString() + '%'
      ctx.fillText(value, padding.left - 10, y + 4)
    }
  }

  // 导出性能报告
  const exportReport = () => {
    const report = cachePerformanceTracker.exportReport()
    const blob = new Blob([report], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cache-performance-report-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 获取趋势图标
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'declining': return <TrendingDown className="w-4 h-4 text-red-600" />
      default: return <Minus className="w-4 h-4 text-gray-600" />
    }
  }

  // 实时更新
  useEffect(() => {
    fetchData()
    
    if (isRecording) {
      const interval = setInterval(fetchData, 5000) // 每5秒更新
      return () => clearInterval(interval)
    }
  }, [timeRange, isRecording])

  // 动画更新
  useEffect(() => {
    if (isRecording && chartData) {
      const animate = () => {
        drawChart(chartData)
        animationRef.current = requestAnimationFrame(animate)
      }
      animationRef.current = requestAnimationFrame(animate)
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [chartData, isRecording])

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>性能趋势图表</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1小时</SelectItem>
                  <SelectItem value="6h">6小时</SelectItem>
                  <SelectItem value="24h">24小时</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRecording(!isRecording)}
              >
                {isRecording ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    开始
                  </>
                )}
              </Button>
              
              <Button variant="outline" size="sm" onClick={exportReport}>
                <Download className="w-4 h-4 mr-2" />
                导出报告
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 图表区域 */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full h-64 border rounded-lg"
              style={{ maxWidth: '100%' }}
            />
            
            {/* 图例 */}
            <div className="absolute top-2 right-2 bg-white bg-opacity-90 p-2 rounded text-xs">
              <div className="flex items-center space-x-1 mb-1">
                <div className="w-3 h-0.5 bg-blue-500"></div>
                <span>命中率 (%)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-green-500" style={{ borderStyle: 'dashed' }}></div>
                <span>存储大小 (MB)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 性能指标 */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getTrendIcon(metrics.trendDirection)}
              <span>性能指标</span>
              <Badge variant={
                metrics.trendDirection === 'improving' ? 'default' : 
                metrics.trendDirection === 'declining' ? 'destructive' : 
                'secondary'
              }>
                {metrics.trendDirection === 'improving' ? '改善中' : 
                 metrics.trendDirection === 'declining' ? '下降中' : 
                 '稳定'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {(metrics.averageHitRate * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">平均命中率</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {(metrics.peakUsage / 1024 / 1024).toFixed(1)}MB
                </p>
                <p className="text-sm text-gray-600">峰值使用量</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {(metrics.compressionEfficiency / 1024 / 1024).toFixed(1)}MB
                </p>
                <p className="text-sm text-gray-600">压缩节省</p>
              </div>
            </div>
            
            {/* 建议 */}
            <div className="space-y-2">
              <h4 className="font-semibold">性能建议:</h4>
              {metrics.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-2 p-2 bg-blue-50 rounded text-sm">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-blue-800">{recommendation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}