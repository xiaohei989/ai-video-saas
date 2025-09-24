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
  dataLoading?: boolean // 🚀 新增：数据加载中状态（区别于点赞操作加载）
  skeleton?: boolean   // 🚀 新增：显示骨架屏
  subscribeToCache?: boolean // 🚀 新增：是否订阅全局likes缓存
  optimistic?: boolean // 🚀 新增：是否启用乐观更新
  disableBaselineLoad?: boolean // 🚀 列表页默认禁用基线拉取，零等待更新
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
  onLikeChange,
  dataLoading = false,
  skeleton = false,
  optimistic = true,
  subscribeToCache = true,
  disableBaselineLoad = false // 🚀 改为false，允许在需要时进行基线加载
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
    enableOptimisticUpdate: optimistic,
    subscribeToCache,
    disableBaselineLoad
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

  // 渲染骨架屏
  if (skeleton) {
    return (
      <div className={cn(
        'like-counter-button flex items-center font-medium tabular-nums select-none',
        config.text,
        config.gap,
        variantStyle,
        config.padding,
        'animate-pulse',
        className
      )}>
        {showIcon && (
          <div className={cn(
            config.icon,
            'bg-gray-300 rounded-full',
            variant === 'default' ? 'bg-gray-400' : 'bg-gray-300'
          )} />
        )}
        <div className={cn(
          'h-4 bg-gray-300 rounded',
          size === 'sm' ? 'w-6' : size === 'md' ? 'w-8' : 'w-10',
          variant === 'default' ? 'bg-gray-400' : 'bg-gray-300'
        )} />
      </div>
    )
  }

  return (
    <div 
      className={cn(
        containerClass,
        {
          'opacity-60': dataLoading, // 数据加载时降低透明度
          'pointer-events-none': dataLoading && !user // 数据加载且未登录时禁用交互
        }
      )}
      onClick={handleClick}
      title={
        dataLoading 
          ? '加载中...'
          : !user 
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
          ) : dataLoading ? (
            <div className={cn(config.icon, 'animate-pulse bg-gray-300 rounded-full')} />
          ) : (
            <Heart className={iconClass} />
          )}
        </>
      )}
      <span className={cn(
        'font-medium tabular-nums',
        {
          'animate-pulse': dataLoading
        }
      )}>
        {dataLoading ? (
          <div className={cn(
            'h-4 bg-gray-300 rounded inline-block',
            size === 'sm' ? 'w-6' : size === 'md' ? 'w-8' : 'w-10'
          )} />
        ) : (
          formatCount(likeCount)
        )}
      </span>
    </div>
  )
}

export default LikeCounterButton
