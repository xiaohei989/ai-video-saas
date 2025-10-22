/**
 * 简化的视频播放器组件
 * 使用原生 video 元素，集成智能缓存的 poster 机制
 */

import React, { useState, useCallback, useRef, useEffect, useId } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2 } from '@/components/icons'
import { cn } from '@/lib/utils'
import { smartLoadImage } from '@/utils/newImageCache'
import { useResponsiveDevice, supportsHover } from '@/utils/deviceDetection'
// R2 CORS已正确配置,视频不再需要代理URL
// import { getProxyVideoUrl, needsCorsProxy } from '@/utils/videoUrlProxy'
import { useVideoContext } from '@/contexts/VideoContext'
import { smartPreloadService } from '@/services/SmartVideoPreloadService'

interface ReactVideoPlayerProps {
  // 主要属性
  videoUrl: string
  thumbnailUrl?: string
  lowResPosterUrl?: string
  autoplay?: boolean
  muted?: boolean
  controls?: boolean
  className?: string
  autoPlayOnHover?: boolean
  hoverDelay?: number
  videoId?: string // 用于Context管理的视频ID
  onPlay?: () => void
  onPause?: () => void
  onReady?: () => void
  onError?: (error: any) => void

  // SimpleVideoPlayer 兼容属性（别名支持）
  src?: string // 别名：videoUrl
  poster?: string // 别名：thumbnailUrl
  lowResPoster?: string // 别名：lowResPosterUrl
  objectFit?: string // 样式相关（暂未使用，保留兼容）
  showPlayButton?: boolean // 控制播放按钮显示（暂未使用，保留兼容）
  disablePreload?: boolean // 预加载控制（暂未使用，保留兼容）
  alt?: string // 可访问性属性（暂未使用，保留兼容）
  videoTitle?: string // 视频标题（暂未使用，保留兼容）
  onLoadStart?: () => void // 别名：加载开始事件
  onCanPlay?: () => void // 别名：onReady
  onClick?: () => void // 点击事件（组件内部处理）

  // 其他可能的 props
  [key: string]: any
}


