/**
 * SimpleVideoPlayer 兼容层
 * 使用 ReactVideoPlayer 作为底层实现，保持 API 兼容性
 */

import React from 'react'
import ReactVideoPlayer from './ReactVideoPlayer'

interface SimpleVideoPlayerProps {
  src: string
  poster?: string
  className?: string
  objectFit?: string
  showPlayButton?: boolean
  autoPlayOnHover?: boolean
  muted?: boolean
  disablePreload?: boolean
  alt?: string
  videoId?: string
  videoTitle?: string
  onLoadStart?: () => void
  onCanPlay?: () => void
  onError?: (error: any) => void
  onPlay?: () => void
  onClick?: () => void
  // 其他可能的 props
  [key: string]: any
}

/**
 * SimpleVideoPlayer 兼容层组件
 * 将旧的 API 转换为新的 ReactVideoPlayer 组件
 */
function SimpleVideoPlayer({
  src,
  poster,
  className,
  onLoadStart,
  onCanPlay,
  onError,
  onPlay,
  onClick,
  muted = true,
  autoPlayOnHover = false,
  ...rest
}: SimpleVideoPlayerProps) {
  return (
    <ReactVideoPlayer
      videoUrl={src}
      thumbnailUrl={poster}
      autoplay={false}
      autoPlayOnHover={autoPlayOnHover}
      muted={muted}
      controls={false} // 改为false以显示自定义播放按钮
      className={className}
      onReady={onCanPlay}
      onError={onError}
      onPlay={onPlay}
      {...rest}
    />
  )
}

export default SimpleVideoPlayer