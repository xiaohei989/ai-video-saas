/**
 * Template Pagination Component
 * 模板分页组件 - 负责分页控制和导航
 */

import Pagination from '@/components/ui/pagination'

interface TemplatePaginationProps {
  currentPage?: number
  totalPages?: number
  pageSize?: number
  totalItems?: number
  showPageSizeSelector?: boolean
  pageSizeOptions?: number[]
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  className?: string
}

export default function TemplatePagination({
  currentPage = 1,
  totalPages = 1,
  pageSize = 12,
  totalItems = 0,
  showPageSizeSelector = false,
  pageSizeOptions = [9, 12, 18, 24],
  onPageChange,
  onPageSizeChange,
  className
}: TemplatePaginationProps) {
  
  // 只在有多页时显示分页组件
  if (totalPages <= 1) {
    return null
  }

  const handlePageChange = (page: number) => {
    onPageChange?.(page)
    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePageSizeChange = (newPageSize: number) => {
    onPageSizeChange?.(newPageSize)
  }

  return (
    <div className={`template-pagination flex justify-center mt-8 ${className || ''}`}>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        showPageSizeSelector={showPageSizeSelector}
        pageSizeOptions={pageSizeOptions}
        showInfo={false}
      />
    </div>
  )
}