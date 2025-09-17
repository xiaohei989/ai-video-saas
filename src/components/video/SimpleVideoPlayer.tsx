/**
 * SimpleVideoPlayer - 基于主流视频网站最佳实践的简化播放器
 * 
 * 设计理念：
 * - 使用原生 <video> 标签获得最佳性能
 * - preload="metadata" 实现快速启动
 * - 最小化 JavaScript 控制，依赖浏览器原生优化
 * - 对标 YouTube、Twitter 等主流网站的播放体验
 */

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react'
import { cn } from '@/utils/cn'
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'
import { getOptimalThumbnailSource, supportsMediaFragments } from '@/utils/thumbnailFallback'
import VideoSkeleton from './VideoSkeleton'

export interface SimpleVideoPlayerProps {
  // 基本属性
  src: string
  poster?: string
  className?: string
  alt?: string
  
  // 播放控制
  autoPlayOnHover?: boolean
  showPlayButton?: boolean
  muted?: boolean
  
  // 事件回调
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (currentTime: number, duration: number, isPlaying: boolean) => void
  
  // 样式控制
  objectFit?: 'contain' | 'cover'
  
  // 标识符（用于分析和调试）
  videoId?: string
  videoTitle?: string
  
  // URL回退（可选）
  fallbackSrc?: string
}

