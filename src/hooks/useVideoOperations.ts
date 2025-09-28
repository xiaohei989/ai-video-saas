/**
 * 视频操作相关的自定义Hook
 * 包含删除、分享、下载、播放等操作逻辑
 */

import { useState, useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import supabaseVideoService from '@/services/supabaseVideoService'
import videoShareService from '@/services/videoShareService'
import { getPlayerUrl, getUrlInfo, getBestVideoUrl } from '@/utils/videoUrlPriority'
import { getProxyVideoUrl } from '@/utils/videoUrlProxy'
import { AuthContext } from '@/contexts/AuthContext'
import type { Video, DeleteDialogState } from '@/types/video.types'

interface UseVideoOperationsOptions {
  onVideoDeleted?: (videoId: string) => void
  onVideoUpdated?: (videos: Video[]) => void
  isPaidUser?: boolean
  subscriptionLoading?: boolean
}

interface UseVideoOperationsReturn {
  // 状态
  deleteDialog: DeleteDialogState
  videoShareModalOpen: boolean
  selectedShareVideo: Video | null

  // 操作
  setDeleteDialog: React.Dispatch<React.SetStateAction<DeleteDialogState>>
  setVideoShareModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedShareVideo: React.Dispatch<React.SetStateAction<Video | null>>

  // 视频操作函数
  handleDeleteVideo: (video: Video) => Promise<void>
  handleShareVideo: (video: Video) => Promise<void>
  handleVideoPlay: (video: Video) => Promise<void>
  handleDownloadClick: (video: Video) => Promise<void>
  handleDynamicThumbnailGeneration: (video: Video) => Promise<void>

  // 虚拟化网格操作（简化版）
  handleVirtualPlay: (video: Video) => Promise<void>
  handleVirtualShare: (video: Video) => void
  handleVirtualDelete: (video: Video) => void
  handleVirtualRegenerate: (video: Video) => void
}

export function useVideoOperations(options: UseVideoOperationsOptions = {}): UseVideoOperationsReturn {
  const {
    onVideoDeleted,
    onVideoUpdated,
    isPaidUser = false,
    subscriptionLoading = false
  } = options

  const { t } = useTranslation()
  const authContext = useContext(AuthContext)
  const user = authContext?.user
  const navigate = useNavigate()

  // 状态管理
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    video: null
  })
  const [videoShareModalOpen, setVideoShareModalOpen] = useState(false)
  const [selectedShareVideo, setSelectedShareVideo] = useState<Video | null>(null)

  /**
   * 删除视频
   */
  const handleDeleteVideo = useCallback(async (video: Video) => {
    if (!user) {
      toast.error(t('auth.loginRequired'))
      return
    }

    try {
      console.log('[useVideoOperations] 删除视频:', video.id)

      const { success, error } = await supabaseVideoService.deleteVideo(video.id, user.id)

      if (success) {
        toast.success(t('videos.deleted'))
        onVideoDeleted?.(video.id)

        // 关闭删除对话框
        setDeleteDialog({ open: false, video: null })

        console.log('[useVideoOperations] 视频删除成功:', video.id)
      } else {
        console.error('[useVideoOperations] 删除视频失败:', error)
        toast.error(error || t('videos.deleteFailed'))
      }
    } catch (error) {
      console.error('[useVideoOperations] 删除视频异常:', error)
      toast.error(t('videos.deleteFailed'))
    }
  }, [user, t, onVideoDeleted])

  /**
   * 分享视频
   */
  const handleShareVideo = useCallback(async (video: Video) => {
    if (!user) {
      toast.error(t('auth.loginRequired'))
      return
    }

    try {
      console.log('[useVideoOperations] 分享视频:', video.id)

      // 直接生成分享链接（不需要后端调用）
      const shareUrl = videoShareService.generateShareLink(video.id)

      console.log('[useVideoOperations] 分享链接生成成功:', shareUrl)

      // 设置分享视频并打开模态框
      setSelectedShareVideo(video)
      setVideoShareModalOpen(true)
    } catch (error) {
      console.error('[useVideoOperations] 分享视频异常:', error)
      toast.error(t('videos.shareFailed'))
    }
  }, [user, t])

  /**
   * 播放视频
   */
  const handleVideoPlay = useCallback(async (video: Video) => {
    if (!user) {
      toast.error(t('auth.loginRequired'))
      return
    }

    try {
      console.log('[useVideoOperations] 播放视频:', video.id)

      // 获取播放URL
      const playerUrl = getPlayerUrl(video)
      if (!playerUrl) {
        toast.error(t('videos.noPlayableUrl'))
        return
      }

      // 导航到播放页面
      navigate(`/video/${video.id}`)
    } catch (error) {
      console.error('[useVideoOperations] 播放视频异常:', error)
      toast.error(t('videos.playFailed'))
    }
  }, [user, t, navigate])

  /**
   * 下载视频
   */
  const handleDownloadClick = useCallback(async (video: Video) => {
    if (!user) {
      toast.error(t('auth.loginRequired'))
      return
    }

    if (subscriptionLoading) {
      toast.info(t('videos.upgradePrompt.checkingSubscription'))
      return
    }

    try {
      if (!isPaidUser) {
        toast.info(t('videos.upgradeToDownload'))
        navigate('/pricing')
        return
      }

      console.log('[useVideoOperations] 下载视频:', video.id)

      // 获取最佳视频URL
      const bestUrlResult = getBestVideoUrl(video)
      if (!bestUrlResult) {
        toast.error(t('videos.noDownloadUrl'))
        return
      }

      console.log('[useVideoOperations] 最佳下载URL:', bestUrlResult)

      // 对于下载，优先使用原始URL，避免代理可能改变的文件格式
      let downloadUrl = bestUrlResult.url

      // 只有在确实需要代理时才使用代理（主要是开发环境的CORS问题）
      if (bestUrlResult.needsProxy) {
        downloadUrl = getProxyVideoUrl(bestUrlResult.url)
        console.log('[useVideoOperations] 使用代理URL下载:', downloadUrl)
      }

      // 确保文件名有正确的扩展名
      const fileName = video.title || `video_${video.id}`
      const cleanFileName = fileName.replace(/[^\w\s-]/g, '').trim()
      const finalFileName = cleanFileName.endsWith('.mp4') ? cleanFileName : `${cleanFileName}.mp4`

      // 使用fetch + blob方式强制下载，避免浏览器直接播放MP4
      try {
        console.log('[useVideoOperations] 开始fetch下载:', downloadUrl)

        const response = await fetch(downloadUrl)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // 获取文件blob
        const blob = await response.blob()
        console.log('[useVideoOperations] Blob获取成功:', { size: blob.size, type: blob.type })

        // 创建blob URL
        const blobUrl = URL.createObjectURL(blob)

        // 创建下载链接
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = finalFileName
        link.style.display = 'none'

        // 不设置target="_blank"，避免在新窗口打开
        // link.setAttribute('target', '_blank')

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // 延迟清理blob URL，确保下载完成
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl)
          console.log('[useVideoOperations] Blob URL已清理')
        }, 3000)

        console.log('[useVideoOperations] 下载成功:', finalFileName)
      } catch (error) {
        console.error('[useVideoOperations] Fetch下载失败:', error)

        // 如果fetch失败，尝试传统方式但添加下载头
        console.log('[useVideoOperations] 尝试传统下载方式...')
        try {
          const link = document.createElement('a')
          link.href = downloadUrl
          link.download = finalFileName
          link.style.display = 'none'

          // 尝试添加下载相关属性
          link.setAttribute('download', finalFileName)
          link.setAttribute('type', 'application/octet-stream')

          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          console.log('[useVideoOperations] 传统下载方式已执行')
        } catch (fallbackError) {
          console.error('[useVideoOperations] 所有下载方式都失败:', fallbackError)
          throw new Error('下载失败，请稍后重试')
        }
      }

      toast.success(t('videos.downloadStarted'))
      console.log('[useVideoOperations] 视频下载开始:', video.id)

    } catch (error) {
      console.error('[useVideoOperations] 下载视频异常:', error)
      toast.error(t('videos.downloadFailed'))
    }
  }, [user, t, navigate, isPaidUser, subscriptionLoading])

  /**
   * 动态缩略图生成
   */
  const handleDynamicThumbnailGeneration = useCallback(async (video: Video) => {
    if (!user) {
      toast.error(t('auth.loginRequired'))
      return
    }

    try {
      console.log('[useVideoOperations] 生成动态缩略图:', video.id)

      // 这里应该调用缩略图生成服务
      // 目前先显示占位提示
      toast.info('缩略图生成功能开发中...')

    } catch (error) {
      console.error('[useVideoOperations] 生成缩略图异常:', error)
      toast.error('缩略图生成失败')
    }
  }, [user, t])

  /**
   * 虚拟化网格播放操作
   */
  const handleVirtualPlay = useCallback(async (video: Video) => {
    await handleVideoPlay(video)
  }, [handleVideoPlay])

  /**
   * 虚拟化网格分享操作
   */
  const handleVirtualShare = useCallback((video: Video) => {
    handleShareVideo(video)
  }, [handleShareVideo])

  /**
   * 虚拟化网格删除操作
   */
  const handleVirtualDelete = useCallback((video: Video) => {
    setDeleteDialog({ open: true, video })
  }, [])

  /**
   * 虚拟化网格重新生成操作
   */
  const handleVirtualRegenerate = useCallback((video: Video) => {
    // 导航到创建页面，预填充模板信息
    const templateId = video.template_id || ''
    navigate(`/create?template=${templateId}&regenerate=${video.id}`)
  }, [navigate])

  return {
    // 状态
    deleteDialog,
    videoShareModalOpen,
    selectedShareVideo,

    // 操作
    setDeleteDialog,
    setVideoShareModalOpen,
    setSelectedShareVideo,

    // 视频操作函数
    handleDeleteVideo,
    handleShareVideo,
    handleVideoPlay,
    handleDownloadClick,
    handleDynamicThumbnailGeneration,

    // 虚拟化网格操作
    handleVirtualPlay,
    handleVirtualShare,
    handleVirtualDelete,
    handleVirtualRegenerate
  }
}