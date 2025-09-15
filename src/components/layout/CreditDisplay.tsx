import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Gem, ArrowUpRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import stripeService from '@/services/stripeService'

interface CreditDisplayProps {
  className?: string
}

export function CreditDisplay({ className }: CreditDisplayProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [subscription, setSubscription] = useState<any>(null)

  // 🚀 简化：直接使用 AuthContext 中的积分数据
  const credits = profile?.credits || 0

  // 获取订阅状态
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user?.id) return

      try {
        const userSubscription = await stripeService.getUserSubscription(user.id)
        setSubscription(userSubscription)
      } catch (error) {
        console.error('[CreditDisplay] 获取订阅信息失败:', error)
      }
    }

    fetchSubscription()
  }, [user?.id])

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
    <div className={`flex items-center gap-1 md:gap-2 ${className}`}>
      {/* 积分显示 - 移动端紧凑样式 */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 bg-secondary/50 rounded-md">
        <Gem className="h-3 w-3 md:h-4 md:w-4 text-purple-600" />
        <span className="text-xs md:text-sm font-medium relative">
          {authLoading ? (
            <Loader2 className="h-2.5 w-2.5 md:h-3 md:w-3 animate-spin" />
          ) : (
            formatCredits(credits)
          )}
        </span>
      </div>

      {/* 升级按钮 - 仅对免费用户显示，企业用户不显示，移动端更紧凑 */}
      {isFreeUser && !isEnterpriseUser && (
        <Button
          onClick={() => navigate('/pricing')}
          size="sm"
          variant="default"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium transition-all duration-200 shadow-sm hover:shadow-md px-1 py-0.5 md:px-1.5 md:py-0.5 text-[9px] md:text-xs h-5 md:h-6"
        >
          <ArrowUpRight className="h-2 w-2 md:h-2.5 md:w-2.5 mr-0.5" />
          {t('upgradeDialog.upgrade')}
        </Button>
      )}
    </div>
  )
}