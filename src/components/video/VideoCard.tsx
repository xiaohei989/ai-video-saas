import { useState, useEffect } from 'react'
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
import thumbnailGenerator from '@/services/thumbnailGeneratorService'
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'
import { isMobile, shouldUseMediaFragments, getCompatibleVideoURL } from '@/utils/thumbnailStrategy'

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
  const [extractedThumbnail, setExtractedThumbnail] = useState<string | null>(null)
  const [thumbnailError, setThumbnailError] = useState<string | null>(null)
  // const videoRef = useRef<HTMLVideoElement>(null) // 暂时未使用
  // const [videoLoaded] = useState(false) // setVideoLoaded暂时未使用

  // 🚀 Media Fragments + 客户端生成策略
  useEffect(() => {
    // 参数验证
    if (!video.id || !video.videoUrl || video.status !== 'completed') {
      return
    }
    
    if (!video.id.trim()) {
      console.warn(`[VideoCard] 跳过缩略图处理，video.id为空:`, video)
      return
    }
    
    // 如果已有有效缩略图（非SVG占位符），直接使用
    if (video.thumbnailUrl && !video.thumbnailUrl.startsWith('data:image/svg+xml')) {
      console.log(`[VideoCard] 使用已有缩略图: ${video.id}`)
      setExtractedThumbnail(video.thumbnailUrl)
      return
    }
    
    const generateThumbnail = async () => {
      try {
        // 🚀 移动端：优先尝试Media Fragments（让浏览器自动显示第一帧）
        if (shouldUseMediaFragments()) {
          console.log(`[VideoCard] 移动端检测，跳过客户端生成，使用Media Fragments: ${video.id}`)
          // 移动端不设置extractedThumbnail，让video元素使用Media Fragments
          setExtractedThumbnail(null)
          setThumbnailError(null)
          return
        }
        
        // 🚀 桌面端：继续使用客户端生成
        console.log(`[VideoCard] 桌面端使用客户端生成策略: ${video.id}`)
        
        const proxyUrl = getProxyVideoUrl(video.videoUrl)
        const clientThumbnail = await thumbnailGenerator.ensureThumbnailCached(proxyUrl, video.id)
        
        if (clientThumbnail) {
          console.log(`[VideoCard] 客户端缩略图生成成功: ${video.id}`)
          setExtractedThumbnail(clientThumbnail)
        } else {
          throw new Error('客户端缩略图生成失败')
        }
        
      } catch (error) {
        console.error(`[VideoCard] 缩略图生成失败 ${video.id}:`, error)
        setThumbnailError(error instanceof Error ? error.message : '缩略图生成失败')
        setExtractedThumbnail(null)
      }
    }
    
    generateThumbnail()
  }, [video.id, video.videoUrl, video.status, video.thumbnailUrl])

  // Removed hover video preview - now only plays on click

  // const handleVideoLoad = () => {
  //   setVideoLoaded(true)
  // } // 暂时未使用
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

  // const formatFileSize = (bytes?: number) => {
  //   if (!bytes) return 'N/A'
  //   const mb = bytes / (1024 * 1024)
  //   return `${mb.toFixed(1)} MB`
  // } // 暂时未使用

  return (
    <Card 
      className={cn(
        "overflow-hidden cursor-pointer",
        className
      )}
      onClick={onSelect}
    >
      {/* 缩略图区域 */}
      <div className="relative aspect-video bg-muted">
        {/* 🚀 智能缩略图显示：桌面端img + 移动端video poster */}
        {video.thumbnailUrl || extractedThumbnail ? (
          // 有缩略图时正常显示
          <img 
            src={video.thumbnailUrl || extractedThumbnail || ''} 
            alt={video.templateName}
            className="w-full h-full object-cover"
          />
        ) : shouldUseMediaFragments() && video.videoUrl ? (
          // 🚀 移动端智能缩略图方案
          <div className="w-full h-full relative overflow-hidden">
            {/* 尝试视频预览 */}
            <video 
              src={`${getCompatibleVideoURL(getProxyVideoUrl(video.videoUrl))}#t=2.0`}
              preload="metadata"
              muted
              playsInline
              poster=""
              className="w-full h-full object-cover absolute inset-0"
              style={{ pointerEvents: 'none' }}
              onLoadedMetadata={(e) => {
                const videoEl = e.target as HTMLVideoElement
                console.log(`[VideoCard] 视频元数据加载: ${video.id}, 时长: ${videoEl.duration}s`)
                // iOS兼容：延迟设置currentTime到2秒位置
                setTimeout(() => {
                  if (videoEl.duration > 2) {
                    videoEl.currentTime = 2.0
                    console.log(`[VideoCard] 设置currentTime到2秒: ${video.id}`)
                  }
                }, 150)
              }}
              onSeeked={(e) => {
                const videoEl = e.target as HTMLVideoElement
                console.log(`[VideoCard] 视频跳转完成: ${video.id}, 当前时间: ${videoEl.currentTime}s`)
                // 跳转成功，隐藏fallback
                setThumbnailError(null)
              }}
              onError={(e) => {
                console.warn(`[VideoCard] 视频预览失败: ${video.id}`, e)
                setThumbnailError('使用默认预览')
              }}
              onLoadStart={() => {
                console.log(`[VideoCard] 开始加载视频: ${video.id}`)
              }}
            />
            
            {/* 智能覆盖层 - 如果视频显示黑屏则显示 */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 transition-opacity duration-300",
              thumbnailError ? "opacity-100" : "opacity-0"
            )}>
              <div className="text-center text-white">
                <div className="relative mb-2">
                  <div className="w-16 h-16 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="h-8 w-8 text-white fill-white ml-1" />
                  </div>
                  {/* 动画光圈 */}
                  <div className="absolute inset-0 rounded-full bg-white/10 animate-ping"></div>
                </div>
                <div className="text-sm font-medium">AI生成视频</div>
                <div className="text-xs opacity-80 mt-1">{video.templateName}</div>
              </div>
            </div>
          </div>
        ) : (
          // fallback占位图
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
            {thumbnailError ? (
              <div className="text-center p-4">
                <Play className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <div className="text-xs text-red-500 break-words max-w-[200px]">
                  {thumbnailError}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Play className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <div className="text-xs text-muted-foreground">
                  {isMobile() ? 'AI生成视频' : '生成缩略图中...'}
                </div>
              </div>
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
            className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors duration-300 group"
            onClick={(e) => {
              e.stopPropagation()
              onPlay?.()
            }}
          >
            <div className="relative">
              {/* 外层光圈动画 */}
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping group-hover:animate-none"></div>
              {/* 播放按钮主体 */}
              <div
                className="h-16 w-16 rounded-full bg-black/30 hover:bg-black/50 hover:scale-110 transition-all duration-300 shadow-xl backdrop-blur-sm border-2 border-white/80 flex items-center justify-center cursor-pointer"
              >
                <Play className="h-7 w-7 ml-1 text-white fill-white drop-shadow-md" />
              </div>
            </div>
          </div>
        )}
      </div>
      
      <CardContent className="p-4 space-y-3">
        {/* AI生成的标题和简介 */}
        <div>
          <h3 className="font-semibold text-sm line-clamp-1">
            {video.title || video.templateName}
          </h3>
          {video.description ? (
            <p className="text-xs text-muted-foreground line-clamp-4 mt-0.5">
              {video.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-4 mt-0.5">
              {video.prompt}
            </p>
          )}
          {video.description && (
            <p className="text-xs text-muted-foreground/70 line-clamp-1 mt-0.5 italic">
              模板: {video.templateName}
            </p>
          )}
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