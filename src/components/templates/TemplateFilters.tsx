/**
 * Template Filters Component
 * 模板筛选器组件 - 包含排序和标签筛选
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Hash, TrendingUp, Sparkles } from 'lucide-react'
import { getPopularTags } from '@/features/video-creator/data/templates/index'

// 临时使用简单的状态管理，稍后替换为Zustand
export type SortOption = 'popular' | 'latest'

interface TemplateFiltersProps {
  sortBy?: SortOption
  selectedTags?: string[]
  totalItems?: number
  onSortChange?: (sort: SortOption) => void
  onTagClick?: (tag: string) => void
  className?: string
}

export default function TemplateFilters({
  sortBy = 'latest',
  selectedTags = [],
  totalItems = 0,
  onSortChange,
  onTagClick,
  className
}: TemplateFiltersProps) {
  const { t } = useTranslation()

  // 缓存热门标签，避免重复计算
  const popularTags = useMemo(() => getPopularTags(16), [])

  const handleSortChange = (newSort: SortOption) => {
    onSortChange?.(newSort)
  }

  const handleTagClick = (tag: string) => {
    onTagClick?.(tag)
  }

  const handleRemoveTag = (tag: string) => {
    onTagClick?.(tag) // 相同的逻辑，点击已选中的标签会取消选中
  }

  return (
    <div className={`template-filters space-y-3 ${className || ''}`}>
      {/* 排序选择器和第一排标签 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        {/* 排序选择器 - 移动端在上方独占一行 */}
        <div className="order-1 md:order-2 flex justify-end">
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full max-w-[180px] md:w-[180px] flex-shrink-0">
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
        
        {/* 第一排标签 - 移动端在下方占满宽度 */}
        <div className="order-2 md:order-1 flex flex-wrap gap-1.5 md:gap-2 flex-1 md:flex-none">
          {popularTags.slice(0, 6).map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "secondary"}
              className={`cursor-pointer transition-all duration-200 hover:scale-105 text-xs md:text-sm px-2 md:px-3 py-1 ${
                selectedTags.includes(tag) 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-primary/10 hover:border-primary/20'
              }`}
              onClick={() => handleTagClick(tag)}
            >
              <Hash className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      
      {/* 第二排标签 - 紧凑布局 */}
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        {popularTags.slice(6, 16).map((tag) => (
          <Badge
            key={tag}
            variant={selectedTags.includes(tag) ? "default" : "secondary"}
            className={`cursor-pointer transition-all duration-200 hover:scale-105 text-xs md:text-sm px-2 md:px-3 py-1 ${
              selectedTags.includes(tag) 
                ? 'bg-primary text-primary-foreground shadow-md' 
                : 'hover:bg-primary/10 hover:border-primary/20'
            }`}
            onClick={() => handleTagClick(tag)}
          >
            <Hash className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
            {tag}
          </Badge>
        ))}
      </div>
      
      {/* 筛选结果提示 */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('template.filterConditions')}</span>
          {selectedTags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 hover:text-destructive"
                aria-label={t('template.removeTagAria', { tag })}
              >
                ×
              </button>
            </Badge>
          ))}
          <span className="text-primary font-medium">
            {t('template.countDisplay', { count: totalItems })}
          </span>
        </div>
      )}
    </div>
  )
}