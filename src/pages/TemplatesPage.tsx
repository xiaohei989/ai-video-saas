import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Play, Clock, Coins, Hash, RefreshCw, TrendingUp, Sparkles, Heart, ArrowUp } from 'lucide-react'
import { templateList as initialTemplates } from '@/features/video-creator/data/templates/index'
import LazyVideoPlayer from '@/components/video/LazyVideoPlayer'
import LikeCounterButton from '@/components/templates/LikeCounterButton'
import { useTemplateLikes } from '@/hooks/useTemplateLikes'
import { useAuthState } from '@/hooks/useAuthState'

type SortOption = 'popular' | 'latest'

export default function TemplatesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthState()
  const [templates, setTemplates] = useState(initialTemplates)
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const [showBackToTop, setShowBackToTop] = useState(false)

  // 获取所有模板ID用于批量查询点赞状态
  const templateIds = useMemo(() => templates.map(t => t.id), [templates])
  
  // 批量管理点赞状态
  const {
    likeStatuses,
    loading: likesLoading,
    getLikeStatus,
    updateStatus
  } = useTemplateLikes({
    templateIds,
    enableAutoRefresh: false
  })

  // 支持热更新
  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(
        '@/features/video-creator/data/templates/index',
        (newModule) => {
          if (newModule) {
            console.log('Templates hot reloaded!')
            setTemplates(newModule.templateList || [])
          }
        }
      )
    }
  }, [])

  // 监听滚动事件，显示/隐藏返回顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      // 当滚动超过300px时显示按钮
      setShowBackToTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 手动刷新模板
  const refreshTemplates = async () => {
    setLoading(true)
    try {
      // 重新导入模板模块
      const module = await import('@/features/video-creator/data/templates/index')
      setTemplates(module.templateList || [])
      console.log(`Loaded ${module.templateList?.length || 0} templates`)
    } catch (error) {
      console.error('Failed to refresh templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // 返回顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  // 排序后的模板列表
  const sortedTemplates = useMemo(() => {
    const sorted = [...templates]
    
    switch (sortBy) {
      case 'popular':
        // 按点赞数降序排序（优先使用实时数据，回退到静态数据）
        return sorted.sort((a, b) => {
          const likeStatusA = getLikeStatus(a.id)
          const likeStatusB = getLikeStatus(b.id)
          const likesA = likeStatusA?.like_count ?? 0
          const likesB = likeStatusB?.like_count ?? 0
          return likesB - likesA
        })
      
      case 'latest':
        // 按创建时间降序排序（最新的在前）
        return sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        })
      
      default:
        return sorted
    }
  }, [templates, sortBy, likeStatuses, getLikeStatus])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('template.title')}</h1>
        
        {/* 排序选择器 */}
        <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('template.sortBy.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <TrendingUp className="h-4 w-4" />
                {t('template.sortBy.popular')}
              </span>
            </SelectItem>
            <SelectItem value="latest">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Sparkles className="h-4 w-4" />
                {t('template.sortBy.latest')}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedTemplates.map((template: any) => {
          return (
          <Card key={template.id} className="overflow-hidden shadow-md flex flex-col">
            <div className="aspect-video bg-muted relative group">
              {template.previewUrl ? (
                <LazyVideoPlayer
                  src={template.previewUrl}
                  poster={template.thumbnailUrl}
                  className="w-full h-full"
                  objectFit="cover"
                  showPlayButton={true}
                  showVolumeControl={true}
                  autoPlayOnHover={false}
                  alt={template.name}
                  enableLazyLoad={true}
                  enableThumbnailCache={true}
                  enableNetworkAdaptive={true}
                  enableProgressiveLoading={true}
                />
              ) : template.thumbnailUrl ? (
                <img 
                  src={template.thumbnailUrl}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Play className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs opacity-70 mt-1">{template.icon} {template.description}</p>
                  </div>
                </div>
              )}
              
              {/* 可交互的点赞区域（左上角） */}
              <div className="absolute top-2 left-2 z-10">
                {(() => {
                  const likeStatus = getLikeStatus(template.id)
                  const likeCount = likeStatus?.like_count ?? 0
                  const isLiked = likeStatus?.is_liked ?? false
                  
                  return (
                    <LikeCounterButton
                      templateId={template.id}
                      initialLikeCount={likeCount}
                      initialIsLiked={isLiked}
                      size="sm"
                      variant="default"
                      showIcon={true}
                      animated={true}
                      onLikeChange={(liked, count) => {
                        updateStatus(template.id, { is_liked: liked, like_count: count })
                      }}
                    />
                  )
                })()}
              </div>
            </div>
            <CardContent className="flex-1 flex flex-col justify-between p-4">
              <div className="space-y-3">
                {/* 描述信息 */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
                
                {/* 创建时间 */}
                {template.createdAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(template.createdAt).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                )}
                
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
              
              {/* 生成按钮 */}
              <Button 
                className="w-full mt-4"
                onClick={() => navigate(`/create?template=${template.id}`)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t('template.generate')}
              </Button>
            </CardContent>
          </Card>
          )
        })}
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
    </div>
  )
}