/**
 * Templates Container Component
 * 模板页面的主容器组件 - 简化版架构
 */

import { useSEO } from '@/hooks/useSEO'
import { useTemplatesData } from '@/hooks/useTemplatesData'
import TemplateFilters from './TemplateFilters'
import TemplateGrid from './TemplateGrid'
import TemplatePagination from './TemplatePagination'
import ErrorBoundary from './ErrorBoundary'

interface TemplatesContainerProps {
  className?: string
}

export default function TemplatesContainer({ className }: TemplatesContainerProps) {
  // SEO优化
  useSEO('templates')
  
  // 数据管理
  const {
    templates,
    totalItems,
    totalPages,
    loading,
    error,
    filters,
    pagination,
    showBackToTop,
    updateFilters,
    updatePagination
  } = useTemplatesData()

  // 处理筛选变更
  const handleSortChange = (sort: 'popular' | 'latest') => {
    updateFilters({ sort })
  }

  const handleTagClick = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag]
    updateFilters({ tags: newTags })
  }

  // 处理分页变更
  const handlePageChange = (page: number) => {
    updatePagination({ page })
  }

  const handlePageSizeChange = (pageSize: number) => {
    // 计算新页码，保持当前查看的大致位置
    const currentFirstIndex = (pagination.page - 1) * pagination.pageSize
    const newPage = Math.floor(currentFirstIndex / pageSize) + 1
    
    updatePagination({ pageSize, page: newPage })
  }

  return (
    <ErrorBoundary>
      <div className={`templates-container space-y-4 ${className || ''}`}>
        {/* 筛选和排序区域 */}
        <TemplateFilters
          sortBy={filters.sort}
          selectedTags={filters.tags}
          totalItems={totalItems}
          onSortChange={handleSortChange}
          onTagClick={handleTagClick}
        />
        
        {/* 模板网格显示 */}
        <TemplateGrid
          templates={templates}
          loading={loading}
          error={error}
          showBackToTop={showBackToTop}
        />
        
        {/* 分页控制 */}
        <TemplatePagination
          currentPage={pagination.page}
          totalPages={totalPages}
          pageSize={pagination.pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          showPageSizeSelector={false}
          pageSizeOptions={[9, 12, 18, 24]}
        />
      </div>
    </ErrorBoundary>
  )
}