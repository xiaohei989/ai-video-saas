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

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Loader2, AlertCircle } from 'lucide-react'
import VideoPlayer from './VideoPlayer'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/utils/cn'
import { useVideoLazyLoad, type LazyLoadOptions } from '@/hooks/useVideoLazyLoad'
import { useSimpleNetworkQuality } from '@/hooks/useNetworkQuality'
import thumbnailGenerator from '@/services/thumbnailGeneratorService'

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
  onTimeUpdate?: (currentTime: number, duration: number, isPlaying: boolean) => void
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
  onTimeUpdate,
  ...restProps
}) => {
  
  const { t } = useTranslation()
  const [hasUserInteraction, setHasUserInteraction] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  // 缩略图状态管理 - 支持同步初始化和异步实时更新
  const [smartThumbnails, setSmartThumbnails] = useState<{ normal: string; blur: string } | null>(() => {
    // 同步初始化 - 优先显示可用内容，避免闪烁
    if (enableThumbnailCache) {
      const memoryCached = thumbnailGenerator.getFromMemoryCache(src)
      if (memoryCached) {
        console.log(`🎯 [LazyVideoPlayer] 同步初始化：使用内存缓存`, { videoId })
        return { normal: memoryCached, blur: memoryCached }
      }
    }
    
    if (poster) {
      console.log(`🎯 [LazyVideoPlayer] 同步初始化：使用poster`, { videoId })
      return { normal: poster, blur: poster }
    }
    
    console.log(`🎯 [LazyVideoPlayer] 同步初始化：使用默认占位符`, { videoId })
    return null
  })
  
  // 异步缓存确保和实时更新
  useEffect(() => {
    if (!enableThumbnailCache) return
    
    // 参数验证 - 防止无效调用导致无限循环  
    if (!src || !videoId || videoId === 'undefined' || typeof videoId !== 'string' || !videoId.trim()) {
      // 在开发环境下降低日志级别，避免spam
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[LazyVideoPlayer] 跳过缩略图更新，参数无效:`, { src, videoId })
      } else {
        console.warn(`[LazyVideoPlayer] 跳过缩略图更新，参数无效:`, { src, videoId })
      }
      return
    }
    
    let isCancelled = false
    
    const updateThumbnail = async () => {
      try {
        const thumbnail = await thumbnailGenerator.ensureThumbnailCached(src, videoId)
        if (isCancelled) return // 防止组件卸载后的状态更新
        
        if (thumbnail && thumbnail !== smartThumbnails?.normal) {
          console.log(`🔄 [LazyVideoPlayer] 实时更新缩略图`, { 
            videoId, 
            old: smartThumbnails?.normal ? '有缩略图' : '无缩略图',
            new: '真实缩略图' 
          })
          setSmartThumbnails({ normal: thumbnail, blur: thumbnail })
          onThumbnailLoad?.(thumbnail)
        }
      } catch (error) {
        if (!isCancelled) {
          console.warn(`[LazyVideoPlayer] 缩略图更新失败: ${videoId}`, error)
        }
      }
    }
    
    updateThumbnail()
    
    return () => {
      isCancelled = true
    }
  }, [src, videoId, enableThumbnailCache]) // 移除onThumbnailLoad避免无限循环
  
  // 网络质量检测
  const networkQuality = useSimpleNetworkQuality()
  
  // 配置懒加载选项 - 使用 useMemo 优化
  const finalLazyLoadOptions: LazyLoadOptions = useMemo(() => ({
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
  }), [
    enableThumbnailCache,
    enableProgressiveLoading,
    networkQuality.isSlowConnection,
    networkQuality.recommendedQuality,
    enableNetworkAdaptive,
    lazyLoadOptions
  ])

  // 使用懒加载Hook
  const [lazyState, lazyActions, inViewRef] = useVideoLazyLoad(
    src,
    enableLazyLoad ? finalLazyLoadOptions : { loadStrategy: 'immediate', ...finalLazyLoadOptions }
  )

  // 处理用户交互 - 优化依赖项
  const handleInteraction = useCallback(() => {
    if (!hasUserInteraction) {
      setHasUserInteraction(true)
      lazyActions.markInteraction()
    }
  }, [hasUserInteraction, lazyActions.markInteraction])

  // 处理点击播放 - 优化依赖项
  const handlePlayClick = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    handleInteraction()
    
    if (!lazyState.isLoaded && !lazyState.isLoading && !lazyState.hasError) {
      lazyActions.load().catch(error => {
        console.error('[LazyVideoPlayer] Manual load failed:', error)
        // 对于CORS等网络错误，直接标记为已加载，使用原始VideoPlayer
      })
    }
  }, [lazyState.isLoaded, lazyState.isLoading, lazyState.hasError, lazyActions.load, handleInteraction])

  // 已移除异步缩略图更新逻辑 - 现在使用一次性同步初始化，避免闪烁

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
   * 渲染占位符 - 使用 useMemo 优化
   */
  const renderPlaceholderContent = useMemo(() => {
    if (renderPlaceholder) {
      return renderPlaceholder({
        isLoading: lazyState.isLoading,
        hasError: lazyState.hasError,
        thumbnail: smartThumbnails?.normal || lazyState.thumbnail || undefined
      })
    }

    // 默认占位符渲染
    if (lazyState.hasError) {
      const isLoadCancelled = lazyState.error === 'Load cancelled'
      
      return (
        <div className={`w-full h-full flex items-center justify-center ${
          isLoadCancelled ? '' : 'bg-red-50 dark:bg-red-900/20'
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

    // 简化缩略图选择逻辑：一次性确定，不再动态变化
    const thumbnailSrc = smartThumbnails?.normal
    
    return (
      <>
        {thumbnailSrc ? (
          <div className="relative w-full h-full">
            {/* 主缩略图 */}
            <img
              src={thumbnailSrc}
              alt={alt}
              className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} transition-opacity duration-300`}
              onError={(e) => {
                // 静默处理图片加载错误，避免显示broken image
                const target = e.target as HTMLImageElement;
                if (target.src !== poster && poster) {
                  target.src = poster; // 尝试fallback到原始poster
                } else {
                  // 如果所有缩略图都失败，隐藏图片元素，让下层的播放图标显示
                  target.style.display = 'none';
                }
              }}
              loading="lazy"
            />
            
            {/* 移除加载中的模糊效果，保持界面简洁 */}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-600">
            <div className="text-center text-gray-600 dark:text-gray-300">
              <Play className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm font-medium">{t('video.preview')}</p>
            </div>
          </div>
        )}

        {/* 播放按钮覆盖层 - 移动端常显，桌面端悬浮显示 */}
        {showPlayButton && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer mobile-video-play-overlay"
            onClick={handlePlayClick}
          >
            <div className="mobile-video-play-button">
              <Play className="h-6 w-6 md:h-8 md:w-8 text-white ml-0.5 md:ml-1" />
            </div>
          </div>
        )}
      </>
    )
  }, [
    renderPlaceholder,
    lazyState.isLoading,
    lazyState.hasError,
    smartThumbnails?.normal,
    lazyState.thumbnail,
    lazyState.error,
    lazyActions.retry,
    t,
    alt,
    objectFit,
    poster,
    showPlayButton,
    handlePlayClick
  ])

  /**
   * 渲染加载覆盖层 - 只在悬浮状态显示转圈动画 - 使用 useMemo 优化
   */
  const renderLoadingContent = useMemo(() => {
    if (renderLoadingOverlay && lazyState.loadProgress) {
      return renderLoadingOverlay({
        percentage: lazyState.loadProgress.percentage,
        speed: lazyState.loadProgress.speed
      })
    }

    // 非悬浮状态：不显示任何加载信息
    if (!isHovered) return null
    
    // 悬浮状态且正在加载：显示转圈动画
    if (lazyState.isLoading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      )
    }
    
    return null
  }, [renderLoadingOverlay, lazyState.loadProgress, isHovered, lazyState.isLoading])

  /**
   * 渲染网络状态指示器 - 完全移除
   */
  const renderNetworkIndicator = () => {
    return null
  }

  // 如果视频已加载，显示实际的VideoPlayer
  if (lazyState.isLoaded && !lazyState.hasError) {
    return (
      <div 
        ref={inViewRef as React.RefObject<HTMLDivElement>} 
        className={cn("relative", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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
          onTimeUpdate={onTimeUpdate}
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
      <div 
        ref={inViewRef as React.RefObject<HTMLDivElement>} 
        className={cn("relative", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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
          onTimeUpdate={onTimeUpdate}
          alt={alt}
          // 禁用渐进加载相关功能
          enableProgressiveLoading={false}
          {...restProps}
        />
      </div>
    )
  }

  // 显示占位符或加载状态 - 移除灰色背景，避免闪烁
  return (
    <div 
      ref={inViewRef as React.RefObject<HTMLDivElement>} 
      className={cn("relative aspect-video", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {renderPlaceholderContent}
      {renderLoadingContent}
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
  userId?: string
  videoId?: string
  videoTitle?: string
  enableDownloadProtection?: boolean
}> = ({ 
  src, 
  poster, 
  className, 
  alt,
  showPlayButton = true,
  onClick,
  userId,
  videoId,
  videoTitle,
  enableDownloadProtection = true
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
      <div ref={inViewRef as React.RefObject<HTMLDivElement>} className={className}>
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
      ref={inViewRef as React.RefObject<HTMLDivElement>} 
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 mobile-video-play-overlay">
          <div className="mobile-video-play-button">
            <Play className="h-6 w-6 md:h-8 md:w-8 text-white ml-0.5 md:ml-1" />
          </div>
        </div>
      )}
      
      {/* 移除加载状态指示器，保持界面简洁 */}
    </div>
  )
}

// React.memo 包装组件，优化性能，避免不必要的重渲染
const LazyVideoPlayerMemo = React.memo(LazyVideoPlayer, (prevProps, nextProps) => {
  // 自定义比较函数，只比较关键 props
  const keyProps = [
    'src', 'poster', 'className', 'alt', 'objectFit', 'showPlayButton', 
    'showVolumeControl', 'autoPlayOnHover', 'userId', 'videoId', 'videoTitle', 
    'enableDownloadProtection', 'enableLazyLoad', 'enableThumbnailCache',
    'enableNetworkAdaptive', 'enableProgressiveLoading'
  ]
  
  for (const prop of keyProps) {
    if (prevProps[prop as keyof LazyVideoPlayerProps] !== nextProps[prop as keyof LazyVideoPlayerProps]) {
      return false // props 有变化，需要重新渲染
    }
  }
  
  // 检查 lazyLoadOptions 对象
  const prevOptions = prevProps.lazyLoadOptions || {}
  const nextOptions = nextProps.lazyLoadOptions || {}
  const optionKeys = [...new Set([...Object.keys(prevOptions), ...Object.keys(nextOptions)])]
  
  for (const key of optionKeys) {
    if ((prevOptions as any)[key] !== (nextOptions as any)[key]) {
      return false
    }
  }
  
  return true // props 没有实质性变化，跳过重渲染
})

LazyVideoPlayerMemo.displayName = 'LazyVideoPlayer'

export default LazyVideoPlayerMemo