import React, { useState } from 'react'
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
    id: 'premium',
    credits: 2400,
    price: 99.99,
    currency: 'USD',
    description: 'premium'
  }
]

// 移除图标和颜色配置，采用更简洁的设计
const packageColors = {
  basic: 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-950 dark:border-gray-800 hover:dark:border-gray-700',
  pro: 'border-gray-900 bg-white dark:bg-gray-950 dark:border-gray-200 ring-1 ring-gray-900 dark:ring-gray-200',
  premium: 'border-gray-200 hover:border-gray-300 bg-white dark:bg-gray-950 dark:border-gray-800 hover:dark:border-gray-700'
}

export function CreditsPurchase({ 
  onPurchaseSuccess,
  className = '' 
}: CreditsPurchaseProps) {
  const { t } = useTranslation()
  const { user } = useAuthContext()
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null)

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!user) return
    
    setLoadingPackage(pkg.id)
    
    try {
      const result = await stripeService.createCreditsPurchaseCheckout(
        pkg.price,
        pkg.credits + (pkg.bonus || 0),
        user.id,
        `${window.location.origin}/pricing?purchase=success`,
        `${window.location.origin}/pricing?purchase=cancelled`
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
              {/* Popular标签 - 卡片顶部中间位置 */}
              {pkg.popular && (
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
                {/* 左上角包名标题 */}
                <div className="mb-6">
                  <div className="inline-block px-3 py-1 rounded-md text-xs font-medium uppercase tracking-wider bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
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
                  {t('credits.credits', { count: pkg.credits.toLocaleString() })}
                </p>

                {/* 购买按钮 */}
                <div className="mb-6">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isLoading && user) {
                        handlePurchase(pkg)
                      }
                    }}
                    disabled={isLoading || !user}
                    variant={pkg.id === 'pro' ? 'default' : 'outline'}
                    className={pkg.id === 'pro' ? 'w-full bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700' : 'w-full'}
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