import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/contexts/AuthContext'
import stripeService, { SubscriptionPlan } from '@/services/stripeService'

interface PricingPlansProps {
  onPlanSelect?: (planId: string) => void
  currentPlan?: string
  showCurrentPlan?: boolean
  className?: string
  billingInterval?: 'month' | 'year'
}

// 移除图标和颜色配置，采用更简洁的设计
const planColors = {
  basic: 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-950 dark:border-gray-800 hover:dark:border-gray-700',
  pro: 'border-gray-900 bg-white dark:bg-gray-950 dark:border-gray-200 ring-1 ring-gray-900 dark:ring-gray-200',
  enterprise: 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-950 dark:border-gray-800 hover:dark:border-gray-700'
}

export function PricingPlans({
  onPlanSelect,
  currentPlan,
  showCurrentPlan = true,
  className = '',
  billingInterval = 'month'
}: PricingPlansProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuthContext()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  
  // 直接从stripeService获取对应计费周期的计划
  const plans = stripeService.getSubscriptionPlans(billingInterval)

  const { data: subscription } = useQuery({
    queryKey: ['user-subscription', user?.id],
    queryFn: () => user?.id ? stripeService.getUserSubscription(user.id) : null,
    enabled: !!user?.id && showCurrentPlan
  })

  const handlePlanSelect = async (planId: string) => {
    if (!user) return
    
    setLoadingPlan(planId)
    
    try {
      if (onPlanSelect) {
        await onPlanSelect(planId)
      } else {
        // 默认跳转到结账页面
        const result = await stripeService.createSubscriptionCheckout(
          planId,
          user.id,
          `${window.location.origin}/pricing?success=true`,
          `${window.location.origin}/pricing?cancelled=true`
        )

        if (result?.url) {
          window.location.href = result.url
        }
      }
    } catch (error) {
      console.error('Error selecting plan:', error)
    } finally {
      setLoadingPlan(null)
    }
  }

  const isCurrentPlan = (planId: string) => {
    return subscription?.plan?.id === planId || currentPlan === planId
  }

  const getPlanButtonText = (plan: SubscriptionPlan) => {
    if (isCurrentPlan(plan.id)) {
      return t('subscription.planButtons.currentPlan')
    }
    
    if (subscription && subscription.plan) {
      // 检查是否为同一基础计划的不同计费周期
      const currentBasePlan = subscription.plan.id.replace('-annual', '')
      const targetBasePlan = plan.id.replace('-annual', '')
      
      if (currentBasePlan === targetBasePlan) {
        // 同一基础计划，不同计费周期
        if (subscription.plan.interval === 'month' && plan.interval === 'year') {
          return t('subscription.planButtons.upgrade') // 月度到年度是升级
        } else if (subscription.plan.interval === 'year' && plan.interval === 'month') {
          return t('subscription.planButtons.downgrade') // 年度到月度是降级
        }
      }
      
      // 不同基础计划，按价格比较
      if (subscription.plan.price < plan.price) {
        return t('subscription.planButtons.upgrade')
      }
      
      if (subscription.plan.price > plan.price) {
        return t('subscription.planButtons.downgrade')
      }
    }
    
    return t('subscription.planButtons.selectPlan')
  }

  const getPlanButtonVariant = (plan: SubscriptionPlan) => {
    if (isCurrentPlan(plan.id)) {
      return 'outline' as const
    }
    
    // 🎨 视觉突出：PRO计划使用default(蓝色)，其他使用outline(边框)
    return plan.id.includes('pro') ? 'default' as const : 'outline' as const
  }

  const getPlanButtonStyle = (plan: SubscriptionPlan) => {
    if (isCurrentPlan(plan.id)) {
      return 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
    }
    
    // Check if it's an upgrade or downgrade
    if (subscription && subscription.plan) {
      const currentBasePlan = subscription.plan.id.replace('-annual', '')
      const targetBasePlan = plan.id.replace('-annual', '')
      
      // 同一基础计划的不同计费周期
      if (currentBasePlan === targetBasePlan) {
        if (subscription.plan.interval === 'month' && plan.interval === 'year') {
          return 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700' // 升级到年度
        } else if (subscription.plan.interval === 'year' && plan.interval === 'month') {
          return 'bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700' // 降级到月度
        }
      }
      
      // 不同基础计划，按价格比较
      if (subscription.plan.price < plan.price) {
        return 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
      } else if (subscription.plan.price > plan.price) {
        return 'bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700'
      }
    }
    
    // 🎨 视觉突出PRO计划：仅PRO使用蓝色，其他使用系统默认
    return plan.id.includes('pro') 
      ? 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700' 
      : '' // BASIC和ENTERPRISE使用系统默认样式
  }

  return (
    <div className={`max-w-6xl mx-auto grid gap-6 md:grid-cols-3 ${className}`}>
      {plans.map((plan) => {
        const isLoading = loadingPlan === plan.id
        const isCurrent = isCurrentPlan(plan.id)
        
        return (
          <Card 
            key={plan.id}
            className={`relative flex flex-col h-full transition-all duration-200 hover:shadow-md ${
              planColors[plan.id as keyof typeof planColors] || ''
            }`}
          >
            {/* Popular标签 - 卡片顶部中间位置 */}
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs font-medium">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {t('pricing.popular')}
                </div>
              </div>
            )}


            <CardContent className="p-6">
              {/* 左上角计划标题 */}
              <div className="mb-6">
                <div className="inline-block px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {plan.id.includes('-annual') 
                    ? t(`subscription.plans.${plan.id.replace('-annual', '')}`)
                    : t(`subscription.plans.${plan.id}`)
                  }
                </div>
              </div>

              {/* 价格区域 */}
              <div className="mb-2">
                {billingInterval === 'year' ? (
                  <div className="flex items-start gap-3">
                    {/* 年度订阅：左侧大号月均价格 */}
                    <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                      {stripeService.formatPrice(plan.price / 12)}
                    </span>
                    {/* 右侧节省信息 */}
                    <div className="flex flex-col items-start mt-1">
                      <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                        {t('subscription.billingInterval.save')} {stripeService.formatPrice((plan.price / 10) - (plan.price / 12))}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">
                          {t('subscription.billingInterval.perMonth')}
                        </span>
                        <span className="text-gray-400 line-through text-sm">
                          {stripeService.formatPrice(plan.price / 10)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                      {stripeService.formatPrice(plan.price)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      {t('subscription.billingInterval.perMonth')}
                    </span>
                  </div>
                )}
              </div>

              {/* 积分数量 */}
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {billingInterval === 'year' 
                  ? t('subscription.planDetails.yearlyCredits', { credits: plan.credits.toLocaleString() })
                  : t('subscription.planDetails.monthlyCredits', { credits: plan.credits.toLocaleString() })
                }
              </p>

              {/* 订阅按钮 */}
              <div className="mb-6">
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isCurrent && !isLoading) {
                      handlePlanSelect(plan.id)
                    }
                  }}
                  disabled={isCurrent || isLoading}
                  variant={getPlanButtonVariant(plan)}
                  className={`w-full ${getPlanButtonStyle(plan)}`}
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('subscription.planButtons.processing')}
                    </>
                  ) : (
                    getPlanButtonText(plan)
                  )}
                </Button>
              </div>

              {/* Features 功能列表 */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">{t('subscription.features.title')}</h4>
                <ul className="space-y-2">
                  {(() => {
                    const basePlanId = plan.id.replace('-annual', '')
                    const features = t(`subscription.features.${basePlanId}`, { returnObjects: true }) as string[]
                    return features.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-400">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        <span>{feature}</span>
                      </li>
                    ))
                  })()}
                </ul>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default PricingPlans