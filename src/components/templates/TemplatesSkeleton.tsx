/**
 * Templates Skeleton Component
 * 模版列表加载时的骨架屏组件
 */

import { Card, CardContent } from '@/components/ui/card'

interface TemplatesSkeletonProps {
  /** 显示的骨架卡片数量 */
  count?: number
  /** 网格列数（响应式） */
  className?: string
}

function TemplateCardSkeleton() {
  return (
    <Card className="overflow-hidden shadow-md flex flex-col animate-pulse">
      {/* 视频预览区域 */}
      <div className="aspect-video bg-muted relative">
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700"></div>
        
        {/* 点赞按钮骨架 */}
        <div className="absolute top-2 left-2">
          <div className="w-12 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
        
        {/* 生成按钮骨架 */}
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2">
          <div className="w-20 h-8 bg-gray-300 dark:bg-gray-600 rounded-md"></div>
        </div>
      </div>
      
      {/* 内容区域 */}
      <CardContent className="flex-1 flex flex-col justify-between p-4">
        <div className="space-y-3">
          {/* 描述文本骨架 */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/5"></div>
          </div>
          
          {/* 标签骨架 */}
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-5 bg-gray-200 dark:bg-gray-700 rounded-sm"
                style={{ width: `${Math.random() * 30 + 40}px` }}
              ></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TemplatesSkeleton({ 
  count = 12, 
  className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" 
}: TemplatesSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <TemplateCardSkeleton key={index} />
      ))}
    </div>
  )
}