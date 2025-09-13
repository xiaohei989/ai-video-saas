import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/contexts/AuthContext'
import stripeService from '@/services/stripeService'

interface CreditsPurchaseProps {
  onPurchaseSuccess?: (credits: number) => void
  className?: string
}

interface CreditPackage {
  id: string
  credits: number
  price: number
  currency: string
  popular?: boolean
  bonus?: number
  description: string
}

const creditPackages: CreditPackage[] = [
  {
    id: 'basic',
    credits: 160,
    price: 9.99,
    currency: 'USD',
    description: 'basic'
  },
  {
    id: 'pro',
    credits: 1000,
    price: 49.99,
    currency: 'USD',
    description: 'pro',
    popular: true
  },
  {
    id: 'enterprise',
    credits: 2400,
    price: 99.99,
    currency: 'USD',
    description: 'enterprise'
  }
]

// 积分包样式配置，Pro包使用特殊样式
const packageColors = {
  basic: 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-950 dark:border-gray-800 hover:dark:border-gray-700',
  pro: 'border-purple-200 bg-gradient-to-br from-white to-purple-50 dark:from-gray-950 dark:to-purple-950/20 ring-2 ring-purple-300 hover:ring-purple-400 dark:ring-purple-600 dark:hover:ring-purple-500 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105',
  enterprise: 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-950 dark:border-gray-800 hover:dark:border-gray-700'
}

export function CreditsPurchase({ 
  className = '' 
}: CreditsPurchaseProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuthContext()
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null)

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!user) {
      // 未登录用户跳转到登录页面
      window.location.href = `/signin?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
      return
    }
    
    setLoadingPackage(pkg.id)
    
    try {
      console.log('💰 发起积分购买请求:', {
        language: i18n.language,
        pkg: pkg.id,
        credits: pkg.credits,
        i18nextLng: localStorage.getItem('i18nextLng'),
        preferredLanguage: localStorage.getItem('preferred_language'),
        detectedLanguage: i18n.language || localStorage.getItem('i18nextLng') || localStorage.getItem('preferred_language') || 'en'
      });
      
      const result = await stripeService.createCreditsPurchaseCheckout(
        pkg.price,
        pkg.credits + (pkg.bonus || 0),
        user.id,
        `${window.location.origin}/pricing?purchase=success`,
        `${window.location.origin}/pricing?purchase=cancelled`,
        i18n.language
      )

      if (result?.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Error purchasing credits:', error)
    } finally {
      setLoadingPackage(null)
    }
  }

  const calculateSavings = (credits: number, price: number): number => {
    const baseRate = 9.99 / 160 // Basic package unit price
    const currentRate = price / credits
    return Math.round(((baseRate - currentRate) / baseRate) * 100)
  }

  return (
    <div className={className}>
      <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-3">
        {creditPackages.map((pkg) => {
          const isLoading = loadingPackage === pkg.id
          const savings = calculateSavings(pkg.credits, pkg.price)
          const totalCredits = pkg.credits + (pkg.bonus || 0)

          return (
            <Card 
              key={pkg.id}
              className={`relative flex flex-col h-full transition-all duration-200 hover:shadow-md ${
                packageColors[pkg.id as keyof typeof packageColors] || ''
              }`}
            >
              {/* Popular标签 - 紧凑圆角矩形设计 */}
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="relative">
                    {/* 流光背景层 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 rounded-lg animate-pulse opacity-90"></div>
                    
                    {/* 流光动画层 */}
                    <div className="absolute inset-0 rounded-lg overflow-hidden">
                      <div className="absolute -inset-10 opacity-70">
                        <div className="w-4 h-full bg-gradient-to-r from-transparent via-white to-transparent transform -skew-x-12" style={{animation: 'shimmer 2s ease-in-out infinite'}}></div>
                      </div>
                    </div>
                    
                    {/* 主体内容 */}
                    <div className="relative flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white rounded-lg shadow-md">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-xs font-bold">{t('pricing.popular')}</span>
                    </div>
                  </div>
                </div>
              )}


              <CardContent className="p-6">
                {/* 左上角包名标题 */}
                <div className="mb-6">
                  <div className={`inline-block px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider ${
                    pkg.popular 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md' 
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {t(`credits.packages.${pkg.description}`)}
                  </div>
                </div>

                {/* 价格区域 */}
                <div className="mb-2">
                  <div className="flex items-center gap-3 justify-start">
                    <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                      {stripeService.formatPrice(pkg.price)}
                    </span>
                    {/* Save标签 - 价格右侧 */}
                    {savings > 0 && (
                      <div className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-base font-semibold">
                        {t('credits.save', { percent: savings })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 积分数量 */}
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('credits.credits', { count: pkg.credits })}
                </p>

                {/* 购买按钮 */}
                <div className="mb-6">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isLoading) {
                        handlePurchase(pkg)
                      }
                    }}
                    disabled={isLoading}
                    variant={pkg.id === 'pro' ? 'default' : 'outline'}
                    className={pkg.id === 'pro' ? 'w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 animate-pulse' : 'w-full'}
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('credits.processing')}
                      </>
                    ) : (
                      t('credits.buyNow')
                    )}
                  </Button>
                </div>

                {/* 详细信息（无标题） */}
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-start">
                    <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span>{t('credits.unitPrice', { price: stripeService.formatPrice(pkg.price / totalCredits) })}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex items-start">
                      <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span className="text-blue-600">{t('credits.saveComparedToBasic', { percent: savings })}</span>
                    </div>
                  )}
                  {pkg.bonus && (
                    <div className="flex items-start">
                      <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <span className="text-blue-600">{t('credits.bonusCredits', { bonus: pkg.bonus })}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default CreditsPurchase