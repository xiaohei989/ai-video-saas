/**
 * 全局视频播放状态调试面板
 * 开发环境显示当前播放状态、性能监控等信息
 */

import React, { useState, useEffect } from 'react'
import { useVideoPlaybackDebug, VideoPlaybackPerformanceMonitor } from '@/contexts/VideoPlaybackContext'

export default function VideoPlaybackDebugPanel() {
  // 生产环境不显示
  if (import.meta.env.PROD) return null
  
  const debug = useVideoPlaybackDebug()
  const [isExpanded, setIsExpanded] = useState(false)
  const [metrics, setMetrics] = useState(VideoPlaybackPerformanceMonitor.getMetrics())
  
  // 每秒更新一次性能指标
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(VideoPlaybackPerformanceMonitor.getMetrics())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  const debugInfo = debug.getDebugInfo()
  
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/90 text-white text-xs font-mono rounded-lg shadow-lg border border-gray-600">
      {/* 标题栏 */}
      <div 
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-white/10 rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>视频播放调试</span>
        </div>
        <div className="text-xs opacity-70">
          {isExpanded ? '🔽' : '🔼'}
        </div>
      </div>
      
      {/* 详细信息 */}
      {isExpanded && (
        <div className="p-3 border-t border-gray-600 space-y-3">
          {/* 当前播放状态 */}
          <div>
            <div className="text-yellow-400 mb-1">📺 播放状态</div>
            <div>当前播放: {debugInfo.currentPlayingId ? 
              `🎬 ${debugInfo.currentPlayingId.slice(-8)}` : 
              '⏸️ 无'
            }</div>
            <div>注册播放器: {debugInfo.registeredPlayerCount}个</div>
          </div>
          
          {/* 性能监控 */}
          <div>
            <div className="text-blue-400 mb-1">⚡ 性能监控</div>
            <div>播放请求: {metrics.playRequestCount}次</div>
            <div>成功率: {debugInfo.successRate.toFixed(1)}%</div>
            <div>平均切换: {metrics.averagePlaySwitchTime.toFixed(1)}ms</div>
            <div>互斥等待: {metrics.mutexWaitCount}次</div>
          </div>
          
          {/* 最近播放历史 */}
          <div>
            <div className="text-purple-400 mb-1">📜 最近播放</div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {metrics.playRequestHistory.slice(-5).reverse().map((record, index) => (
                <div key={index} className="text-xs opacity-80">
                  {record.success ? '✅' : '❌'} {record.playerId.slice(-8)} 
                  {record.duration !== undefined && ` (${record.duration.toFixed(1)}ms)`}
                </div>
              ))}
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2 border-t border-gray-600">
            <button
              onClick={() => debug.pauseAll()}
              className="px-2 py-1 bg-red-600/80 hover:bg-red-600 rounded text-xs"
            >
              暂停所有
            </button>
            <button
              onClick={() => debug.immediateStopAll()}
              className="px-2 py-1 bg-orange-600/80 hover:bg-orange-600 rounded text-xs"
            >
              立即停止
            </button>
            <button
              onClick={() => debug.performanceMonitor.reset()}
              className="px-2 py-1 bg-gray-600/80 hover:bg-gray-600 rounded text-xs"
            >
              重置统计
            </button>
          </div>
        </div>
      )}
    </div>
  )
}