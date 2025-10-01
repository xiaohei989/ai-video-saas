/**
 * 模板页面性能统计显示组件 - 开发环境专用
 * 专为模板页面设计的性能监控面板，监控模板加载、筛选、缓存等性能指标
 */

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Zap, 
  Database, 
  Clock, 
  Smartphone, 
  Monitor,
  Filter,
  Image,
  Video,
  Tags,
  Grid
} from '@/components/icons'

export interface TemplatePerformanceMetrics {
  // 页面加载性能
  pageLoadStart: number
  firstContentfulPaint: number
  timeToInteractive: number
  templateRenderTime: number
  
  // 数据加载性能
  templateLoadTime: number
  likeDataLoadTime: number
  cacheHitCount: number
  networkRequestCount: number
  
  // 用户交互性能
  filterResponseTime: number
  paginationResponseTime: number
  sortResponseTime: number
  tagClickResponseTime: number
  
  // 资源使用统计
  templateCount: number
  loadedImageCount: number
  loadedVideoCount: number
  cacheSize: number
  
  // 分类缓存统计
  imageCacheSize?: number
  videoCacheSize?: number
  imageCacheItems?: number
  videoCacheItems?: number
  
  // 分类缓存命中统计
  categoryHitStats?: {
    image: { hits: number; misses: number; hitRate: number }
    video: { hits: number; misses: number; hitRate: number }
    template: { hits: number; misses: number; hitRate: number }
    api: { hits: number; misses: number; hitRate: number }
    overall: { hits: number; misses: number; hitRate: number }
  }
}

export interface TemplateLoadingState {
  initial: boolean        // 初始骨架状态
  templatesLoaded: boolean // 模板数据已加载
  likesLoaded: boolean    // 点赞数据已加载
  assetsLoaded: boolean   // 图片/视频资源已加载
  fullReady: boolean      // 完全就绪状态
}

interface TemplatePerformanceStatsProps {
  metrics: TemplatePerformanceMetrics
  isMobile: boolean
  loadingState: TemplateLoadingState
  filterStats?: {
    selectedTags: string[]
    sortBy: string
    currentPage: number
    totalPages: number
  }
}

