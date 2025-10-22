/**
 * 视频卡片组件
 * 显示单个视频的缩略图、标题、操作按钮等
 */

import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'
import { parseTitle, parseDescription } from '@/utils/titleParser'
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
} from '@/components/icons'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'
import { formatRelativeTime, formatDuration } from '@/utils/timeFormat'
import CachedImage from '@/components/ui/CachedImage'
import VideoDebugInfo from './VideoDebugInfo'
import { simpleTemplatePreload } from '@/services/simpleTemplatePreload'
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
  thumbnailDebugInfo?: ThumbnailDebugInfo
  videoDebugInfo?: ThumbnailDebugInfo
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
  thumbnailDebugInfo,
  videoDebugInfo,
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
  const { t, i18n } = useTranslation()
  const { navigateTo } = useLanguageRouter()
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)

  // 从环境变量读取是否显示调试信息按钮
  const showDebugButton = import.meta.env.VITE_SHOW_VIDEO_DEBUG_INFO === 'true'

  // 解析视频标题和描述（支持多语言JSON格式）
  const currentLocale = i18n.language.split('-')[0] // zh-CN -> zh
  const parsedTitle = parseTitle(video.title || '', currentLocale, t('videos.untitled'))
  const parsedDescription = parseDescription(video.description || '', currentLocale, '')

  // 🐛 调试：检查缩略图状态
  React.useEffect(() => {
    if (video.status === 'completed' && video.video_url) {
      console.log('[VideoCard] 🐛 缩略图状态检查:', {
        videoId: video.id,
        status: video.status,
        hasVideoUrl: !!video.video_url,
        hasThumbnailUrl: !!video.thumbnail_url,
        thumbnailUrlLength: video.thumbnail_url?.length || 0,
        thumbnailUrlPrefix: video.thumbnail_url?.substring(0, 50),
        isSvgThumbnail: video.thumbnail_url?.includes('data:image/svg'),
        hasBlurUrl: !!video.thumbnail_blur_url,
        _frontendGenerated: video._frontendGenerated,
        shouldShowGenerating: (
          video.status === 'completed' &&
          video.video_url &&
          (!video.thumbnail_url || video.thumbnail_url.includes('data:image/svg')) &&
          !video.thumbnail_blur_url
        )
      })
    }
  }, [video.id, video.status, video.video_url, video.thumbnail_url, video.thumbnail_blur_url])

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

      // 如果没有模板ID，跳转到模板选择页面(保留语言前缀)
      navigateTo('/templates')
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
    navigateTo(targetUrl)
  }, [video, navigateTo])

  // 处理预览播放
  const handlePreviewPlay = useCallback(() => {
    setShowVideoPlayer(true)
  }, [])

  // 关闭视频预览
  const handleClosePreview = useCallback(() => {
    setShowVideoPlayer(false)
  }, [])

  // 缓存URL状态
  const [actualVideoUrl, setActualVideoUrl] = useState(video.video_url)

  // 同步 video.video_url 的变化
  React.useEffect(() => {
    if (video.video_url && video.video_url !== actualVideoUrl) {
      setActualVideoUrl(video.video_url)
    }
  }, [video.video_url])

  // 获取视频宽高比（用于布局调整）- 使用 useMemo 避免不必要的重新渲染
  // 🎯 关键优化:确保 aspectRatio 在首次渲染时就是正确的值,避免从默认值变化导致的布局跳变
  const aspectRatio = React.useMemo(() => {
    // 优先从 parameters 获取,其次从 metadata
    const ratio = video.parameters?.aspectRatio || video.metadata?.aspectRatio
    // 如果都没有,使用16:9作为默认值(但这种情况应该很少见)
    return ratio || '16:9'
  }, [video.parameters?.aspectRatio, video.metadata?.aspectRatio])

  // 判断是否为竖屏视频
  const isPortrait = aspectRatio === '9:16'


  // 鼠标悬停预加载（类似模板页面的实现）
  const handleMouseEnter = useCallback(async () => {
    // 🚀 鼠标悬停时触发预加载，获取正确的URL
    if (video.video_url) {
      console.log(`[VideoCard] 🎯 悬浮触发视频缓存: ${video.id}`)
      const urlToUse = await simpleTemplatePreload.preloadOnHover(video.id, video.video_url)
      setActualVideoUrl(urlToUse) // 使用返回的URL（可能是缓存URL）
    }
  }, [video.id, video.video_url])

  // 移动端触摸/点击缓存（为移动端提供缓存机会）
  const handleTouchStart = useCallback(async () => {
    // 📱 移动端首次触摸时触发缓存
    if (video.video_url) {
      console.log(`[VideoCard] 📱 移动端触摸触发视频缓存: ${video.id}`)
      const urlToUse = await simpleTemplatePreload.preloadOnHover(video.id, video.video_url)
      setActualVideoUrl(urlToUse) // 使用返回的URL（可能是缓存URL）
    }
  }, [video.id, video.video_url])

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
    <Card
      className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-200"
      data-aspect-ratio={aspectRatio}
    >
      <CardContent className="p-0">
        {/* 9:16视频：两层布局 - 上层(预览+按钮)，下层(标题+描述) */}
        {isPortrait ? (
          <div className="flex flex-col">
            {/* 上层：预览+按钮横向布局 */}
            <div className="flex p-4 gap-2">
              {/* 左侧预览区域 */}
              <div
                className="relative flex-shrink-0 w-[85%] bg-muted rounded-lg overflow-hidden"
                style={{ aspectRatio: '9/16' }}
                onMouseEnter={handleMouseEnter}
                onTouchStart={handleTouchStart}
              >
                {/* 视频播放器（仅在视频完成状态显示，支持悬浮播放） */}
                {video.status === 'completed' && video.video_url ? (
                  <ReactVideoPlayer
                    videoUrl={actualVideoUrl}
                    thumbnailUrl={video.thumbnail_url || video.thumbnail_blur_url || ''}
                    lowResPosterUrl={video.thumbnail_blur_url}
                    videoId={video.id}
                    autoplay={false}
                    muted={true}
                    autoPlayOnHover={true} // 桌面端悬浮自动播放，移动端点击播放
                    className="relative z-10 w-full h-full"
                    onReady={() => onCheckCache(video)}
                  />
                ) : (
                  /* 缩略图显示（非完成状态或无视频URL时） */
                  <CachedImage
                    src={video.thumbnail_url || video.thumbnail_blur_url || ''}
                    alt={parsedTitle}
                    className="w-full h-full object-cover"
                    fastPreview={true}
                    placeholderSrc={video.thumbnail_blur_url}
                    onLoad={() => onCheckCache(video)}
                  />
                )}

                {/* 🆕 缩略图生成中状态 - 仅在视频完成但完全没有缩略图时显示 */}
                {video.status === 'completed' &&
                 video.video_url &&
                 (!video.thumbnail_url || video.thumbnail_url.includes('data:image/svg')) &&
                 !video.thumbnail_blur_url && ( // 没有任何缩略图（包括模糊图）
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 flex flex-col items-center justify-center text-white z-10 overflow-hidden">
                    {/* 多彩流光动画背景层 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent -skew-x-12 animate-[shimmer_2s_ease-in-out_infinite]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/15 to-transparent -skew-x-12 animate-[shimmer_2.5s_ease-in-out_infinite_0.3s]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-500/10 to-transparent -skew-x-12 animate-[shimmer_3s_ease-in-out_infinite_0.6s]" />

                    {/* 动态光点效果 */}
                    <div className="absolute top-1/4 left-1/4 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

                    <div className="text-center space-y-2 relative z-10">
                      {/* 旋转加载图标 - 添加光晕效果 */}
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse" />
                        <Loader2 className="w-8 h-8 animate-spin mx-auto relative z-10" />
                      </div>

                      {/* 提示文字 */}
                      <div className="text-xs font-medium bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {t('videos.generatingThumbnail')}
                      </div>
                    </div>
                  </div>
                )}

                {/* 处理中的进度覆盖 - 只有当确实有活跃任务或进度信息时才显示 */}
                {(video.status === 'processing' || video.status === 'pending') &&
                 (activeTask || videoProgress) &&
                 !(video.status === 'completed' && video.video_url) && // 如果已完成且有视频URL，不显示进度
                 getProgressPercentage() < 100 && ( // 进度达到100%时不显示
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 flex flex-col items-center justify-center text-white z-10 overflow-hidden">
                    {/* 多彩流光动画背景层 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent -skew-x-12 animate-[shimmer_2s_ease-in-out_infinite]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/15 to-transparent -skew-x-12 animate-[shimmer_2.5s_ease-in-out_infinite_0.3s]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-500/10 to-transparent -skew-x-12 animate-[shimmer_3s_ease-in-out_infinite_0.6s]" />

                    {/* 动态光点效果 */}
                    <div className="absolute top-1/4 left-1/4 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

                    <div className="text-center space-y-2 relative z-10">
                      {/* 旋转加载图标 - 添加光晕效果 */}
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse" />
                        <Loader2 className="w-8 h-8 animate-spin mx-auto relative z-10" />
                      </div>

                      {/* 渐变进度条 */}
                      <div className="w-32 bg-white/20 rounded-full h-2 overflow-hidden relative">
                        <div
                          className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full h-2 transition-all duration-300 relative"
                          style={{ width: `${getProgressPercentage()}%` }}
                        >
                          {/* 进度条流光效果 */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1s_ease-in-out_infinite]" />
                        </div>
                      </div>

                      {/* 百分比显示 - 添加渐变文字 */}
                      <div className="text-sm font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {getProgressPercentage().toFixed(0)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* 失败状态覆盖 */}
                {video.status === 'failed' && (
                  <div className="absolute inset-0 bg-red-500/20 flex flex-col items-center justify-center text-white px-2">
                    <AlertCircle className="w-6 h-6 text-red-500 mb-2" />
                    <div className="text-xs font-medium text-red-500 mb-1">{t('videos.generationFailed')}</div>
                    {video.error_message && (
                      <div className="text-[10px] text-red-400 text-center mb-2 max-w-[90%] line-clamp-3">
                        {video.error_message}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 text-red-500 border-red-500"
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
                      size="sm"
                      className="rounded-full"
                      onClick={handlePlayClick}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* 时长显示 */}
                {video.duration && (
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </div>
                )}
              </div>

              {/* 右侧按钮区域 - 垂直排列，仅图标 */}
              <div className="flex flex-col justify-between flex-1">
                {/* 按钮组 */}
                <div className="flex flex-col gap-1.5">
                  <TooltipProvider>
                    {/* 跳转到生成页面按钮 */}
                    {video.status === 'completed' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGoToCreate}
                            className="w-full"
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
                            className="w-full"
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
                            className="w-full"
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
                          className="w-full"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('videos.delete')}</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* 调试信息按钮 - 根据环境变量控制显示 */}
                    {showDebugButton && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleDebugInfo(video.id)}
                            className="w-full"
                          >
                            <Info className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>查看视频缓存调试信息</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TooltipProvider>
                </div>

                {/* 生成时间 - 显示在按钮下方 */}
                <div className="text-xs text-muted-foreground text-center mt-2">
                  {formatRelativeTime(video.created_at)}
                </div>
              </div>
            </div>

            {/* 下层：标题和描述 - 标题单行，描述4行 */}
            <div className="px-4 pb-4 pt-2 flex-shrink-0">
              <h3
                className="font-medium text-foreground mb-2 truncate"
                style={{
                  fontSize: `clamp(0.75rem, ${Math.max(0.75, 0.875 - parsedTitle.length / 100)}rem, 0.875rem)`
                }}
                title={parsedTitle}
              >
                {parsedTitle}
              </h3>
              {parsedDescription && (
                <div
                  className="text-muted-foreground line-clamp-4 leading-relaxed"
                  style={{
                    fontSize: `clamp(0.625rem, ${Math.max(0.625, 0.75 - parsedDescription.length / 150)}rem, 0.75rem)`
                  }}
                  title={parsedDescription}
                >
                  {parsedDescription}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 16:9视频：原有布局 */
          <div>
            {/* 预览区域 */}
            <div
              className="relative bg-muted"
              style={{ aspectRatio: '16/9' }}
              onMouseEnter={handleMouseEnter}
              onTouchStart={handleTouchStart}
            >
              {/* 视频播放器（仅在视频完成状态显示，支持悬浮播放） */}
              {video.status === 'completed' && video.video_url ? (
                <ReactVideoPlayer
                  videoUrl={actualVideoUrl}
                  thumbnailUrl={video.thumbnail_url || video.thumbnail_blur_url || ''}
                  lowResPosterUrl={video.thumbnail_blur_url}
                  videoId={video.id}
                  autoplay={false}
                  muted={true}
                  autoPlayOnHover={true}
                  className="relative z-10 w-full h-full"
                  onReady={() => onCheckCache(video)}
                />
              ) : (
                <CachedImage
                  src={video.thumbnail_url || video.thumbnail_blur_url || ''}
                  alt={parsedTitle}
                  className="w-full h-full object-cover"
                  fastPreview={true}
                  placeholderSrc={video.thumbnail_blur_url}
                  onLoad={() => onCheckCache(video)}
                />
              )}

              {/* 🆕 缩略图生成中状态 */}
              {video.status === 'completed' &&
               video.video_url &&
               (!video.thumbnail_url || video.thumbnail_url.includes('data:image/svg')) &&
               !video.thumbnail_blur_url && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 flex flex-col items-center justify-center text-white z-10 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent -skew-x-12 animate-[shimmer_2s_ease-in-out_infinite]" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/15 to-transparent -skew-x-12 animate-[shimmer_2.5s_ease-in-out_infinite_0.3s]" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-500/10 to-transparent -skew-x-12 animate-[shimmer_3s_ease-in-out_infinite_0.6s]" />
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                  <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                  <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <div className="text-center space-y-3 relative z-10">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse" />
                      <Loader2 className="w-12 h-12 animate-spin mx-auto relative z-10" />
                    </div>
                    <div className="text-sm font-medium bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {t('videos.generatingThumbnail')}
                    </div>
                  </div>
                </div>
              )}

              {/* 处理中的进度覆盖 */}
              {(video.status === 'processing' || video.status === 'pending') &&
               (activeTask || videoProgress) &&
               !(video.status === 'completed' && video.video_url) &&
               getProgressPercentage() < 100 && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 flex flex-col items-center justify-center text-white z-10 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent -skew-x-12 animate-[shimmer_2s_ease-in-out_infinite]" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/15 to-transparent -skew-x-12 animate-[shimmer_2.5s_ease-in-out_infinite_0.3s]" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-500/10 to-transparent -skew-x-12 animate-[shimmer_3s_ease-in-out_infinite_0.6s]" />
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                  <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                  <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <div className="text-center space-y-3 relative z-10">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-50 animate-pulse" />
                      <Loader2 className="w-12 h-12 animate-spin mx-auto relative z-10" />
                    </div>
                    <div className="w-40 bg-white/20 rounded-full h-2.5 overflow-hidden relative">
                      <div
                        className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full h-2.5 transition-all duration-300 relative"
                        style={{ width: `${getProgressPercentage()}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1s_ease-in-out_infinite]" />
                      </div>
                    </div>
                    <div className="text-base font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {getProgressPercentage().toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}

              {/* 失败状态覆盖 */}
              {video.status === 'failed' && (
                <div className="absolute inset-0 bg-red-500/20 flex flex-col items-center justify-center text-white px-4">
                  <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                  <div className="text-sm font-medium text-red-500 mb-2">{t('videos.generationFailed')}</div>
                  {video.error_message && (
                    <div className="text-xs text-red-400 text-center mb-3 max-w-[80%] line-clamp-3">
                      {video.error_message}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 text-red-500 border-red-500"
                    onClick={() => onRegenerate(video)}
                  >
                    {t('videos.regenerate')}
                  </Button>
                </div>
              )}

              {/* 播放按钮覆盖 */}
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
            </div>

            {/* 信息区域 */}
            <div className="p-4">
              {/* 标题和描述 */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-sm font-medium text-foreground truncate"
                    title={parsedTitle}
                  >
                    {parsedTitle}
                  </h3>
                  {parsedDescription && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-4">
                      {parsedDescription}
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
                    {showDebugButton && (
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
                          <p>查看视频缓存调试信息</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TooltipProvider>

                {/* 时间戳 */}
                <div className="text-xs text-muted-foreground">
                  {formatRelativeTime(video.created_at)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 调试信息展示 - 根据环境变量控制显示 */}
        {showDebugButton && (
          <VideoDebugInfo
            videoId={video.id}
            thumbnailDebugInfo={thumbnailDebugInfo}
            videoDebugInfo={videoDebugInfo}
            isVisible={showDebugInfo}
            onToggle={onToggleDebugInfo}
            onCacheCleared={() => onCheckCache(video)}
            onThumbnailRepaired={() => {
              // 视频缓存修复完成后，重新检查缓存状态
              onCheckCache(video)
            }}
          />
        )}

        {/* 视频预览播放器 */}
        {showVideoPlayer && video.status === 'completed' && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="relative w-full h-full">
              <ReactVideoPlayer
                video={video}
                videoId={video.id}
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