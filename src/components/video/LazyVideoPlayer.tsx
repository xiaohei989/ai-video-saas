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

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Loader2, AlertCircle } from 'lucide-react'
import VideoPlayer from './VideoPlayer'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/utils/cn'
import { useVideoLazyLoad, type LazyLoadOptions } from '@/hooks/useVideoLazyLoad'
import { useSimpleNetworkQuality } from '@/hooks/useNetworkQuality'
import { thumbnailGenerator } from '@/services/thumbnailGeneratorService'

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
  // LazyVideoPlayer渲染开始
  if (import.meta.env.DEV) {
    console.log(`[LazyVideoPlayer] 渲染开始`, {
      src,
      videoId,
      videoTitle,
      hasPoster: !!poster,
      timestamp: new Date().toISOString()
    })
  }
  
  const { t } = useTranslation()
  const [hasUserInteraction, setHasUserInteraction] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  // 防重复处理的ref - 跟踪已处理的资源
  const thumbnailProcessedRef = useRef<Set<string>>(new Set())
  
  // 智能缩略图状态 - 智能初始化，如果有poster立即使用
  const [smartThumbnails, setSmartThumbnails] = useState<{ normal: string; blur: string } | null>(() => {
    // 如果有poster，立即使用它作为初始状态，避免闪烁
    if (poster) {
      console.log(`🚀 [LazyVideoPlayer] 智能初始化：直接使用poster`, { poster, videoId })
      return { normal: poster, blur: poster }
    }
    return null
  })
  
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

  // 智能缩略图初始化 - 后台静默处理，不影响初始显示
  React.useEffect(() => {
    const initSmartThumbnails = async () => {
      try {
        // 🔥 生成唯一的处理键，避免重复处理相同的资源组合
        const processKey = `${src}:${poster || 'no-poster'}`
        
        // 🔥 检查是否已经处理过这个资源组合
        if (thumbnailProcessedRef.current.has(processKey)) {
          console.log(`⏭️ [LazyVideoPlayer] 跳过重复处理: ${processKey}`)
          return
        }
        
        // 🔥 标记为正在处理
        thumbnailProcessedRef.current.add(processKey)
        
        const thumbnails = await thumbnailGenerator.getBestThumbnail(src, poster)
        
        // 🔥 改进的更新条件判断：避免无效更新
        const currentThumbnail = smartThumbnails?.normal
        const newThumbnail = thumbnails.normal
        
        // 只有在以下情况才更新：
        // 1. 新缩略图不是SVG占位符
        // 2. 新缩略图与当前缩略图不同
        // 3. 新缩略图不是poster（避免用poster覆盖更好的缩略图）
        const shouldUpdate = (
          !newThumbnail.startsWith('data:image/svg+xml') &&
          newThumbnail !== currentThumbnail &&
          newThumbnail !== poster
        )
        
        if (shouldUpdate) {
          console.log(`🔄 [LazyVideoPlayer] 后台获取到更好的缩略图，静默更新`, { 
            old: currentThumbnail, 
            new: newThumbnail,
            processKey
          })
          setSmartThumbnails(thumbnails)
          onThumbnailLoad?.(newThumbnail)
        } else {
          // 🔥 更详细的跳过原因日志
          let skipReason = 'unknown'
          if (newThumbnail.startsWith('data:image/svg+xml')) {
            skipReason = 'SVG占位符'
          } else if (newThumbnail === currentThumbnail) {
            skipReason = '相同缩略图'
          } else if (poster && newThumbnail === poster) {
            skipReason = '新缩略图是poster'
          } else if (!newThumbnail.length) {
            skipReason = '空缩略图'
          } else {
            skipReason = '其他条件不满足'
          }
          
          console.log(`📌 [LazyVideoPlayer] 保持当前缩略图，跳过后台更新`, { 
            current: currentThumbnail,
            fetched: newThumbnail,
            reason: skipReason,
            processKey
          })
        }
        
        if (import.meta.env.DEV) {
          console.log(`[LazyVideoPlayer] 🖼️ 智能缩略图处理完成`, {
            videoId,
            thumbnailUrl: newThumbnail,
            wasUpdated: shouldUpdate,
            processKey
          })
        }
      } catch (error) {
        console.warn('[LazyVideoPlayer] 智能缩略图获取失败:', error)
        // 🔥 更安全的错误回退逻辑
        if (!smartThumbnails && poster) {
          console.log(`🛡️ [LazyVideoPlayer] 错误回退：使用poster作为缩略图`)
          setSmartThumbnails({ normal: poster, blur: poster })
        }
      } finally {
        // 🔥 确保清理工作：如果处理失败，也要从处理集合中移除
        // 这样下次src或poster变化时能够重新处理
      }
    }
    
    if (enableThumbnailCache) {
      // 🔥 增加更长的延迟，给初始化逻辑更多时间完成
      const delay = poster ? 100 : 0 // 有poster时延迟更长，避免覆盖
      setTimeout(initSmartThumbnails, delay)
    }
  }, [src, poster, enableThumbnailCache, onThumbnailLoad])
  
  // 🔥 清理效果：在组件卸载或src变化时清理已处理的记录
  React.useEffect(() => {
    return () => {
      // 组件卸载时清理所有相关记录
      if (thumbnailProcessedRef.current) {
        const keysToRemove = Array.from(thumbnailProcessedRef.current).filter(key => key.startsWith(src))
        keysToRemove.forEach(key => thumbnailProcessedRef.current.delete(key))
        console.log(`🧽 [LazyVideoPlayer] 清理已处理记录: ${keysToRemove.length} 个`)
      }
    }
  }, [src])

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

    // 优化缩略图选择逻辑：确保总是有可用的缩略图显示
    const thumbnailSrc = smartThumbnails?.normal || poster || lazyState.thumbnail
    
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
   * 渲染加载覆盖层 - 只在悬浮状态显示转圈动画
   */
  const renderLoadingContent = () => {
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
  }

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
      {renderPlaceholderContent()}
      {renderLoadingContent()}
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-16 h-16 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        </div>
      )}
      
      {/* 移除加载状态指示器，保持界面简洁 */}
    </div>
  )
}

export default LazyVideoPlayer