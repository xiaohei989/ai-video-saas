import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Download, 
  Share2, 
  Eye, 
  Clock, 
  Gem,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { VideoRecord } from '@/services/videoHistoryService'
import thumbnailCacheService from '@/services/ThumbnailCacheService'
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'

interface VideoCardProps {
  video: VideoRecord
  onPlay?: () => void
  onDownload?: () => void
  onShare?: () => void
  onSelect?: () => void
  className?: string
}

export default function VideoCard({
  video,
  onPlay,
  onDownload,
  onShare,
  onSelect,
  className
}: VideoCardProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [extractedThumbnail, setExtractedThumbnail] = useState<string | null>(null)
  const [thumbnailError, setThumbnailError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Extract thumbnail if not provided using cache service and proxy
  useEffect(() => {
    if (video.videoUrl && !video.thumbnailUrl && video.status === 'completed') {
      const proxyUrl = getProxyVideoUrl(video.videoUrl)
      console.log(`[VideoCard] 开始提取缩略图: ${video.videoUrl} -> ${proxyUrl}`)
      
      thumbnailCacheService.getThumbnail(proxyUrl, {
        quality: 'medium',
        frameTime: 0.33,
        forceRefresh: false
      })
        .then(thumbnail => {
          console.log(`[VideoCard] 缩略图提取成功: ${video.id}`)
          setExtractedThumbnail(thumbnail)
        })
        .catch(error => {
          console.error(`[VideoCard] 缩略图提取失败 ${video.id}:`, error)
          setThumbnailError(error.message)
          // 即使失败也设置为null，触发重新渲染显示占位图
          setExtractedThumbnail(null)
        })
    }
  }, [video.videoUrl, video.thumbnailUrl, video.status, video.id])

  // Removed hover video preview - now only plays on click

  const handleVideoLoad = () => {
    setVideoLoaded(true)
  }
  const getStatusIcon = () => {
    switch (video.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusText = () => {
    switch (video.status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'processing':
        return 'Processing'
      default:
        return 'Pending'
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  return (
    <Card 
      className={cn(
        "overflow-hidden cursor-pointer",
        className
      )}
      onClick={onSelect}
    >
      {/* 缩略图区域 */}
      <div 
        className="relative aspect-video bg-muted"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Show thumbnail or placeholder */}
        {video.thumbnailUrl || extractedThumbnail ? (
          <img 
            src={video.thumbnailUrl || extractedThumbnail || ''} 
            alt={video.templateName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
            {thumbnailError ? (
              <div className="text-center p-4">
                <Play className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <div className="text-xs text-red-500 break-words max-w-[200px]">
                  缩略图加载失败
                </div>
              </div>
            ) : (
              <Play className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
        )}
        
        {/* 状态标签 */}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-background/90 rounded-md text-xs">
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
        
        {/* 时长标签 */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white rounded text-xs">
            {formatDuration(video.duration)}
          </div>
        )}
        
        {/* 播放按钮 - 始终显示 */}
        {video.status === 'completed' && video.videoUrl && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/30"
            onClick={(e) => {
              e.stopPropagation()
              onPlay?.()
            }}
          >
            <Button
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-full hover:scale-110 transition-transform"
            >
              <Play className="h-6 w-6 ml-0.5" />
            </Button>
          </div>
        )}
      </div>
      
      <CardContent className="p-4 space-y-3">
        {/* 标题和模板 */}
        <div>
          <h3 className="font-semibold text-sm line-clamp-1">
            {video.templateName}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {video.prompt}
          </p>
        </div>
        
        {/* 元数据 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(video.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Gem className="h-3 w-3 text-purple-600" />
            {video.credits}
          </span>
        </div>
        
        {/* 统计信息 */}
        {video.status === 'completed' && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {video.views}
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="h-3 w-3" />
              {video.shares}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {video.downloads}
            </span>
          </div>
        )}
        
        {/* 错误信息 */}
        {video.status === 'failed' && video.error && (
          <div className="text-xs text-red-500 line-clamp-2">
            Error: {video.error}
          </div>
        )}
        
        {/* 操作按钮 */}
        {video.status === 'completed' && video.videoUrl && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation()
                onDownload?.()
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation()
                onShare?.()
              }}
            >
              <Share2 className="h-3 w-3 mr-1" />
              Share
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}