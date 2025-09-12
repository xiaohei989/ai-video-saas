import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Play, Hash, TrendingUp, Sparkles, ArrowUp, Camera } from 'lucide-react'
import { templateList as initialTemplates, getPopularTags, getTemplatesByTags } from '@/features/video-creator/data/templates/index'
import LazyVideoPlayer from '@/components/video/LazyVideoPlayer'
import LikeCounterButton from '@/components/templates/LikeCounterButton'
import Pagination from '@/components/ui/pagination'
import { useTemplateLikes } from '@/hooks/useTemplateLikes'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'

type SortOption = 'popular' | 'latest'

export default function TemplatesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { trackTemplateView, trackEvent, trackFilter } = useAnalytics()
  const [searchParams, setSearchParams] = useSearchParams()
  const [templates, setTemplates] = useState(initialTemplates)
  const [loading, setLoading] = useState(false)
  
  // 避免未使用变量警告
  void loading
  
  // 从URL参数中获取状态，或使用默认值
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get('page')
    return page ? Math.max(1, parseInt(page, 10)) : 1
  })
  const [pageSize, setPageSize] = useState(() => {
    const size = searchParams.get('size')
    return size ? Math.max(9, parseInt(size, 10)) : 12
  })
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const sort = searchParams.get('sort') as SortOption
    return sort && ['popular', 'latest'].includes(sort) ? sort : 'popular'
  })
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tags = searchParams.get('tags')
    return tags ? tags.split(',').filter(Boolean) : []
  })
  const [showBackToTop, setShowBackToTop] = useState(false)
  
  // 获取热门标签
  const popularTags = getPopularTags(16)

  // SEO优化
  useSEO('templates')

  // 同步URL参数
  useEffect(() => {
    const params = new URLSearchParams()
    if (currentPage > 1) params.set('page', currentPage.toString())
    if (pageSize !== 12) params.set('size', pageSize.toString())
    if (sortBy !== 'popular') params.set('sort', sortBy)
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','))
    
    const newSearch = params.toString()
    const currentSearch = searchParams.toString()
    
    if (newSearch !== currentSearch) {
      setSearchParams(params, { replace: true })
    }
  }, [currentPage, pageSize, sortBy, selectedTags, searchParams, setSearchParams])

  // 监听URL参数变化
  useEffect(() => {
    const page = searchParams.get('page')
    const size = searchParams.get('size')
    const sort = searchParams.get('sort') as SortOption
    const tags = searchParams.get('tags')
    
    if (page) {
      const pageNum = Math.max(1, parseInt(page, 10))
      if (pageNum !== currentPage) {
        setCurrentPage(pageNum)
      }
    }
    
    if (size) {
      const sizeNum = Math.max(9, parseInt(size, 10))
      if (sizeNum !== pageSize) {
        setPageSize(sizeNum)
      }
    }
    
    if (sort && ['popular', 'latest'].includes(sort) && sort !== sortBy) {
      setSortBy(sort)
    }
    
    const urlTags = tags ? tags.split(',').filter(Boolean) : []
    if (JSON.stringify(urlTags) !== JSON.stringify(selectedTags)) {
      setSelectedTags(urlTags)
    }
  }, [searchParams])

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
  
  // 避免未使用变量警告
  void likesLoading

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
  
  // 避免未使用变量警告
  void refreshTemplates

  // 返回顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  // 根据标签筛选和排序的模板列表
  const filteredAndSortedTemplates = useMemo(() => {
    // 首先根据选中的标签筛选模板
    const filteredTemplates = getTemplatesByTags(selectedTags)
    
    // 然后排序
    switch (sortBy) {
      case 'popular':
        // 按点赞数降序排序（优先使用实时数据，回退到静态数据）
        return filteredTemplates.sort((a, b) => {
          const likeStatusA = getLikeStatus(a.id)
          const likeStatusB = getLikeStatus(b.id)
          const likesA = likeStatusA?.like_count ?? 0
          const likesB = likeStatusB?.like_count ?? 0
          return likesB - likesA
        })
      
      case 'latest':
        // 按创建时间降序排序（最新的在前）
        return filteredTemplates.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        })
      
      default:
        return filteredTemplates
    }
  }, [selectedTags, sortBy, likeStatuses, getLikeStatus])

  // 分页计算
  const totalItems = filteredAndSortedTemplates.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedTemplates = filteredAndSortedTemplates.slice(startIndex, endIndex)

  // 当切换排序或页面大小时，重置到第一页
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  // 分页处理函数
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // 跟踪分页使用
    trackEvent({
      action: 'pagination_click',
      category: 'user_navigation',
      label: `page_${page}`,
      custom_parameters: {
        total_pages: totalPages,
        page_size: pageSize,
        sort_by: sortBy
      }
    })
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    // 计算新页码，保持当前查看的大致位置
    const currentFirstIndex = (currentPage - 1) * pageSize
    const newPage = Math.floor(currentFirstIndex / newPageSize) + 1
    setCurrentPage(newPage)
    
    // 跟踪页面大小切换
    trackEvent({
      action: 'page_size_change',
      category: 'user_preference',
      label: `size_${newPageSize}`,
      custom_parameters: {
        old_page_size: pageSize,
        new_page_size: newPageSize,
        total_items: totalItems
      }
    })
  }

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort)
    setCurrentPage(1) // 切换排序时回到第一页
    trackFilter('sort', newSort)
  }

  const handleTagClick = (tag: string) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag) // 取消选中
      : [...selectedTags, tag] // 添加选中
    
    setSelectedTags(newSelectedTags)
    setCurrentPage(1) // 切换标签时回到第一页
    
    // 跟踪标签筛选事件
    trackEvent({
      action: 'tag_filter',
      category: 'user_navigation',
      label: tag,
      custom_parameters: {
        selected_tags: newSelectedTags,
        filter_action: selectedTags.includes(tag) ? 'remove' : 'add'
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* 标签筛选区域 */}
      <div className="space-y-2">
        {/* 热门标签展示区域 - 2排，右上角是排序选择器 */}
        <div className="space-y-2">
          {/* 第一排标签和排序选择器 */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {popularTags.slice(0, 6).map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "secondary"}
                  className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedTags.includes(tag) 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'hover:bg-primary/10 hover:border-primary/20'
                  }`}
                  onClick={() => handleTagClick(tag)}
                >
                  <Hash className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
            
            {/* 排序选择器 */}
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[180px] flex-shrink-0">
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
          {/* 第二排标签 */}
          <div className="flex flex-wrap gap-2">
            {popularTags.slice(6, 16).map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "secondary"}
                className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                  selectedTags.includes(tag) 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'hover:bg-primary/10 hover:border-primary/20'
                }`}
                onClick={() => handleTagClick(tag)}
              >
                <Hash className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
          
          {/* 筛选结果提示 */}
          {selectedTags.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>筛选条件:</span>
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                  <button
                    onClick={() => handleTagClick(tag)}
                    className="ml-1 hover:text-destructive"
                    aria-label={`移除 ${tag} 标签`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <span className="text-primary font-medium">
                ({totalItems} 个模板)
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedTemplates.map((template: any, index: number) => {
          // 所有视频都使用懒加载，优先显示缩略图
          const enableLazy = true // 启用懒加载，静默后台加载视频
          
          return (
          <Card key={template.id} className="overflow-hidden shadow-md flex flex-col">
            <div className="aspect-video bg-muted relative group">
              {template.previewUrl ? (
                <LazyVideoPlayer
                  src={template.previewUrl}
                  poster={template.thumbnailUrl}
                  className="w-full h-full"
                  objectFit="cover"
                  showPlayButton={false}
                  showVolumeControl={true}
                  autoPlayOnHover={true}
                  alt={template.name}
                  enableLazyLoad={enableLazy}
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
              
              
              {/* 生成按钮（底部中间，移动端始终显示，桌面端悬停显示） */}
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-20">
                <Button 
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-200 text-xs font-light px-3 py-1.5"
                  onClick={() => {
                    // 跟踪模板使用事件
                    trackTemplateView(template.id, template.category)
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
                    navigate(`/create?template=${template.slug}`)
                  }}
                >
                  <Camera className="h-3 w-3 mr-1.5" />
                  {t('template.generate')}
                </Button>
              </div>
              
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
        })}
      </div>

      {/* 分页组件 */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            showPageSizeSelector={false}
            pageSizeOptions={[9, 12, 18, 24]}
            showInfo={false}
          />
        </div>
      )}

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