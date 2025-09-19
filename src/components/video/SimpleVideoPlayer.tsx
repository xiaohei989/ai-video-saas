/**
 * SimpleVideoPlayer - 基于主流视频网站最佳实践的简化播放器
 * 
 * 设计理念：
 * - 使用原生 <video> 标签获得最佳性能
 * - preload="metadata" 实现快速启动
 * - 最小化 JavaScript 控制，依赖浏览器原生优化
 * - 对标 YouTube、Twitter 等主流网站的播放体验
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react'
import { cn } from '@/utils/cn'
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'
import { getOptimalThumbnailSource, supportsMediaFragments } from '@/utils/thumbnailFallback'
import VideoSkeleton from './VideoSkeleton'
import { cacheHitTracker } from '@/utils/cacheHitTracker'
import { 
  toggleFullscreen as toggleFullscreenHelper,
  getFullscreenState,
  detectDeviceCapabilities,
  bindVideoFullscreenEventsiOS,
  getFullscreenTooltip
} from '@/utils/fullscreenHelper'
import { useVideoPlayback, VideoPlayerInstance } from '@/contexts/VideoPlaybackContext'

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
  const [isHoverLoading, setIsHoverLoading] = useState(false) // 悬浮加载状态
  
  // 视频加载状态
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [hasMetadata, setHasMetadata] = useState(false)
  const [currentVideoSrc, setCurrentVideoSrc] = useState(src)
  const [hasTriedFallback, setHasTriedFallback] = useState(false)
  
  // 悬停播放控制 - 简化版本
  
  // 设备能力检测
  const [deviceCapabilities] = useState(detectDeviceCapabilities())

  // 简化的全局播放管理 - 仅用于点击播放控制
  const { registerPlayer, unregisterPlayer, requestPlay, notifyPause, isCurrentlyPlaying, isPendingPlay } = useVideoPlayback()
  
  // 生成唯一的播放器ID
  const playerId = useMemo(() => {
    if (videoId) return videoId
    // 如果没有提供videoId，基于src生成唯一ID
    return `video-${src.split('/').pop()?.split('?')[0] || Math.random().toString(36).substr(2, 9)}`
  }, [videoId, src])

  // 简化的视频源优化 - 不再区分悬停模式
  const getOptimizedVideoUrl = (videoSrc: string): string => {
    const proxyUrl = getProxyVideoUrl(videoSrc)
    const isUsingProxy = proxyUrl !== videoSrc
    
    // 记录缓存命中情况
    if (isUsingProxy) {
      cacheHitTracker.recordVideoHit(videoSrc, 'proxy')
    } else {
      cacheHitTracker.recordVideoMiss(videoSrc)
    }
    
    // 只在支持 Media Fragments 的浏览器中添加参数
    if (supportsMediaFragments() && !proxyUrl.includes('#t=')) {
      const optimizedUrl = `${proxyUrl}#t=0.1`
      if (isUsingProxy) {
        cacheHitTracker.recordVideoHit(videoSrc, 'media_fragments')
      }
      return optimizedUrl
    }
    return proxyUrl
  }

  // 智能缩略图源选择
  const optimalPoster = getOptimalThumbnailSource(src, poster)

  // 创建播放器实例接口
  const playerInstance = useMemo<VideoPlayerInstance>(() => ({
    id: playerId,
    pause: () => {
      const video = videoRef.current
      if (video && !video.paused) {
        video.pause()
      }
    },
    play: async () => {
      const video = videoRef.current
      if (video && video.paused) {
        await video.play()
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime || 0,
    getDuration: () => videoRef.current?.duration || 0,
    isPlaying: () => !!(videoRef.current && !videoRef.current.paused),
    // 立即停止方法：暂停并重置到开始位置
    stopImmediate: () => {
      const video = videoRef.current
      if (video) {
        if (!video.paused) {
          video.pause()
        }
        video.currentTime = 0
      }
    }
  }), [playerId])

  // 注册和注销播放器
  useEffect(() => {
    registerPlayer(playerId, playerInstance)
    
    return () => {
      unregisterPlayer(playerId)
    }
  }, [playerId, registerPlayer, unregisterPlayer])

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
      setIsHoverLoading(false) // 播放开始时取消悬浮加载状态
      onPlay?.()
    }

    const handlePause = () => {
      setIsPlaying(false)
      // 通知全局管理器
      notifyPause(playerId)
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
      
      // 检查是否是R2代理失败，尝试直接访问R2 URL
      if (currentVideoSrc.includes('/api/r2/') && !hasTriedFallback) {
        const directR2Url = `https://cdn.veo3video.me${currentVideoSrc.replace('/api/r2', '')}`
        
        // 记录代理缓存失败，但R2直接访问成功
        cacheHitTracker.recordVideoHit(src, 'r2_direct')
        
        setHasTriedFallback(true)
        setCurrentVideoSrc(directR2Url)
        setIsLoading(true)
        setHasError(false)
        
        // 更新video元素的src
        if (video) {
          video.src = directR2Url
          video.load()
        }
        return
      }
      
      // 如果有回退URL且还未尝试过，则尝试回退
      if (fallbackSrc && !hasTriedFallback && currentVideoSrc !== fallbackSrc) {
        
        // 记录回退缓存命中
        cacheHitTracker.recordVideoHit(src, 'fallback')
        
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
      cacheHitTracker.recordVideoMiss(src)
      setIsLoading(false)
      setHasError(true)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
      setIsHoverLoading(false) // 视频可以播放时取消悬浮加载状态
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
  }, [onPlay, onPause, onTimeUpdate, src, playerId, notifyPause])

  // 🎯 极简鼠标悬停播放控制 - 直接操作video元素，无延迟无异步
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    setShowControls(true)
    
    // 🎬 极简悬浮播放：直接播放，无需任何管理器
    if (autoPlayOnHover && videoRef.current && videoRef.current.paused) {
      // 开始加载状态
      setIsHoverLoading(true)
      
      videoRef.current.muted = true  // 必须静音才能自动播放
      videoRef.current.play().then(() => {
        // 播放成功后取消加载状态
        setIsHoverLoading(false)
        setIsPlaying(true)
      }).catch(() => {
        // 播放失败也取消加载状态
        setIsHoverLoading(false)
      })
      setIsMuted(true)
    }
  }, [autoPlayOnHover])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setShowControls(false)
    setIsHoverLoading(false) // 重置悬浮加载状态
    
    // 🛑 极简悬浮暂停：直接暂停并重置，无需状态管理
    if (autoPlayOnHover && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0  // 重置到开始位置
      setIsPlaying(false)
    }
  }, [autoPlayOnHover])

  // 🎯 简化点击播放/暂停 - 保留全局管理但简化逻辑
  const handlePlayPause = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    const video = videoRef.current
    if (!video) return

    const isCurrentlyPlayingNow = isCurrentlyPlaying(playerId)

    if (isCurrentlyPlayingNow) {
      // 当前播放中，直接暂停
      video.pause()
      video.currentTime = 0  // 重置到开始位置
      notifyPause(playerId)
    } else {
      // 请求播放（这里保留全局管理，防止多个视频同时有声播放）
      const success = requestPlay(playerId)
      
      if (!success) {
        console.warn(`[SimpleVideoPlayer] 点击播放请求被拒绝: ${playerId}`)
      }
    }
  }, [playerId, isCurrentlyPlaying, notifyPause, requestPlay])

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

  // 全屏切换功能 - iOS兼容版本
  const toggleFullscreen = async () => {
    const video = videoRef.current
    const container = containerRef.current
    
    if (!video) {
      console.warn('[SimpleVideoPlayer] 视频元素不可用')
      return
    }

    try {
      const success = await toggleFullscreenHelper(video, container || undefined)
      if (!success) {
        console.warn('[SimpleVideoPlayer] 全屏切换失败')
        
        // iOS设备的回退方案
        if (deviceCapabilities.isiOS) {
          // iOS用户可以使用原生视频控制条进入全屏
        }
      }
    } catch (error) {
      console.error('[SimpleVideoPlayer] 全屏切换出错:', error)
    }
  }

  // iOS全屏事件监听
  useEffect(() => {
    const video = videoRef.current
    if (!video || !deviceCapabilities.isiOS) return

    const cleanup = bindVideoFullscreenEventsiOS(
      video,
      () => {
        setIsFullscreen(true)
      },
      () => {
        setIsFullscreen(false)
      }
    )

    return cleanup
  }, [deviceCapabilities.isiOS])

  // 标准全屏事件监听（非iOS）
  useEffect(() => {
    if (deviceCapabilities.isiOS) return

    const handleFullscreenChange = () => {
      const state = getFullscreenState()
      setIsFullscreen(state.isFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [deviceCapabilities.isiOS])

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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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

      {/* 播放按钮覆盖层 - 悬停自动播放时不显示中间播放按钮 */}
      {showPlayButton && !isCurrentlyPlaying(playerId) && !isPendingPlay(playerId) && 
       !(autoPlayOnHover && isHovered) && (
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

      {/* 悬浮加载动画 - 悬停自动播放时视频加载中显示 */}
      {autoPlayOnHover && isHovered && isHoverLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-black/50 rounded-full p-3 md:p-4 backdrop-blur-sm">
            <div className="h-6 w-6 md:h-8 md:w-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}
      
      {/* iOS全屏提示 */}
      {deviceCapabilities.isiOS && showControls && !isCurrentlyPlaying(playerId) && !isPendingPlay(playerId) && (
        <div className="absolute top-4 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          iOS: 点击全屏按钮进入全屏
        </div>
      )}


      {/* 播放控制栏 - 悬停时显示 */}
      {showControls && duration > 0 && (
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
                aria-label={isCurrentlyPlaying(playerId) ? '暂停' : '播放'}
              >
                {isCurrentlyPlaying(playerId) ? (
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
            <div className="flex items-center gap-0.5">
              {/* 时间显示 - 细字体，位于全屏按钮左侧 */}
              <div className="text-white text-xs font-light font-sans">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              {/* 全屏按钮 - 位于最右侧 */}
              <button
                onClick={toggleFullscreen}
                className="flex items-center justify-center w-8 h-8 text-white hover:bg-white/20 
                         rounded-full transition-colors duration-200"
                aria-label={getFullscreenTooltip(isFullscreen)}
                title={getFullscreenTooltip(isFullscreen)}
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
    const isUsingProxy = proxyUrl !== src
    
    // 记录轻量级播放器的缓存使用情况
    if (isUsingProxy) {
      cacheHitTracker.recordVideoHit(src, 'light_player_proxy')
    } else {
      cacheHitTracker.recordVideoMiss(src)
    }
    
    if (supportsMediaFragments() && !proxyUrl.includes('#t=')) {
      // 🚀 优化：使用时间范围片段，减少数据传输
      if (isUsingProxy) {
        cacheHitTracker.recordVideoHit(src, 'light_player_fragments')
      }
      return `${proxyUrl}#t=0.1,0.3`
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