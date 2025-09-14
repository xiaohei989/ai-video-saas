import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Download, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
// import { Slider } from '@/components/ui/slider' // 暂时未使用
import { cn } from '@/utils/cn'
import { extractVideoThumbnail } from '@/utils/videoThumbnail'
import videoLoaderService, { type LoadProgress } from '@/services/VideoLoaderService'
import thumbnailGenerator from '@/services/thumbnailGeneratorService'
import ProtectedDownloadService from '@/services/protectedDownloadService'
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'

interface VideoPlayerProps {
  src: string
  poster?: string
  className?: string
  autoPlayOnHover?: boolean
  showPlayButton?: boolean
  showVolumeControl?: boolean
  objectFit?: 'contain' | 'cover'
  onDownload?: () => void
  onShare?: () => void
  alt?: string
  
  // 下载保护相关
  userId?: string
  videoId?: string
  videoTitle?: string
  enableDownloadProtection?: boolean
  
  // 性能优化选项
  enableProgressiveLoading?: boolean
  enableThumbnailCache?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  quality?: 'high' | 'medium' | 'low' | 'auto'
  
  // 加载事件
  onLoadStart?: () => void
  onLoadProgress?: (progress: LoadProgress) => void
  onLoadComplete?: () => void
  onLoadError?: (error: string) => void
  
  // 时间信息回调
  onTimeUpdate?: (currentTime: number, duration: number, isPlaying: boolean) => void
}

