import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Crown, AlertCircle } from '@/components/icons'
import { SubscriptionService } from '@/services/subscriptionService'
import type { Subscription } from '@/types'
import { useAuthContext } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { zhCN, enUS, ja, ko, es } from 'date-fns/locale'

const getDateLocaleByLanguage = (language: string) => {
  switch (language) {
    case 'zh': return zhCN
    case 'ja': return ja
    case 'ko': return ko
    case 'es': return es
    default: return enUS
  }
}

const getDateFormatByLanguage = (language: string) => {
  switch (language) {
    case 'zh': return 'yyyy年MM月dd日'
    case 'ja': return 'yyyy年MM月dd日'
    case 'ko': return 'yyyy년 MM월 dd일'
    case 'es': return 'dd/MM/yyyy'
    default: return 'MMM dd, yyyy'
  }
}

interface SubscriptionStatusProps {
  className?: string
  showManageButton?: boolean
  onManageClick?: () => void
}

export default function SubscriptionStatus({ 
  className = '', 
  showManageButton = false,
  onManageClick 
}: SubscriptionStatusProps) {
  const { user } = useAuthContext()
  const { t, i18n } = useTranslation()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadSubscription()
    }
  }, [user])

  const loadSubscription = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      const data = await SubscriptionService.getCurrentSubscription(user.id)
      setSubscription(data)
    } catch (err) {
      console.error('Failed to load subscription info:', err)
      setError(t('subscription.status.loadingError'))
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'cancelled':
        return 'destructive'
      case 'expired':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getPlanIcon = (planId: string) => {
    const basePlanId = planId.replace('-annual', '')
    switch (basePlanId) {
      case 'enterprise':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'pro':
        return <CreditCard className="h-4 w-4 text-blue-500" />
      default:
        return <CreditCard className="h-4 w-4 text-gray-500" />
    }
  }

  const formatStatus = (status: string) => {
    const statusKey = `subscription.status.statusLabels.${status}`
    const translatedStatus = t(statusKey)
    
    // 如果没有找到翻译，返回原状态
    return translatedStatus === statusKey ? status : translatedStatus
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!subscription) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('subscription.status.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="text-muted-foreground mb-4">
              {t('subscription.status.noSubscription')}
            </div>
            <Button onClick={() => window.location.href = '/pricing'}>
              {t('subscription.status.viewPlans')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const planDetails = SubscriptionService.getPlanDetails(subscription.planId)
  const isExpiringSoon = SubscriptionService.isSubscriptionExpiringSoon(subscription)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getPlanIcon(subscription.planId)}
            {t('subscription.status.title')}
          </div>
          <Badge variant={getStatusBadgeVariant(subscription.status)}>
            {formatStatus(subscription.status)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Badge className={`text-white border-0 text-sm px-3 py-1 ${
            subscription.planId.replace('-annual', '') === 'enterprise'
              ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
              : subscription.planId.replace('-annual', '') === 'pro'
              ? 'bg-gradient-to-r from-blue-500 to-purple-600'
              : 'bg-gradient-to-r from-green-500 to-emerald-600'
          }`}>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span>
                {t(`subscription.plans.${subscription.planId.replace('-annual', '')}`)} {subscription.planId.includes('-annual') ? t('subscription.billingInterval.annually') : t('subscription.billingInterval.monthly')}
              </span>
            </div>
          </Badge>
          <div className="text-2xl font-bold text-primary">
            ${planDetails.price}{subscription.planId.includes('-annual') ? t('subscription.planDetails.yearly') : t('subscription.planDetails.monthly')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">
              {subscription.planId.includes('-annual') 
                ? t('subscription.planDetails.yearlyCredits', { credits: planDetails.credits.toLocaleString() })
                : t('subscription.planDetails.monthlyCredits', { credits: planDetails.credits.toLocaleString() })
              }
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('subscription.nextRenewal')}</div>
            <div className="font-medium">
              {subscription.currentPeriodEnd.getFullYear() > 1970 
                ? format(subscription.currentPeriodEnd, getDateFormatByLanguage(i18n.language), { locale: getDateLocaleByLanguage(i18n.language) })
                : t('subscription.toBeUpdated')
              }
            </div>
          </div>
        </div>

        {isExpiringSoon && subscription.currentPeriodEnd.getFullYear() > 1970 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('subscription.status.expiringSoon', { 
                date: format(subscription.currentPeriodEnd, getDateFormatByLanguage(i18n.language), { locale: getDateLocaleByLanguage(i18n.language) }) 
              })}
            </AlertDescription>
          </Alert>
        )}

        {subscription.cancelAtPeriodEnd && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('subscription.status.cancelledAtPeriodEnd')}
            </AlertDescription>
          </Alert>
        )}


        {showManageButton && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={onManageClick || (() => window.location.href = '/pricing')}
          >
            {t('subscription.status.changePlan')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}