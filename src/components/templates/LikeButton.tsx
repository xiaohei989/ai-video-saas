/**
 * LikeButton Component
 * 模板点赞按钮组件
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { Heart, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLike } from '@/hooks/useLike'
import { useAuthState } from '@/hooks/useAuthState'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface LikeButtonProps {
  templateId: string
  initialLikeCount?: number
  initialIsLiked?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost' | 'outline'
  showCount?: boolean
  showLabel?: boolean
  className?: string
  onLikeChange?: (isLiked: boolean, likeCount: number) => void
}

export function LikeButton({
  templateId,
  initialLikeCount = 0,
  initialIsLiked = false,
  size = 'md',
  variant = 'ghost',
  showCount = true,
  showLabel = false,
  className,
  onLikeChange
}: LikeButtonProps) {
  const { user } = useAuthState()
  const navigate = useNavigate()
  const { t } = useTranslation()
  
  const {
    isLiked,
    likeCount,
    loading,
    error,
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
      button: 'h-8 px-2 text-xs',
      icon: 'h-3 w-3',
      gap: 'gap-1'
    },
    md: {
      button: 'h-9 px-3 text-sm',
      icon: 'h-4 w-4',
      gap: 'gap-1.5'
    },
    lg: {
      button: 'h-10 px-4 text-base',
      icon: 'h-5 w-5',
      gap: 'gap-2'
    }
  }

  const config = sizeConfig[size]

  // 处理点击事件
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      toast.error(t('like.loginToLike'))
      navigate('/signin')
      return
    }

    try {
      await toggleLike()
      
      if (!error) {
        // 静默处理成功状态，不显示toast
        // 保持用户界面简洁
      }
    } catch (err) {
      console.error('Like button error:', err)
    }
  }

  // 静默处理错误，不显示toast提示
  React.useEffect(() => {
    if (error) {
      console.error('Like button error:', error)
      // 不显示toast提示，保持用户界面清洁
    }
  }, [error])

  // 生成按钮样式
  const buttonClass = cn(
    'like-button transition-all duration-300 ease-out',
    'hover:scale-105 active:scale-95',
    'focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
    config.button,
    config.gap,
    {
      // 点赞状态的样式
      'text-pink-500 hover:text-pink-600': isLiked,
      'text-gray-500 hover:text-pink-500': !isLiked,
      // 加载状态
      'cursor-not-allowed opacity-60': loading,
      // 禁用状态
      'cursor-not-allowed opacity-40': !user && !loading
    },
    className
  )

  // 图标样式
  const iconClass = cn(
    config.icon,
    'transition-all duration-200',
    {
      'fill-current': isLiked,
      'animate-pulse': loading
    }
  )

  return (
    <Button
      variant={variant}
      className={buttonClass}
      onClick={handleClick}
      disabled={loading}
      title={user ? (isLiked ? t('like.unlike') : t('like.like')) : t('like.loginToLike')}
      data-testid="like-button"
      aria-pressed={isLiked}
    >
      {loading ? (
        <Loader2 className={cn(config.icon, 'animate-spin')} />
      ) : (
        <Heart className={iconClass} />
      )}
      
      {showCount && (
        <span className="font-medium tabular-nums" data-testid="like-count">
          {likeCount.toLocaleString()}
        </span>
      )}
      
      {showLabel && (
        <span className="hidden sm:inline">
          {isLiked ? t('like.unlike') : t('like.like')}
        </span>
      )}
    </Button>
  )
}

export default LikeButton