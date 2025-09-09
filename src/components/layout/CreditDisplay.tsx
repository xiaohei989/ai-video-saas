import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Gem, ArrowUpRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { edgeCacheClient } from '@/services/EdgeFunctionCacheClient'
import stripeService from '@/services/stripeService'

interface CreditDisplayProps {
  className?: string
}

export function CreditDisplay({ className }: CreditDisplayProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [subscription, setSubscription] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 初始化积分数据 - 优先使用AuthContext中的数据
  useEffect(() => {
    if (profile?.credits !== undefined) {
      setCredits(profile.credits)
    }
  }, [profile?.credits])

  // 获取用户积分和订阅状态 - 使用统一缓存系统
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return

      // 如果已有profile数据，不显示loading状态，而是后台静默更新
      const shouldShowLoading = !profile?.credits
      if (shouldShowLoading) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        // 🚀 使用EdgeFunctionCacheClient统一获取积分（移除重复的localStorage缓存）
        const userCredits = await edgeCacheClient.getUserCredits(user.id)
        if (userCredits > 0) {
          setCredits(userCredits)
        }

        // 🚀 使用缓存获取订阅状态
        const subscriptionTier = await edgeCacheClient.getUserSubscription(user.id)
        
        // 构建简化的订阅对象用于UI显示
        if (subscriptionTier && subscriptionTier !== 'free') {
          setSubscription({
            plan: { tier: subscriptionTier },
            status: 'active'
          })
        } else {
          // 免费用户或获取失败时，尝试原方法作为后备
          const userSubscription = await stripeService.getUserSubscription(user.id)
          setSubscription(userSubscription)
        }
      } catch (error) {
        console.error('[CreditDisplay] 获取用户数据失败:', error)
        // 错误时尝试原方法作为后备
        try {
          const userSubscription = await stripeService.getUserSubscription(user.id)
          setSubscription(userSubscription)
        } catch (fallbackError) {
          console.error('[CreditDisplay] 后备方法也失败:', fallbackError)
        }
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    }

    fetchUserData()
  }, [user?.id, profile?.credits])

  // 检查用户订阅状态
  const isFreeUser = !subscription || !subscription.plan || subscription.status !== 'active'
  const isEnterpriseUser = subscription?.plan?.tier === 'enterprise' || subscription?.plan?.tier === 'enterprise-annual'

  // 格式化积分显示
  const formatCredits = (credits: number) => {
    if (credits >= 1000) {
      return `${(credits / 1000).toFixed(1)}k`
    }
    return credits.toString()
  }

  // 不显示给未登录用户
  if (!user) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 积分显示 */}
      <div className="flex items-center gap-1 px-2 py-1 bg-secondary/50 rounded-md">
        <Gem className="h-4 w-4 text-purple-600" />
        <span className="text-sm font-medium relative">
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              {formatCredits(credits || 0)}
              {isRefreshing && (
                <Loader2 className="h-2 w-2 animate-spin absolute -top-1 -right-1 text-purple-400" />
              )}
            </>
          )}
        </span>
      </div>

      {/* 升级按钮 - 仅对免费用户显示，企业用户不显示 */}
      {isFreeUser && !isEnterpriseUser && (
        <Button
          onClick={() => navigate('/pricing')}
          size="sm"
          variant="default"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 shadow-sm hover:shadow-md px-1.5 py-0.5 text-xs h-6 text-[10px]"
        >
          <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
          {t('upgradeDialog.upgrade')}
        </Button>
      )}
    </div>
  )
}