import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gem, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/contexts/AuthContext'
import creditService from '@/services/creditService'

interface CreditBalanceProps {
  showDetails?: boolean
  onPurchaseClick?: () => void
  className?: string
}

export function CreditBalance({ 
  showDetails = true, 
  onPurchaseClick,
  className = ''
}: CreditBalanceProps) {
  const { user } = useAuthContext()

  const { data: credits, isLoading, error } = useQuery({
    queryKey: ['user-credits', user?.id],
    queryFn: () => user?.id ? creditService.getUserCredits(user.id) : null,
    enabled: !!user?.id,
    refetchInterval: 30000 // 30秒刷新一次
  })

  const { data: stats } = useQuery({
    queryKey: ['credit-stats', user?.id],
    queryFn: () => user?.id ? creditService.getCreditStats(user.id) : null,
    enabled: !!user?.id && showDetails
  })

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
              <div className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !credits) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600">积分加载失败</p>
              <p className="text-xs text-gray-500">请刷新页面重试</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isLowBalance = credits.credits < 50

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isLowBalance ? 'bg-red-100' : 'bg-purple-100'
            }`}>
              <Gem className={`w-5 h-5 ${
                isLowBalance ? 'text-red-600' : 'text-purple-600'
              }`} />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">
                {creditService.formatCredits(credits.credits)}
              </CardTitle>
              <CardDescription>
                {isLowBalance ? '积分余额不足' : '当前积分余额'}
              </CardDescription>
            </div>
          </div>
          {onPurchaseClick && (
            <Button onClick={onPurchaseClick} size="sm">
              充值
            </Button>
          )}
        </div>
      </CardHeader>

      {showDetails && stats && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-gray-600">总获得</p>
                <p className="font-medium">{creditService.formatCredits(stats.totalEarned)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <div>
                <p className="text-gray-600">总消费</p>
                <p className="font-medium">{creditService.formatCredits(stats.totalSpent)}</p>
              </div>
            </div>
            
            <div className="col-span-2 mt-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>本月已消费</span>
                <span>{creditService.formatCredits(stats.thisMonthSpent)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((stats.thisMonthSpent / 500) * 100, 100)}%`
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                月度预算: 500积分
              </p>
            </div>
          </div>

          {isLowBalance && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                💡 您的积分余额较低，建议及时充值以确保服务正常使用
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default CreditBalance