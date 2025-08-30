/**
 * 虚拟滚动视频列表组件
 * 
 * 功能：
 * 1. 使用虚拟滚动优化大量视频列表的性能
 * 2. 支持网格和列表两种布局
 * 3. 集成懒加载视频播放器
 * 4. 自适应列数和项目大小
 * 5. 预加载策略优化
 * 6. 响应式设计
 */

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import LazyVideoPlayer from './LazyVideoPlayer'
import { cn } from '@/utils/cn'
import { useSimpleNetworkQuality } from '@/hooks/useNetworkQuality'
import { useBatchLazyLoad } from '@/hooks/useVideoLazyLoad'

export interface VideoItem {
  id: string
  video_url: string
  thumbnail_url?: string
  title?: string
  description?: string
  status?: 'completed' | 'processing' | 'failed'
  created_at: string
  [key: string]: any // 允许额外的属性
}

export interface VirtualVideoListProps<T extends VideoItem = VideoItem> {
  // 数据
  videos: T[]
  
  // 布局选项
  layout?: 'grid' | 'list'
  columns?: number | 'auto' // 网格列数，'auto'表示自适应
  itemHeight?: number // 列表模式下的项目高度
  gap?: number // 项目间距
  
  // 容器样式
  className?: string
  height?: string | number // 容器高度
  
  // 性能选项
  overscan?: number // 预渲染的项目数量
  estimateSize?: (index: number) => number // 自定义尺寸估算
  enableVirtualization?: boolean // 是否启用虚拟化
  
  // 渲染自定义
  renderItem?: (video: T, index: number) => React.ReactNode
  renderEmpty?: () => React.ReactNode
  renderLoading?: () => React.ReactNode
  
  // 交互事件
  onVideoClick?: (video: T, index: number) => void
  onVideoPlay?: (video: T, index: number) => void
  onLoadMore?: () => void
  
  // 加载状态
  isLoading?: boolean
  hasNextPage?: boolean
  
  // 懒加载选项
  enableLazyLoad?: boolean
  preloadCount?: number // 预加载数量
}

