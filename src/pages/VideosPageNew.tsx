/**
 * 重构后的 VideosPage 组件
 * 使用模块化的 hooks 和组件，大幅简化代码结构
 */

import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import VideoShareModal from '@/components/share/VideoShareModal'
import VideoGrid from '@/components/video/VideoGrid'
import { VideoContextProvider } from '@/contexts/VideoContext'
import { useSEO } from '@/hooks/useSEO'
import { triggerAutoThumbnailFill } from '@/utils/videoHelpers'

// 重构后的 hooks
import { useVideosData } from '@/hooks/useVideosData'
import { useVideoTasks } from '@/hooks/useVideoTasks'
import { useVideoOperations } from '@/hooks/useVideoOperations'
import { useVideoCache } from '@/hooks/useVideoCache'

export default function VideosPageNew() {
  const { t, ready } = useTranslation()

  // 如果翻译系统未准备好，显示加载状态
  if (!ready) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  // SEO优化
  useSEO('videos')

  // 数据加载 hook
  const videosData = useVideosData({
    quickLoadPageSize: 9,
    maxPageSize: 50,
    enableAnalytics: true
  })

  // 任务管理 hook
  const videoTasks = useVideoTasks({
    onVideoUpdate: videosData.refreshVideos,
    enablePolling: true
  })

  // 视频操作 hook
  const videoOperations = useVideoOperations({
    onVideoDeleted: (videoId) => {
      // 从列表中移除删除的视频
      videosData.setVideos(prev => prev.filter(v => v.id !== videoId))
    },
    onVideoUpdated: videosData.refreshVideos,
    isPaidUser: videosData.isPaidUser,
    subscriptionLoading: videosData.subscriptionLoading
  })

  // 缓存管理 hook
  const videoCache = useVideoCache({
    enableDebugInfo: true
  })


  // 自动缩略图填充
  const handleAutoThumbnailFill = useCallback(async () => {
    if (videosData.videos.length > 0) {
      const userIdFromVideo = videosData.videos[0]?.user_id
      if (userIdFromVideo) {
        await triggerAutoThumbnailFill(userIdFromVideo)
      }
    }
  }, [videosData.videos])

  // 页面加载完成后触发自动缩略图填充
  React.useEffect(() => {
    if (videosData.loadingState.fullLoaded) {
      setTimeout(handleAutoThumbnailFill, 0)
    }
  }, [videosData.loadingState.fullLoaded, handleAutoThumbnailFill])

  // 组合缓存检查和调试信息切换
  const handleToggleDebugInfo = useCallback(async (videoId: string) => {
    await videoCache.toggleDebugInfo(videoId)

    // 如果是首次显示调试信息，检查缓存
    const isShowing = !videoCache.videoDebugInfo.get(videoId)
    if (isShowing && !videoCache.thumbnailDebugInfo.has(videoId)) {
      const video = videosData.videos.find(v => v.id === videoId)
      if (video) {
        await videoCache.checkThumbnailCache(video)
      }
    }
  }, [videoCache, videosData.videos])

  return (
    <VideoContextProvider>
      <div className="container mx-auto p-4 space-y-6">

        {/* 视频网格 */}
        <VideoGrid
          // 数据
          videos={videosData.videos}
          loadingState={videosData.loadingState}
          searchTerm={videosData.searchTerm}
          page={videosData.page}
          pageSize={videosData.pageSize}

          // 任务相关
          activeTasks={videoTasks.activeTasks}
          videoProgress={videoTasks.videoProgress}
          currentTime={videoTasks.currentTime}

          // 调试信息
          videoDebugInfo={videoCache.videoDebugInfo}
          thumbnailDebugInfo={videoCache.thumbnailDebugInfo}
          thumbnailGeneratingVideos={videoCache.thumbnailGeneratingVideos}

          // 订阅状态
          isPaidUser={videosData.isPaidUser}
          subscriptionLoading={videosData.subscriptionLoading}

          // 事件处理
          onSearchChange={videosData.setSearchTerm}
          onPageChange={videosData.setPage}
          onPageSizeChange={videosData.setPageSize}

          // 视频操作
          onVideoPlay={videoOperations.handleVideoPlay}
          onVideoDownload={videoOperations.handleDownloadClick}
          onVideoShare={videoOperations.handleShareVideo}
          onVideoDelete={(video) => videoOperations.setDeleteDialog({ open: true, video })}
          onVideoRegenerate={videoOperations.handleVirtualRegenerate}
          onToggleDebugInfo={handleToggleDebugInfo}
          onCheckCache={videoCache.checkThumbnailCache}
          onGenerateThumbnail={videoOperations.handleDynamicThumbnailGeneration}
        />

        {/* 删除确认对话框 */}
        <AlertDialog
          open={videoOperations.deleteDialog.open}
          onOpenChange={(open) =>
            videoOperations.setDeleteDialog({
              open,
              video: open ? videoOperations.deleteDialog.video : null
            })
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('videos.confirmDelete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('videos.confirmDeleteDescription', {
                  title: videoOperations.deleteDialog.video?.title || t('videos.untitledVideo')
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (videoOperations.deleteDialog.video) {
                    videoOperations.handleDeleteVideo(videoOperations.deleteDialog.video)
                  }
                }}
                className="bg-red-500 hover:bg-red-600"
              >
                {t('videos.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 分享模态框 */}
        <VideoShareModal
          open={videoOperations.videoShareModalOpen}
          onOpenChange={(open) => {
            videoOperations.setVideoShareModalOpen(open)
            if (!open) {
              videoOperations.setSelectedShareVideo(null)
            }
          }}
          video={videoOperations.selectedShareVideo}
        />
      </div>
    </VideoContextProvider>
  )
}