export default function SimpleVideoPlayer({
  src,
  poster,
  className,
  alt,
  autoPlayOnHover = false,
  showPlayButton = true,
  muted = false, // 默认有声音播放
  onPlay,
  onPause,
  onTimeUpdate,
  objectFit = 'cover',
  videoId,
  videoTitle,
  fallbackSrc,
}: SimpleVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const [isMuted, setIsMuted] = useState(muted)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // 视频加载状态
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [hasMetadata, setHasMetadata] = useState(false)
  const [currentVideoSrc, setCurrentVideoSrc] = useState(src)
  const [hasTriedFallback, setHasTriedFallback] = useState(false)

  // 智能视频源优化 - 根据浏览器支持情况添加 Media Fragments
  const getOptimizedVideoUrl = (videoSrc: string): string => {
    const proxyUrl = getProxyVideoUrl(videoSrc)
    // 只在支持 Media Fragments 的浏览器中添加参数
    if (supportsMediaFragments() && !proxyUrl.includes('#t=')) {
      return `${proxyUrl}#t=0.001`
    }
    return proxyUrl
  }

  // 智能缩略图源选择
  const optimalPoster = getOptimalThumbnailSource(src, poster)

  // 处理src变化，重置回退状态
  useEffect(() => {
    if (src !== currentVideoSrc) {
      setCurrentVideoSrc(src)
      setHasTriedFallback(false)
      setHasError(false)
      setIsLoading(true)
    }
  }, [src])

  // 处理播放状态变化
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      setIsPlaying(true)
      onPlay?.()
    }

    const handlePause = () => {
      setIsPlaying(false)
      onPause?.()
    }

    const handleTimeUpdate = () => {
      const time = video.currentTime
      const dur = video.duration || 0
      setCurrentTime(time)
      onTimeUpdate?.(time, dur, !video.paused)
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0)
      setHasMetadata(true)
      setIsLoading(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      // 对于预览视频，播放结束后重置到开始
      video.currentTime = 0
    }

    // 加载状态处理
    const handleLoadStart = () => {
      setIsLoading(true)
      setHasError(false)
    }

    const handleLoadedData = () => {
      setIsLoading(false)
    }

    const handleError = () => {
      console.warn('[SimpleVideoPlayer] 视频加载失败:', currentVideoSrc)
      
      // 如果有回退URL且还未尝试过，则尝试回退
      if (fallbackSrc && !hasTriedFallback && currentVideoSrc !== fallbackSrc) {
        console.log('[SimpleVideoPlayer] 尝试回退URL:', fallbackSrc)
        setHasTriedFallback(true)
        setCurrentVideoSrc(fallbackSrc)
        setIsLoading(true)
        setHasError(false)
        
        // 更新video元素的src
        if (video) {
          video.src = getOptimizedVideoUrl(fallbackSrc)
          video.load()
        }
        return
      }
      
      // 没有回退URL或已经尝试过回退，显示错误
      setIsLoading(false)
      setHasError(true)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('error', handleError)
    video.addEventListener('canplay', handleCanPlay)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('error', handleError)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [onPlay, onPause, onTimeUpdate, src])

  // 悬停自动播放逻辑
  useEffect(() => {
    if (!autoPlayOnHover || !videoRef.current) return

    const video = videoRef.current

    if (isHovered && !isPlaying) {
      // 尝试自动播放
      video.play().catch(() => {
        // 如果有声播放失败，尝试静音播放
        console.debug('Auto-play blocked, trying muted playback')
        video.muted = true
        setIsMuted(true)
        video.play().catch(e => {
          console.debug('Muted auto-play also failed:', e)
        })
      })
    } else if (!isHovered && isPlaying && autoPlayOnHover) {
      // 鼠标离开时暂停并重置
      video.pause()
      video.currentTime = 0
    }
  }, [isHovered, autoPlayOnHover, isPlaying])

  // 点击播放/暂停
  const handlePlayPause = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    const video = videoRef.current
    if (!video) return

    try {
      if (isPlaying) {
        video.pause()
      } else {
        await video.play()
      }
    } catch (error) {
      console.warn('播放操作失败:', error)
    }
  }

  // 点击视频区域播放/暂停
  const handleVideoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    handlePlayPause(e)
  }

  // 静音切换
  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    const video = videoRef.current
    if (!video) return
    
    const newMuted = !isMuted
    video.muted = newMuted
    setIsMuted(newMuted)
  }

  // 进度条点击跳转
  const handleProgressClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    const video = videoRef.current
    if (!video || !duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickRatio = clickX / rect.width
    const newTime = clickRatio * duration
    
    video.currentTime = newTime
    setCurrentTime(newTime)
  }

  // 全屏切换功能
  const toggleFullscreen = () => {
    if (!containerRef.current) return
    
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current.requestFullscreen()
    }
  }

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative group bg-muted overflow-hidden", className)}
      onMouseEnter={() => {
        setIsHovered(true)
        setShowControls(true)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        setShowControls(false)
      }}
    >
      {/* 骨骼屏覆盖层 - 在视频加载时显示 */}
      {(isLoading || hasError) && (
        <VideoSkeleton
          className="absolute inset-0"
          showPlayButton={showPlayButton}
        />
      )}

      {/* 原生视频元素 */}
      <video
        ref={videoRef}
        src={getOptimizedVideoUrl(currentVideoSrc)}
        poster={optimalPoster}
        className={cn(
          `w-full h-full cursor-pointer`,
          objectFit === 'cover' ? 'object-cover' : 'object-contain',
          // 加载时隐藏视频元素，避免白屏闪烁
          (isLoading || hasError) && 'opacity-0'
        )}
        onClick={handleVideoClick}
        muted={isMuted}
        playsInline // 移动端内联播放
        preload="metadata" // 核心：只预载元数据，快速启动
        crossOrigin="anonymous"
        aria-label={alt || videoTitle || '视频播放器'}
        style={{
          // 智能回退：使用 CSS 背景图确保缩略图显示
          backgroundImage: optimalPoster ? `url(${optimalPoster})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* 播放按钮覆盖层 - 只在未播放时显示，播放时完全隐藏 */}
      {showPlayButton && !isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer
                     opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200"
          onClick={handlePlayPause}
        >
          <div className="bg-black/50 rounded-full p-3 md:p-4 backdrop-blur-sm
                         transition-transform hover:scale-105">
            <Play className="h-6 w-6 md:h-8 md:w-8 text-white ml-0.5 md:ml-1" />
          </div>
        </div>
      )}


      {/* 播放控制栏 - 悬停时显示 */}
      {showControls && isPlaying && duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent">
          {/* 进度条区域 */}
          <div className="px-4 pt-4 pb-2">
            <div 
              className="relative w-full h-1 bg-white/30 rounded-full cursor-pointer group/progress"
              onClick={handleProgressClick}
            >
              {/* 播放进度 */}
              <div 
                className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-150"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              {/* 悬停时的进度点 */}
              <div 
                className="absolute top-1/2 w-3 h-3 bg-white rounded-full shadow-md -translate-y-1/2 
                          opacity-0 group-hover/progress:opacity-100 transition-opacity"
                style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 6px)` }}
              />
            </div>
          </div>
          
          {/* 控制按钮区域 */}
          <div className="flex items-center justify-between px-4 pb-3">
            {/* 左侧控制组 */}
            <div className="flex items-center gap-2">
              {/* 播放/暂停按钮 */}
              <button
                onClick={handlePlayPause}
                className="flex items-center justify-center w-8 h-8 text-white hover:bg-white/20 
                         rounded-full transition-colors duration-200"
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </button>
              
              {/* 静音控制按钮 */}
              <button
                onClick={handleMuteToggle}
                className="flex items-center justify-center w-8 h-8 text-white hover:bg-white/20 
                         rounded-full transition-colors duration-200"
                aria-label={isMuted ? '取消静音' : '静音'}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            </div>
            
            {/* 右侧控制组 */}
            <div className="flex items-center gap-2">
              {/* 时间显示 */}
              <div className="text-white text-xs font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              {/* 全屏按钮 */}
              <button
                onClick={toggleFullscreen}
                className="flex items-center justify-center w-8 h-8 text-white hover:bg-white/20 
                         rounded-full transition-colors duration-200"
                aria-label={isFullscreen ? '退出全屏' : '全屏播放'}
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 轻量级视频播放器 - 用于不需要复杂控制的场景
 */
export function LightVideoPlayer({
  src,
  poster,
  className,
  alt,
  onClick
}: {
  src: string
  poster?: string
  className?: string
  alt?: string
  onClick?: () => void
}) {
  // 智能优化的视频 URL
  const optimizedSrc = (() => {
    const proxyUrl = getProxyVideoUrl(src)
    if (supportsMediaFragments() && !proxyUrl.includes('#t=')) {
      return `${proxyUrl}#t=0.001`
    }
    return proxyUrl
  })()
  
  // 智能缩略图选择
  const optimalPoster = getOptimalThumbnailSource(src, poster)

  return (
    <div className={cn("relative group cursor-pointer", className)} onClick={onClick}>
      <video
        src={optimizedSrc}
        poster={optimalPoster}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="none" // 更轻量的预加载策略
        aria-label={alt || '视频预览'}
        style={{
          // 智能回退：使用 CSS 背景图
          backgroundImage: optimalPoster ? `url(${optimalPoster})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* 播放图标 */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20
                     group-hover:bg-black/30 transition-colors duration-200">
        <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm
                       transition-transform group-hover:scale-105">
          <Play className="h-6 w-6 text-white ml-0.5" />
        </div>
      </div>
    </div>
  )
}