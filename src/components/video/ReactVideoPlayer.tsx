/**
 * 简化的视频播放器组件
 * 使用原生 video 元素，集成智能缓存的 poster 机制
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCachedImage, generateImageUrls, smartLoadImage } from '@/utils/newImageCache'
import { useResponsiveDevice, supportsHover } from '@/utils/deviceDetection'

interface ReactVideoPlayerProps {
  videoUrl: string
  thumbnailUrl?: string
  autoplay?: boolean
  muted?: boolean
  controls?: boolean
  className?: string
  autoPlayOnHover?: boolean
  hoverDelay?: number
  onPlay?: () => void
  onPause?: () => void
  onReady?: () => void
  onError?: (error: any) => void
}

export function ReactVideoPlayer({
  videoUrl,
  thumbnailUrl,
  autoplay = false,
  muted = true,
  controls = false,
  className,
  autoPlayOnHover = false,
  hoverDelay = 300,
  onPlay,
  onPause,
  onReady,
  onError
}: ReactVideoPlayerProps) {
  const { isMobile, isDesktop } = useResponsiveDevice()
  const canHover = supportsHover()
  
  const [isPlaying, setIsPlaying] = useState(autoplay)
  const [isMuted, setIsMuted] = useState(muted)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [hasEverPlayed, setHasEverPlayed] = useState(autoplay)
  
  // 缓存相关状态
  const [currentPoster, setCurrentPoster] = useState<string>(thumbnailUrl || '')
  
  // 悬停播放相关状态
  const [isHovering, setIsHovering] = useState(false)
  const [isHoverPlaying, setIsHoverPlaying] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  const hoverTimeoutRef = useRef<NodeJS.Timeout>()

  // 自动隐藏控制条
  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }, [])

  // 鼠标移动时显示控制条（仅在播放时）
  const handleMouseMove = useCallback(() => {
    if (isPlaying) {
      setShowControls(true)
      hideControlsAfterDelay()
    }
  }, [isPlaying, hideControlsAfterDelay])

  // 暂停其他视频播放器
  const pauseOtherVideos = useCallback(() => {
    // 简单的全局视频暂停机制
    const otherVideos = document.querySelectorAll('video')
    otherVideos.forEach(video => {
      if (video !== videoRef.current) {
        video.pause()
      }
    })
  }, [])

  // 播放控制
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      pauseOtherVideos()
      videoRef.current.play().catch(console.error)
    }
  }, [isPlaying, pauseOtherVideos])

  // 音量控制
  const handleMuteToggle = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }, [isMuted])

  // 全屏控制
  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }, [isFullscreen])

  // 悬浮播放控制（仅桌面端）
  const handleMouseEnter = useCallback(() => {
    if (!canHover || isMobile || !autoPlayOnHover) return
    
    setIsHovering(true)
    
    // 清除之前的定时器
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    
    // 延迟播放
    hoverTimeoutRef.current = setTimeout(() => {
      if (!videoRef.current || isPlaying) return
      
      pauseOtherVideos()
      videoRef.current.play().catch(console.error)
      setIsHoverPlaying(true)
      setHasEverPlayed(true)
    }, hoverDelay)
  }, [canHover, isMobile, autoPlayOnHover, hoverDelay, isPlaying, pauseOtherVideos])

  const handleMouseLeave = useCallback(() => {
    if (!canHover || isMobile) return
    
    setIsHovering(false)
    
    // 清除悬浮播放定时器
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    
    // 如果是悬浮触发的播放，则暂停
    if (isHoverPlaying && videoRef.current) {
      videoRef.current.pause()
      setIsHoverPlaying(false)
    }
  }, [canHover, isMobile, isHoverPlaying])

  // 点击播放控制 - 只在暂停状态且移动端时处理
  const handleClick = useCallback(() => {
    // 播放中或桌面端时不处理点击事件，让原生控件处理
    if (isPlaying || isDesktop) {
      return
    }
    
    // 移动端暂停时点击播放
    handlePlayPause()
    
    // 如果是悬浮播放状态，转为正常播放状态
    if (isHoverPlaying) {
      setIsHoverPlaying(false)
    }
  }, [handlePlayPause, isHoverPlaying, isDesktop, isPlaying])


  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // 智能缓存 poster 加载
  useEffect(() => {
    if (!thumbnailUrl) {
      console.log('[ReactVideoPlayer] ⚠️ 无thumbnailUrl，跳过缓存处理')
      setCurrentPoster('')
      return
    }

    const loadCachedPoster = async () => {
      console.log('[ReactVideoPlayer] 🧠 开始智能缓存加载:', thumbnailUrl)
      
      try {
        // 使用优化后的智能加载函数
        const finalImageUrl = await smartLoadImage(thumbnailUrl, {
          enableFastPreview: true,
          onBlurLoad: (blurUrl) => {
            console.log('[ReactVideoPlayer] 🔄 模糊图过渡（仅在无缓存时）:', blurUrl.substring(0, 50) + '...')
            setCurrentPoster(blurUrl)
          },
          onFinalLoad: (finalUrl) => {
            console.log('[ReactVideoPlayer] ✅ 最终图加载:', typeof finalUrl, finalUrl.startsWith('data:') ? 'Base64缓存' : 'CDN地址')
            setCurrentPoster(finalUrl)
            
            // 同步更新video元素的poster
            if (videoRef.current) {
              videoRef.current.poster = finalUrl
              console.log('[ReactVideoPlayer] ✅ video元素poster已更新')
            }
          }
        })
        
        console.log('[ReactVideoPlayer] 🎯 智能加载完成:', typeof finalImageUrl)
      } catch (error) {
        console.error('[ReactVideoPlayer] ❌ 智能加载失败:', error)
        // 降级到原始URL
        setCurrentPoster(thumbnailUrl)
        if (videoRef.current) {
          videoRef.current.poster = thumbnailUrl
        }
      }
    }

    loadCachedPoster()
  }, [thumbnailUrl])


  // 清理定时器
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative group overflow-hidden rounded-lg bg-black",
        (isMobile && !isPlaying) && "hover:cursor-pointer", // 只在移动端暂停时显示指针光标
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* 简化的video元素 */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={currentPoster}
        muted={isMuted}
        playsInline
        preload="metadata"
        controls={hasEverPlayed}
        className="w-full h-full object-cover"
        onLoadedMetadata={() => {
          onReady?.()
        }}
        onPlay={() => {
          setIsPlaying(true)
          setHasEverPlayed(true)
          setShowControls(true)
          hideControlsAfterDelay()
          onPlay?.()
        }}
        onPause={() => {
          setIsPlaying(false)
          setShowControls(true)
          onPause?.()
        }}
        onError={(error) => {
          console.error('[ReactVideoPlayer] 播放错误:', error)
          onError?.(error)
        }}
      />

      {/* 移动端暂停时显示播放按钮覆盖层 */}
      {isMobile && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 transition-all duration-200">
            <Play className="text-white fill-white w-10 h-10" />
          </div>
        </div>
      )}
    </div>
  )
}

export default ReactVideoPlayer