export default function TemplatePerformanceStats({ 
  metrics, 
  isMobile, 
  loadingState,
  filterStats 
}: TemplatePerformanceStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // 性能等级计算 - 针对模板页面优化
  const getPerformanceGrade = (timeToInteractive: number) => {
    if (timeToInteractive <= 300) return { grade: 'A+', color: 'text-green-600', bgColor: 'bg-green-50' }
    if (timeToInteractive <= 600) return { grade: 'A', color: 'text-green-500', bgColor: 'bg-green-50' }
    if (timeToInteractive <= 1000) return { grade: 'B', color: 'text-yellow-500', bgColor: 'bg-yellow-50' }
    if (timeToInteractive <= 1500) return { grade: 'C', color: 'text-orange-500', bgColor: 'bg-orange-50' }
    return { grade: 'D', color: 'text-red-500', bgColor: 'bg-red-50' }
  }
  
  // 缓存效率计算 - 基于实际缓存使用情况
  const getCacheEfficiency = () => {
    // 如果有具体的缓存大小数据，说明缓存在工作
    const hasCacheData = (metrics.cacheSize || 0) > 0
    const hasImageCache = (metrics.imageCacheSize || 0) > 0  
    const hasVideoCache = (metrics.videoCacheSize || 0) > 0
    
    // 如果多级缓存统计可用，优先使用精确统计
    if (metrics.cacheHitCount > 0 || metrics.networkRequestCount > 0) {
      const total = metrics.cacheHitCount + metrics.networkRequestCount
      if (total === 0) return { rate: '0', efficiency: 'N/A', color: 'text-gray-400' }
      
      const rate = (metrics.cacheHitCount / total * 100).toFixed(1)
      const rateNum = parseFloat(rate)
      
      if (rateNum >= 80) return { rate, efficiency: '优秀', color: 'text-green-500' }
      if (rateNum >= 60) return { rate, efficiency: '良好', color: 'text-yellow-500' }
      if (rateNum >= 40) return { rate, efficiency: '一般', color: 'text-orange-500' }
      return { rate, efficiency: '较差', color: 'text-red-500' }
    }
    
    // 降级到基于缓存存在性的估算
    if (hasCacheData) {
      const cacheTypes = [hasImageCache, hasVideoCache].filter(Boolean).length
      if (cacheTypes >= 2) return { rate: '75+', efficiency: '良好', color: 'text-green-500' }
      if (cacheTypes >= 1) return { rate: '50+', efficiency: '一般', color: 'text-yellow-500' }
      return { rate: '25+', efficiency: '较差', color: 'text-orange-500' }
    }
    
    return { rate: '0', efficiency: 'N/A', color: 'text-gray-400' }
  }
  
  // 用户交互性能评估
  const getInteractionPerformance = () => {
    const avgResponseTime = (
      metrics.filterResponseTime + 
      metrics.paginationResponseTime + 
      metrics.sortResponseTime + 
      metrics.tagClickResponseTime
    ) / 4
    
    if (avgResponseTime <= 50) return { level: '极佳', color: 'text-green-500' }
    if (avgResponseTime <= 100) return { level: '良好', color: 'text-yellow-500' }
    if (avgResponseTime <= 200) return { level: '一般', color: 'text-orange-500' }
    return { level: '需优化', color: 'text-red-500' }
  }
  
  const performance = getPerformanceGrade(metrics.timeToInteractive)
  const cacheStats = getCacheEfficiency()
  const interactionStats = getInteractionPerformance()

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
          {performance.grade} | {metrics.timeToInteractive.toFixed(0)}ms | {metrics.templateCount} 模板
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-96 p-4 bg-black/95 text-white font-mono text-xs border-gray-600 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span className="font-semibold">模板页面性能</span>
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
        
        {/* 核心性能指标 */}
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
              模板渲染:
            </span>
            <span>{metrics.templateRenderTime.toFixed(1)}ms</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-green-400" />
              缓存效率:
            </span>
            <span className={cacheStats.color}>
              {cacheStats.rate}% ({cacheStats.efficiency})
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-purple-400" />
              交互性能:
            </span>
            <span className={interactionStats.color}>
              {interactionStats.level}
            </span>
          </div>
        </div>
        
        {/* 详细统计 */}
        <div className="border-t border-gray-600 pt-2 mt-3">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <Grid className="w-2 h-2 text-blue-300" />
              <span>模板: {metrics.templateCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Image className="w-2 h-2 text-green-300" />
              <span>图片: {metrics.imageCacheItems || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Video className="w-2 h-2 text-red-300" />
              <span>视频: {metrics.videoCacheItems || 0}</span>
            </div>
            <div className="flex items-center gap-1" title="总缓存：内存+localStorage+IndexedDB">
              <Database className="w-2 h-2 text-yellow-300" />
              <span>总缓存: {(metrics.cacheSize / 1024).toFixed(1)}KB</span>
            </div>
          </div>
        </div>

        {/* 分类缓存统计 */}
        {(metrics.imageCacheSize !== undefined || metrics.videoCacheSize !== undefined) && (
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className="text-[10px] text-gray-300 mb-1">缓存分类:</div>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <div className="flex items-center gap-1" title="图片缓存：cached_img_、thumb:">
                <Image className="w-2 h-2 text-green-400" />
                <span>图片: {((metrics.imageCacheSize || 0) / 1024).toFixed(1)}KB</span>
                {metrics.imageCacheItems !== undefined && (
                  <span className="text-gray-400">({metrics.imageCacheItems})</span>
                )}
              </div>
              <div className="flex items-center gap-1" title="视频缓存：veo3_video_cache_、video:">
                <Video className="w-2 h-2 text-red-400" />
                <span>视频: {((metrics.videoCacheSize || 0) / 1024).toFixed(1)}KB</span>
                {metrics.videoCacheItems !== undefined && (
                  <span className="text-gray-400">({metrics.videoCacheItems})</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 分类缓存命中率统计 */}
        {metrics.categoryHitStats && (
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className="text-[10px] text-gray-300 mb-1">缓存命中率:</div>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <div className="flex items-center justify-between" title="图片缓存命中率">
                <span className="flex items-center gap-1">
                  <Image className="w-2 h-2 text-green-400" />
                  图片:
                </span>
                <span className={metrics.categoryHitStats.image.hitRate >= 50 ? 'text-green-400' : 'text-yellow-400'}>
                  {metrics.categoryHitStats.image.hitRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between" title="视频缓存命中率">
                <span className="flex items-center gap-1">
                  <Video className="w-2 h-2 text-red-400" />
                  视频:
                </span>
                <span className={metrics.categoryHitStats.video.hitRate >= 50 ? 'text-green-400' : 'text-yellow-400'}>
                  {metrics.categoryHitStats.video.hitRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between" title="模板数据缓存命中率">
                <span className="flex items-center gap-1">
                  <Grid className="w-2 h-2 text-blue-400" />
                  模板:
                </span>
                <span className={metrics.categoryHitStats.template.hitRate >= 50 ? 'text-green-400' : 'text-yellow-400'}>
                  {metrics.categoryHitStats.template.hitRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between" title="API缓存命中率">
                <span className="flex items-center gap-1">
                  <Database className="w-2 h-2 text-purple-400" />
                  API:
                </span>
                <span className={metrics.categoryHitStats.api.hitRate >= 50 ? 'text-green-400' : 'text-yellow-400'}>
                  {metrics.categoryHitStats.api.hitRate.toFixed(1)}%
                </span>
              </div>
            </div>
            
            {/* 总体命中率 */}
            <div className="mt-1 pt-1 border-t border-gray-700">
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1">
                  <Activity className="w-2 h-2 text-orange-400" />
                  总体命中率:
                </span>
                <span className={metrics.categoryHitStats.overall.hitRate >= 60 ? 'text-green-400' : 
                              metrics.categoryHitStats.overall.hitRate >= 30 ? 'text-yellow-400' : 'text-red-400'}>
                  {metrics.categoryHitStats.overall.hitRate.toFixed(1)}%
                </span>
              </div>
              <div className="text-[8px] text-gray-500 mt-0.5">
                命中: {metrics.categoryHitStats.overall.hits} | 未命中: {metrics.categoryHitStats.overall.misses}
              </div>
            </div>
          </div>
        )}
        
        {/* 用户交互性能详情 */}
        <div className="border-t border-gray-600 pt-2 mt-2">
          <div className="text-[10px] text-gray-300 mb-1">交互响应时间:</div>
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            <div>筛选: {metrics.filterResponseTime.toFixed(1)}ms</div>
            <div>分页: {metrics.paginationResponseTime.toFixed(1)}ms</div>
            <div>排序: {metrics.sortResponseTime.toFixed(1)}ms</div>
            <div>标签: {metrics.tagClickResponseTime.toFixed(1)}ms</div>
          </div>
        </div>
        
        {/* 当前筛选状态 */}
        {filterStats && (
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className="text-[10px] text-gray-300 mb-1">当前状态:</div>
            <div className="text-[9px] text-gray-400">
              <div className="flex justify-between">
                <span>排序: {filterStats.sortBy}</span>
                <span>页码: {filterStats.currentPage}/{filterStats.totalPages}</span>
              </div>
              {filterStats.selectedTags.length > 0 && (
                <div className="mt-1">
                  <Tags className="w-2 h-2 inline mr-1" />
                  标签: {filterStats.selectedTags.slice(0, 3).join(', ')}
                  {filterStats.selectedTags.length > 3 && '...'}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 加载状态指示器 */}
        <div className="flex items-center gap-2 text-[10px] mt-2">
          <span>状态:</span>
          <div className="flex gap-1">
            <div className={`w-2 h-2 rounded-full ${
              loadingState.templatesLoaded ? 'bg-green-400' : 'bg-gray-600'
            }`} title="模板数据"></div>
            <div className={`w-2 h-2 rounded-full ${
              loadingState.likesLoaded ? 'bg-green-400' : 'bg-gray-600'
            }`} title="点赞数据"></div>
            <div className={`w-2 h-2 rounded-full ${
              loadingState.assetsLoaded ? 'bg-green-400' : 'bg-gray-600'
            }`} title="资源加载"></div>
            <div className={`w-2 h-2 rounded-full ${
              loadingState.fullReady ? 'bg-green-400' : 'bg-gray-600'
            }`} title="完全就绪"></div>
          </div>
          <span className="text-gray-400">
            {loadingState.fullReady ? '就绪' : 
             loadingState.assetsLoaded ? '资源' :
             loadingState.likesLoaded ? '点赞' : 
             loadingState.templatesLoaded ? '模板' : '加载中'}
          </span>
        </div>
        
        {/* 性能建议 */}
        {metrics.timeToInteractive > 1000 && (
          <div className="mt-3 p-2 bg-yellow-900/50 rounded text-[10px] text-yellow-300">
            💡 建议: 可交互时间过长，考虑优化模板渲染或缓存策略
          </div>
        )}
        
        {cacheStats.rate === '0' && metrics.networkRequestCount > 0 && (
          <div className="mt-2 p-2 bg-blue-900/50 rounded text-[10px] text-blue-300">
            💾 提示: 首次访问，缓存正在构建中
          </div>
        )}
        
        {parseFloat(cacheStats.rate) < 40 && metrics.networkRequestCount > 5 && (
          <div className="mt-2 p-2 bg-orange-900/50 rounded text-[10px] text-orange-300">
            ⚠️ 警告: 缓存命中率偏低，可能影响性能
          </div>
        )}
        
        {metrics.templateCount > 50 && metrics.templateRenderTime > 500 && (
          <div className="mt-2 p-2 bg-purple-900/50 rounded text-[10px] text-purple-300">
            🚀 建议: 模板数量较多，考虑实现虚拟滚动或分页优化
          </div>
        )}
      </Card>
    </div>
  )
}