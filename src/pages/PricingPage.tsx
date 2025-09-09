import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, XCircle, Gift, CreditCard, Users } from 'lucide-react'
import PricingPlans from '@/components/payment/PricingPlans'
import CreditsPurchase from '@/components/payment/CreditsPurchase'
import ReferralDashboard from '@/components/payment/ReferralDashboard'
import CreditBalance from '@/components/payment/CreditBalance'
import CompactUserInfo from '@/components/subscription/CompactUserInfo'
import { useAuthContext } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'

// 计费周期类型
type BillingInterval = 'month' | 'year'

export default function PricingPage() {
  const { t } = useTranslation()
  const { user } = useAuthContext()
  const { trackEvent } = useAnalytics()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('subscription')
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month')

  // SEO优化
  useSEO('pricing')

  // 处理URL参数和支付结果
  useEffect(() => {
    const activeTabParam = searchParams.get('activeTab')
    const success = searchParams.get('success')
    const cancelled = searchParams.get('cancelled')
    const purchase = searchParams.get('purchase')

    // 设置初始标签页
    if (activeTabParam && ['subscription', 'credits', 'referral'].includes(activeTabParam)) {
      setActiveTab(activeTabParam)
    }

    // 处理支付结果
    if (success === 'true') {
      toast.success(t('pricing.subscriptionSuccess'))
      setSearchParams({}) // 清除URL参数
    } else if (cancelled === 'true') {
      toast.error(t('pricing.paymentCancelled'))
      setSearchParams({})
    } else if (purchase === 'success') {
      toast.success(t('pricing.creditsSuccess'))
      setSearchParams({})
    } else if (purchase === 'cancelled') {
      toast.error(t('pricing.creditsCancelled'))
      setSearchParams({})
    }
  }, [searchParams, setSearchParams, t])

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 用户信息（已登录用户） */}
      {user && (
        <div className="mb-6">
          <CompactUserInfo 
            userId={user.id}
            className="max-w-3xl mx-auto"
          />
        </div>
      )}

      {/* 支付状态提示 */}
      {searchParams.get('success') === 'true' && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {t('pricing.paymentSuccess')}
          </AlertDescription>
        </Alert>
      )}

      {searchParams.get('cancelled') === 'true' && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {t('pricing.paymentCancelledDescription')}
          </AlertDescription>
        </Alert>
      )}

      {/* 主要内容标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${user ? 'grid-cols-3' : 'grid-cols-2'} max-w-md mx-auto`}>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>{t('pricing.subscriptionPlan')}</span>
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <span>{t('pricing.purchaseCredits')}</span>
          </TabsTrigger>
          {user && (
            <TabsTrigger value="referral" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{t('pricing.inviteFriends')}</span>
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-6">
          {/* 订阅计划 */}
          <TabsContent value="subscription" className="space-y-6">
            {/* 计费周期切换 */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center p-1 bg-gray-100 rounded-lg dark:bg-gray-800">
                <button
                  onClick={() => setBillingInterval('month')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    billingInterval === 'month'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {t('subscription.billingInterval.monthly')}
                </button>
                <button
                  onClick={() => setBillingInterval('year')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all relative ${
                    billingInterval === 'year'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{t('subscription.billingInterval.annually')}</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                      {t('subscription.billingInterval.freeMonths')}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <PricingPlans billingInterval={billingInterval} />
            
            {/* 订阅计划FAQ */}
            <div className="max-w-5xl mx-auto">
              <h2 className="text-xl font-bold text-center mb-6">{t('pricing.faqTitle')}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-3 text-lg">{t('pricing.whatAreCredits')}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {t('pricing.creditsDescription')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-3 text-lg">{t('pricing.canChangePlan')}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {t('pricing.changePlanDescription')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-3 text-lg">{t('pricing.doCreditsRollover')}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {t('pricing.creditsRolloverDescription')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-3 text-lg">{t('pricing.paymentMethods')}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {t('pricing.paymentMethodsDescription')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 积分购买 */}
          <TabsContent value="credits">
            <CreditsPurchase />
          </TabsContent>

          {/* 邀请系统 */}
          {user && (
            <TabsContent value="referral">
              <ReferralDashboard />
            </TabsContent>
          )}
        </div>
      </Tabs>

    </div>
  )
}