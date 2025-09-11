import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Crown, CreditCard, Star } from 'lucide-react'
import { SubscriptionService } from '@/services/subscriptionService'
import { edgeCacheClient } from '@/services/EdgeFunctionCacheClient'
import type { Subscription } from '@/types'

interface MembershipBadgeProps {
  userId: string
  variant?: 'compact' | 'full'
  className?: string
}

export default function MembershipBadge({ 
  userId, 
  variant = 'compact', 
  className = '' 
}: MembershipBadgeProps) {
  const { t } = useTranslation()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMembership()
  }, [userId])

  const loadMembership = async () => {
    try {
      setLoading(true)
      // 🚀 优化：优先使用缓存获取订阅信息
      const tier = await edgeCacheClient.getUserSubscription(userId)
      
      if (tier && tier !== 'free') {
        // 如果有有效订阅，构建简化的subscription对象
        setSubscription({
          id: '',
          userId: userId,
          stripeSubscriptionId: '',
          planId: tier as any,
          status: 'active' as const,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      } else {
        // 免费用户或缓存未命中时，回退到原方法
        const data = await SubscriptionService.getCurrentSubscription(userId)
        setSubscription(data)
      }
    } catch (error) {
      console.error('[MembershipBadge] 加载会员信息失败:', error)
      // 错误时设置为null，显示免费用户状态
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse h-5 w-12 bg-muted rounded ${className}`} />
    )
  }

  // 如果没有订阅，显示免费用户
  if (!subscription || subscription.status !== 'active') {
    return (
      <Badge variant="secondary" className={`text-xs ${className}`}>
        {variant === 'full' ? (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            <span>{t('subscription.freeUser')}</span>
          </div>
        ) : (
          t('membership.free')
        )}
      </Badge>
    )
  }

  // const planDetails = SubscriptionService.getPlanDetails(subscription.planId) // 暂时未使用
  
  // 根据计划类型设置不同的样式和图标 - 支持年度订阅
  const getBadgeProps = () => {
    const basePlanId = subscription.planId.replace('-annual', '')
    const isAnnual = subscription.planId.includes('-annual')
    
    interface BadgeConfig {
      variant: 'default' | 'secondary' | 'destructive' | 'outline'
      className: string
      icon: React.ReactNode
      text: string
    }
    
    let baseConfig: BadgeConfig = {
      variant: 'secondary',
      className: '',
      icon: <Star className="h-3 w-3" />,
      text: t('membership.basic')
    }

    switch (basePlanId) {
      case 'enterprise':
        baseConfig = {
          ...baseConfig,
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0',
          icon: <Crown className="h-3 w-3" />,
          text: t(`subscription.plans.${basePlanId}`)
        }
        break
      case 'pro':
        baseConfig = {
          ...baseConfig,
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0',
          icon: <CreditCard className="h-3 w-3" />,
          text: t(`subscription.plans.${basePlanId}`)
        }
        break
      case 'basic':
        baseConfig = {
          ...baseConfig,
          variant: 'default' as const,
          className: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0',
          icon: <Star className="h-3 w-3" />,
          text: t(`subscription.plans.${basePlanId}`)
        }
        break
    }

    // 添加计费周期标识（年付/月付）- 所有variant都显示
    const intervalText = isAnnual ? t('subscription.billingInterval.annually') : t('subscription.billingInterval.monthly')
    baseConfig.text = `${baseConfig.text} ${intervalText}`

    return baseConfig
  }

  const badgeProps = getBadgeProps()

  return (
    <Badge 
      variant={badgeProps.variant}
      className={`text-xs ${badgeProps.className} ${className}`}
    >
      {variant === 'full' ? (
        <div className="flex items-center gap-1">
          {badgeProps.icon}
          <span>{badgeProps.text}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {badgeProps.icon}
          <span>{badgeProps.text}</span>
        </div>
      )}
    </Badge>
  )
}