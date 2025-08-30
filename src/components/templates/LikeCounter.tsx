/**
 * LikeCounter Component
 * 点赞数量显示组件（仅展示，无交互）
 */

import React from 'react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LikeCounterProps {
  count: number
  isLiked?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'minimal' | 'badge'
  className?: string
  showIcon?: boolean
  animated?: boolean
}

export function LikeCounter({
  count,
  isLiked = false,
  size = 'md',
  variant = 'default',
  className,
  showIcon = true,
  animated = true
}: LikeCounterProps) {
  // 尺寸配置
  const sizeConfig = {
    sm: {
      text: 'text-xs',
      icon: 'h-3 w-3',
      padding: 'px-2 py-1',
      gap: 'gap-1'
    },
    md: {
      text: 'text-sm',
      icon: 'h-4 w-4',
      padding: 'px-2 py-1',
      gap: 'gap-1.5'
    },
    lg: {
      text: 'text-base',
      icon: 'h-5 w-5',
      padding: 'px-3 py-1.5',
      gap: 'gap-2'
    }
  }

  // 变体样式配置
  const variantConfig = {
    default: 'bg-black/70 backdrop-blur-sm rounded-full text-white',
    minimal: 'text-gray-600',
    badge: 'bg-pink-50 text-pink-600 rounded-full border border-pink-200'
  }

  const config = sizeConfig[size]
  const variantStyle = variantConfig[variant]

  // 生成容器样式
  const containerClass = cn(
    'like-counter flex items-center font-medium tabular-nums',
    config.text,
    config.gap,
    variantStyle,
    {
      [config.padding]: variant !== 'minimal',
      'transition-all duration-300': animated,
    },
    className
  )

  // 图标样式
  const iconClass = cn(
    config.icon,
    'transition-all duration-200',
    {
      'fill-current text-pink-400': isLiked && variant === 'default',
      'fill-current text-pink-500': isLiked && variant !== 'default',
      'text-pink-400': !isLiked && variant === 'default',
      'text-gray-400': !isLiked && variant === 'minimal',
      'text-pink-500': !isLiked && variant === 'badge',
    }
  )

  // 格式化点赞数
  const formatCount = (num: number): string => {
    if (num < 1000) {
      return num.toString()
    } else if (num < 1000000) {
      const k = Math.floor(num / 100) / 10
      return k.toString().replace(/\.0$/, '') + 'k'
    } else {
      const m = Math.floor(num / 100000) / 10
      return m.toString().replace(/\.0$/, '') + 'm'
    }
  }

  return (
    <div className={containerClass}>
      {showIcon && (
        <Heart className={iconClass} />
      )}
      <span className="select-none">
        {formatCount(count)}
      </span>
    </div>
  )
}

export default LikeCounter