export default function VideoPlayer({
  src,
  poster,
  className,
  autoPlayOnHover = false,
  showPlayButton = true,
  showVolumeControl = true,
  objectFit = 'cover',
  onDownload,
  onShare,
  userId,
  videoId,
  videoTitle,
  enableDownloadProtection = true,
  enableProgressiveLoading = true,
  enableThumbnailCache = true,
  preload = 'metadata',
  quality = 'auto',
  onLoadStart,
  onLoadProgress,
  onLoadComplete,
  onLoadError,
  onTimeUpdate
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false) // 区分自动播放和手动播放
  const [duration, setDuration] = useState(0)
  // showControls 状态移除，直接使用 isHovering
  const [extractedPoster, setExtractedPoster] = useState<string | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null)
  const [hasLoadError, setHasLoadError] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // controlsTimeout 移除

  // Extract thumbnail if no poster provided (with cache support)
  useEffect(() => {
    if (src && !poster && enableThumbnailCache) {
      // 验证参数有效性
      if (!videoId) {
        console.warn(`[VideoPlayer] 跳过缩略图提取，缺少videoId:`, { src })
        return
      }
      
      thumbnailGenerator.ensureThumbnailCached(src, videoId)
        .then(thumbnail => {
          setExtractedPoster(thumbnail)
        })
        .catch(error => {
          console.error('Failed to extract thumbnail:', error)
          // 回退到原始方法
          if (src && !poster) {
            extractVideoThumbnail(src)
              .then(thumbnail => {
                setExtractedPoster(thumbnail)
              })
              .catch(e => {
                console.error('Fallback thumbnail extraction failed:', e)
              })
          }
        })
    } else if (src && !poster && !enableThumbnailCache) {
      // 使用原始方法
      extractVideoThumbnail(src)
        .then(thumbnail => {
          setExtractedPoster(thumbnail)
        })
        .catch(error => {
          console.error('Failed to extract thumbnail:', error)
        })
    }
  }, [src, poster, enableThumbnailCache, quality])

  // Handle auto-play on hover
  useEffect(() => {
    if (!autoPlayOnHover || !videoRef.current) return

    if (isHovering && !isPlaying && !isAutoPlaying) {
      // 悬浮自动播放时尝试使用当前静音状态
      videoRef.current.muted = isMuted
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true)
          setIsAutoPlaying(true)
        })
        .catch(err => {
          // 如果播放失败，强制静音播放
          console.log('Auto-play failed, trying muted:', err)
          if (videoRef.current) {
            videoRef.current.muted = true
            setIsMuted(true)
            videoRef.current.play()
              .then(() => {
                setIsPlaying(true)
                setIsAutoPlaying(true)
              })
              .catch(e => console.log('Muted auto-play also failed:', e))
          }
        })
    } else if (!isHovering && isAutoPlaying) {
      // 只在自动播放状态下才自动暂停
      videoRef.current.pause()
      videoRef.current.currentTime = 0
      setIsPlaying(false)
      setIsAutoPlaying(false)
    }
  }, [isHovering, autoPlayOnHover, isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(video.currentTime)
        // 调用时间更新回调
        onTimeUpdate?.(video.currentTime, video.duration || 0, !video.paused)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setIsAutoPlaying(false)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [isDragging])

  // 添加平滑的时间更新（仅在播放且未拖拽时）
  useEffect(() => {
    if (!isPlaying || isDragging) return
    
    const updateTime = () => {
      if (videoRef.current && !isDragging) {
        setCurrentTime(videoRef.current.currentTime)
      }
    }
    
    const interval = setInterval(updateTime, 50) // 20fps更新
    return () => clearInterval(interval)
  }, [isPlaying, isDragging])

  const togglePlay = async () => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
      setIsAutoPlaying(false) // 清除自动播放状态
    } else {
      // 在播放前检查是否需要加载视频
      if (enableProgressiveLoading && !hasLoadError) {
        try {
          setIsLoading(true)
          setHasLoadError(false)
          setLoadError(null)
          onLoadStart?.()
          
          await videoLoaderService.loadVideo(
            src,
            {
              quality,
              preload,
              enableRangeRequests: enableProgressiveLoading
            },
            (progress) => {
              setLoadProgress(progress)
              onLoadProgress?.(progress)
            }
          )
          
          setIsLoading(false)
          onLoadComplete?.()
        } catch (error) {
          setIsLoading(false)
          setHasLoadError(true)
          setLoadError(error instanceof Error ? error.message : 'Load failed')
          onLoadError?.(error instanceof Error ? error.message : 'Load failed')
          return
        }
      }
      
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true)
          setIsAutoPlaying(false) // 这是手动播放，不是自动播放
        })
        .catch(err => console.log('Manual play failed:', err))
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    
    const newMuted = !isMuted
    videoRef.current.muted = newMuted
    setIsMuted(newMuted)
  }

  // const handleSeek = (value: number[]) => {
  //   if (!videoRef.current) return
  //   
  //   const newTime = value[0]
  //   videoRef.current.currentTime = newTime
  //   setCurrentTime(newTime)
  // } // 暂时未使用

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return
    
    const rect = event.currentTarget.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickRatio = clickX / rect.width
    const newTime = clickRatio * duration
    
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current.requestFullscreen()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // handleMouseMove 函数移除，控制栏显示完全基于悬停状态

  const handleDownload = async () => {
    if (onDownload) {
      onDownload()
    } else if (enableDownloadProtection && userId && videoId) {
      // 使用受保护的下载服务
      await ProtectedDownloadService.downloadVideo(
        userId,
        videoId,
        src,
        videoTitle || 'video'
      )
    } else {
      // 默认下载行为（当保护功能未启用时）
      const a = document.createElement('a')
      a.href = src
      a.download = `video-${Date.now()}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative bg-muted rounded-t-lg overflow-hidden group", className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={videoRef}
        src={getProxyVideoUrl(src)}
        poster={poster || extractedPoster || undefined}
        className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
        onClick={togglePlay}
        loop={autoPlayOnHover}
        muted={isMuted}
        preload={preload}
        crossOrigin="anonymous"
        controlsList="nodownload"
        disablePictureInPicture
        onContextMenu={(e) => {
          if (enableDownloadProtection) {
            e.preventDefault()
          }
        }}
      />
      
      {/* 时间显示（右上角） */}
      {isPlaying && duration > 0 && (
        <div className="absolute top-2 right-2 z-10 bg-black/50 text-white px-1.5 py-0.5 rounded text-[10px] font-light backdrop-blur-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}
      
      {/* 播放按钮覆盖层 - 移动端常显，桌面端悬浮显示 */}
      {showPlayButton && !isPlaying && !isLoading && !hasLoadError && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer mobile-video-play-overlay"
          onClick={togglePlay}
        >
          <div className="mobile-video-play-button">
            <Play className="h-6 w-6 md:h-8 md:w-8 text-white ml-0.5 md:ml-1" strokeWidth={1.5} />
          </div>
        </div>
      )}
      
      {/* 加载状态覆盖层 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center text-white px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-3" />
            
            {loadProgress && (
              <>
                <div className="text-lg font-semibold mb-2">
                  {Math.round(loadProgress.percentage)}%
                </div>
                
                <div className="w-48 mx-auto mb-2">
                  <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-white h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(loadProgress.percentage, 2)}%` }}
                    />
                  </div>
                </div>
                
                {loadProgress.speed > 0 && (
                  <div className="text-sm opacity-80">
                    {loadProgress.speed.toFixed(1)} KB/s
                    {loadProgress.remainingTime > 0 && (
                      <span className="ml-2">
                        剩余 {Math.round(loadProgress.remainingTime)}s
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
            
            <div className="text-xs opacity-60 mt-2">
              正在优化加载...
            </div>
          </div>
        </div>
      )}
      
      {/* 错误状态覆盖层 */}
      {hasLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/10">
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
              加载失败
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mb-3">
              {loadError}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHasLoadError(false)
                setLoadError(null)
                togglePlay()
              }}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              重试
            </Button>
          </div>
        </div>
      )}
      
      {/* 控制栏 */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300",
        isHovering ? "opacity-100" : "opacity-0"
      )}>
        {/* 进度条区域 */}
        <div className="px-4 pt-3 pb-1">
          <div className="relative group" onClick={handleProgressClick}>
            <div 
              className="relative w-full h-1 bg-white/20 rounded-full cursor-pointer" 
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const percent = Math.max(0, Math.min(1, x / rect.width))
                const newTime = percent * duration
                if (videoRef.current) {
                  videoRef.current.currentTime = newTime
                  setCurrentTime(newTime)
                }
              }}
            >
              {/* 已播放进度 */}
              <div 
                className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-150"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              {/* 拖拽手柄 */}
              <div 
                className="absolute top-1/2 w-3 h-3 bg-white border border-white rounded-full shadow-md -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 6px)` }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDragging(true)
                  const rect = e.currentTarget.parentElement!.getBoundingClientRect()
                  
                  const handleMouseMove = (e: MouseEvent) => {
                    const x = e.clientX - rect.left
                    const percent = Math.max(0, Math.min(1, x / rect.width))
                    const newTime = percent * duration
                    setCurrentTime(newTime) // 立即更新UI
                  }
                  
                  const handleMouseUp = (e: MouseEvent) => {
                    const x = e.clientX - rect.left
                    const percent = Math.max(0, Math.min(1, x / rect.width))
                    const newTime = percent * duration
                    if (videoRef.current) {
                      videoRef.current.currentTime = newTime // 最终设置视频时间
                    }
                    setIsDragging(false)
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
              />
            </div>
          </div>
        </div>
        
        {/* 控制按钮区域 */}
        <div className="flex items-center justify-between px-4 pb-3">
          {/* 左侧控制组 */}
          <div className="flex items-center gap-1">
            {/* 播放/暂停按钮 */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20 transition-colors"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Play className="h-4 w-4 ml-0.5" strokeWidth={1.5} />
              )}
            </Button>
            
            {/* 音量切换按钮 */}
            {showVolumeControl && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20 transition-colors"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={1.5} />
                )}
              </Button>
            )}
            
          </div>
          
          {/* 右侧控制组 */}
          <div className="flex items-center gap-1">
            {onDownload && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20 transition-colors"
                onClick={handleDownload}
                title="下载视频"
              >
                <Download className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            )}
            {onShare && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20 transition-colors"
                onClick={onShare}
                title="分享视频"
              >
                <Share2 className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20 transition-colors"
              onClick={toggleFullscreen}
              title="全屏播放"
            >
              <Maximize className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}