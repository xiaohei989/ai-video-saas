/**
 * LikeCounterButton Component
 * 可交互的点赞数量组件 - 结合显示和交互功能
 */

import React from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLike } from '@/hooks/useLike'
import { useAuthState } from '@/hooks/useAuthState'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface LikeCounterButtonProps {
  templateId: string
  initialLikeCount?: number
  initialIsLiked?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'minimal' | 'badge'
  className?: string
  showIcon?: boolean
  animated?: boolean
  onLikeChange?: (isLiked: boolean, likeCount: number) => void
}

export function LikeCounterButton({
  templateId,
  initialLikeCount = 0,
  initialIsLiked = false,
  size = 'sm',
  variant = 'default',
  className,
  showIcon = true,
  animated = true,
  onLikeChange
}: LikeCounterButtonProps) {
  const { user } = useAuthState()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const {
    isLiked,
    likeCount,
    loading,
    toggleLike
  } = useLike({
    templateId,
    initialLikeCount,
    initialIsLiked,
    onLikeChange,
    enableOptimisticUpdate: true
  })

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

  // 处理点击事件
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      // 未登录用户点击跳转到登录页
      navigate('/signin')
      return
    }

    try {
      await toggleLike()
    } catch (err) {
      console.error('Like counter button error:', err)
    }
  }

  // 生成容器样式
  const containerClass = cn(
    'like-counter-button flex items-center font-medium tabular-nums select-none',
    config.text,
    config.gap,
    variantStyle,
    {
      [config.padding]: variant !== 'minimal',
      'transition-all duration-300': animated,
      // 交互样式
      'cursor-pointer hover:scale-105 active:scale-95': user && !loading,
      'cursor-not-allowed opacity-60': loading,
      'cursor-pointer': !user, // 未登录也可以点击（跳转登录）
      // hover效果
      'hover:bg-black/80': user && variant === 'default' && !loading,
      'hover:bg-pink-100': user && variant === 'badge' && !loading,
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
      'animate-pulse': loading
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
    <div 
      className={containerClass}
      onClick={handleClick}
      title={
        !user 
          ? t('like.loginToLike') 
          : loading 
            ? t('like.processing') 
            : isLiked 
              ? t('like.unlike') 
              : t('like.like')
      }
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick(e as any)
        }
      }}
      data-testid="like-counter-button"
      aria-pressed={isLiked}
    >
      {showIcon && (
        <>
          {loading ? (
            <Loader2 className={cn(config.icon, 'animate-spin')} />
          ) : (
            <Heart className={iconClass} />
          )}
        </>
      )}
      <span className="font-medium tabular-nums">
        {formatCount(likeCount)}
      </span>
    </div>
  )
}

export default LikeCounterButton