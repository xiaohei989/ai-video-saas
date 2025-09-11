/**
 * 测试背景视频组件 - 简化版本用于调试
 */

import { useRef, useState, useEffect } from 'react'
import { cn } from '@/utils/cn'

interface TestBackgroundVideoProps {
  src: string
  className?: string
  fallbackImage?: string
}

export default function TestBackgroundVideo({ 
  src, 
  className,
  fallbackImage = '/logo.png' 
}: TestBackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    console.log('[TestBackgroundVideo] 组件加载，视频源:', src)
  }, [src])

  const handleLoadedData = () => {
    console.log('[TestBackgroundVideo] 视频加载完成')
    setIsLoading(false)
    setVideoReady(true)
  }

  const handleError = (e: any) => {
    console.error('[TestBackgroundVideo] 视频加载失败:', e)
    setHasError(true)
    setIsLoading(false)
  }

  const handleCanPlay = () => {
    console.log('[TestBackgroundVideo] 视频可以播放')
    setVideoReady(true)
  }

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* 视频元素 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onLoadedData={handleLoadedData}
        onError={handleError}
        onCanPlay={handleCanPlay}
      >
        <source src={src} type="video/mp4" />
        您的浏览器不支持视频播放
      </video>

      {/* 半透明覆盖层 */}
      <div 
        className="absolute inset-0" 
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
      />

      {/* 渐变层 */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.5))'
        }}
      />

      {/* 加载状态 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm">加载背景视频中...</p>
            <p className="text-xs opacity-70 mt-1">{src}</p>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {hasError && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-gray-900"
          style={{ backgroundImage: `url(${fallbackImage})` }}
        >
          <div 
            className="absolute inset-0" 
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center bg-black/50 p-4 rounded-lg">
              <p className="text-sm font-medium">视频加载失败</p>
              <p className="text-xs opacity-70 mt-1">使用后备图片</p>
            </div>
          </div>
        </div>
      )}

      {/* 状态指示器 */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs">
        {isLoading ? '加载中...' : hasError ? '加载失败' : videoReady ? '视频就绪' : '初始化'}
      </div>
    </div>
  )
}