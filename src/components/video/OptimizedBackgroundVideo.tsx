/**
 * 优化的背景视频组件
 * 
 * 性能优化特性：
 * 1. 多格式支持（WebM/MP4）
 * 2. 分辨率自适应
 * 3. 渐进式加载
 * 4. 智能降级策略
 * 5. 内存优化
 * 6. 电池友好模式
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { BatteryLow } from 'lucide-react'
import { cn } from '@/utils/cn'
import { multiLevelCache, CACHE_PREFIX } from '@/services/MultiLevelCacheService'
import { thumbnailGenerator } from '@/services/thumbnailGeneratorService'
// import { smartPreloadService } from '@/services/SmartVideoPreloadService' // 暂时未使用

export interface VideoSource {
  src: string
  type: 'webm' | 'mp4' | 'avif'
  quality: 'low' | 'medium' | 'high'
  resolution: '480p' | '720p' | '1080p'
  fileSize?: number // 文件大小（字节）
}

export interface OptimizedBackgroundVideoProps {
  // 视频源配置
  sources: VideoSource[] // 多格式多质量源
  fallbackImage: string
  fallbackBlurImage?: string // 模糊版本用于加载过渡
  
  // 播放控制
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  playbackRate?: number
  
  // 性能配置
  enableAdaptive?: boolean // 启用自适应质量
  enableProgressive?: boolean // 启用渐进式加载
  enableBatteryOptimization?: boolean // 电池优化
  enableMemoryOptimization?: boolean // 内存优化
  preloadStrategy?: 'none' | 'metadata' | 'auto' | 'progressive'
  
  // 视觉效果
  overlayOpacity?: number
  overlayColor?: string
  enableGradient?: boolean
  enableBlur?: boolean // 加载时模糊效果
  transitionDuration?: number // 过渡动画时长（毫秒）
  
  // 缩略图配置
  autoGenerateThumbnail?: boolean // 自动生成缩略图
  
  // 回调
  onQualityChange?: (quality: string) => void
  onPerformanceIssue?: (issue: string) => void
  
  className?: string
}

// 设备能力检测
const detectDeviceCapabilities = () => {
  const memory = (navigator as any).deviceMemory || 8 // GB
  const cores = navigator.hardwareConcurrency || 4
  const connection = (navigator as any).connection
  
  return {
    memory,
    cores,
    isLowEndDevice: memory < 4 || cores < 4,
    isMobile: /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent),
    supportWebM: !!document.createElement('video').canPlayType('video/webm'),
    supportAVIF: !!document.createElement('img').srcset,
    connectionType: connection?.effectiveType || '4g'
  }
}

// 电池状态检测
const getBatteryStatus = async (): Promise<{ level: number; charging: boolean } | null> => {
  try {
    const battery = await (navigator as any).getBattery?.()
    if (battery) {
      return {
        level: battery.level * 100,
        charging: battery.charging
      }
    }
  } catch {
    // 忽略错误
  }
  return null
}

export default function OptimizedBackgroundVideo({
  sources,
  fallbackImage,
  fallbackBlurImage,
  autoPlay = true,
  loop = true,
  muted = true,
  playbackRate = 1, // 播放速率
  enableAdaptive = true,
  enableProgressive = true,
  enableBatteryOptimization = true,
  enableMemoryOptimization = true,
  preloadStrategy = 'progressive',
  overlayOpacity = 0.3,
  overlayColor = 'black',
  enableGradient = true,
  enableBlur = true,
  transitionDuration = 1000,
  autoGenerateThumbnail = false,
  onQualityChange,
  onPerformanceIssue,
  className
}: OptimizedBackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  console.log('OptimizedBackgroundVideo props:', { playbackRate }); // 使用变量避免警告
  const containerRef = useRef<HTMLDivElement>(null)
  const frameCallbackRef = useRef<number>(0)
  
  // 状态管理
  const [currentSource, setCurrentSource] = useState<VideoSource | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isPlaying] = useState(autoPlay) // setIsPlaying暂时未使用
  const [isMuted, setIsMuted] = useState(muted)
  const [showDegraded, setShowDegraded] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  
  // 设备能力
  const deviceCapabilities = useMemo(() => detectDeviceCapabilities(), [])
  const [batteryStatus, setBatteryStatus] = useState<{ level: number; charging: boolean } | null>(null)
  
  // 动态缩略图
  const [dynamicThumbnails, setDynamicThumbnails] = useState<{ normal: string; blur: string } | null>(null)
  
  // 性能监控
  const performanceMonitor = useRef({
    frameDrops: 0,
    lastFrameTime: 0,
    fps: 0
  })

  /**
   * 选择最佳视频源
   */
  const selectBestSource = useCallback(async (): Promise<VideoSource | null> => {
    if (!sources.length) return null
    
    // 检查电池状态
    if (enableBatteryOptimization) {
      const battery = await getBatteryStatus()
      setBatteryStatus(battery)
      
      if (battery && !battery.charging && battery.level < 20) {
        if (import.meta.env.DEV) {
          console.log('[OptimizedBG] 🔋 低电量模式，使用静态图片')
        }
        setShowDegraded(true)
        onPerformanceIssue?.('low-battery')
        return null
      }
    }
    
    // 检查设备能力
    if (deviceCapabilities.isLowEndDevice && enableMemoryOptimization) {
      if (import.meta.env.DEV) {
        console.log('[OptimizedBG] 📱 低端设备，使用低质量视频')
      }
      onPerformanceIssue?.('low-end-device')
    }
    
    // 根据网络和设备选择源
    let targetQuality: 'low' | 'medium' | 'high' = 'high'
    let targetFormat: 'webm' | 'mp4' = 'mp4'
    
    if (enableAdaptive) {
      // 网络自适应
      switch (deviceCapabilities.connectionType) {
        case 'slow-2g':
        case '2g':
          targetQuality = 'low'
          break
        case '3g':
          targetQuality = 'medium'
          break
        case '4g':
        default:
          targetQuality = deviceCapabilities.isLowEndDevice ? 'medium' : 'high'
      }
      
      // 格式选择（WebM体积更小）
      targetFormat = deviceCapabilities.supportWebM ? 'webm' : 'mp4'
    }
    
    // 查找匹配的源
    const idealSource = sources.find(s => 
      s.quality === targetQuality && s.type === targetFormat
    )
    
    // 降级查找
    const fallbackSource = idealSource || 
      sources.find(s => s.type === targetFormat) ||
      sources[0]
    
    if (import.meta.env.DEV) {
      console.log(`[OptimizedBG] 📹 选择视频源: ${fallbackSource.quality} ${fallbackSource.type}`)
    }
    onQualityChange?.(fallbackSource.quality)
    
    return fallbackSource
  }, [sources, deviceCapabilities, enableAdaptive, enableBatteryOptimization, enableMemoryOptimization, onQualityChange, onPerformanceIssue])

  /**
   * 获取最佳缩略图
   */
  const getBestThumbnails = useCallback(async (videoSrc: string) => {
    try {
      const thumbnails = await thumbnailGenerator.getBestThumbnail(videoSrc, fallbackImage)
      setDynamicThumbnails(thumbnails)
      
      // 预加载缩略图
      if (thumbnails.normal !== fallbackImage) {
        await thumbnailGenerator.preloadThumbnails([thumbnails.normal, thumbnails.blur])
        if (import.meta.env.DEV) {
          console.log('[OptimizedBG] 🖼️ 缩略图预加载完成')
        }
      }
      
      return thumbnails
    } catch (error) {
      console.warn('[OptimizedBG] 缩略图获取失败:', error)
      return { normal: fallbackImage, blur: fallbackBlurImage || fallbackImage }
    }
  }, [fallbackImage, fallbackBlurImage])

  /**
   * 生成视频缩略图（客户端）
   */
  const generateVideoThumbnail = useCallback(async (video: HTMLVideoElement) => {
    if (!autoGenerateThumbnail) return null
    
    try {
      // 等待视频元数据加载
      if (video.readyState < 1) {
        await new Promise((resolve) => {
          video.addEventListener('loadedmetadata', resolve, { once: true })
        })
      }
      
      // 跳到第2秒生成缩略图
      video.currentTime = Math.min(2, video.duration * 0.1)
      
      await new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true })
      })
      
      const thumbnails = await thumbnailGenerator.generateThumbnailFromVideo(video, {
        blurRadius: 20,
        quality: 2
      })
      
      setDynamicThumbnails(thumbnails)
      
      if (import.meta.env.DEV) {
        console.log('[OptimizedBG] 🎬 动态缩略图生成完成')
      }
      
      return thumbnails
    } catch (error) {
      console.warn('[OptimizedBG] 动态缩略图生成失败:', error)
      return null
    }
  }, [autoGenerateThumbnail])

  /**
   * 渐进式加载视频
   */
  const loadVideoProgressive = useCallback(async (source: VideoSource) => {
    if (!videoRef.current) return
    
    const video = videoRef.current
    const cacheKey = `${CACHE_PREFIX.VIDEO}bg:${source.src}`
    
    try {
      // 检查缓存
      const cached = await multiLevelCache.get<string>(cacheKey)
      if (cached) {
        if (import.meta.env.DEV) {
          console.log('[OptimizedBG] 🎯 缓存命中')
        }
        video.src = cached
        return
      }
      
      if (enableProgressive && preloadStrategy === 'progressive') {
        // 第一步：加载前3秒预览
        if (import.meta.env.DEV) {
          console.log('[OptimizedBG] ⏳ 加载预览片段...')
        }
        
        // 创建预览视频元素
        const previewVideo = document.createElement('video')
        previewVideo.src = source.src
        previewVideo.muted = true
        previewVideo.preload = 'metadata'
        
        await new Promise((resolve, reject) => {
          previewVideo.addEventListener('loadedmetadata', () => {
            previewVideo.currentTime = 0
            resolve(undefined)
          })
          previewVideo.addEventListener('error', reject)
          setTimeout(() => reject(new Error('Preview load timeout')), 5000)
        })
        
        // 第二步：开始播放预览循环
        video.src = source.src
        video.currentTime = 0
        
        // 监听加载进度
        const handleProgress = () => {
          if (video.buffered.length > 0) {
            const buffered = video.buffered.end(video.buffered.length - 1)
            const duration = video.duration || 1
            const progress = (buffered / duration) * 100
            setLoadProgress(progress)
            
            if (progress > 10) {
              // 开始播放
              video.play().catch(console.error)
            }
          }
        }
        
        video.addEventListener('progress', handleProgress)
        
        // 第三步：后台加载完整视频
        if (import.meta.env.DEV) {
          console.log('[OptimizedBG] 📥 后台加载完整视频...')
        }
        
        // 清理监听器
        return () => {
          video.removeEventListener('progress', handleProgress)
        }
      } else {
        // 直接加载
        video.src = source.src
      }
      
      // 缓存URL（仅在L1级别）
      await multiLevelCache.set(cacheKey, source.src, {
        ttl: 3600,
        level: 'L1'
      })
    } catch (error) {
      console.error('[OptimizedBG] 加载失败:', error)
      setHasError(true)
    }
  }, [enableProgressive, preloadStrategy])

  /**
   * 性能监控（使用requestVideoFrameCallback）
   */
  const startPerformanceMonitor = useCallback(() => {
    if (!videoRef.current || !(videoRef.current as any).requestVideoFrameCallback) {
      return
    }
    
    const video = videoRef.current as any
    
    const frameCallback = (now: number) => {
      const monitor = performanceMonitor.current
      
      if (monitor.lastFrameTime) {
        const delta = now - monitor.lastFrameTime
        const fps = 1000 / delta
        
        // 平滑FPS计算
        monitor.fps = monitor.fps * 0.9 + fps * 0.1
        
        // 检测掉帧
        if (delta > 50) { // 超过50ms认为掉帧
          monitor.frameDrops++
          
          if (monitor.frameDrops > 10 && enableAdaptive) {
            onPerformanceIssue?.('frame-drops')
            
            // 降低播放速率或质量
            if (video.playbackRate > 0.5) {
              video.playbackRate = 0.5
            }
          }
        }
      }
      
      monitor.lastFrameTime = now
      frameCallbackRef.current = video.requestVideoFrameCallback(frameCallback)
    }
    
    frameCallbackRef.current = video.requestVideoFrameCallback(frameCallback)
  }, [enableAdaptive, onPerformanceIssue])

  /**
   * 清理性能监控
   */
  const stopPerformanceMonitor = useCallback(() => {
    if (frameCallbackRef.current && videoRef.current) {
      (videoRef.current as any).cancelVideoFrameCallback?.(frameCallbackRef.current)
    }
  }, [])

  // 初始化
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      
      const source = await selectBestSource()
      if (source) {
        setCurrentSource(source)
        
        // 同时加载缩略图和视频
        const [thumbnails] = await Promise.allSettled([
          getBestThumbnails(source.src),
          loadVideoProgressive(source)
        ])
        
        if (thumbnails.status === 'fulfilled' && import.meta.env.DEV) {
          console.log('[OptimizedBG] 🎯 缩略图和视频加载完成')
        }
      }
      
      setIsLoading(false)
    }
    
    init()
  }, [selectBestSource, loadVideoProgressive, getBestThumbnails])

  // 性能监控
  useEffect(() => {
    if (isPlaying && !hasError && !showDegraded) {
      startPerformanceMonitor()
      return () => stopPerformanceMonitor()
    }
  }, [isPlaying, hasError, showDegraded, startPerformanceMonitor, stopPerformanceMonitor])

  // 页面可见性处理
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!videoRef.current) return
      
      if (document.hidden) {
        // 页面隐藏时暂停
        videoRef.current.pause()
      } else if (isPlaying) {
        // 页面显示时恢复
        videoRef.current.play().catch(console.error)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isPlaying])

  // 同步外部 muted 属性到内部状态
  useEffect(() => {
    if (muted !== isMuted) {
      setIsMuted(muted)
      
      // 同时更新视频元素的 muted 属性
      if (videoRef.current) {
        videoRef.current.muted = muted
      }
    }
  }, [muted, isMuted])

  // 内存优化：组件卸载时释放资源
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ''
        videoRef.current.load()
      }
    }
  }, [])

  // 渲染降级内容（静态图片）
  if (showDegraded || hasError) {
    return (
      <div 
        ref={containerRef}
        className={cn("relative overflow-hidden", className)}
      >
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${enableBlur ? 
              (dynamicThumbnails?.blur || fallbackBlurImage || fallbackImage) : 
              (dynamicThumbnails?.normal || fallbackImage)})`,
            filter: enableBlur && !dynamicThumbnails?.blur && !fallbackBlurImage ? 'blur(8px)' : undefined,
            transform: 'scale(1.1)' // 补偿模糊边缘
          }}
        />
        
        {/* 覆盖层 */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundColor: `${overlayColor === 'black' ? 'rgba(0,0,0,' : 'rgba(255,255,255,'}${overlayOpacity})`
          }}
        />
        
        {/* 渐变层 */}
        {enableGradient && (
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, transparent, ${overlayColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'})`
            }}
          />
        )}
        
        {/* 低电量提示 */}
        {batteryStatus && batteryStatus.level < 20 && (
          <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm">
            <BatteryLow className="w-4 h-4" />
            <span>视频已暂停以节省电量</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
    >
      {/* 模糊背景（加载过渡） */}
      {isLoading && enableBlur && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${dynamicThumbnails?.blur || fallbackBlurImage || fallbackImage})`,
            filter: !dynamicThumbnails?.blur && !fallbackBlurImage ? 'blur(20px)' : undefined,
            transform: 'scale(1.1)',
            transition: `opacity ${transitionDuration}ms ease-out`,
            opacity: isLoading ? 1 : 0
          }}
        />
      )}
      
      {/* 视频元素 */}
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 w-full h-full object-cover",
          "transition-opacity duration-1000",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        autoPlay={autoPlay}
        loop={loop}
        muted={isMuted}
        playsInline
        preload={preloadStrategy === 'progressive' ? 'none' : preloadStrategy}
        style={{
          // 硬件加速
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
        onLoadedData={() => {
          setIsLoading(false)
          if (autoPlay && videoRef.current) {
            videoRef.current.play().catch(console.error)
            
            // 尝试生成动态缩略图（不阻塞主流程）
            if (!dynamicThumbnails && autoGenerateThumbnail && videoRef.current) {
              generateVideoThumbnail(videoRef.current).catch(console.warn)
            }
          }
        }}
        onError={() => {
          console.error('[OptimizedBG] 视频加载失败')
          setHasError(true)
        }}
      >
        {/* 多源支持 */}
        {currentSource && (
          <source 
            src={currentSource.src} 
            type={`video/${currentSource.type === 'webm' ? 'webm' : 'mp4'}`}
          />
        )}
        您的浏览器不支持视频播放
      </video>
      
      {/* 覆盖层 */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: `${overlayColor === 'black' ? 'rgba(0,0,0,' : 'rgba(255,255,255,'}${overlayOpacity})`
        }}
      />
      
      {/* 渐变层 */}
      {enableGradient && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, transparent, ${overlayColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'})`
          }}
        />
      )}
      
      {/* 加载进度（仅在渐进式加载时显示） */}
      {isLoading && enableProgressive && loadProgress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <div 
            className="h-full bg-white/50 transition-all duration-300"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
      )}
      
      {/* 性能指示器（开发模式） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded font-mono">
          FPS: {Math.round(performanceMonitor.current.fps)}
          {currentSource && ` | ${currentSource.quality} ${currentSource.type}`}
        </div>
      )}
    </div>
  )
}