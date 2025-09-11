import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Settings, CreditCard, AlertTriangle, ExternalLink } from 'lucide-react'
import { SubscriptionService } from '@/services/subscriptionService'
import type { Subscription } from '@/types'
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

interface SubscriptionManagementProps {
  subscription: Subscription
  onSubscriptionChange?: () => void
}

export default function SubscriptionManagement({ 
  subscription, 
  onSubscriptionChange 
}: SubscriptionManagementProps) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const handleCancelSubscription = async () => {
    try {
      setLoading(true)
      await SubscriptionService.cancelSubscription(subscription.stripeSubscriptionId)
      
      // 刷新订阅数据
      onSubscriptionChange?.()
      setShowCancelDialog(false)
      
      alert(t('subscription.management.cancelSuccess'))
    } catch (error) {
      console.error('Cancel subscription failed:', error)
      alert(t('subscription.management.cancelError'))
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = () => {
    // 重定向到Stripe客户门户
    window.open('https://billing.stripe.com/p/login/test_xxx', '_blank')
  }

  const planDetails = SubscriptionService.getPlanDetails(subscription.planId)
  
  const managementActions = [
    {
      icon: <CreditCard className="h-4 w-4" />,
      title: t('subscription.management.managePayment'),
      description: t('subscription.management.managePaymentDesc'),
      action: handleManageBilling,
      variant: 'outline' as const
    },
    {
      icon: <Settings className="h-4 w-4" />,
      title: t('subscription.management.changePlan'),
      description: t('subscription.management.changePlanDesc'),
      action: () => window.location.href = '/pricing',
      variant: 'outline' as const
    },
    {
      icon: <AlertTriangle className="h-4 w-4" />,
      title: t('subscription.management.cancelSubscription'),
      description: t('subscription.management.cancelSubscriptionDesc'),
      action: () => setShowCancelDialog(true),
      variant: 'destructive' as const,
      disabled: subscription.cancelAtPeriodEnd
    }
  ]

  return (
    <div className="space-y-6">
      {/* 当前订阅概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('subscription.management.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">{t('subscription.currentPlan')}</div>
              <div className="font-semibold">{t(`subscription.plans.${subscription.planId}`)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('subscription.management.monthlyFee') || t('subscription.monthly')}</div>
              <div className="font-semibold">${planDetails.price}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('subscription.nextRenewal')}</div>
              <div className="font-semibold">
                {subscription.currentPeriodEnd.getFullYear() > 1970 
                  ? format(subscription.currentPeriodEnd, getDateFormatByLanguage(i18n.language), { locale: getDateLocaleByLanguage(i18n.language) })
                  : t('subscription.toBeUpdated')
                }
              </div>
            </div>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {subscription.currentPeriodEnd.getFullYear() > 1970 
                  ? t('subscription.management.cancelledNotice', {
                      date: format(subscription.currentPeriodEnd, getDateFormatByLanguage(i18n.language), { locale: getDateLocaleByLanguage(i18n.language) })
                    })
                  : t('subscription.management.cancelledNotice', { date: t('subscription.toBeUpdated') })
                }
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 管理操作 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('subscription.management.actions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {managementActions.map((action, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-start gap-3">
                {action.icon}
                <div>
                  <div className="font-medium">{action.title}</div>
                  <div className="text-sm text-muted-foreground">{action.description}</div>
                </div>
              </div>
              <Button
                variant={action.variant}
                size="sm"
                onClick={action.action}
                disabled={action.disabled || loading}
              >
                {action.title === t('subscription.management.managePayment') && <ExternalLink className="h-3 w-3 ml-1" />}
                {action.variant === 'destructive' && action.disabled ? t('subscription.management.cancelled') : t('subscription.management.action')}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 计划详情 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('subscription.management.currentPlanDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>{t('subscription.planDetails.monthlyCredits', { credits: '' }).replace('{{credits}} ', '')}</span>
              <span className="font-medium">{planDetails.credits.toLocaleString()} {t('credits.credits', planDetails.credits.toString())}</span>
            </div>
            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-2">{t('subscription.status.includedFeatures')}</div>
              <ul className="space-y-1">
                {planDetails.features.map((feature, index) => (
                  <li key={index} className="text-sm flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 取消确认对话框 */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('subscription.management.confirmCancel')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="text-sm">
                  {t('subscription.management.cancelWarning')}
                </div>
                <ul className="text-sm space-y-1 ml-4">
                  {(t('subscription.management.cancelBullets', { returnObjects: true, date: subscription.currentPeriodEnd.getFullYear() > 1970 ? format(subscription.currentPeriodEnd, getDateFormatByLanguage(i18n.language), { locale: getDateLocaleByLanguage(i18n.language) }) : t('subscription.toBeUpdated') }) as string[]).map((bullet, index) => (
                    <li key={index}>• {bullet}</li>
                  ))}
                </ul>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t('subscription.management.cancelNote')}
                  </AlertDescription>
                </Alert>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('subscription.management.keepSubscription')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? t('subscription.management.processing') : t('subscription.management.confirmCancelAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}