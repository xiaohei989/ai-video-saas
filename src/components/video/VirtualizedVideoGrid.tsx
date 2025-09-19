/**
 * 虚拟化视频网格组件
 * 支持大量视频高性能渲染，只渲染可见区域的视频卡片
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Download, 
  Share2, 
  Trash2, 
  Eye,
  ArrowRight,
  Loader2,
  AlertCircle,
  Lock
} from 'lucide-react'
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import { getPlayerUrl, getBestVideoUrl } from '@/utils/videoUrlPriority'
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'
import { formatRelativeTime, formatDuration } from '@/utils/timeFormat'
import { useTranslation } from 'react-i18next'
import type { Database } from '@/lib/supabase'
import type { VideoTask } from '@/services/VideoTaskManager'

type Video = Database['public']['Tables']['videos']['Row']

interface VirtualizedVideoGridProps {
  videos: Video[]
  viewMode: 'grid' | 'list'
  isPaidUser: boolean
  subscriptionLoading: boolean
  isMobile: boolean
  getVideoTask: (videoId: string) => VideoTask | null
  getTaskElapsedTime: (task: VideoTask) => number
  onDownload: (video: Video) => void
  onShare: (video: Video) => void
  onDelete: (video: Video) => void
  onRegenerate: (video: Video) => void
  onPlay: (video: Video) => void
  containerWidth?: number
  containerHeight?: number
}

// 计算网格布局参数
const useGridLayout = (containerWidth: number, isMobile: boolean, viewMode: 'grid' | 'list') => {
  return useMemo(() => {
    if (viewMode === 'list') {
      return {
        columns: 1,
        itemWidth: containerWidth - 32, // 留出padding
        itemHeight: 120, // 列表模式较矮
        gap: 16
      }
    }

    // 网格模式
    const gap = isMobile ? 12 : 24
    let columns: number

    if (isMobile) {
      columns = 2
    } else if (containerWidth < 768) {
      columns = 2
    } else if (containerWidth < 1024) {
      columns = 3
    } else if (containerWidth < 1280) {
      columns = 4
    } else {
      columns = 5
    }

    const itemWidth = Math.floor((containerWidth - gap * (columns + 1)) / columns)
    const itemHeight = Math.floor(itemWidth * 0.75) + 100 // 16:9比例 + 内容高度

    return {
      columns,
      itemWidth,
      itemHeight,
      gap
    }
  }, [containerWidth, isMobile, viewMode])
}

// 视频卡片组件
const VideoCard: React.FC<{
  video: Video
  style: React.CSSProperties
  isPaidUser: boolean
  subscriptionLoading: boolean
  isMobile: boolean
  getVideoTask: (videoId: string) => VideoTask | null
  getTaskElapsedTime: (task: VideoTask) => number
  onDownload: (video: Video) => void
  onShare: (video: Video) => void
  onDelete: (video: Video) => void
  onRegenerate: (video: Video) => void
  onPlay: (video: Video) => void
}> = React.memo(({
  video,
  style,
  isPaidUser,
  subscriptionLoading,
  isMobile,
  getVideoTask,
  getTaskElapsedTime,
  onDownload,
  onShare,
  onDelete,
  onRegenerate,
  onPlay
}) => {
  const { t } = useTranslation()
  const task = getVideoTask(video.id)

  return (
    <div style={style} className="p-2">
      <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300">
        <div className="aspect-video relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-600">
          {/* 视频渲染逻辑 */}
          {(video.video_url || video.r2_url) && video.id ? (
            (() => {
              const urlResult = getBestVideoUrl(video)
              const primaryUrl = getPlayerUrl(video) || getProxyVideoUrl(video.video_url || '')
              const fallbackUrl = urlResult?.fallbackUrl ? getProxyVideoUrl(urlResult.fallbackUrl) : undefined
              
              return (
                <SimpleVideoPlayer
                  src={primaryUrl}
                  fallbackSrc={fallbackUrl}
                  poster={video.thumbnail_url || undefined}
                  className="w-full h-full"
                  autoPlayOnHover={!isMobile}
                  showPlayButton={true}
                  muted={false}
                  objectFit="cover"
                  videoId={video.id}
                  videoTitle={video.title || 'video'}
                  alt={video.title || 'Video preview'}
                  onPlay={() => onPlay(video)}
                />
              )
            })()
          ) : task && (task.status === 'processing' || task.status === 'pending') ? (
            // 处理中状态
            <div className="w-full h-full flowing-background flex items-center justify-center">
              <div className="fluid-bubbles"></div>
              <div className="text-center px-4 z-10 relative">
                <Loader2 className="h-8 w-8 animate-spin text-white/90 mx-auto mb-2" strokeWidth={1.5} />
                <div className="text-lg font-bold text-white mb-1">
                  {Math.round(task.progress)}%
                </div>
                <div className="text-xs text-white/80 mb-0.5">
                  {task.statusText}
                </div>
                <div className="text-xs text-white/70 mb-2">
                  {t('videos.elapsedTime')}: {formatDuration(getTaskElapsedTime(task))}
                </div>
                <div className="w-24 bg-white/30 rounded-full h-1 overflow-hidden mx-auto">
                  <div 
                    className="bg-gradient-to-r from-white to-white/80 h-1 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.max(task.progress, 2)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : video.status === 'failed' || task?.status === 'failed' ? (
            // 失败状态
            <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
              <div className="text-center p-4">
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" strokeWidth={1.5} />
                <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                  {t('videos.generationFailed')}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 max-w-xs">
                  {video.error_message || task?.errorMessage || '未知错误'}
                </div>
              </div>
            </div>
          ) : (
            // 默认占位符
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-gray-600 dark:text-gray-300">
                <Eye className="h-10 w-10 mx-auto mb-2" strokeWidth={1.5} />
                <div className="text-sm">{t('videos.waitingForProcessing')}</div>
              </div>
            </div>
          )}
        </div>

        <CardContent className="p-3">
          <div className="space-y-2">
            <div>
              <h3 className="font-medium text-sm line-clamp-2 min-h-[2rem]">
                {video.title || t('videos.untitledVideo')}
              </h3>
              {video.description && (
                <p className="text-xs text-muted-foreground mt-0 line-clamp-2">
                  {video.description}
                </p>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-between items-center">
              <TooltipProvider>
                <div className="flex gap-1">
                  {/* 重新生成按钮 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRegenerate(video)}
                      >
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('videos.regenerateTitle')}</p>
                    </TooltipContent>
                  </Tooltip>

                  {video.video_url && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDownload(video)}
                            disabled={subscriptionLoading}
                          >
                            {subscriptionLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                            ) : isPaidUser ? (
                              <Download className="w-4 h-4" strokeWidth={1.5} />
                            ) : (
                              <Lock className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {subscriptionLoading 
                              ? t('videos.upgradePrompt.checkingSubscription')
                              : isPaidUser 
                                ? t('videos.downloadHD') 
                                : t('videos.upgradeToDownload')
                            }
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onShare(video)}
                          >
                            <Share2 className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('videos.share')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(video)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('videos.delete')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              
              <div className="text-xs text-muted-foreground">
                {formatRelativeTime(video.created_at)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

VideoCard.displayName = 'VideoCard'

// 主组件
export const VirtualizedVideoGrid: React.FC<VirtualizedVideoGridProps> = ({
  videos,
  viewMode,
  isPaidUser,
  subscriptionLoading,
  isMobile,
  getVideoTask,
  getTaskElapsedTime,
  onDownload,
  onShare,
  onDelete,
  onRegenerate,
  onPlay,
  containerWidth = 1200,
  containerHeight = 600
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: containerWidth, height: containerHeight })

  // 响应式容器尺寸监听
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current
        setDimensions({ width: offsetWidth, height: offsetHeight })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const layout = useGridLayout(dimensions.width, isMobile, viewMode)
  
  // 将视频按行分组
  const videoRows = useMemo(() => {
    const rows: Video[][] = []
    for (let i = 0; i < videos.length; i += layout.columns) {
      rows.push(videos.slice(i, i + layout.columns))
    }
    return rows
  }, [videos, layout.columns])

  const rowVirtualizer = useVirtualizer({
    count: videoRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => layout.itemHeight + layout.gap,
    overscan: 5,
  })

  if (videos.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-64 flex items-center justify-center">
        <div className="text-center">
          <Eye className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">没有视频可显示</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-auto"
      style={{ height: containerHeight }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowVideos = videoRows[virtualRow.index]
          if (!rowVideos) return null

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="flex gap-2 px-2">
                {rowVideos.map((video, columnIndex) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    style={{
                      width: layout.itemWidth,
                      height: layout.itemHeight,
                    }}
                    isPaidUser={isPaidUser}
                    subscriptionLoading={subscriptionLoading}
                    isMobile={isMobile}
                    getVideoTask={getVideoTask}
                    getTaskElapsedTime={getTaskElapsedTime}
                    onDownload={onDownload}
                    onShare={onShare}
                    onDelete={onDelete}
                    onRegenerate={onRegenerate}
                    onPlay={onPlay}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VirtualizedVideoGrid