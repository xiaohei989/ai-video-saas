/**
 * Template Grid Component
 * 模板网格显示组件 - 负责渲染模板卡片列表
 */

import { memo, useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Hash, Video, ArrowUp } from 'lucide-react'
import SimpleVideoPlayer from '@/components/video/SimpleVideoPlayer'
import LikeCounterButton from './LikeCounterButton'
import CachedImage from '@/components/ui/CachedImage'
import TemplatesSkeleton from './TemplatesSkeleton'
import VideoLoadingSpinner from '@/components/ui/VideoLoadingSpinner'
import { useAnalytics } from '@/hooks/useAnalytics'
import { simpleTemplatePreload } from '@/services/simpleTemplatePreload'

// 模板类型定义（与数据库转换后的格式一致）
interface Template {
  id: string
  slug: string
  name: string
  description: string
  thumbnailUrl?: string
  previewUrl?: string
  category?: string
  credits?: number
  tags?: string[]
  // 额外字段
  likeCount?: number
  isActive?: boolean
  isPublic?: boolean
  version?: string
  auditStatus?: string
}

interface TemplateGridProps {
  templates?: Template[]
  loading?: boolean
  error?: Error | null
  showBackToTop?: boolean
  onTemplateUse?: (template: Template) => void
  className?: string
}

export default function TemplateGrid({
  templates = [],
  loading = false,
  error = null,
  showBackToTop = false,
  onTemplateUse,
  className
}: TemplateGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 🚀 首屏模板预加载 - 当模板列表加载完成时触发
  useEffect(() => {
    if (templates.length > 0 && !loading) {
      // 延迟执行预加载，避免阻塞初始渲染
      const timer = setTimeout(() => {
        console.log('[TemplateGrid] 🚀 开始预加载首屏模板')
        simpleTemplatePreload.preloadFirstScreen(templates)
      }, 1000) // 1秒延迟，确保页面渲染完成

      return () => clearTimeout(timer)
    }
  }, [templates, loading])

  // 返回顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-red-600 mb-2">加载失败</h3>
          <p className="text-gray-600 mb-4">模板数据加载失败，请稍后重试</p>
          <Button onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </div>
    )
  }

  // 加载状态
  if (loading) {
    return <TemplatesSkeleton count={12} className={className || "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"} />
  }

  // 空状态
  if (!templates.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <div className="text-center">
          <Play className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">暂无模板</h3>
          <p className="text-muted-foreground">请尝试调整筛选条件</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 模板网格 */}
      <div className={className || "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"}>
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onUseTemplate={onTemplateUse}
          />
        ))}
      </div>

      {/* 返回顶部按钮 */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 rounded-full shadow-lg"
          size="icon"
          variant="default"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </>
  )
}

// 优化的模版卡片组件
const TemplateCard = memo(({ 
  template,
  onUseTemplate
}: {
  template: Template
  onUseTemplate?: (template: Template) => void
}) => {
  const { t } = useTranslation()
  const { trackTemplateView, trackEvent } = useAnalytics()
  const navigate = useNavigate()
  
  // 检测移动端 - 使用响应式检测并监听窗口变化
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth <= 768
  )
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile() // 立即检查一次
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // 视频加载状态管理
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)

  // 视频事件处理
  const handleVideoLoadStart = () => {
    setIsVideoLoading(true)
  }
  
  const handleVideoCanPlay = () => {
    setIsVideoLoading(false)
  }
  
  const handleVideoError = () => {
    setIsVideoLoading(false)
  }
  
  // 鼠标事件处理
  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsHovered(true)
      setHasUserInteracted(true)
      
      // 🚀 鼠标悬停时触发预加载
      if (template.previewUrl) {
        simpleTemplatePreload.preloadOnHover(template.id, template.previewUrl)
      }
    }
  }
  
  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsHovered(false)
    }
  }
  
  // 移动端播放按钮点击
  const handlePlayClick = () => {
    if (isMobile) {
      setHasUserInteracted(true)
    }
  }

  const handleUseTemplate = () => {
    // 跟踪模板使用事件
    trackTemplateView(template.id, template.category || 'unknown')
    trackEvent({
      action: 'template_use_click',
      category: 'product_usage',
      label: template.id,
      custom_parameters: {
        template_name: template.name,
        template_category: template.category,
        credit_cost: template.credits
      }
    })
    
    if (onUseTemplate) {
      onUseTemplate(template)
    } else {
      // 默认行为：导航到创建页面
      navigate(`/create?template=${template.slug}`)
    }
  }

  // 直接使用API数据中的点赞数
  const likeCount = template.likeCount ?? 0
  const isLiked = false // 暂时不支持用户点赞状态，只显示数量
  
  // 判断数据是否加载完成：只要有template.likeCount就不是加载状态
  const hasLikeData = template.likeCount !== undefined
  
  // 判断是否应该显示加载动画
  const shouldShowLoadingSpinner = isVideoLoading && hasUserInteracted && (isHovered || isMobile)

  return (
    <Card className="overflow-hidden shadow-md flex flex-col">
      <div 
        className="aspect-video bg-muted relative group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {template.previewUrl ? (
          <div className="relative w-full h-full">
            {/* 模糊图背景层 - 支持两级加载：模糊图→清晰图 */}
            {template.thumbnailUrl && (
              <CachedImage 
                key={`cached-bg-${template.id}`} // 🔧 添加稳定的key避免重渲染
                src={template.thumbnailUrl}
                alt={template.name}
                className="absolute inset-0 w-full h-full object-cover"
                fastPreview={true} // 启用模糊图→清晰图两级加载
              />
            )}
            {/* 视频播放器在上层（透明背景） */}
            <SimpleVideoPlayer
              src={template.previewUrl}
              // poster={template.thumbnailUrl} // 🔧 移除poster避免与CachedImage竞争
              className="relative z-10 w-full h-full bg-transparent" // 🔧 设置透明背景
              objectFit="cover"
              showPlayButton={true}
              autoPlayOnHover={!isMobile} // 移动端禁用自动播放
              muted={false}
              disablePreload={false} // ✅ 启用预加载，配合智能预加载服务
              alt={template.name}
              videoId={template.id}
              videoTitle={template.name}
              onLoadStart={handleVideoLoadStart}
              onCanPlay={handleVideoCanPlay}
              onError={handleVideoError}
              onPlay={() => {
                // 跟踪视频播放事件
                trackEvent({
                  action: 'template_video_play',
                  category: 'user_engagement',
                  label: template.id,
                  custom_parameters: {
                    template_name: template.name,
                    template_category: template.category || 'unknown'
                  }
                })
              }}
              onClick={handlePlayClick}
            />
            
            {/* 视频加载动画 */}
            {shouldShowLoadingSpinner && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <VideoLoadingSpinner 
                  size="lg"
                  showPlayIcon={false}
                />
              </div>
            )}
          </div>
        ) : template.thumbnailUrl ? (
          <CachedImage 
            key={`cached-main-${template.id}`} // 🔧 添加稳定的key避免重渲染
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover"
            fastPreview={true}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Play className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm font-medium">{template.name}</p>
              <p className="text-xs opacity-70 mt-1">{template.description}</p>
            </div>
          </div>
        )}
        
        {/* 生成按钮（底部中间，移动端始终显示，桌面端悬停显示） */}
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-20">
          <Button 
            variant="outline"
            size="sm"
            className="bg-black/20 border-white/40 text-white hover:text-white hover:bg-gradient-to-r hover:from-blue-500/30 hover:to-purple-500/30 hover:border-white/60 hover:scale-105 backdrop-blur-md transition-all duration-300 text-xs font-semibold px-4 py-2 shadow-xl [&:hover]:text-white"
            onClick={handleUseTemplate}
            style={{
              textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.5), 0 0 24px rgba(0,0,0,0.3)',
              color: 'white'
            }}
          >
            <Video className="h-3.5 w-3.5 mr-1.5 drop-shadow-lg text-white" />
            <span className="drop-shadow-lg text-white">{t('template.generate')}</span>
          </Button>
        </div>
        
        {/* 可交互的点赞区域（左上角） */}
        <div className="absolute top-2 left-2 z-10">
          <LikeCounterButton
            templateId={template.id}
            initialLikeCount={likeCount}
            initialIsLiked={isLiked}
            size="sm"
            variant="default"
            showIcon={true}
            animated={true}
            dataLoading={!hasLikeData}
            skeleton={false}
            onLikeChange={(liked, count) => {
              // 暂时禁用点赞功能，只显示数量
              console.log('点赞功能暂时禁用', { templateId: template.id, liked, count })
            }}
          />
        </div>
      </div>
      <CardContent className="flex-1 flex flex-col justify-between p-4">
        <div className="space-y-3">
          {/* 描述信息 */}
          <p className="text-xs text-muted-foreground line-clamp-3">
            {template.description}
          </p>
          
          {/* 标签 */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-secondary text-secondary-foreground rounded-sm"
                >
                  <Hash className="h-2 w-2" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})