const VirtualVideoList = <T extends VideoItem = VideoItem>({
  videos,
  layout = 'grid',
  columns = 'auto',
  itemHeight = 300,
  gap = 16,
  className,
  height = 600,
  overscan = 5,
  estimateSize,
  enableVirtualization = true,
  renderItem,
  renderEmpty,
  renderLoading,
  onVideoClick,
  onVideoPlay,
  onLoadMore,
  isLoading = false,
  hasNextPage = false,
  enableLazyLoad = true,
  preloadCount = 3,
  ...props
}: VirtualVideoListProps<T>) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const networkQuality = useSimpleNetworkQuality()

  // 批量懒加载管理
  const videoUrls = useMemo(() => videos.map(v => v.video_url).filter(Boolean), [videos])
  const batchLazyLoad = useBatchLazyLoad(videoUrls, {
    enableThumbnailCache: true,
    thumbnailQuality: networkQuality.isSlowConnection ? 'low' : 'medium'
  })

  // 监听容器尺寸变化
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateSize()
    const resizeObserver = new ResizeObserver(updateSize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  // 计算网格布局参数
  const gridConfig = useMemo(() => {
    if (layout === 'list') {
      return { columns: 1, itemWidth: containerWidth, itemHeight }
    }

    let columnCount: number
    if (columns === 'auto') {
      // 自适应列数
      const minItemWidth = 280 // 最小项目宽度
      columnCount = Math.max(1, Math.floor((containerWidth + gap) / (minItemWidth + gap)))
    } else {
      columnCount = columns
    }

    const itemWidth = (containerWidth - gap * (columnCount - 1)) / columnCount
    const aspectRatio = 16 / 9 // 视频宽高比
    const calculatedItemHeight = itemWidth / aspectRatio + 120 // 额外高度用于标题等内容

    return {
      columns: columnCount,
      itemWidth,
      itemHeight: calculatedItemHeight
    }
  }, [layout, columns, containerWidth, gap, itemHeight])

  // 虚拟化配置
  const getItemSize = useCallback((index: number) => {
    if (estimateSize) {
      return estimateSize(index)
    }
    return gridConfig.itemHeight
  }, [estimateSize, gridConfig.itemHeight])

  // 创建虚拟化器
  const virtualizer = useVirtualizer({
    count: Math.ceil(videos.length / gridConfig.columns),
    getScrollElement: () => containerRef.current,
    estimateSize: getItemSize,
    overscan,
    paddingStart: gap,
    paddingEnd: gap
  })

  // 处理视频点击
  const handleVideoClick = useCallback((video: T, index: number) => {
    batchLazyLoad.markVisible(video.video_url)
    onVideoClick?.(video, index)
  }, [batchLazyLoad, onVideoClick])

  // 处理视频播放
  const handleVideoPlay = useCallback((video: T, index: number) => {
    onVideoPlay?.(video, index)
  }, [onVideoPlay])

  // 渲染单个视频项目
  const renderVideoItem = useCallback((video: T, itemIndex: number) => {
    if (renderItem) {
      return renderItem(video, itemIndex)
    }

    // 默认渲染
    return (
      <Card 
        key={video.id}
        className="overflow-hidden hover:shadow-lg transition-all duration-300"
        style={{ 
          width: gridConfig.itemWidth,
          minHeight: layout === 'list' ? itemHeight : 'auto'
        }}
      >
        <div 
          className="aspect-video relative cursor-pointer"
          onClick={() => handleVideoClick(video, itemIndex)}
        >
          <LazyVideoPlayer
            src={video.video_url}
            poster={video.thumbnail_url}
            className="w-full h-full"
            alt={video.title}
            enableLazyLoad={enableLazyLoad}
            enableThumbnailCache={true}
            enableNetworkAdaptive={false}
            onVisibilityChange={(isVisible) => {
              if (isVisible) {
                batchLazyLoad.markVisible(video.video_url)
              } else {
                batchLazyLoad.markHidden(video.video_url)
              }
            }}
          />
          
          {/* 状态标识 */}
          {video.status === 'processing' && (
            <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
              {t('videoCreator.processing')}
            </div>
          )}
          {video.status === 'failed' && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
              {t('videoCreator.failed')}
            </div>
          )}
        </div>
        
        <CardContent className="p-4">
          <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] mb-2">
            {video.title || t('video.untitled')}
          </h3>
          
          {video.description && layout !== 'list' && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {video.description}
            </p>
          )}
          
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>
              {new Date(video.created_at).toLocaleDateString()}
            </span>
            
            {video.status === 'completed' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleVideoPlay(video, itemIndex)
                }}
                className="h-6 text-xs"
              >
                {t('video.play')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }, [
    renderItem,
    gridConfig.itemWidth,
    layout,
    itemHeight,
    handleVideoClick,
    enableLazyLoad,
    batchLazyLoad,
    handleVideoPlay
  ])

  // 渲染虚拟行
  const renderVirtualRow = useCallback((virtualRow: any) => {
    const startIndex = virtualRow.index * gridConfig.columns
    const endIndex = Math.min(startIndex + gridConfig.columns, videos.length)
    const rowVideos = videos.slice(startIndex, endIndex)

    return (
      <div
        key={virtualRow.index}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`
        }}
      >
        <div 
          className="flex gap-4 px-4"
          style={{ gap: `${gap}px` }}
        >
          {rowVideos.map((video, index) => 
            renderVideoItem(video, startIndex + index)
          )}
          
          {/* 填充空白项 */}
          {rowVideos.length < gridConfig.columns && 
            Array.from({ length: gridConfig.columns - rowVideos.length }).map((_, index) => (
              <div 
                key={`empty-${index}`}
                style={{ width: gridConfig.itemWidth }}
              />
            ))
          }
        </div>
      </div>
    )
  }, [videos, gridConfig, gap, renderVideoItem])

  // 渲染加载状态
  const renderLoadingState = () => {
    if (renderLoading) {
      return renderLoading()
    }

    return (
      <div className="grid gap-4 p-4" style={{
        gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)`,
        gap: `${gap}px`
      }}>
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <Skeleton className="aspect-video w-full" />
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // 渲染空状态
  const renderEmptyState = () => {
    if (renderEmpty) {
      return renderEmpty()
    }

    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="14" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2">{t('video.noVideos')}</h3>
        <p className="text-sm text-center max-w-sm">
          {t('video.noVideosDescription')}
        </p>
      </div>
    )
  }

  // 加载状态
  if (isLoading && videos.length === 0) {
    return (
      <div ref={containerRef} className={cn("w-full", className)}>
        {renderLoadingState()}
      </div>
    )
  }

  // 空状态
  if (videos.length === 0) {
    return (
      <div ref={containerRef} className={cn("w-full", className)}>
        {renderEmptyState()}
      </div>
    )
  }

  // 非虚拟化渲染（用于较少的项目）
  if (!enableVirtualization || videos.length < 20) {
    return (
      <div ref={containerRef} className={cn("w-full", className)}>
        <div 
          className="grid gap-4 p-4"
          style={{
            gridTemplateColumns: layout === 'list' 
              ? '1fr' 
              : `repeat(${gridConfig.columns}, 1fr)`,
            gap: `${gap}px`
          }}
        >
          {videos.map((video, index) => renderVideoItem(video, index))}
        </div>
        
        {/* 加载更多 */}
        {isLoading && (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        
        {hasNextPage && !isLoading && onLoadMore && (
          <div className="flex justify-center p-4">
            <Button onClick={onLoadMore} variant="outline">
              {t('common.loadMore')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // 虚拟化渲染
  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-auto", className)}
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height 
      }}
      {...props}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(renderVirtualRow)}
      </div>
      
      {/* 加载更多触发器 */}
      {hasNextPage && !isLoading && onLoadMore && (
        <div className="flex justify-center p-4">
          <Button onClick={onLoadMore} variant="outline">
            {t('common.loadMore')}
          </Button>
        </div>
      )}
      
      {isLoading && (
        <div className="flex justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  )
}

/**
 * 简化版虚拟视频列表
 */
export const SimpleVirtualVideoList = <T extends VideoItem = VideoItem>({
  videos,
  onVideoClick,
  className,
  height = 600
}: {
  videos: T[]
  onVideoClick?: (video: T) => void
  className?: string
  height?: string | number
}) => {
  return (
    <VirtualVideoList
      videos={videos}
      layout="grid"
      columns="auto"
      className={className}
      height={height}
      onVideoClick={onVideoClick}
      enableVirtualization={videos.length >= 20}
    />
  )
}

export default VirtualVideoList