export function ReactVideoPlayer(props: ReactVideoPlayerProps) {
  // 缓存检查逻辑已移至VideoCard层面，ReactVideoPlayer只负责播放

  // 处理属性别名，支持SimpleVideoPlayer的API
  const {
    // 主要属性
    videoUrl: propVideoUrl,
    thumbnailUrl: propThumbnailUrl,
    lowResPosterUrl: propLowResPosterUrl,
    autoplay = false,
    muted = true,
    controls = false, // 默认关闭，将根据播放状态动态设置
    className,
    autoPlayOnHover = false,
    hoverDelay = 300,
    videoId,
    onPlay,
    onPause,
    onReady,
    onError,

    // SimpleVideoPlayer 兼容属性（别名支持）
    src, // 别名：videoUrl
    poster, // 别名：thumbnailUrl
    lowResPoster, // 别名：lowResPosterUrl
    onLoadStart,
    onCanPlay, // 别名：onReady
    onClick,

    // 其他属性（保持兼容性）
    ...rest
  } = props

  // 属性别名处理：优先使用别名，回退到主属性
  const videoUrl = src || propVideoUrl
  const thumbnailUrl = poster || propThumbnailUrl
  const lowResPosterUrl = lowResPoster || propLowResPosterUrl
  
  // 事件处理别名
  const handleReady = onCanPlay || onReady
  const handleLoadStart = onLoadStart

  // 如果没有 videoUrl，降级显示缩略图
  if (!videoUrl) {
    // 静默返回 null，让父组件处理显示逻辑
    return null
  }
  const { isMobile, isDesktop } = useResponsiveDevice()
  const canHover = supportsHover()
  
  // 🚀 简化：使用VideoContext管理全局播放状态
  const { currentPlayingId, setCurrentPlaying, isVideoPlaying } = useVideoContext()
  
  // 生成或使用传入的视频ID
  const generatedId = useId()
  const currentVideoId = videoId || `video-${generatedId}`

  // 组件创建日志已移除
  
  // 基于分辨率的设备信息（统一使用一套判断逻辑）
  const deviceInfo = {
    isMobile,
    isDesktop,
    // 基于User Agent的补充信息（仅用于特定功能优化，不影响主要显示逻辑）
    isIOS: typeof navigator !== 'undefined' ? /iPad|iPhone|iPod/.test(navigator.userAgent) : false,
    isIOSChrome: typeof navigator !== 'undefined' ? /iPad|iPhone|iPod/.test(navigator.userAgent) && /CriOS/.test(navigator.userAgent) : false,
    isAndroid: typeof navigator !== 'undefined' ? /Android/.test(navigator.userAgent) : false,
    isWechat: typeof navigator !== 'undefined' ? /MicroMessenger/.test(navigator.userAgent) : false,
    isQQ: typeof navigator !== 'undefined' ? /QQ\//.test(navigator.userAgent) : false,
  }
  
  // 🚀 简化：只保留核心状态
  const [isPlaying, setIsPlaying] = useState(autoplay)
  // 所有设备点击播放默认不静音（有声音）
  const [isMuted, setIsMuted] = useState(false)
  const [hasEnded, setHasEnded] = useState(false)

  // 视频缓存相关状态（保留用于内部逻辑）
  const [isVideoCached, setIsVideoCached] = useState(false)
  const [actualVideoUrl, setActualVideoUrl] = useState(videoUrl)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [hasEverPlayed, setHasEverPlayed] = useState(autoplay)
  
  // 简化的加载和错误状态
  const [isLoadingPlay, setIsLoadingPlay] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  
  // 生成轻量级默认Poster（16:9 SVG，占位避免黑屏）
  const defaultPoster = React.useMemo(() => {
    const width = 960, height = 540
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#e9eefc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f5e8ff;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bg)"/>
        <circle cx="${width/2}" cy="${height/2}" r="56" fill="rgba(255,255,255,0.95)"/>
        <polygon points="${width/2-22},${height/2-28} ${width/2-22},${height/2+28} ${width/2+28},${height/2}" fill="#6366f1"/>
      </svg>
    `
    try {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
    } catch {
      return ''
    }
  }, [])

  // ✅ 优化：使用 useMemo 计算最优缩略图URL，避免重复计算
  const optimalPosterUrl = React.useMemo(() => {
    return thumbnailUrl || lowResPosterUrl || defaultPoster
  }, [thumbnailUrl, lowResPosterUrl, defaultPoster])

  // 缓存相关状态 - 直接使用最优URL作为初始值
  const [currentPoster, setCurrentPoster] = useState<string>(optimalPosterUrl)
  const [isPosterLoading, setIsPosterLoading] = useState(false)
  
  // 🚀 简化：只保留必要的悬停状态
  const [isHovering, setIsHovering] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  const hoverTimeoutRef = useRef<NodeJS.Timeout>()

  // 缓存日志记录函数
  const addCacheLog = useCallback((message: string) => {
    // Log removed
  }, [])

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

  // 🚀 简化：清除错误状态
  const clearError = useCallback(() => {
    setPlaybackError(null)
  }, [])

  // 🚀 简化：播放控制（使用VideoContext管理全局状态）
  const handlePlayPause = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      // 清除全局播放状态
      setCurrentPlaying(null)
      return
    }

    // 如果视频已结束,重置状态
    if (hasEnded) {
      setHasEnded(false)
      video.currentTime = 0
    }

    // 播放前清除之前的错误
    clearError()

    // 🚀 点击播放时确保有声音
    if (isMuted) {
      console.log('🔊 播放: 取消静音')
      video.muted = false
      setIsMuted(false)
    }

    // 🚀 智能判断是否需要显示加载动画
    const needsLoading = video.readyState < 3 // HAVE_FUTURE_DATA
    console.log('🔍 点击播放 - 视频准备状态:', video.readyState, needsLoading ? '需要加载' : '可以播放', '静音状态:', video.muted)

    // 只在真正需要加载时显示加载动画
    if (needsLoading) {
      setIsLoadingPlay(true)
    }

    // 🚀 简化：使用Context设置当前播放视频，其他视频会自动暂停
    setCurrentPlaying(currentVideoId)

    try {
      // 🚀 保留移动端优化逻辑
      if (deviceInfo.isMobile) {
        console.log('📱 移动端播放优化检查...')
        const video = videoRef.current
        
        if (video.readyState < 1) {
          console.log('📱 移动端: 视频元数据未加载，先加载元数据...')
          video.load()
          
          await new Promise((resolve) => {
            const startTime = Date.now()
            const maxWaitTime = 8000 // 简化：减少等待时间到8秒
            
            const checkMetadata = () => {
              const elapsedTime = Date.now() - startTime
              
              if (video.readyState >= 1) {
                console.log('📱 移动端: 元数据加载完成，耗时:', elapsedTime + 'ms')
                resolve(true)
              } else if (elapsedTime >= maxWaitTime) {
                console.warn('📱 移动端: 元数据加载超时，直接尝试播放')
                resolve(false)
              } else {
                setTimeout(checkMetadata, 500) // 简化：增加检查间隔
              }
            }
            checkMetadata()
          })
        }
      }
      
      await videoRef.current.play()
      console.log('✅ 视频播放成功，ID:', currentVideoId)
      addCacheLog(`▶️ 视频开始播放 - ${isVideoCached ? '本地缓存' : '远程流'}`)
      if (isVideoCached) {
        addCacheLog(`🚀 缓存命中！无需网络下载`)
      }
    } catch (error) {
      console.error('❌ 播放失败:', error)
      addCacheLog(`❌ 播放失败: ${error instanceof Error ? error.message : '未知错误'}`)

      // 重置状态
      setIsPlaying(false)
      setHasEverPlayed(false)
      setIsLoadingPlay(false)
      setCurrentPlaying(null) // 清除全局播放状态
      
      // 🚀 简化：错误处理
      let errorMessage = '视频播放失败，请重试'
      if (deviceInfo.isIOSChrome) {
        errorMessage = 'iOS Chrome播放限制，建议使用Safari浏览器'
      } else if (deviceInfo.isMobile && error instanceof Error && error.message.includes('network')) {
        errorMessage = '移动网络加载较慢，建议切换到WiFi'
      }
      
      setPlaybackError(errorMessage)
      console.warn('📱 播放失败，显示重试按钮:', errorMessage)
      
      // 触发外部错误回调
      onError?.(error)
    }
  }, [isPlaying, clearError, onError, currentVideoId, setCurrentPlaying, addCacheLog, isVideoCached])

  // 🚀 简化：重试播放
  const handleRetry = useCallback(async () => {
    console.log('🔄 重试播放')
    clearError()
    
    // 移动端重试前重新加载视频
    if (deviceInfo.isMobile && videoRef.current) {
      console.log('📱 移动端重试前重新加载视频')
      videoRef.current.load()
    }
    
    // 简单延迟后重试
    setTimeout(() => {
      handlePlayPause()
    }, 500)
  }, [handlePlayPause, clearError])

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

  // 🚀 简化：悬浮播放控制（仅桌面端）
  const handleMouseEnter = useCallback(() => {
    if (!canHover || isMobile || !autoPlayOnHover) return
    
    setIsHovering(true)
    
    // 清除之前的定时器
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    
    // 延迟播放
    hoverTimeoutRef.current = setTimeout(async () => {
      const video = videoRef.current
      if (!video || isPlaying) return
      
      console.log('🖱️ 悬浮播放开始，视频ID:', currentVideoId)
      
      // 🚀 智能判断是否需要显示加载动画
      const needsLoading = video.readyState < 3 // HAVE_FUTURE_DATA
      
      // 只在真正需要加载时显示加载动画
      if (needsLoading) {
        setIsLoadingPlay(true)
      }
      
      try {
        setCurrentPlaying(currentVideoId) // 设置全局播放状态
        await video.play()
        setHasEverPlayed(true)
      } catch (error) {
        setIsLoadingPlay(false)
        setCurrentPlaying(null)
      }
    }, hoverDelay)
  }, [canHover, isMobile, autoPlayOnHover, hoverDelay, isPlaying, currentVideoId, setCurrentPlaying])

  const handleMouseLeave = useCallback(() => {
    if (!canHover || isMobile) return
    
    setIsHovering(false)
    
    // 清除悬浮播放定时器
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      if (isLoadingPlay && !isPlaying) {
        setIsLoadingPlay(false)
      }
    }
    
    // 🚀 简化：如果当前视频正在播放且是悬浮触发的，则暂停
    if (isPlaying && videoRef.current && currentPlayingId === currentVideoId) {
      videoRef.current.pause()
      setCurrentPlaying(null)
    }
  }, [canHover, isMobile, isLoadingPlay, isPlaying, currentPlayingId, currentVideoId, setCurrentPlaying])

  // 🚀 点击播放控制 - 优化错误重试体验
  const handleClick = useCallback(() => {
    // 🚀 修改：如果有播放错误（即使没显示错误框），也允许重试
    if (playbackError) {
      clearError()
      // 移动端重试前重新加载视频
      if (deviceInfo.isMobile && videoRef.current) {
        console.log('📱 移动端重试前重新加载视频')
        videoRef.current.load()
      }
      // 给用户一个短暂的反馈后再尝试播放
      setTimeout(() => {
        handlePlayPause()
      }, 300)
      return
    }

    // 如果正在播放且是桌面端，不处理点击事件，让原生控件或自定义控件处理
    if (isPlaying && isDesktop) {
      return
    }
    
    // 移动端或桌面端暂停时点击播放
    handlePlayPause()
  }, [handlePlayPause, handleRetry, isDesktop, isPlaying, playbackError, clearError, deviceInfo.isMobile])


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

  // 强力调试 useEffect - 无条件执行
  useEffect(() => {
    if (!videoId) {
      // videoId 为空
    }

    try {
      // useEffect 正常执行
    } catch (error) {
      console.error(`useEffect 执行错误:`, error)
    }
  }, [videoId, currentVideoId, videoUrl])

  // 🚀 优化：移除延迟，立即检查视频缓存状态 - 解决移动端加载失败问题
  useEffect(() => {
    if (!videoId) {
      return
    }

    const checkVideoCache = async () => {
      if (!currentVideoId || !videoUrl) {
        return
      }

      try {
        addCacheLog(`检查视频缓存状态 - 视频ID: ${currentVideoId}`)

        // 🚀 移动端优化：先设置原始URL，不阻塞渲染
        setActualVideoUrl(videoUrl)

        // 验证服务是否可用
        if (!smartPreloadService || typeof smartPreloadService.isVideoCached !== 'function') {
          console.log('[VideoPlayer] ⚠️ 缓存服务不可用，使用原始URL')
          return
        }

        // 🚀 使用 Promise.race 设置超时，避免长时间等待
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => {
            console.log('[VideoPlayer] ⏰ 缓存检查超时(500ms)，使用原始URL')
            resolve(false)
          }, 500) // 500ms 超时
        })

        const cacheCheckPromise = smartPreloadService.isVideoCached(currentVideoId)

        // 并行检查缓存，超时则使用原始URL
        const isCached = await Promise.race([cacheCheckPromise, timeoutPromise])
        setIsVideoCached(isCached)

        // 如果没有缓存，额外检查是否使用了错误的ID (不阻塞)
        if (!isCached && videoId && videoId !== currentVideoId) {
          smartPreloadService.isVideoCached(videoId).catch(() => {})
        }

        if (isCached) {
          addCacheLog(`✅ 视频已缓存，获取本地URL`)
          // 获取本地缓存的视频URL
          const localUrl = await smartPreloadService.getLocalVideoUrl(currentVideoId)
          if (localUrl) {
            setActualVideoUrl(localUrl)
            addCacheLog(`✅ 使用本地缓存视频播放`)
            console.log(`[VideoPlayer] ✅ 使用缓存视频: ${currentVideoId}`)
          } else {
            addCacheLog(`⚠️ 缓存视频URL获取失败，继续使用原始URL`)
          }
        } else {
          addCacheLog(`❌ 视频未缓存，使用远程URL`)
        }
      } catch (error) {
        console.error('[VideoPlayer] 检查缓存失败:', error)
        addCacheLog(`❌ 缓存检查失败: ${error instanceof Error ? error.message : '未知错误'}`)
        // 已经设置了原始URL，无需再次设置
      }
    }

    // 🚀 立即执行，不使用延迟
    checkVideoCache()
  }, [currentVideoId, videoUrl, videoId])


  // R2 CORS已正确配置,所有视频都使用原始URL
  
  // iOS/移动端内联播放兼容属性和视频格式检测
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    
    try {
      
      // 基础移动端兼容性属性
      el.setAttribute('playsinline', 'true')
      el.setAttribute('webkit-playsinline', 'true')
      el.setAttribute('x-webkit-airplay', 'allow')
      
      // 微信/QQ浏览器特殊处理
      if (deviceInfo.isWechat || deviceInfo.isQQ) {
        el.setAttribute('x5-playsinline', 'true')
        el.setAttribute('x5-video-player-type', 'h5')
        el.setAttribute('x5-video-player-fullscreen', 'false')
        el.setAttribute('x5-video-orientation', 'portrait')
        // 微信浏览器专用属性
        if (deviceInfo.isWechat) {
          el.setAttribute('x5-video-ignore-metadata', 'true')
        }
      }
      
      // iOS Chrome特殊处理
      if (deviceInfo.isIOSChrome) {
        // iOS Chrome需要更严格的设置
        el.setAttribute('webkit-playsinline', 'true')
        el.setAttribute('playsinline', 'true')
        el.setAttribute('preload', 'none') // iOS Chrome preload设为none
      }
      
      // Android Chrome优化
      if (deviceInfo.isAndroid) {
        el.setAttribute('preload', 'metadata')
      }
      
      // 通用移动端优化
      if (deviceInfo.isMobile) {
        // 移动端禁用右键菜单
        el.setAttribute('controlsList', 'nodownload noremoteplayback')
        // 移动端视频不自动全屏
        el.setAttribute('webkit-playsinline', 'true')
        el.setAttribute('playsinline', 'true')
      }
      
    } catch (error) {
    }
  }, [deviceInfo])

  // 🚀 启用 IndexedDB 缓存的智能缩略图加载
  useEffect(() => {
    if (!optimalPosterUrl) return

    const loadPosterWithCache = async () => {
      try {
        setIsPosterLoading(true)

        // 如果有低分辨率占位图,先显示
        if (lowResPosterUrl && lowResPosterUrl !== optimalPosterUrl) {
          setCurrentPoster(lowResPosterUrl)
          if (videoRef.current) {
            videoRef.current.poster = lowResPosterUrl
          }
        }

        // 检查缓存禁用状态
        const isCacheDisabled = import.meta.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE === 'true'

        if (isCacheDisabled) {
          // 缓存禁用:直接使用原始 URL
          setCurrentPoster(optimalPosterUrl)
          if (videoRef.current) {
            videoRef.current.poster = optimalPosterUrl
          }
          setIsPosterLoading(false)
          return
        }

        // 使用 smartLoadImage 加载并缓存
        const cachedUrl = await smartLoadImage(optimalPosterUrl, {
          enableFastPreview: false,
          onFinalLoad: (finalUrl) => {
            setCurrentPoster(finalUrl)
            if (videoRef.current) {
              videoRef.current.poster = finalUrl
            }
            setIsPosterLoading(false)
          }
        })

        // 如果立即返回了缓存结果
        if (cachedUrl && cachedUrl.startsWith('data:')) {
          setCurrentPoster(cachedUrl)
          if (videoRef.current) {
            videoRef.current.poster = cachedUrl
          }
        }

        setIsPosterLoading(false)
      } catch (error) {
        console.error('[ReactVideoPlayer] 缩略图缓存加载失败:', error)
        // 失败回退到原始 URL
        setCurrentPoster(optimalPosterUrl)
        if (videoRef.current) {
          videoRef.current.poster = optimalPosterUrl
        }
        setIsPosterLoading(false)
      }
    }

    loadPosterWithCache()
  }, [optimalPosterUrl, lowResPosterUrl])


  // 🚀 Context监听效果：当其他视频开始播放时自动暂停当前视频
  useEffect(() => {
    if (!videoRef.current || !currentPlayingId) return
    
    // 如果当前播放的视频不是本视频，且本视频正在播放，则暂停
    if (currentPlayingId !== currentVideoId && isPlaying) {
      videoRef.current.pause()
    }
  }, [currentPlayingId, currentVideoId, isPlaying])

  // 🚀 确保视频初始状态不静音（所有设备）
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    console.log('🔊 视频初始化: 设置为不静音')
    video.muted = false
    setIsMuted(false)
  }, [])

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
        "relative group overflow-hidden rounded-lg bg-muted",
        (isMobile && !isPlaying) && "hover:cursor-pointer", // 只在移动端暂停时显示指针光标
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* 移动端优化的video元素 */}
      <video
        ref={videoRef}
        poster={currentPoster}
        muted={isMuted}
        playsInline
        crossOrigin="anonymous"
        preload={
          deviceInfo.isIOSChrome ? "none" : // iOS Chrome不预加载，避免兼容问题
          deviceInfo.isWechat || deviceInfo.isQQ ? "none" : // 微信/QQ浏览器不预加载，节省流量
          deviceInfo.isMobile ? "metadata" : // 其他移动设备预加载元数据
          "metadata" // 桌面端预加载元数据
        }
        controls={false}
        controlsList={deviceInfo.isMobile ? "nodownload noremoteplayback" : "nodownload"}
        className="w-full h-full object-cover"
        style={{
          // 完全隐藏系统播放控件
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          appearance: 'none',
        } as React.CSSProperties}
        onLoadStart={() => {
          addCacheLog(`📥 开始加载视频 - ${isVideoCached ? '本地缓存' : '远程'}`)
          handleLoadStart?.()
        }}
        onLoadedMetadata={() => {
          addCacheLog(`📋 视频元数据加载完成`)
          handleReady?.()
        }}
        onCanPlayThrough={() => {
          // 视频可以流畅播放，清除加载状态
          addCacheLog(`✅ 视频可以流畅播放`)
          setIsLoadingPlay(false)
        }}
        onWaiting={() => {
          // 缓冲不足，显示加载动画
          if (isPlaying || hasEverPlayed) {
            addCacheLog(isVideoCached ? `⚡ 缓存视频加载中...` : `⏳ 视频缓冲中...`)
            setIsLoadingPlay(true)
          }
        }}
        onCanPlay={() => {
          // 可以播放，隐藏加载动画
          addCacheLog(isVideoCached ? `⚡ 缓存视频准备就绪` : `🎥 视频准备就绪`)
          setIsLoadingPlay(false)
        }}
        onPlay={() => {
          setIsPlaying(true)
          setHasEverPlayed(true)
          setIsLoadingPlay(false) // 重置加载状态
          setShowControls(true)
          hideControlsAfterDelay()
          onPlay?.()
        }}
        onPause={() => {
          setIsPlaying(false)
          setShowControls(true)
          onPause?.()
        }}
        onEnded={() => {
          console.log('📱 视频播放结束')
          setIsPlaying(false)
          setHasEnded(true)
          setShowControls(false)
          // 重置到开始位置
          if (videoRef.current) {
            videoRef.current.currentTime = 0
          }
        }}
        onError={(error) => {
          
          // 重置播放状态和加载状态
          setIsPlaying(false)
          setHasEverPlayed(false)
          setIsLoadingPlay(false)
          
          // 🚀 优化：移除激进的iOS Chrome检测，只处理通用的视频加载错误
          let errorMessage = '视频加载失败，请重试'
          
          // 只针对特定的严重错误显示特殊提示，不针对iOS Chrome进行预判
          if (deviceInfo.isWechat) {
            errorMessage = '微信浏览器视频加载失败，请尝试在浏览器中打开'
          } else if (deviceInfo.isQQ) {
            errorMessage = 'QQ浏览器视频加载失败，请尝试其他浏览器'
          } else if (deviceInfo.isAndroid && error.toString().includes('network')) {
            errorMessage = 'Android设备网络连接问题，请检查网络后重试'
          } else if (deviceInfo.isMobile && error.toString().includes('decode')) {
            errorMessage = '移动端视频解码失败，请尝试刷新页面'
          }
          
          // 🚀 修改：不显示错误提示框，只记录错误信息
          setPlaybackError(errorMessage)
          
          
          // 触发外部错误回调
          onError?.(error)
        }}
      >
        {/* 🚀 R2 CORS已正确配置，直接使用实际视频URL */}
        <source src={actualVideoUrl} type="video/mp4" />
        {deviceInfo.isIOSChrome ? 
          'iOS Chrome不支持此视频格式，建议使用Safari浏览器' :
          '您的浏览器不支持视频播放，建议使用Chrome或Safari浏览器'
        }
      </video>

      {/* 🚀 统一的播放按钮和加载动画覆盖层 - 支持移动端和桌面端 */}
      {/* 🚀 修复显示逻辑：移动端默认显示播放按钮，桌面端只在悬浮交互时显示 */}
      {(() => {
        // 正在播放时不显示任何覆盖层
        if (isPlaying) return false

        // 移动端逻辑：未播放时始终显示播放按钮，或在加载/错误时显示相应状态，或播放结束后显示
        if (isMobile) {
          return !isPlaying && (isLoadingPlay || !hasEverPlayed || playbackError || hasEnded)
        }

        // 桌面端逻辑：只在用户交互时显示覆盖层，或播放结束后显示
        if (isDesktop) {
          return !isPlaying && (
            isLoadingPlay ||  // 点击播放或悬浮播放加载中
            playbackError ||  // 播放错误
            hasEnded ||  // 播放结束
            (isHovering && !hasEverPlayed) // 悬浮且未播放过时显示播放按钮
          )
        }

        return false
      })() && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className={cn(
            "bg-black/20 backdrop-blur-sm rounded-full transition-all duration-200",
            // 移动端样式
            isMobile && "p-6 hover:bg-black/30 active:scale-95",
            // 桌面端样式
            isDesktop && "p-4 hover:bg-black/40 hover:scale-110 cursor-pointer"
          )}>
            {isLoadingPlay ? (
              <Loader2 className={cn(
                "text-white animate-spin",
                isMobile ? "w-10 h-10" : "w-8 h-8"
              )} />
            ) : (
              <Play className={cn(
                "text-white fill-white",
                isMobile ? "w-10 h-10" : "w-8 h-8"
              )} />
            )}
          </div>
        </div>
      )}


    </div>
  )
}

export default ReactVideoPlayer
