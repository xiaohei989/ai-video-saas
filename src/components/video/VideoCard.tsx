/**
 * 视频卡片组件
 * 显示单个视频的缩略图、标题、操作按钮等
 */

import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { parseTitle } from '@/utils/titleParser'
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
  Lock,
  Info,
  Plus
} from 'lucide-react'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'
import { formatRelativeTime, formatDuration } from '@/utils/timeFormat'
import CachedImage from '@/components/ui/CachedImage'
import VideoDebugInfo from './VideoDebugInfo'
import type { Video, ThumbnailDebugInfo } from '@/types/video.types'
import type { VideoTask } from '@/services/VideoTaskManager'
import type { VideoProgress } from '@/services/progressManager'

interface VideoCardProps {
  video: Video
  // 任务相关
  activeTask?: VideoTask
  videoProgress?: VideoProgress
  currentTime: number
  // 调试信息
  debugInfo?: ThumbnailDebugInfo
  showDebugInfo: boolean
  // 缩略图生成
  isGeneratingThumbnail: boolean
  // 订阅状态
  isPaidUser: boolean
  subscriptionLoading: boolean
  // 事件处理
  onPlay: (video: Video) => void
  onDownload: (video: Video) => void
  onShare: (video: Video) => void
  onDelete: (video: Video) => void
  onRegenerate: (video: Video) => void
  onToggleDebugInfo: (videoId: string) => void
  onCheckCache: (video: Video) => void
  onGenerateThumbnail: (video: Video) => void
}

