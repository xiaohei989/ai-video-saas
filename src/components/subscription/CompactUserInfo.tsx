import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Coins, CalendarDays } from 'lucide-react'
import { SubscriptionService } from '@/services/subscriptionService'
import { creditService } from '@/services/creditService'
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
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserInfo()
  }, [userId])

  const loadUserInfo = async () => {
    try {
      setLoading(true)
      
      // 只加载必要的订阅信息和积分信息
      const [subscriptionData, creditsData] = await Promise.all([
        SubscriptionService.getCurrentSubscription(userId).catch(() => null),
        creditService.getUserCredits(userId).catch(() => ({ credits: 0 }))
      ])
      
      setSubscription(subscriptionData)
      setCredits(creditsData?.credits || 0)
    } catch (error) {
      console.error('Failed to load user info:', error)
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
          <Badge className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
            <div className="flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              <span>{getPlanName(subscription.planId)} {intervalText}</span>
            </div>
          </Badge>
        )
      case 'pro':
        return (
          <Badge className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
            <div className="flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              <span>{getPlanName(subscription.planId)} {intervalText}</span>
            </div>
          </Badge>
        )
      case 'basic':
        return (
          <Badge className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
            <div className="flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              <span>{getPlanName(subscription.planId)} {intervalText}</span>
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
      case 'zh': return 'MM月dd日'
      case 'ja': return 'MM月dd日'
      case 'ko': return 'MM월dd일'
      case 'es': return 'dd MMM'
      default: return 'MMM dd'
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
          <div className="flex items-center justify-between">
            {/* 左侧：订阅等级和徽章 */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Coins className="h-5 w-5 text-white" />
              </div>
              
              <div className="space-y-1">
                {subscription && subscription.status === 'active' && planDetails ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{t('subscription.currentPlan')}</span>
                      {getPlanBadge()}
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

            {/* 右侧：积分余额和续费信息 */}
            <div className="flex items-center gap-8">
              {/* 当前积分 */}
              <div className="flex flex-col justify-center text-center min-w-[90px]">
                <div className="text-xl font-bold text-foreground leading-tight">{formatCredits(credits)}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('subscription.currentCredits')}</div>
              </div>
              
              {/* 续费时间 */}
              {subscription && subscription.status === 'active' && (
                <div className="flex flex-col justify-center text-center min-w-[90px]">
                  <div className="text-lg font-medium text-foreground leading-tight flex items-center justify-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {subscription.currentPeriodEnd.getFullYear() > 1970 
                      ? format(subscription.currentPeriodEnd, getDateFormat(), { locale: getDateLocale() })
                      : t('subscription.toBeUpdated')
                    }
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