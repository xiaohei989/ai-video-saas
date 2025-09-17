/**
 * VideoSkeleton - 视频加载骨骼屏组件
 * 
 * 功能：
 * - 在视频加载期间显示美观的骨骼屏动画
 * - 包含播放按钮骨骼和背景渐变
 * - 支持深色/浅色主题
 * - 响应式设计
 */

import React from 'react'
import { Play } from 'lucide-react'
import { cn } from '@/utils/cn'

interface VideoSkeletonProps {
  className?: string
  showPlayButton?: boolean
  aspectRatio?: 'video' | 'square' | 'auto'
}

export default function VideoSkeleton({
  className,
  showPlayButton = true,
  aspectRatio = 'video'
}: VideoSkeletonProps) {
  const aspectClass = {
    video: 'aspect-video',
    square: 'aspect-square',
    auto: ''
  }[aspectRatio]

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-md",
        aspectClass,
        "bg-muted/50",
        "animate-pulse",
        className
      )}
    >
      {/* 主背景动画 */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/5 to-transparent 
                     -skew-x-12 animate-[shimmer_2s_ease-in-out_infinite]" />
      
      {/* 播放按钮骨骼 */}
      {showPlayButton && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* 播放按钮背景圆圈 */}
            <div className="w-16 h-16 bg-background/80 backdrop-blur-sm rounded-full 
                           flex items-center justify-center animate-pulse
                           border border-border/50 shadow-sm">
              {/* 播放图标骨骼 */}
              <div className="w-5 h-5 bg-muted-foreground/30 animate-pulse ml-1
                             [clip-path:polygon(0%_0%,0%_100%,100%_50%)]" />
            </div>
            
            {/* 外圈脉冲效果 */}
            <div className="absolute inset-0 w-16 h-16 rounded-full 
                           bg-muted-foreground/10 animate-ping" />
          </div>
        </div>
      )}
      
      {/* 底部时间条骨骼 */}
      <div className="absolute bottom-2 left-2 right-2">
        <div className="h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
          <div className="h-full bg-muted-foreground/40 rounded-full w-1/3 
                         animate-[loading_3s_ease-in-out_infinite]" />
        </div>
      </div>
      
      {/* 右上角状态骨骼 */}
      <div className="absolute top-2 right-2">
        <div className="w-12 h-4 bg-muted-foreground/20 rounded-sm animate-pulse" />
      </div>
      
      {/* 左上角喜欢按钮骨骼 */}
      <div className="absolute top-2 left-2">
        <div className="flex items-center gap-1 px-2 py-1 bg-background/60 rounded-full backdrop-blur-sm">
          <div className="w-3 h-3 bg-rose-500/50 rounded-full animate-pulse" />
          <div className="w-6 h-3 bg-muted-foreground/30 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/**
 * 轻量级视频骨骼屏 - 用于列表项
 */
export function VideoSkeletonLight({
  className
}: {
  className?: string
}) {
  return (
    <div 
      className={cn(
        "relative aspect-video overflow-hidden rounded-md",
        "bg-gradient-to-br from-muted/30 to-muted/60",
        "animate-pulse",
        className
      )}
    >
      {/* 简化的渐变动画 */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent 
                     animate-[shimmer_2.5s_ease-in-out_infinite]" />
      
      {/* 中心播放图标 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Play className="w-8 h-8 text-muted-foreground/40" />
      </div>
    </div>
  )
}