export function VideoCard({
  video,
  activeTask,
  videoProgress,
  currentTime,
  debugInfo,
  showDebugInfo,
  isGeneratingThumbnail,
  isPaidUser,
  subscriptionLoading,
  onPlay,
  onDownload,
  onShare,
  onDelete,
  onRegenerate,
  onToggleDebugInfo,
  onCheckCache,
  onGenerateThumbnail
}: VideoCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)

  // 解析视频标题
  const { title: parsedTitle, isProcessed: titleIsProcessed } = parseTitle(video.title || '')

  // 处理视频播放
  const handlePlayClick = useCallback(() => {
    onPlay(video)
  }, [video, onPlay])

  // 处理跳转到生成页面
  const handleGoToCreate = useCallback(() => {
    console.log('视频数据:', video) // 调试日志

    // 从 metadata 中获取模板ID（真正的存储位置）
    const templateId = video.metadata?.templateId || video.template_id

    if (!templateId) {
      console.warn('视频没有模板ID，跳转到模板选择页面', {
        videoId: video.id,
        templateId: templateId,
        metadata: video.metadata,
        allKeys: Object.keys(video)
      })

      // 如果没有模板ID，跳转到模板选择页面
      navigate('/templates')
      return
    }

    console.log('使用模板ID:', templateId)

    // 构建跳转URL
    const searchParams = new URLSearchParams()
    searchParams.set('template', templateId)

    // 如果视频有参数，将其编码到URL中
    if (video.parameters) {
      try {
        const encodedParams = encodeURIComponent(JSON.stringify(video.parameters))
        searchParams.set('params', encodedParams)
        console.log('视频参数已编码:', video.parameters)
      } catch (error) {
        console.error('编码视频参数失败:', error)
      }
    }

    const targetUrl = `/create?${searchParams.toString()}`
    console.log('跳转到:', targetUrl)

    // 跳转到生成页面
    navigate(targetUrl)
  }, [video, navigate])

  // 处理预览播放
  const handlePreviewPlay = useCallback(() => {
    setShowVideoPlayer(true)
  }, [])

  // 关闭视频预览
  const handleClosePreview = useCallback(() => {
    setShowVideoPlayer(false)
  }, [])

  // 计算任务耗时
  const getTaskDuration = () => {
    if (!activeTask || !activeTask.createdAt) return ''

    const createdTime = new Date(activeTask.createdAt).getTime()
    const elapsed = Math.floor((currentTime - createdTime) / 1000)

    if (elapsed < 60) return `${elapsed}秒`
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}分${elapsed % 60}秒`
    return `${Math.floor(elapsed / 3600)}小时${Math.floor((elapsed % 3600) / 60)}分钟`
  }

  // 获取进度显示文本
  const getProgressText = () => {
    if (videoProgress) {
      return videoProgress.statusText || '处理中...'
    }
    if (activeTask) {
      return activeTask.statusText || '处理中...'
    }
    return '处理中...'
  }

  // 获取进度百分比
  const getProgressPercentage = () => {
    if (videoProgress?.progress !== undefined) {
      return Math.max(0, Math.min(100, videoProgress.progress))
    }
    if (activeTask?.progress !== undefined) {
      return Math.max(0, Math.min(100, activeTask.progress))
    }
    return 0
  }

  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-0">
        {/* 缩略图区域 */}
        <div className="relative aspect-video bg-muted group">
          {/* 视频播放器（仅在视频完成状态显示，支持悬浮播放） */}
          {video.status === 'completed' && video.video_url ? (
            <ReactVideoPlayer
              videoUrl={video.video_url}
              thumbnailUrl={video.thumbnail_url || video.blur_thumbnail_url || ''}
              lowResPosterUrl={video.blur_thumbnail_url}
              autoplay={false}
              muted={true}
              autoPlayOnHover={true} // 桌面端悬浮自动播放，移动端点击播放
              className="relative z-10 w-full h-full"
              onReady={() => onCheckCache(video)}
            />
          ) : (
            /* 缩略图显示（非完成状态或无视频URL时） */
            <CachedImage
              src={video.thumbnail_url || video.blur_thumbnail_url || ''}
              alt={parsedTitle}
              className="w-full h-full object-cover"
              fastPreview={true}
              placeholderSrc={video.blur_thumbnail_url}
              onLoad={() => onCheckCache(video)}
            />
          )}

          {/* 处理中的进度覆盖 */}
          {(video.status === 'processing' || video.status === 'pending') && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
              <div className="text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                <div className="text-sm font-medium">{getProgressText()}</div>

                {/* 进度条 */}
                <div className="w-32 bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-300"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>

                <div className="text-xs text-gray-300">
                  {getProgressPercentage().toFixed(0)}% • {getTaskDuration()}
                </div>
              </div>
            </div>
          )}

          {/* 失败状态覆盖 */}
          {video.status === 'failed' && (
            <div className="absolute inset-0 bg-red-500/20 flex flex-col items-center justify-center text-white">
              <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
              <div className="text-sm font-medium text-red-500">生成失败</div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-red-500 border-red-500"
                onClick={() => onRegenerate(video)}
              >
                {t('videos.regenerate')}
              </Button>
            </div>
          )}

          {/* 播放按钮覆盖（仅在没有视频URL时显示） */}
          {video.status === 'completed' && !video.video_url && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full"
                onClick={handlePlayClick}
              >
                <Eye className="w-6 h-6 mr-2" />
                播放
              </Button>
            </div>
          )}

          {/* 时长显示 */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formatDuration(video.duration)}
            </div>
          )}

          {/* 缩略图生成按钮 */}
          {!video.thumbnail_url && !isGeneratingThumbnail && (
            <div className="absolute top-2 left-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onGenerateThumbnail(video)}
                className="opacity-80 hover:opacity-100"
              >
                <Plus className="w-4 h-4 mr-1" />
                生成缩略图
              </Button>
            </div>
          )}

          {/* 缩略图生成中 */}
          {isGeneratingThumbnail && (
            <div className="absolute top-2 left-2">
              <div className="flex items-center gap-2 bg-blue-500/90 text-white px-2 py-1 rounded text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                生成中...
              </div>
            </div>
          )}
        </div>

        {/* 视频信息区域 */}
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 min-w-0">
              <h3
                className="text-sm font-medium text-foreground truncate"
                title={video.title || parsedTitle}
              >
                {video.title || parsedTitle}
              </h3>
              {video.description && (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-4">
                  {video.description}
                </div>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between items-center">
            <TooltipProvider>
              <div className="flex gap-1">
                {/* 跳转到生成页面按钮 */}
                {video.status === 'completed' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGoToCreate}
                      >
                        <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('videos.regenerateTitle')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* 下载按钮 */}
                {video.status === 'completed' && (
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
                          <Lock className="w-4 h-4" strokeWidth={1.5} />
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
                )}

                {/* 分享按钮 */}
                {video.status === 'completed' && (
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
                )}

                {/* 删除按钮 */}
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

                {/* 调试信息按钮 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleDebugInfo(video.id)}
                    >
                      <Info className="w-4 h-4" strokeWidth={1.5} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>查看缓存调试信息</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(video.created_at)}
            </div>
          </div>
        </div>

        {/* 调试信息展示 */}
        <VideoDebugInfo
          videoId={video.id}
          debugInfo={debugInfo}
          isVisible={showDebugInfo}
          onToggle={onToggleDebugInfo}
          onCacheCleared={() => onCheckCache(video)}
          onThumbnailRepaired={() => {
            // 缩略图修复完成后，重新检查缓存状态
            onCheckCache(video)
          }}
        />

        {/* 视频预览播放器 */}
        {showVideoPlayer && video.status === 'completed' && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="relative w-full h-full">
              <ReactVideoPlayer
                video={video}
                onClose={handleClosePreview}
                showControls={true}
                autoplay={true}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={handleClosePreview}
              >
                ×
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VideoCard