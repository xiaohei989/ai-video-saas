/**
 * Pagination Component
 * 分页导航组件 - 基于 shadcn 设计系统
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  className?: string
  showPageSizeSelector?: boolean
  pageSizeOptions?: number[]
  showInfo?: boolean
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
  showPageSizeSelector = true,
  pageSizeOptions = [9, 12, 18, 24],
  showInfo = true
}: PaginationProps) {
  const { t } = useTranslation()
  // 生成页码按钮数组
  const generatePageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisiblePages = 7

    if (totalPages <= maxVisiblePages) {
      // 如果总页数较少，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // 总页数较多时，使用省略号
      if (currentPage <= 4) {
        // 当前页在前部
        for (let i = 1; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        // 当前页在后部
        pages.push(1)
        pages.push('ellipsis')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // 当前页在中间
        pages.push(1)
        pages.push('ellipsis')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }

    return pages
  }

  const pageNumbers = generatePageNumbers()

  // 处理键盘导航
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName.toLowerCase() === 'input') {
        return // 如果焦点在输入框内，不处理键盘事件
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (currentPage > 1) {
            onPageChange(currentPage - 1)
          }
          break
        case 'ArrowRight':
          if (currentPage < totalPages) {
            onPageChange(currentPage + 1)
          }
          break
        case 'Home':
          onPageChange(1)
          break
        case 'End':
          onPageChange(totalPages)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages, onPageChange])

  if (totalPages <= 1) {
    return null // 只有一页或没有数据时不显示分页
  }

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4', className)}>
      {/* 每页显示数量选择器 */}
      {showPageSizeSelector && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground order-2 sm:order-1">
          <span>{t('pagination.itemsPerPage')}</span>
          <Select value={pageSize.toString()} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>{t('pagination.items')}</span>
        </div>
      )}

      {/* 分页按钮 */}
      <nav className="flex items-center gap-1 order-1 sm:order-2" role="navigation" aria-label={t('pagination.navigation')}>
        {/* 第一页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="hidden sm:flex"
          title={t('pagination.firstPage')}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* 上一页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title={t('pagination.prevPage')}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only ml-1">{t('pagination.prevPage')}</span>
        </Button>

        {/* 页码按钮 */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) =>
            page === 'ellipsis' ? (
              <div
                key={`ellipsis-${index}`}
                className="flex items-center justify-center w-8 h-8"
                aria-hidden="true"
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(page)}
                className="w-8 h-8 p-0"
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </Button>
            )
          )}
        </div>

        {/* 下一页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title={t('pagination.nextPage')}
        >
          <span className="sr-only sm:not-sr-only mr-1">{t('pagination.nextPage')}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* 最后一页按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="hidden sm:flex"
          title={t('pagination.lastPage')}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  )
}

export default Pagination