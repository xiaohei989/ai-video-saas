/**
 * Video Loading Spinner Component
 * 视频加载动画组件 - 用于视频预览加载时显示
 */

import { Play, Loader2 } from 'lucide-react'

interface VideoLoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  showPlayIcon?: boolean
  className?: string
  progress?: number // 添加进度支持
}

export default function VideoLoadingSpinner({ 
  size = 'md', 
  showPlayIcon = true,
  className = '',
  progress
}: VideoLoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-10 h-10'
  }
  
  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <div className={`
      flex flex-col items-center justify-center gap-2
      ${className}
    `}>
      {/* 旋转的加载圆环容器 */}
      <div className={`
        flex items-center justify-center
        bg-black/50 backdrop-blur-sm rounded-full
        ${sizeClasses[size]}
      `}>
        <div className="relative">
          {/* 旋转的加载圆环 */}
          <Loader2 className={`
            ${iconSizeClasses[size]} 
            text-white 
            animate-spin
            drop-shadow-lg
          `} />
          
          {/* 可选的播放图标 - 只在没有进度时显示 */}
          {showPlayIcon && progress === undefined && (
            <Play className={`
              absolute inset-0 
              ${iconSizeClasses[size]}
              text-white/70
              animate-pulse
              drop-shadow-lg
            `} />
          )}
        </div>
      </div>
      
      {/* 进度百分比 - 独立显示在圆环下方 */}
      {progress !== undefined && (
        <span className="text-white text-xs font-bold bg-black/80 px-2 py-1 rounded-md border border-white/30 shadow-lg backdrop-blur-sm">
          {Math.round(progress)}%
        </span>
      )}
    </div>
  )
}