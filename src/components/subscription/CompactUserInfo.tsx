import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Gem, CalendarDays } from '@/components/icons'
import { SubscriptionService } from '@/services/subscriptionService'
import { useAuth } from '@/contexts/AuthContext'
import type { Subscription } from '@/types'
import { format } from 'date-fns'
import { zhCN, enUS, ja, ko, es } from 'date-fns/locale'

interface CompactUserInfoProps {
  userId: string
  className?: string
}

export default function CompactUserInfo({ 
  userId, 
  className = '' 
}: CompactUserInfoProps) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  // 🚀 简化：直接使用 AuthContext 中的积分数据
  const credits = profile?.credits || 0

  useEffect(() => {
    loadUserInfo()
  }, [userId])

  const loadUserInfo = async () => {
    try {
      setLoading(true)
      
      // 只获取订阅信息
      const subscriptionData = await SubscriptionService.getCurrentSubscription(userId).catch(() => null)
      setSubscription(subscriptionData)
      
    } catch (error) {
      console.error('[CompactUserInfo] Failed to load user info:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlanName = (planId: string) => {
    const basePlanId = planId.replace('-annual', '')
    return t(`subscription.plans.${basePlanId}`, { defaultValue: basePlanId })
  }

  const getPlanInterval = (planId: string) => {
    return planId.includes('-annual') 
      ? t('subscription.billingInterval.annually')
      : t('subscription.billingInterval.monthly')
  }

  const getPlanBadge = () => {
    if (!subscription || subscription.status !== 'active') {
      return null // 不显示免费徽章
    }
    
    const basePlanId = subscription.planId.replace('-annual', '')
    const intervalText = getPlanInterval(subscription.planId)
    
    switch (basePlanId) {
      case 'enterprise':
        return (
          <Badge className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 max-w-[140px] sm:max-w-none">
            <div className="flex items-center gap-1 min-w-0">
              <CreditCard className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{getPlanName(subscription.planId)} {intervalText}</span>
            </div>
          </Badge>
        )
      case 'pro':
        return (
          <Badge className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 max-w-[140px] sm:max-w-none">
            <div className="flex items-center gap-1 min-w-0">
              <CreditCard className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{getPlanName(subscription.planId)} {intervalText}</span>
            </div>
          </Badge>
        )
      case 'basic':
        return (
          <Badge className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 max-w-[140px] sm:max-w-none">
            <div className="flex items-center gap-1 min-w-0">
              <CreditCard className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{getPlanName(subscription.planId)} {intervalText}</span>
            </div>
          </Badge>
        )
      default:
        return null // 不显示免费徽章
    }
  }

  const formatCredits = (credits: number) => {
    return credits.toLocaleString() // Display full number with thousands separator
  }

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'zh': return zhCN
      case 'ja': return ja
      case 'ko': return ko
      case 'es': return es
      default: return enUS
    }
  }

  const getDateFormat = () => {
    switch (i18n.language) {
      case 'zh': return 'yyyy年MM月dd日'
      case 'ja': return 'yyyy年MM月dd日'
      case 'ko': return 'yyyy년MM월dd일'
      case 'es': return 'dd MMM yyyy'
      default: return 'MMM dd, yyyy'
    }
  }

  if (loading) {
    return (
      <div className={className}>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="animate-pulse flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-16 mb-1"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 mb-1"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                </div>
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const planDetails = subscription ? SubscriptionService.getPlanDetails(subscription.planId) : null

  return (
    <div className={className}>
      <Card className="overflow-hidden bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/10 dark:to-indigo-950/10 border-blue-200/50 dark:border-blue-800/50">
        <CardContent className="p-4">
          {/* 移动端垂直布局，桌面端水平布局 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
            {/* 订阅等级和徽章 */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <Gem className="h-5 w-5 text-white" />
              </div>
              
              <div className="space-y-1 flex-1 min-w-0">
                {subscription && subscription.status === 'active' && planDetails ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground whitespace-nowrap flex-shrink-0">{t('subscription.currentPlan')}</span>
                      <div className="min-w-0 flex-shrink">
                        {getPlanBadge()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {subscription.planId.includes('-annual')
                        ? t('subscription.planDetails.yearlyCredits', { credits: planDetails.credits.toLocaleString() })
                        : t('subscription.planDetails.monthlyCredits', { credits: planDetails.credits.toLocaleString() })
                      }
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium text-foreground">{t('subscription.freeUser')}</div>
                    <div className="text-xs text-muted-foreground">{t('subscription.payAsYouGo')}</div>
                  </>
                )}
              </div>
            </div>

            {/* 积分余额和续费信息 */}
            <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8">
              {/* 当前积分 */}
              <div className="flex flex-col justify-center text-center min-w-[70px] sm:min-w-[90px]">
                <div className="text-lg sm:text-xl font-bold text-foreground leading-tight">{formatCredits(credits)}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('subscription.currentCredits')}</div>
              </div>
              
              {/* 续费时间 */}
              {subscription && subscription.status === 'active' && (
                <div className="flex flex-col justify-center text-center min-w-[70px] sm:min-w-[90px]">
                  <div className="text-sm sm:text-lg font-medium text-foreground leading-tight flex items-center justify-center gap-1">
                    <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-base">
                      {subscription.currentPeriodEnd.getFullYear() > 1970 
                        ? format(subscription.currentPeriodEnd, i18n.language === 'zh' ? 'MM/dd' : 'MMM dd', { locale: getDateLocale() })
                        : t('subscription.toBeUpdated')
                      }
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('subscription.nextRenewal')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}