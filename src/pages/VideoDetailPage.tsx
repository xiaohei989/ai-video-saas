import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Eye, 
  Calendar,
  User,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'
import VideoShareModal from '@/components/share/VideoShareModal'
import supabaseVideoService from '@/services/supabaseVideoService'
import videoShareService from '@/services/videoShareService'
import { formatRelativeTime, formatDuration } from '@/utils/timeFormat'
import { toast } from 'sonner'
import type { Database } from '@/lib/supabase'

type Video = Database['public']['Tables']['videos']['Row']

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { navigateTo } = useLanguageRouter()
  const { t } = useTranslation()
  
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  
  // 更新页面meta标签
  const updatePageMeta = (video: Video) => {
    const title = `${video.title || '精彩视频'} | AI视频生成平台`
    const description = video.prompt || 'AI生成的精彩视频内容'
    const videoUrl = video.video_url || ''
    // 确保缩略图URL是完整的HTTPS链接，如果没有则使用默认图片
    const thumbnailUrl = video.thumbnail_url || `${window.location.origin}/default-video-thumbnail.jpg`
    const pageUrl = `${window.location.origin}/video/${video.id}`
    
    // 更新页面标题
    document.title = title
    
    // 更新或创建meta标签
    const updateMetaTag = (property: string, content: string, attribute = 'property') => {
      let meta = document.querySelector(`meta[${attribute}="${property}"]`)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute(attribute, property)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }
    
    // 基础meta标签
    updateMetaTag('description', description, 'name')
    
    // Open Graph tags
    updateMetaTag('og:title', title)
    updateMetaTag('og:description', description)
    updateMetaTag('og:type', 'video.other')
    updateMetaTag('og:url', pageUrl)
    updateMetaTag('og:image', thumbnailUrl)
    updateMetaTag('og:video', videoUrl)
    
    // Twitter Card tags
    updateMetaTag('twitter:card', 'player', 'name')
    updateMetaTag('twitter:site', '@veo3video_me', 'name')
    updateMetaTag('twitter:creator', '@veo3video_me', 'name')
    updateMetaTag('twitter:title', title, 'name')
    updateMetaTag('twitter:description', description, 'name')
    updateMetaTag('twitter:image', thumbnailUrl, 'name')
    updateMetaTag('twitter:image:alt', `视频预览: ${video.title}`, 'name')
    updateMetaTag('twitter:player', `${window.location.origin}/embed/${video.id}`, 'name')
    updateMetaTag('twitter:player:width', '1280', 'name')
    updateMetaTag('twitter:player:height', '720', 'name')
    updateMetaTag('twitter:player:stream', videoUrl, 'name')
    updateMetaTag('twitter:player:stream:content_type', 'video/mp4', 'name')
  }
  
  // 获取视频数据
  useEffect(() => {
    if (!id) return
    
    const fetchVideo = async () => {
      try {
        setLoading(true)
        const videoData = await supabaseVideoService.getVideo(id)
        
        if (!videoData) {
          setError(t('pages.videoDetail.notFound'))
          return
        }
        
        // 检查视频是否公开可访问（这里可以添加隐私检查逻辑）
        setVideo(videoData)
        
        // 更新页面meta标签
        updatePageMeta(videoData)
        
        // 增加视频观看次数
        try {
          await supabaseVideoService.incrementViewCount(id)
        } catch (viewError) {
          console.error('Failed to increment view count:', viewError)
        }
        
      } catch (err) {
        console.error('Failed to fetch video:', err)
        setError('加载视频失败')
      } finally {
        setLoading(false)
      }
    }
    
    fetchVideo()
  }, [id])
  
  // 处理下载
  const handleDownload = async () => {
    if (!video?.video_url) return
    
    try {
      await videoShareService.downloadVideo(video.id, video.video_url, {
        filename: `${video.title || 'video'}.mp4`
      })
      
      // 增加下载计数
      await supabaseVideoService.incrementDownloadCount(video.id)
    } catch (error) {
      console.error('Download failed:', error)
      toast.error(t('pages.videoDetail.downloadFailed'))
    }
  }
  
  // 处理分享
  const handleShare = () => {
    setShareModalOpen(true)
  }
  
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('pages.videoDetail.loading')}</p>
        </div>
      </div>
    )
  }
  
  if (error || !video) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-4">{error || t('pages.videoDetail.notFound')}</p>
          <Button onClick={() => navigateTo('/')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('pages.videoDetail.backToHome')}
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black">
      <div className="w-full h-screen flex items-center justify-center">
        {/* 简洁的视频播放区域 */}
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {video.video_url ? (
              <ReactVideoPlayer
                src={video.video_url}
                poster={video.thumbnail_url || undefined}
                className="w-full h-full"
                autoPlayOnHover={false}
                showPlayButton={true}
                muted={false}
                objectFit="contain"
                videoId={video.id}
                videoTitle={video.title}
                alt={video.title || '视频内容'}
                controls={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <AlertCircle className="h-12 w-12 mb-2" />
                <p>视频不可用</p>
              </div>
            )}
          </div>
          
          {/* 制作信息 */}
          <div className="mt-4 text-center">
            <p className="text-sm text-white/70">
              {t('video.madeWith', 'Made with veo3video.me')}
            </p>
          </div>
        </div>
      </div>
      
      {/* 分享模态框 */}
      <VideoShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        video={{
          id: video.id,
          title: video.title,
          description: video.prompt,
          video_url: video.video_url,
          template_id: video.template_id,
          metadata: video.metadata,
          thumbnail_url: video.thumbnail_url
        }}
      />
    </div>
  )
}