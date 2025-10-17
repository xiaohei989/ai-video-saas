/**
 * 视频网格组件
 * 负责视频列表的展示、搜索、分页等功能
 */

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Search, Loader2 } from '@/components/icons'
import Pagination from '@/components/ui/pagination'
import VideoCard from './VideoCard'
import type { Video, ThumbnailDebugInfo, LoadingState } from '@/types/video.types'
import type { VideoTask } from '@/services/VideoTaskManager'
import type { VideoProgress } from '@/services/progressManager'

interface VideoGridProps {
  // 数据
  videos: Video[]
  loadingState: LoadingState
  searchTerm: string
  page: number
  pageSize: number

  // 任务相关
  activeTasks: Map<string, VideoTask>
  videoProgress: Map<string, VideoProgress>
  currentTime: number

  // 调试信息
  videoDebugInfo: Map<string, boolean>
  thumbnailDebugInfo: Map<string, ThumbnailDebugInfo>
  videoDebugInfoData?: Map<string, ThumbnailDebugInfo> // 视频缓存调试信息
  thumbnailGeneratingVideos: Set<string>

  // 订阅状态
  isPaidUser: boolean
  subscriptionLoading: boolean

  // 事件处理
  onSearchChange: (searchTerm: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void

  // 视频操作
  onVideoPlay: (video: Video) => void
  onVideoDownload: (video: Video) => void
  onVideoShare: (video: Video) => void
  onVideoDelete: (video: Video) => void
  onVideoRegenerate: (video: Video) => void
  onToggleDebugInfo: (videoId: string) => void
  onCheckCache: (video: Video) => void
  onGenerateThumbnail: (video: Video) => void
}

export function VideoGrid({
  videos,
  loadingState,
  searchTerm,
  page,
  pageSize,
  activeTasks,
  videoProgress,
  currentTime,
  videoDebugInfo,
  thumbnailDebugInfo,
  videoDebugInfoData,
  thumbnailGeneratingVideos,
  isPaidUser,
  subscriptionLoading,
  onSearchChange,
  onPageChange,
  onPageSizeChange,
  onVideoPlay,
  onVideoDownload,
  onVideoShare,
  onVideoDelete,
  onVideoRegenerate,
  onToggleDebugInfo,
  onCheckCache,
  onGenerateThumbnail
}: VideoGridProps) {
  const { t } = useTranslation()

  // 过滤视频
  const filteredVideos = useMemo(() => {
    if (!searchTerm.trim()) return videos

    const searchLower = searchTerm.toLowerCase()
    return videos.filter(video =>
      video.title?.toLowerCase().includes(searchLower) ||
      video.prompt?.toLowerCase().includes(searchLower)
    )
  }, [videos, searchTerm])

  // 分页计算
  const totalItems = filteredVideos.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const currentPageVideos = filteredVideos.slice(startIndex, endIndex)

  // 如果正在初始加载，显示骨架屏
  if (loadingState.initial) {
    return (
      <div className="space-y-6">
        <VideoGridSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 搜索栏 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder={t('videos.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* 后台加载状态 */}
      {!loadingState.fullLoaded && (
        <div className="flex justify-end">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('video.backgroundLoading.mobile')}</span>
          </div>
        </div>
      )}

      {/* 无视频状态 */}
      {filteredVideos.length === 0 && (
        <EmptyVideoState searchTerm={searchTerm} />
      )}

      {/* 视频网格 - 智能自适应布局 */}
      {currentPageVideos.length > 0 && (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))'
          }}
        >
          {currentPageVideos.map((video) => {
            const activeTask = activeTasks.get(video.id)
            const progress = videoProgress.get(video.id)
            const thumbnailDebugInfoData = thumbnailDebugInfo.get(video.id)
            const videoDebugInfoForVideo = videoDebugInfoData?.get(video.id)
            const showDebugInfo = videoDebugInfo.get(video.id) || false
            const isGeneratingThumbnail = thumbnailGeneratingVideos.has(video.id)

            return (
              <VideoCard
                key={video.id}
                video={video}
                activeTask={activeTask}
                videoProgress={progress}
                currentTime={currentTime}
                thumbnailDebugInfo={thumbnailDebugInfoData}
                videoDebugInfo={videoDebugInfoForVideo}
                showDebugInfo={showDebugInfo}
                isGeneratingThumbnail={isGeneratingThumbnail}
                isPaidUser={isPaidUser}
                subscriptionLoading={subscriptionLoading}
                onPlay={onVideoPlay}
                onDownload={onVideoDownload}
                onShare={onVideoShare}
                onDelete={onVideoDelete}
                onRegenerate={onVideoRegenerate}
                onToggleDebugInfo={onToggleDebugInfo}
                onCheckCache={onCheckCache}
                onGenerateThumbnail={onGenerateThumbnail}
              />
            )
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            className="justify-center"
            showPageSizeSelector={false}
          />
        </div>
      )}
    </div>
  )
}

/**
 * 空状态组件
 */
interface EmptyVideoStateProps {
  searchTerm: string
}

function EmptyVideoState({ searchTerm }: EmptyVideoStateProps) {
  const { t } = useTranslation()

  if (searchTerm) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground mb-4">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">没有找到匹配的视频</p>
          <p className="text-sm">尝试使用不同的关键词搜索</p>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-12">
      <div className="text-muted-foreground mb-4">
        <p className="text-lg">{t('videos.noVideos')}</p>
        <p className="text-sm">{t('videos.noVideosDescription')}</p>
      </div>
    </div>
  )
}

/**
 * 骨架屏组件
 */
function VideoGridSkeleton() {
  return (
    <div className="space-y-6">
      {/* 搜索栏骨架 */}
      <div className="max-w-md">
        <div className="h-10 bg-muted rounded-md animate-pulse" />
      </div>

      {/* 统计信息骨架 */}
      <div className="flex justify-between items-center">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </div>

      {/* 视频网格骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }, (_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/**
 * 视频卡片骨架
 */
function VideoCardSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* 缩略图骨架 */}
      <div className="aspect-video bg-muted animate-pulse" />

      {/* 内容骨架 */}
      <div className="p-4 space-y-3">
        {/* 标题骨架 */}
        <div className="h-4 bg-muted rounded animate-pulse" />

        {/* 操作按钮骨架 */}
        <div className="flex justify-between items-center">
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="w-8 h-8 bg-muted rounded animate-pulse" />
            ))}
          </div>
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default VideoGrid