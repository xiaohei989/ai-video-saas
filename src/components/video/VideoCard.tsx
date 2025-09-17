import { useState } from 'react'
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
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import { VideoSkeletonLight } from '@/components/video/VideoSkeleton'

interface VideoCardProps {
  video: VideoRecord & {
    r2_url?: string | null
    migration_status?: string | null
  }
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
  const [isMobile] = useState(() => 
    typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  )
  
  // 🚀 获取最佳视频URL - 优先使用R2存储
  const getBestVideoUrl = (): string | null => {
    // 1. 优先使用R2 URL
    if (video.r2_url) {
      console.log(`[VideoCard] 使用R2 URL: ${video.id}`)
      return video.r2_url
    }
    
    // 2. 降级到原始URL
    if (video.videoUrl) {
      console.log(`[VideoCard] 使用原始URL: ${video.id}`)
      return getProxyVideoUrl(video.videoUrl)
    }
    
    return null
  }
  
  // 🚀 检查是否应该显示迁移状态
  const showMigrationStatus = () => {
    if (!video.migration_status || video.migration_status === 'completed') {
      return null
    }
    
    const statusLabels = {
      pending: '待迁移',
      downloading: '下载中',
      uploading: '上传中',
      failed: '迁移失败'
    }
    
    return statusLabels[video.migration_status as keyof typeof statusLabels] || video.migration_status
  }

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
      {/* 视频预览区域 */}
      <div className="relative aspect-video bg-muted">
        {getBestVideoUrl() ? (
          // 有视频URL - 使用统一的 SimpleVideoPlayer
          <SimpleVideoPlayer
            src={getBestVideoUrl()!}
            poster={video.thumbnailUrl || undefined} // 使用智能回退：现有缩略图优先，然后是视频URL
            className="w-full h-full"
            autoPlayOnHover={!isMobile}
            showPlayButton={true}
            muted={false}
            objectFit="cover"
            videoId={video.id}
            videoTitle={video.templateName}
            alt={video.templateName}
            onPlay={onPlay}
          />
        ) : (
          // 优化的占位符 - 使用轻量级骨骼屏
          <VideoSkeletonLight className="w-full h-full" />
        )}
        
        {/* 状态标签 */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <div className="flex items-center gap-1 px-2 py-1 bg-background/90 rounded-md text-xs">
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
          
          {/* R2迁移状态 */}
          {showMigrationStatus() && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/90 text-white rounded-md text-xs">
              {video.migration_status === 'downloading' && <Loader2 className="h-3 w-3 animate-spin" />}
              {video.migration_status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin" />}
              {video.migration_status === 'failed' && <XCircle className="h-3 w-3" />}
              <span>{showMigrationStatus()}</span>
            </div>
          )}
          
          {/* R2存储标识 */}
          {video.r2_url && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-500/90 text-white rounded-md text-xs">
              <CheckCircle className="h-3 w-3" />
              <span>R2</span>
            </div>
          )}
        </div>
        
        {/* 时长标签 */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white rounded text-xs">
            {formatDuration(video.duration)}
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