/**
 * 懒加载视频播放器组件
 * 
 * 功能：
 * 1. 集成视频懒加载
 * 2. 缓存缩略图管理
 * 3. 网络自适应加载
 * 4. 渐进式视频加载
 * 5. 加载状态和错误处理
 * 6. 向后兼容原有VideoPlayer接口
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Loader2, AlertCircle } from 'lucide-react'
import VideoPlayer from './VideoPlayer'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/utils/cn'
import { useVideoLazyLoad, type LazyLoadOptions } from '@/hooks/useVideoLazyLoad'
import { useSimpleNetworkQuality } from '@/hooks/useNetworkQuality'

export interface LazyVideoPlayerProps {
  // 基本视频属性
  src: string
  poster?: string
  className?: string
  alt?: string
  objectFit?: 'contain' | 'cover'
  
  // VideoPlayer 兼容属性
  showPlayButton?: boolean
  showVolumeControl?: boolean
  autoPlayOnHover?: boolean
  onDownload?: () => void
  onShare?: () => void
  
  // 下载保护相关
  userId?: string
  videoId?: string
  videoTitle?: string
  enableDownloadProtection?: boolean
  
  // 懒加载配置
  lazyLoadOptions?: LazyLoadOptions
  
  // 性能选项
  enableLazyLoad?: boolean
  enableThumbnailCache?: boolean
  enableNetworkAdaptive?: boolean
  enableProgressiveLoading?: boolean
  
  // 自定义渲染
  renderPlaceholder?: (state: { isLoading: boolean; hasError: boolean; thumbnail?: string }) => React.ReactNode
  renderLoadingOverlay?: (progress: { percentage: number; speed: number }) => React.ReactNode
  renderError?: (error: string, onRetry: () => void) => React.ReactNode
  
  // 事件回调
  onLoad?: () => void
  onError?: (error: string) => void
  onVisibilityChange?: (isVisible: boolean) => void
  onThumbnailLoad?: (thumbnail: string) => void
}

const LazyVideoPlayer: React.FC<LazyVideoPlayerProps> = ({
  src,
  poster,
  className,
  alt,
  objectFit = 'cover',
  showPlayButton = true,
  showVolumeControl = true,
  autoPlayOnHover = false,
  onDownload,
  onShare,
  userId,
  videoId,
  videoTitle,
  enableDownloadProtection = true,
  lazyLoadOptions = {},
  enableLazyLoad = true,
  enableThumbnailCache = true,
  enableNetworkAdaptive = true,
  enableProgressiveLoading = true,
  renderPlaceholder,
  renderLoadingOverlay,
  renderError,
  onLoad,
  onError,
  onVisibilityChange,
  onThumbnailLoad,
  ...restProps
}) => {
  const { t } = useTranslation()
  const [hasUserInteraction, setHasUserInteraction] = useState(false)
  
  // 网络质量检测
  const networkQuality = useSimpleNetworkQuality()
  
  // 配置懒加载选项
  const finalLazyLoadOptions: LazyLoadOptions = {
    threshold: 0.1,
    rootMargin: '100px',
    loadStrategy: 'onVisible',
    enableThumbnailCache: enableThumbnailCache,
    enableProgressiveLoading: enableProgressiveLoading,
    thumbnailQuality: networkQuality.isSlowConnection ? 'low' : 'medium',
    videoOptions: {
      quality: enableNetworkAdaptive ? networkQuality.recommendedQuality : 'auto',
      preload: networkQuality.isSlowConnection ? 'none' : 'metadata',
      enableRangeRequests: enableProgressiveLoading && !networkQuality.isSlowConnection
    },
    ...lazyLoadOptions
  }

  // 使用懒加载Hook
  const [lazyState, lazyActions, inViewRef] = useVideoLazyLoad(
    src,
    enableLazyLoad ? finalLazyLoadOptions : { loadStrategy: 'immediate', ...finalLazyLoadOptions }
  )

  // 处理用户交互
  const handleInteraction = useCallback(() => {
    if (!hasUserInteraction) {
      setHasUserInteraction(true)
      lazyActions.markInteraction()
    }
  }, [hasUserInteraction, lazyActions])

  // 处理点击播放
  const handlePlayClick = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    handleInteraction()
    
    if (!lazyState.isLoaded && !lazyState.isLoading && !lazyState.hasError) {
      lazyActions.load().catch(error => {
        console.error('[LazyVideoPlayer] Manual load failed:', error)
        // 对于CORS等网络错误，直接标记为已加载，使用原始VideoPlayer
      })
    }
  }, [lazyState.isLoaded, lazyState.isLoading, lazyState.hasError, lazyActions, handleInteraction])

  // 事件处理器
  useEffect(() => {
    onVisibilityChange?.(lazyState.isVisible)
  }, [lazyState.isVisible, onVisibilityChange])

  useEffect(() => {
    if (lazyState.isLoaded && !lazyState.hasError) {
      onLoad?.()
    }
  }, [lazyState.isLoaded, lazyState.hasError, onLoad])

  useEffect(() => {
    if (lazyState.hasError && lazyState.error) {
      onError?.(lazyState.error)
    }
  }, [lazyState.hasError, lazyState.error, onError])

  useEffect(() => {
    if (lazyState.thumbnail) {
      onThumbnailLoad?.(lazyState.thumbnail)
    }
  }, [lazyState.thumbnail, onThumbnailLoad])

  /**
   * 渲染占位符
   */
  const renderPlaceholderContent = () => {
    if (renderPlaceholder) {
      return renderPlaceholder({
        isLoading: lazyState.isLoading,
        hasError: lazyState.hasError,
        thumbnail: lazyState.thumbnail || undefined
      })
    }

    // 默认占位符渲染
    if (lazyState.hasError) {
      const isLoadCancelled = lazyState.error === 'Load cancelled'
      
      return (
        <div className={`w-full h-full flex items-center justify-center ${
          isLoadCancelled ? 'bg-gray-50 dark:bg-gray-800' : 'bg-red-50 dark:bg-red-900/20'
        }`}>
          <div className="text-center p-4">
            <AlertCircle className={`h-12 w-12 mx-auto mb-3 ${
              isLoadCancelled ? 'text-gray-500' : 'text-red-500'
            }`} />
            <p className={`text-sm font-medium mb-2 ${
              isLoadCancelled 
                ? 'text-gray-700 dark:text-gray-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>
              {isLoadCancelled ? t('video.previewPaused') : t('video.loadFailed')}
            </p>
            <p className={`text-xs mb-3 ${
              isLoadCancelled 
                ? 'text-gray-600 dark:text-gray-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {isLoadCancelled ? '点击重试加载预览视频' : lazyState.error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => lazyActions.retry()}
              className={
                isLoadCancelled
                  ? "text-gray-600 border-gray-300 hover:bg-gray-50"
                  : "text-red-600 border-red-300 hover:bg-red-50"
              }
            >
              {t('common.retry')}
            </Button>
          </div>
        </div>
      )
    }

    // 显示缩略图或默认占位符
    const thumbnailSrc = lazyState.thumbnail || poster
    
    return (
      <>
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={alt}
            className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Play className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm font-medium">{t('video.preview')}</p>
            </div>
          </div>
        )}

        {/* 播放按钮覆盖层 */}
        {showPlayButton && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={handlePlayClick}
          >
            <div className="w-16 h-16 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
              <Play className="h-8 w-8 text-white ml-1" />
            </div>
          </div>
        )}
      </>
    )
  }

  /**
   * 渲染加载覆盖层
   */
  const renderLoadingContent = () => {
    if (renderLoadingOverlay && lazyState.loadProgress) {
      return renderLoadingOverlay({
        percentage: lazyState.loadProgress.percentage,
        speed: lazyState.loadProgress.speed
      })
    }

    // 默认加载覆盖层
    const progress = lazyState.loadProgress
    
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
        <div className="text-center text-white px-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3" />
          
          {progress && (
            <>
              <div className="text-lg font-semibold mb-2">
                {Math.round(progress.percentage)}%
              </div>
              
              <div className="w-64 mx-auto mb-2">
                <Progress 
                  value={progress.percentage} 
                  className="h-2"
                />
              </div>
              
              {progress.speed > 0 && (
                <div className="text-sm opacity-80">
                  {progress.speed.toFixed(1)} KB/s
                  {progress.remainingTime > 0 && (
                    <span className="ml-2">
                      {t('common.remaining')} {Math.round(progress.remainingTime)}s
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          
          <div className="text-xs opacity-60 mt-2">
            {t('video.loading')}
          </div>
        </div>
      </div>
    )
  }

  /**
   * 渲染网络状态指示器
   */
  const renderNetworkIndicator = () => {
    return null
  }

  // 如果视频已加载，显示实际的VideoPlayer
  if (lazyState.isLoaded && !lazyState.hasError) {
    return (
      <div ref={inViewRef} className={cn("relative", className)}>
        <VideoPlayer
          src={src}
          poster={poster || lazyState.thumbnail || undefined}
          className="w-full h-full"
          objectFit={objectFit}
          showPlayButton={showPlayButton}
          showVolumeControl={showVolumeControl}
          autoPlayOnHover={autoPlayOnHover}
          onDownload={onDownload}
          onShare={onShare}
          userId={userId}
          videoId={videoId}
          videoTitle={videoTitle}
          enableDownloadProtection={enableDownloadProtection}
          alt={alt}
          {...restProps}
        />
        {renderNetworkIndicator()}
      </div>
    )
  }
  
  // 如果加载失败但是网络相关错误，直接降级到标准VideoPlayer（跳过懒加载）
  if (lazyState.hasError && lazyState.error && 
      (lazyState.error.includes('CORS') || 
       lazyState.error.includes('Failed to fetch') || 
       lazyState.error.includes('Network Error') ||
       lazyState.error.includes('HEAD request failed'))) {
    console.log('[LazyVideoPlayer] Network error detected, falling back to standard VideoPlayer:', lazyState.error)
    return (
      <div ref={inViewRef} className={cn("relative", className)}>
        <VideoPlayer
          src={src}
          poster={poster}
          className="w-full h-full"
          objectFit={objectFit}
          showPlayButton={showPlayButton}
          showVolumeControl={showVolumeControl}
          autoPlayOnHover={autoPlayOnHover}
          onDownload={onDownload}
          onShare={onShare}
          userId={userId}
          videoId={videoId}
          videoTitle={videoTitle}
          enableDownloadProtection={enableDownloadProtection}
          alt={alt}
          // 禁用渐进加载相关功能
          enableProgressiveLoading={false}
          {...restProps}
        />
      </div>
    )
  }

  // 显示占位符或加载状态
  return (
    <div ref={inViewRef} className={cn("relative aspect-video bg-muted", className)}>
      {renderPlaceholderContent()}
      
      {/* 加载覆盖层 */}
      {lazyState.isLoading && renderLoadingContent()}
      
      {/* 网络状态指示器 */}
      {renderNetworkIndicator()}
      
      {/* 缩略图加载指示器 */}
      {lazyState.thumbnailLoading && !lazyState.isLoading && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-black/50 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('video.thumbnail')}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 简化版懒加载视频播放器
 * 只保留核心懒加载功能，去除复杂的配置
 */
export const SimpleLazyVideoPlayer: React.FC<{
  src: string
  poster?: string
  className?: string
  alt?: string
  showPlayButton?: boolean
  onClick?: () => void
}> = ({ 
  src, 
  poster, 
  className, 
  alt,
  showPlayButton = true,
  onClick 
}) => {
  const [lazyState, lazyActions, inViewRef] = useVideoLazyLoad(src, {
    threshold: 0.1,
    loadStrategy: 'onVisible',
    enableThumbnailCache: true
  })

  const handleClick = () => {
    lazyActions.markInteraction()
    onClick?.()
  }

  if (lazyState.isLoaded) {
    return (
      <div ref={inViewRef} className={className}>
        <VideoPlayer
          src={src}
          poster={poster || lazyState.thumbnail || undefined}
          className="w-full h-full"
          showPlayButton={showPlayButton}
          userId={userId}
          videoId={videoId}
          videoTitle={videoTitle}
          enableDownloadProtection={enableDownloadProtection}
          alt={alt}
        />
      </div>
    )
  }

  return (
    <div 
      ref={inViewRef} 
      className={cn("relative aspect-video bg-muted cursor-pointer", className)}
      onClick={handleClick}
    >
      {lazyState.thumbnail || poster ? (
        <img
          src={lazyState.thumbnail || poster}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <Play className="h-12 w-12" />
        </div>
      )}
      
      {showPlayButton && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-16 h-16 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        </div>
      )}
      
      {lazyState.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
    </div>
  )
}

export default LazyVideoPlayer