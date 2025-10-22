/**
 * 模板视频预览卡片组件
 * 用于SEO Guide页面展示当前模板的示例视频
 * 参考 PreviewPanel 的设计风格
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles } from '@/components/icons'
import { ReactVideoPlayer } from '@/components/video/ReactVideoPlayer'
import CachedImage from '@/components/ui/CachedImage'
import { transformCDNUrl } from '@/config/cdnConfig'
import type { Video } from '@/types/video.types'

interface TemplateVideoPreviewCardProps {
  video: Partial<Video> | null
  templateSlug: string
  templateName: string
  loading?: boolean
  language: string
}

export const TemplateVideoPreviewCard: React.FC<TemplateVideoPreviewCardProps> = ({
  video,
  templateSlug,
  templateName,
  loading = false,
  language
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // 组件渲染日志
  console.log('[SEO Video Card Component] 🎨 组件渲染中...')
  console.log('[SEO Video Card Component] 📊 接收到的props:', {
    hasVideo: !!video,
    videoUrl: video?.video_url,
    thumbnailUrl: video?.thumbnail_url,
    templateSlug,
    templateName,
    loading,
    language,
    aspectRatio: video?.parameters?.aspectRatio
  })

  if (loading) {
    console.log('[SEO Video Card Component] ⏳ 显示加载骨架屏')
    return (
      <div className="my-6 p-6 bg-card border border-border rounded-lg shadow-lg animate-pulse">
        <div className="aspect-video bg-muted rounded-lg mb-4" />
        <div className="h-8 bg-muted rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    )
  }

  if (!video || !video.video_url) {
    console.log('[SEO Video Card Component] ❌ 没有有效视频数据,组件不渲染')
    return null
  }

  console.log('[SEO Video Card Component] ✅ 准备渲染完整视频卡片')

  const handleCreateVideo = () => {
    console.log('[SEO Video Card Component] 🚀 用户点击"创建视频"按钮,跳转到:', `/${language}/create?template=${templateSlug}`)
    navigate(`/${language}/create?template=${templateSlug}`)
  }

  // 确定宽高比
  const aspectRatio = video.parameters?.aspectRatio || '16:9'
  const isVertical = aspectRatio === '9:16'

  return (
    <div className="my-8 p-4 lg:p-6 bg-gradient-to-br from-card via-card to-muted/30 border-2 border-primary/20 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-primary/40">
      {/* 标题区域 */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold text-foreground">
            {t('seo.tryThisTemplate', { template: templateName })}
          </h3>
        </div>
      </div>

      {/* 视频预览区域 - 参考 PreviewPanel 设计 */}
      <div className="mb-4">
        <div className={`bg-muted rounded-lg overflow-hidden flex items-center justify-center relative ${isVertical ? 'max-w-md mx-auto' : 'aspect-video max-h-96'}`}>
          {/* 缩略图背景层 */}
          {video.thumbnail_url && (
            <CachedImage
              src={transformCDNUrl(video.thumbnail_url)}
              alt={video.title || templateName}
              className="absolute inset-0 w-full h-full object-cover"
              cacheKey={`seo_preview_${video.id}`}
              maxAge={24 * 60 * 60 * 1000}
            />
          )}

          {/* 视频播放器前景层 */}
          <div className="relative w-full h-full z-10">
            <ReactVideoPlayer
              key={`seo-preview-${video.id}`}
              src={transformCDNUrl(video.video_url) || ''}
              poster={transformCDNUrl(video.thumbnail_url)}
              className="w-full h-full"
              objectFit="cover"
              showPlayButton={true}
              autoPlayOnHover={true}
              muted={false}
              alt={video.title || templateName}
              videoId={video.id || 'preview'}
              videoTitle={video.title || templateName}
            />
          </div>
        </div>
      </div>

      {/* CTA按钮区域 - 模仿 Generate 按钮风格 */}
      <div className="flex justify-center">
        <button
          onClick={handleCreateVideo}
          className="w-1/2 relative overflow-hidden rounded-md px-4 py-3 font-medium text-white text-base bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:opacity-90 active:scale-95 transition-all duration-200"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5" />
            {t('seo.createYourVideo')}
            <ArrowRight className="w-5 h-5 ml-auto" />
          </span>
        </button>
      </div>
    </div>
  )
}

export default TemplateVideoPreviewCard
