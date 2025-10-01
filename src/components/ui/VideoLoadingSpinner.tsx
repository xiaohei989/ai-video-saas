/**
 * Video Loading Spinner Component
 * 视频加载动画组件 - 用于视频预览加载时显示
 */

import { Play, Loader2 } from '@/components/icons'

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
    sm: 'w-5 h-5',  // 与圆环同尺寸
    md: 'w-7 h-7', 
    lg: 'w-8 h-8'
  }
  
  const iconSizeClasses = {
    sm: 'w-5 h-5',  // 容器24px → 圆环约20px（~83%）
    md: 'w-7 h-7',  // 容器32px → 圆环约28px（~87%）
    lg: 'w-8 h-8'   // 容器40px → 圆环约32px（~80%）
  }
  
  const textSizeClasses = {
    sm: 'text-[8px]',
    md: 'text-[10px]',
    lg: 'text-[11px]'
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
          {/* 百分比文本：居中覆盖在圆形内部，无额外背景框 */}
          {progress !== undefined && (
            <span
              className={`absolute inset-0 flex items-center justify-center text-white font-light ${textSizeClasses[size]}`}
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
            >
              {Math.round(progress)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
