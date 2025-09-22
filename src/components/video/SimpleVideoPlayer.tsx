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
import { getProxyVideoUrl, getVideoFallbackUrl } from '@/utils/videoUrlProxy'
import { getOptimalThumbnailSource, supportsMediaFragments } from '@/utils/thumbnailFallback'
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
  disablePreload?: boolean
  
  // 事件回调
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (currentTime: number, duration: number, isPlaying: boolean) => void
  onLoadStart?: () => void
  onCanPlay?: () => void
  onError?: () => void
  onClick?: () => void
  
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
  disablePreload = false,
  onPlay,
  onPause,
  onTimeUpdate,
  onLoadStart,
  onCanPlay,
  onError,
  onClick,
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
  // 移除 isHoverLoading，统一使用 isBuffering 状态
  
  // 视频加载状态
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [hasMetadata, setHasMetadata] = useState(false)
  const [currentVideoSrc, setCurrentVideoSrc] = useState(src)
  const [hasTriedFallback, setHasTriedFallback] = useState(false)
  
  // 🚀 缓冲进度相关状态
  const [bufferProgress, setBufferProgress] = useState(0) // 缓冲进度百分比
  const [isBuffering, setIsBuffering] = useState(false) // 是否正在缓冲
  const [canPlaySmooth, setCanPlaySmooth] = useState(false) // 是否有足够缓冲可以流畅播放
  const [currentPreload, setCurrentPreload] = useState<"none" | "metadata" | "auto">(disablePreload ? "none" : "metadata")
  
  // 🔧 修复点击暂停后自动播放的问题
  const [userPaused, setUserPaused] = useState(false) // 用户是否主动暂停
  
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
      // 简化后移除了缓存命中追踪器 // cacheHitTracker.recordVideoHit(videoSrc, 'proxy')
    } else {
      // 简化后移除了缓存未命中追踪器 // cacheHitTracker.recordVideoMiss(videoSrc)
    }
    
    // 只在支持 Media Fragments 的浏览器中添加参数
    if (supportsMediaFragments() && !proxyUrl.includes('#t=')) {
      const optimizedUrl = `${proxyUrl}#t=0.1`
      if (isUsingProxy) {
        // 简化后移除了缓存命中追踪器 // cacheHitTracker.recordVideoHit(videoSrc, 'media_fragments')
      }
      return optimizedUrl
    }
    return proxyUrl
  }

  // 智能缩略图源选择
  const optimalPoster = getOptimalThumbnailSource(src, poster)

  // 🚀 优化：当有缩略图时，立即允许显示内容，无需等待视频加载
  useEffect(() => {
    if (optimalPoster && isLoading) {
      // 如果有可用的缩略图，可以立即显示内容，无需等待视频元数据
      setIsLoading(false)
    }
  }, [optimalPoster, isLoading, playerId])

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

  // 处理src变化，重置回退状态和缓冲状态
  useEffect(() => {
    if (src !== currentVideoSrc) {
      setCurrentVideoSrc(src)
      setHasTriedFallback(false)
      setHasError(false)
      setIsLoading(true)
      // 🔄 只在视频源改变时才重置缓冲状态
      setBufferProgress(0)
      setCanPlaySmooth(false)
      setIsBuffering(false)
      setCurrentPreload(disablePreload ? "none" : "metadata")
    }
  }, [src])

  // 处理播放状态变化
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      setIsPlaying(true)
      setIsBuffering(false) // 播放开始时取消缓冲状态
      setIsLoading(false) // 🔧 修复：视频开始播放时立即取消加载状态，避免骨骼屏遮挡画面
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
      onLoadStart?.()
    }

    const handleLoadedData = () => {
      setIsLoading(false)
    }

    const handleError = () => {
      
      // 使用智能回退机制
      if (!hasTriedFallback) {
        const fallbackUrl = getVideoFallbackUrl(currentVideoSrc, src)
        
        if (fallbackUrl !== currentVideoSrc) {
          
          setHasTriedFallback(true)
          setCurrentVideoSrc(fallbackUrl)
          setIsLoading(true)
          setHasError(false)
          
          // 更新video元素的src
          if (video) {
            video.src = fallbackUrl
            video.load()
          }
          return
        }
      }
      
      // 如果还有用户提供的回退URL且还未尝试过，则尝试回退
      if (fallbackSrc && currentVideoSrc !== fallbackSrc && !currentVideoSrc.includes(fallbackSrc)) {
        
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
      
      // 所有回退策略都失败了，显示错误
      setIsLoading(false)
      setHasError(true)
      onError?.()
    }

    const handleCanPlay = () => {
      setIsLoading(false)
      setIsBuffering(false) // 视频可以播放时取消缓冲状态
      setCanPlaySmooth(true) // 标记可以流畅播放
      
      // 🚀 简化逻辑：如果悬停中且视频可播放，且用户没有暂停，才自动播放
      if (isHovered && autoPlayOnHover && !isCurrentlyPlaying(playerId) && !userPaused) {
        const success = requestPlay(playerId)
        if (success) {
          const video = videoRef.current
          if (video && video.paused) {
            video.play().catch(() => {})
          }
        }
      }
      
      onCanPlay?.()
    }

    // 🚀 缓冲进度监听器
    const handleProgress = () => {
      if (!video.buffered.length) return
      
      const duration = video.duration
      if (!duration) return
      
      // 计算已缓冲的最大时间点
      let bufferedEnd = 0
      for (let i = 0; i < video.buffered.length; i++) {
        bufferedEnd = Math.max(bufferedEnd, video.buffered.end(i))
      }
      
      // 计算缓冲进度百分比
      const progress = (bufferedEnd / duration) * 100
      setBufferProgress(progress)
      
      // 判断是否有足够缓冲可以开始播放（至少3秒或10%）
      const bufferedSeconds = bufferedEnd - video.currentTime
      const hasEnoughBuffer = bufferedSeconds >= 3 || progress >= 10
      setCanPlaySmooth(hasEnoughBuffer)
      
      // 🚀 简化缓冲逻辑：当缓冲足够时，且用户没有暂停，才自动开始播放
      if (hasEnoughBuffer && isBuffering && autoPlayOnHover && isHovered && !isCurrentlyPlaying(playerId) && !userPaused) {
        
        // 🔧 延迟隐藏缓冲状态，确保用户能看到100%
        if (progress >= 99) {
          setTimeout(() => {
            setIsBuffering(false)
          }, 300) // 延迟300ms隐藏
        } else {
          setIsBuffering(false)
        }
        
        const success = requestPlay(playerId)
        if (success) {
          const video = videoRef.current
          if (video && video.paused) {
            video.play().catch(() => {})
          }
        }
      } else if (hasEnoughBuffer && isBuffering && userPaused && isHovered) {
        // 即使用户暂停了，也要隐藏缓冲状态
        setIsBuffering(false)
      }
      
    }

    // 🚀 缓冲状态监听器
    const handleWaiting = () => {
      setIsBuffering(true)
    }

    const handleCanPlayThrough = () => {
      setIsBuffering(false)
      setCanPlaySmooth(true)
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
    video.addEventListener('progress', handleProgress)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('canplaythrough', handleCanPlayThrough)

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
      video.removeEventListener('progress', handleProgress)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('canplaythrough', handleCanPlayThrough)
    }
  }, [onPlay, onPause, onTimeUpdate, onLoadStart, onCanPlay, onError, currentVideoSrc, hasTriedFallback, fallbackSrc, playerId, notifyPause, isBuffering, autoPlayOnHover, isHovered, isCurrentlyPlaying, requestPlay, userPaused])

  // 🚀 添加加载超时机制，防止 isLoading 状态永久卡住
  useEffect(() => {
    if (!isLoading || disablePreload) return

    const timeout = setTimeout(() => {
      const video = videoRef.current
      if (video && isLoading) {
        setIsLoading(false)
      }
    }, 3000) // 3秒超时

    return () => clearTimeout(timeout)
  }, [isLoading, playerId, disablePreload])

  // 🚀 添加状态一致性检查，检测并修正状态不一致的情况
  useEffect(() => {
    const video = videoRef.current
    if (!video || disablePreload) return

    // 定期检查状态一致性
    const checkInterval = setInterval(() => {
      // 检测1：视频已准备好但仍显示加载状态
      if (isLoading && video.readyState >= 1) {
        setIsLoading(false)
        setHasMetadata(true)
      }

      // 检测2：视频有duration但hasMetadata为false
      if (!hasMetadata && video.duration && video.duration > 0) {
        setHasMetadata(true)
        setDuration(video.duration)
      }
    }, 1000) // 每秒检查一次

    return () => clearInterval(checkInterval)
  }, [isLoading, hasMetadata, playerId, disablePreload])

  // 🚀 组件挂载后立即进行一次状态检查
  useEffect(() => {
    const video = videoRef.current
    if (!video || disablePreload) return

    // 短暂延迟后检查初始状态，确保 video 元素已经开始加载
    const initialCheck = setTimeout(() => {
      // 如果视频已经有poster或背景图，但仍在loading状态，可能需要重置
      if (isLoading && (optimalPoster || video.poster)) {
        // 检查视频是否实际需要加载状态
        if (video.readyState === 0 && video.networkState === video.NETWORK_NO_SOURCE) {
          // 视频还没开始加载，这是正常的
        } else if (video.readyState >= 1) {
          // 视频已经有元数据了，重置加载状态
          setIsLoading(false)
        }
      }
    }, 100)

    return () => clearTimeout(initialCheck)
  }, [disablePreload]) // 只在挂载时执行一次

  // 🎯 简化悬停播放控制 - 根据用户要求完全重写
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    setShowControls(true)
    
    const video = videoRef.current
    if (!autoPlayOnHover || !video) return
    
    
    // 🔧 如果用户主动暂停了，不自动播放
    if (userPaused) {
      return
    }
    
    // 🚀 简化逻辑：检查视频是否可以播放
    if (video.readyState >= 3) {
      // 视频已加载足够数据，可以播放 - 立即自动播放
      const success = requestPlay(playerId)
      if (success) {
        video.play().catch(() => {})
      }
    } else {
      // 视频还在加载 - 显示加载动画
      setIsBuffering(true)
      
      // 启用预加载加速缓冲
      if (currentPreload !== "auto") {
        setCurrentPreload("auto")
        video.preload = "auto"
        video.load()
      }
    }
  }, [autoPlayOnHover, currentPreload, playerId, requestPlay, userPaused])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setShowControls(false)
    
    const video = videoRef.current
    if (!autoPlayOnHover || !video) return
    
    
    // 🛑 简化逻辑：停止播放，不显示任何加载动画和播放组件
    if (!video.paused) {
      video.pause()
      video.currentTime = 0  // 重置到开始位置
      setIsPlaying(false)
      notifyPause(playerId)
    }
    
    // 隐藏所有UI组件
    setIsBuffering(false)
    
    // 🔧 重置用户暂停状态，下次鼠标进入时可以重新自动播放
    setUserPaused(false)
    
  }, [autoPlayOnHover, playerId, notifyPause])

  // 🎯 修复点击播放/暂停 - 确保播放状态与UI同步
  const handlePlayPause = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    const video = videoRef.current
    if (!video) return

    const isCurrentlyPlayingNow = isCurrentlyPlaying(playerId)

    if (isCurrentlyPlayingNow) {
      // 当前播放中，直接暂停
      video.pause()
      video.currentTime = 0  // 重置到开始位置
      notifyPause(playerId)
      
      // 🔧 关键修复：设置用户暂停标记，防止悬停时自动播放
      setUserPaused(true)
    } else {
      // 🔧 修复：等待播放请求完成后再更新UI状态
      try {
        // 先检查是否可以播放
        if (!video.src || video.networkState === video.NETWORK_NO_SOURCE) {
          return
        }

        // 🔧 用户主动播放时，清除暂停标记
        setUserPaused(false)

        // 请求播放（保留全局管理，防止多个视频同时有声播放）
        const success = requestPlay(playerId)
        
        if (!success) {
          return
        }

        // 📱 移动端修复：确保用户交互触发的播放
        // 不依赖全局管理器的异步播放，直接在用户交互中播放
        if (video.paused) {
          // 🔧 播放前先确保加载状态正确，避免骨骼屏遮挡
          if (isLoading) {
            setIsLoading(false)
          }
          await video.play()
        }
      } catch (error) {
        // 播放失败时确保UI状态正确
        notifyPause(playerId)
      }
    }
  }, [playerId, isCurrentlyPlaying, notifyPause, requestPlay])

  // 点击视频区域播放/暂停
  const handleVideoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onClick?.()
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
      return
    }

    try {
      const success = await toggleFullscreenHelper(video, container || undefined)
      if (!success) {
        // iOS设备的回退方案
        if (deviceCapabilities.isiOS) {
          // iOS用户可以使用原生视频控制条进入全屏
        }
      }
    } catch (error) {
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

      {/* 原生视频元素 */}
      <video
        ref={videoRef}
        src={getOptimizedVideoUrl(currentVideoSrc)}
        poster={optimalPoster}
        className={cn(
          `w-full h-full cursor-pointer`,
          objectFit === 'cover' ? 'object-cover' : 'object-contain',
          // 🚀 修复：移除 opacity-0，改用更精确的状态控制
          // 让 CSS 背景图始终可见，只在真正错误时才完全隐藏
          hasError && !optimalPoster ? 'hidden' : ''
        )}
        onClick={handleVideoClick}
        muted={isMuted}
        playsInline // 移动端内联播放
        preload={disablePreload ? "none" : currentPreload} // 🚀 动态预加载：悬停时自动缓冲
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

      {/* 🚀 简化UI渲染：鼠标进入时根据视频状态显示不同内容 */}
      {isHovered && autoPlayOnHover && (
        <>
          {/* 加载状态：显示转圈动画 */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="h-12 w-12 md:h-14 md:w-14 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm relative border border-white/20">
                {/* 旋转动画 */}
                <div className="h-6 w-6 md:h-7 md:w-7 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                
                {/* 百分比显示 - 使用更显眼的样式 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold bg-black/80 px-2 py-1 rounded-md border border-white/30 shadow-lg">
                    {Math.round(bufferProgress)}%
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* 非加载状态且未播放：显示播放按钮 */}
          {!isBuffering && showPlayButton && !isCurrentlyPlaying(playerId) && !isPendingPlay(playerId) && (
            <div 
              className="absolute inset-0 flex items-center justify-center cursor-pointer transition-opacity duration-200"
              onClick={handlePlayPause}
            >
              <Play className="h-6 w-6 md:h-8 md:w-8 text-white" />
            </div>
          )}
        </>
      )}
      
      {/* 播放控制栏 - 悬停且有视频时显示（无论播放还是暂停） */}
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
              {/* 🚀 播放/暂停按钮 - 根据播放状态显示不同图标 */}
              <button
                onClick={handlePlayPause}
                className="flex items-center justify-center w-8 h-8 text-white hover:bg-white/20 
                         rounded-full transition-colors duration-200"
                aria-label={isCurrentlyPlaying(playerId) ? "暂停" : "播放"}
              >
                {isCurrentlyPlaying(playerId) ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
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
      // 简化后移除了缓存命中追踪器 // cacheHitTracker.recordVideoHit(src, 'light_player_proxy')
    } else {
      // 简化后移除了缓存未命中追踪器 // cacheHitTracker.recordVideoMiss(src)
    }
    
    if (supportsMediaFragments() && !proxyUrl.includes('#t=')) {
      // 🚀 优化：使用时间范围片段，减少数据传输
      if (isUsingProxy) {
        // 简化后移除了缓存命中追踪器 // cacheHitTracker.recordVideoHit(src, 'light_player_fragments')
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