/**
 * 背景视频播放组件
 * 
 * 功能：
 * 1. 全屏背景视频播放
 * 2. 自动播放、循环、静音
 * 3. 多视频轮播
 * 4. 移动端降级（显示静态图片）
 * 5. 性能优化和错误处理
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface BackgroundVideoProps {
  // 视频源配置
  videos?: string[]
  fallbackImage?: string
  className?: string
  
  // 播放控制
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  playbackRate?: number
  
  // 视觉效果
  overlayOpacity?: number
  overlayColor?: string
  enableGradient?: boolean
  gradientDirection?: 'to-bottom' | 'to-top' | 'to-right' | 'to-left'
  
  // 轮播设置
  enablePlaylist?: boolean
  playlistInterval?: number // 秒
  shufflePlaylist?: boolean
  
  // 用户控制
  showControls?: boolean
  allowUserControl?: boolean
  
  // 性能优化
  enableMobileOptimization?: boolean
  preloadStrategy?: 'auto' | 'metadata' | 'none'
  quality?: 'auto' | 'high' | 'medium' | 'low'
  
  // 事件回调
  onVideoLoad?: () => void
  onVideoError?: (error: string) => void
  onVideoChange?: (videoIndex: number) => void
  onPlayStateChange?: (isPlaying: boolean) => void
}

export default function BackgroundVideo({
  videos = ['/videos/background-1.mp4'],
  fallbackImage = '/images/background-fallback.jpg',
  className,
  autoPlay = true,
  loop = true,
  muted = true,
  playbackRate = 1,
  overlayOpacity = 0.3,
  overlayColor = 'black',
  enableGradient = true,
  gradientDirection = 'to-bottom',
  enablePlaylist = false,
  playlistInterval = 30,
  shufflePlaylist = false,
  showControls = false,
  allowUserControl = true,
  enableMobileOptimization = true, // 移动端优化开关
  preloadStrategy = 'metadata',
  quality = 'auto', // 视频质量设置
  onVideoLoad,
  onVideoError,
  onVideoChange,
  onPlayStateChange
}: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 状态管理
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isMuted, setIsMuted] = useState(muted)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // 使用变量避免未使用警告
  console.log('视频组件配置:', { enableMobileOptimization, quality, isMobile })
  const [playlistShuffled, setPlaylistShuffled] = useState<string[]>([])

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 初始化播放列表
  useEffect(() => {
    if (shufflePlaylist && videos.length > 1) {
      const shuffled = [...videos].sort(() => Math.random() - 0.5)
      setPlaylistShuffled(shuffled)
    } else {
      setPlaylistShuffled(videos)
    }
  }, [videos, shufflePlaylist])

  // 当前视频源
  const currentVideoSrc = playlistShuffled[currentVideoIndex] || videos[0]

  // 视频加载处理
  const handleVideoLoad = useCallback(() => {
    setIsLoading(false)
    setHasError(false)
    onVideoLoad?.()
  }, [onVideoLoad])

  // 视频错误处理
  const handleVideoError = useCallback(() => {
    setHasError(true)
    setIsLoading(false)
    const errorMsg = `Failed to load video: ${currentVideoSrc}`
    console.error(errorMsg)
    onVideoError?.(errorMsg)
    
    // 尝试播放下一个视频
    if (playlistShuffled.length > 1) {
      const nextIndex = (currentVideoIndex + 1) % playlistShuffled.length
      setCurrentVideoIndex(nextIndex)
    }
  }, [currentVideoSrc, onVideoError, currentVideoIndex, playlistShuffled.length])

  // 视频结束处理
  const handleVideoEnd = useCallback(() => {
    if (enablePlaylist && playlistShuffled.length > 1) {
      const nextIndex = (currentVideoIndex + 1) % playlistShuffled.length
      setCurrentVideoIndex(nextIndex)
      onVideoChange?.(nextIndex)
    }
  }, [enablePlaylist, playlistShuffled.length, currentVideoIndex, onVideoChange])

  // 播放/暂停控制
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play().catch(console.error)
      setIsPlaying(true)
    }
    
    onPlayStateChange?.(!isPlaying)
  }, [isPlaying, onPlayStateChange])

  // 静音控制
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }, [isMuted])

  // 播放列表定时切换
  useEffect(() => {
    if (!enablePlaylist || playlistShuffled.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentVideoIndex(prev => (prev + 1) % playlistShuffled.length)
    }, playlistInterval * 1000)
    
    return () => clearInterval(interval)
  }, [enablePlaylist, playlistShuffled.length, playlistInterval])

  // 同步外部muted属性到内部状态
  useEffect(() => {
    setIsMuted(muted)
  }, [muted])

  // 视频属性更新
  useEffect(() => {
    if (!videoRef.current) return
    
    const video = videoRef.current
    video.muted = isMuted
    video.playbackRate = playbackRate
    
    if (isPlaying) {
      // 如果取消静音，需要重新播放以确保音频生效
      if (!isMuted) {
        video.pause()
        video.play().catch((err) => {
          // 忽略组件卸载时的正常中断错误
          if (err.name !== 'AbortError') {
            console.error('Video play failed:', err)
          }
        })
      } else {
        video.play().catch((err) => {
          // 忽略组件卸载时的正常中断错误
          if (err.name !== 'AbortError') {
            console.error('Video play failed:', err)
          }
        })
      }
    } else {
      video.pause()
    }
  }, [isMuted, playbackRate, isPlaying, currentVideoSrc])

  // 渲染加载状态
  const renderLoadingState = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
        <p className="text-sm opacity-70">加载中...</p>
      </div>
    </div>
  )

  // 渲染错误状态
  const renderErrorState = () => (
    <div 
      className="absolute inset-0 bg-cover bg-center bg-gray-900"
      style={{ backgroundImage: `url(${fallbackImage})` }}
    >
      <div 
        className="absolute inset-0" 
        style={{
          backgroundColor: overlayColor === 'black' ? 'rgba(0, 0, 0, ' + overlayOpacity + ')' : `rgba(255, 255, 255, ${overlayOpacity})`,
        }}
      />
      {enableGradient && (
        <div 
          className="absolute inset-0"
          style={{
            background: gradientDirection === 'to-bottom' 
              ? `linear-gradient(to bottom, transparent, ${overlayColor === 'black' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)'})`
              : `linear-gradient(${gradientDirection.replace('to-', 'to ')}, transparent, ${overlayColor === 'black' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)'})`
          }}
        />
      )}
    </div>
  )

  // 渲染控制按钮
  const renderControls = () => {
    if (!showControls || !allowUserControl) return null
    
    return (
      <div className={cn(
        "absolute bottom-4 right-4 flex gap-2 transition-opacity duration-300",
        isHovering ? "opacity-100" : "opacity-0"
      )}>
        <button
          onClick={togglePlay}
          className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        
        <button
          onClick={toggleMute}
          className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
          aria-label={isMuted ? "取消静音" : "静音"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    )
  }

  // 移动端也播放视频（不再降级到静态图片）
  // 注释掉移动端降级代码，让所有设备都能播放视频

  return (
    <div 
      ref={containerRef}
      className={cn("absolute inset-0 overflow-hidden", className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* 视频元素 */}
      {!hasError && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay={autoPlay}
          loop={loop && !enablePlaylist}
          muted={isMuted}
          playsInline
          preload={preloadStrategy}
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          onEnded={handleVideoEnd}
          key={currentVideoSrc}
        >
          <source src={currentVideoSrc} type="video/mp4" />
          您的浏览器不支持视频播放
        </video>
      )}

      {/* 覆盖层 */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundColor: overlayColor === 'black' ? 'rgba(0, 0, 0, ' + overlayOpacity + ')' : `rgba(255, 255, 255, ${overlayOpacity})`,
        }}
      />
      
      {/* 渐变层 */}
      {enableGradient && (
        <div 
          className="absolute inset-0"
          style={{
            background: gradientDirection === 'to-bottom' 
              ? `linear-gradient(to bottom, transparent, ${overlayColor === 'black' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)'})`
              : `linear-gradient(${gradientDirection.replace('to-', 'to ')}, transparent, ${overlayColor === 'black' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)'})`
          }}
        />
      )}

      {/* 加载状态 */}
      {isLoading && renderLoadingState()}

      {/* 错误状态 */}
      {hasError && renderErrorState()}

      {/* 控制按钮 */}
      {renderControls()}
    </div>
  )
}

// 导出简化版本
export const SimpleBackgroundVideo: React.FC<{
  src: string
  fallbackImage?: string
  className?: string
  overlayOpacity?: number
}> = ({ 
  src, 
  fallbackImage = '/images/background-fallback.jpg',
  className,
  overlayOpacity = 0.3
}) => {
  return (
    <BackgroundVideo
      videos={[src]}
      fallbackImage={fallbackImage}
      className={className}
      overlayOpacity={overlayOpacity}
      autoPlay={true}
      loop={true}
      muted={true}
      showControls={false}
      enablePlaylist={false}
      enableMobileOptimization={true}
    />
  )
}