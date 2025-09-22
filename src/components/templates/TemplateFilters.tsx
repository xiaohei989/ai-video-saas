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
      {/* 排序选择器 - 水平居中 */}
      <div className="flex justify-center">
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
      
      {/* 标签网格 - 每行4个 */}
      <div className="grid grid-cols-4 gap-1 md:gap-2">
        {popularTags.slice(0, 16).map((tag) => (
          <Badge
            key={tag}
            variant={selectedTags.includes(tag) ? "default" : "secondary"}
            className={`cursor-pointer transition-all duration-200 hover:scale-105 text-[9px] md:text-xs px-0.5 md:px-2 py-1 justify-center min-h-[22px] md:min-h-[24px] ${
              selectedTags.includes(tag) 
                ? 'bg-primary text-primary-foreground shadow-md' 
                : 'hover:bg-primary/10 hover:border-primary/20'
            }`}
            onClick={() => handleTagClick(tag)}
          >
            <Hash className="h-1.5 w-1.5 md:h-2.5 md:w-2.5 mr-0.5 md:mr-1 flex-shrink-0" />
            <span className="leading-none">{tag}</span>
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