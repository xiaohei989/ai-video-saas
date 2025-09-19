/**
 * 性能统计显示组件 - 开发环境专用
 * 实时显示页面加载性能指标，帮助优化移动端体验
 */

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Zap, Database, Clock, Smartphone, Monitor } from 'lucide-react'

interface PerformanceStatsProps {
  metrics: {
    pageLoadStart: number
    firstContentfulPaint: number
    timeToInteractive: number
    cacheHitCount: number
    networkRequestCount: number
    totalLoadTime: number
  }
  isMobile: boolean
  videosCount: number
  loadingState: {
    initial: boolean
    basicLoaded: boolean
    fullLoaded: boolean
  }
}

export default function PerformanceStats({ 
  metrics, 
  isMobile, 
  videosCount, 
  loadingState 
}: PerformanceStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // 性能等级计算
  const getPerformanceGrade = (timeToInteractive: number) => {
    if (timeToInteractive <= 500) return { grade: 'A+', color: 'text-green-600', bgColor: 'bg-green-50' }
    if (timeToInteractive <= 1000) return { grade: 'A', color: 'text-green-500', bgColor: 'bg-green-50' }
    if (timeToInteractive <= 2000) return { grade: 'B', color: 'text-yellow-500', bgColor: 'bg-yellow-50' }
    if (timeToInteractive <= 3000) return { grade: 'C', color: 'text-orange-500', bgColor: 'bg-orange-50' }
    return { grade: 'D', color: 'text-red-500', bgColor: 'bg-red-50' }
  }
  
  const performance = getPerformanceGrade(metrics.timeToInteractive)
  const cacheHitRate = metrics.cacheHitCount + metrics.networkRequestCount > 0 
    ? (metrics.cacheHitCount / (metrics.cacheHitCount + metrics.networkRequestCount) * 100).toFixed(1)
    : '0'

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsExpanded(true)}
          className={`
            ${performance.bgColor} ${performance.color} 
            border-2 border-current rounded-lg p-2 text-xs font-mono
            hover:scale-105 transition-all duration-200
          `}
          variant="outline"
        >
          <Activity className="w-4 h-4 mr-1" />
          {performance.grade} | {metrics.timeToInteractive.toFixed(0)}ms
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 p-4 bg-black/90 text-white font-mono text-xs border-gray-600">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span className="font-semibold">性能监控</span>
            {isMobile ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
          </div>
          <Button
            onClick={() => setIsExpanded(false)}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 h-6 w-6 p-0"
          >
            ✕
          </Button>
        </div>
        
        {/* 性能等级 */}
        <div className={`
          mb-3 p-2 rounded text-center font-bold
          ${performance.bgColor} ${performance.color}
        `}>
          性能等级: {performance.grade}
        </div>
        
        {/* 关键指标 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" />
              可交互时间:
            </span>
            <span className={performance.color}>
              {metrics.timeToInteractive.toFixed(1)}ms
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-400" />
              总加载时间:
            </span>
            <span>{metrics.totalLoadTime.toFixed(1)}ms</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-green-400" />
              缓存命中率:
            </span>
            <span className={metrics.cacheHitCount > 0 ? 'text-green-400' : 'text-orange-400'}>
              {cacheHitRate}%
            </span>
          </div>
          
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>视频数量: {videosCount}</span>
              <span>设备: {isMobile ? '移动端' : '桌面端'}</span>
            </div>
            
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>
                缓存: {metrics.cacheHitCount} | 
                网络: {metrics.networkRequestCount}
              </span>
            </div>
          </div>
          
          {/* 加载状态指示器 */}
          <div className="flex items-center gap-2 text-[10px] mt-2">
            <span>状态:</span>
            <div className={`w-2 h-2 rounded-full ${
              loadingState.fullLoaded ? 'bg-green-400' : 
              loadingState.basicLoaded ? 'bg-yellow-400' : 'bg-red-400'
            }`}></div>
            <span className="text-gray-400">
              {loadingState.fullLoaded ? '完成' : 
               loadingState.basicLoaded ? '基础' : '加载中'}
            </span>
          </div>
        </div>
        
        {/* 性能建议 */}
        {metrics.timeToInteractive > 2000 && (
          <div className="mt-3 p-2 bg-yellow-900/50 rounded text-[10px] text-yellow-300">
            💡 建议: 加载时间过长，检查网络或缓存配置
          </div>
        )}
        
        {cacheHitRate === '0' && metrics.networkRequestCount > 0 && (
          <div className="mt-2 p-2 bg-blue-900/50 rounded text-[10px] text-blue-300">
            💾 提示: 首次访问，缓存正在构建
          </div>
        )}
      </Card>
    </div>
  )
}