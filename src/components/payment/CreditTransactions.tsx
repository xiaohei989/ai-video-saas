import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { 
  Receipt, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Gift,
  CreditCard,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from '@/components/icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthContext } from '@/contexts/AuthContext'
import creditService, { CreditTransaction } from '@/services/creditService'
import { useTranslation } from 'react-i18next'

interface CreditTransactionsProps {
  limit?: number
  showAll?: boolean
  className?: string
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'purchase':
      return <CreditCard className="w-4 h-4" />
    case 'reward':
      return <Gift className="w-4 h-4" />
    case 'consume':
      return <ArrowDownCircle className="w-4 h-4" />
    case 'refund':
      return <ArrowUpCircle className="w-4 h-4" />
    default:
      return <Receipt className="w-4 h-4" />
  }
}

const getTransactionColor = (type: string) => {
  switch (type) {
    case 'purchase':
      return 'text-green-600 bg-green-100'
    case 'reward':
      return 'text-blue-600 bg-blue-100'
    case 'consume':
      return 'text-red-600 bg-red-100'
    case 'refund':
      return 'text-green-600 bg-green-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

export function CreditTransactions({ 
  limit = 10, 
  showAll = false,
  className = ''
}: CreditTransactionsProps) {
  const { user } = useAuthContext()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(showAll)
  const [page, setPage] = useState(0)
  const pageSize = limit

  const { 
    data: transactions, 
    isLoading, 
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['credit-transactions', user?.id, page],
    queryFn: () => user?.id ? creditService.getCreditTransactions(
      user.id, 
      pageSize, 
      page * pageSize
    ) : [],
    enabled: !!user?.id
  })

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>积分记录</CardTitle>
          <CardDescription>加载中...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="w-20 h-3 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !transactions) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t('payment.creditHistory')}</CardTitle>
          <CardDescription>{t('components.templateGrid.loadFailed')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">无法加载积分记录</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>积分记录</CardTitle>
          <CardDescription>暂无积分交易记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">还没有任何积分交易记录</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const displayedTransactions = expanded ? transactions : transactions.slice(0, limit)

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>积分记录</CardTitle>
            <CardDescription>
              显示 {displayedTransactions.length} 条记录
              {page > 0 && ` (第 ${page + 1} 页)`}
            </CardDescription>
          </div>
          <Button 
            onClick={() => refetch()} 
            variant="ghost" 
            size="sm"
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {displayedTransactions.map((transaction: CreditTransaction) => (
            <div 
              key={transaction.id}
              className="flex items-center space-x-3 py-2 border-b border-gray-100 last:border-b-0"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                getTransactionColor(transaction.type)
              }`}>
                {getTransactionIcon(transaction.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {transaction.description}
                  </p>
                  <span className={`text-sm font-semibold ${
                    transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{creditService.getTransactionTypeText(transaction.type)}</span>
                  <span>
                    {format(new Date(transaction.created_at), 'MM月dd日 HH:mm', { locale: zhCN })}
                  </span>
                </div>
                
                <div className="text-xs text-gray-400 mt-1">
                  余额: {transaction.balance_before} → {transaction.balance_after}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 分页控制 */}
        <div className="flex items-center justify-between mt-6">
          <Button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            variant="outline"
            size="sm"
          >
            上一页
          </Button>
          
          <span className="text-sm text-gray-500">
            第 {page + 1} 页
          </span>
          
          <Button
            onClick={() => setPage(page + 1)}
            disabled={transactions.length < pageSize}
            variant="outline"
            size="sm"
          >
            下一页
          </Button>
        </div>

        {/* 展开/折叠控制 */}
        {!showAll && transactions.length > limit && (
          <div className="text-center mt-4">
            <Button
              onClick={() => setExpanded(!expanded)}
              variant="ghost"
              size="sm"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  查看更多 ({transactions.length - limit} 条)
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CreditTransactions