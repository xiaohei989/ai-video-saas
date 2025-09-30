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

import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'

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
  enableMobileOptimization?: boolean // 是否启用移动端优化
  enableHapticFeedback?: boolean // 是否启用触觉反馈
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
  onLikeChange,
  enableMobileOptimization = true,
  enableHapticFeedback = true
}: LikeButtonProps) {
  const { user } = useAuthState()
  const { navigateTo } = useLanguageRouter()
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

  // 区分不同类型的loading状态
  const [isToggling, setIsToggling] = React.useState(false)
  
  // 只有在用户主动点击切换时才禁用按钮，初始加载时不禁用
  const shouldDisableButton = isToggling || (!user && !loading)

  // 检测是否为移动设备并且启用了移动端优化
  const isMobile = enableMobileOptimization && typeof window !== 'undefined' && 
    (window.innerWidth < 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0)

  // 尺寸配置
  const sizeConfig = {
    sm: {
      button: isMobile ? 'h-11 px-3 text-sm min-w-[44px]' : 'h-8 px-2 text-xs',
      icon: isMobile ? 'h-4 w-4' : 'h-3 w-3',
      gap: 'gap-1.5'
    },
    md: {
      button: isMobile ? 'h-12 px-4 text-base min-w-[48px]' : 'h-9 px-3 text-sm',
      icon: isMobile ? 'h-5 w-5' : 'h-4 w-4',
      gap: 'gap-2'
    },
    lg: {
      button: isMobile ? 'h-14 px-5 text-lg min-w-[56px]' : 'h-10 px-4 text-base',
      icon: isMobile ? 'h-6 w-6' : 'h-5 w-5',
      gap: 'gap-2.5'
    }
  }

  const config = sizeConfig[size]

  // 处理点击事件
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // 防止在切换过程中重复点击
    if (isToggling) {
      return
    }

    // 移动端触觉反馈
    if (isMobile && enableHapticFeedback && 'vibrate' in navigator) {
      // 轻微震动反馈，模拟按钮按压感
      navigator.vibrate(20)
    }

    if (!user) {
      toast.error(t('like.loginToLike'))
      navigateTo('/signin')
      return
    }

    setIsToggling(true)
    
    try {
      const previousIsLiked = isLiked
      await toggleLike()
      
      // 成功切换点赞状态时，给予更强的触觉反馈
      if (!error && isMobile && enableHapticFeedback && 'vibrate' in navigator && previousIsLiked !== isLiked) {
        // 点赞成功时的触觉反馈
        navigator.vibrate(previousIsLiked ? [30] : [20, 20, 40])
      }
    } catch (err) {
      console.error('Like button error:', err)
      // 错误时的触觉反馈
      if (isMobile && enableHapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100])
      }
    } finally {
      setIsToggling(false)
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
    // 桌面端交互效果
    'hover:scale-105 active:scale-95',
    // 移动端触摸优化
    isMobile && [
      'touch-manipulation', // 提升触摸响应
      'select-none', // 防止文本选择
      'active:scale-90', // 更明显的按压效果
      'active:bg-pink-50', // 按压时的背景色
      'focus:outline-none', // 移动端不显示焦点框
    ],
    // 桌面端焦点样式
    !isMobile && 'focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
    config.button,
    config.gap,
    {
      // 点赞状态的样式
      'text-pink-500 hover:text-pink-600': isLiked,
      'text-gray-500 hover:text-pink-500': !isLiked,
      // 移动端点赞状态优化
      [cn(isMobile && 'text-pink-600 active:text-pink-700')]: isLiked && isMobile,
      [cn(isMobile && 'text-gray-600 active:text-pink-600')]: !isLiked && isMobile,
      // 切换加载状态（用户主动点击时）
      'cursor-not-allowed opacity-60': isToggling,
      // 禁用状态（未登录用户）
      'cursor-not-allowed opacity-40': !user && !isToggling,
      // 初始加载状态（不禁用，但显示加载提示）
      'opacity-80': loading && !isToggling
    },
    className
  )

  // 图标样式
  const iconClass = cn(
    config.icon,
    'transition-all duration-200',
    // 移动端图标优化
    isMobile && 'drop-shadow-sm',
    {
      'fill-current': isLiked,
      'animate-pulse': loading && !isToggling, // 只在初始加载时显示脉冲动画
      // 移动端点赞动画增强
      [cn(isMobile && 'scale-110 drop-shadow-md')]: isLiked && isMobile
    }
  )

  return (
    <Button
      variant={variant}
      className={buttonClass}
      onClick={handleClick}
      disabled={shouldDisableButton}
      title={user ? (isLiked ? t('like.unlike') : t('like.like')) : t('like.loginToLike')}
      data-testid="like-button"
      aria-pressed={isLiked}
    >
      {isToggling ? (
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