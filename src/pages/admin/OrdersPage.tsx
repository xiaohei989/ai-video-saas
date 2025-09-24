import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Download,
  DollarSign,
  Receipt,
  TrendingUp,
  Users
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatShortDate } from '@/utils/dateFormat'

interface Order {
  id: string
  user_id: string
  user_email: string
  user_role: string
  stripe_payment_intent_id: string
  stripe_checkout_session_id: string
  amount: number
  currency: string
  status: string
  description: string
  payment_type: string
  metadata: any
  created_at: string
  updated_at: string
}

interface OrderSummary {
  total_orders: number
  successful_orders: number
  pending_orders: number
  failed_orders: number
  total_revenue: number
  subscription_orders: number
  credit_purchase_orders: number
  avg_order_amount: number
}

interface OrdersResponse {
  orders: Order[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  summary: OrderSummary
  filters: {
    status: string | null
    paymentType: string | null
    searchEmail: string | null
    dateFrom: string | null
    dateTo: string | null
  }
}

export const OrdersPage: React.FC = () => {
  const { t } = useTranslation()
  const [data, setData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 筛选状态
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    paymentType: '',
    searchEmail: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => {
    loadOrders()
  }, [filters])

  const loadOrders = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Authentication required')
      }

      // 构建查询参数
      const params = new URLSearchParams()
      params.set('page', filters.page.toString())
      params.set('limit', filters.limit.toString())
      
      if (filters.status) params.set('status', filters.status)
      if (filters.paymentType) params.set('paymentType', filters.paymentType)
      if (filters.searchEmail) params.set('searchEmail', filters.searchEmail)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-orders?${params}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch orders')
      }

      setData(result.data)
    } catch (err) {
      console.error('Load orders error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    // 将"all"值转换为空字符串，表示不筛选
    const filterValue = value === 'all' ? '' : value
    setFilters(prev => ({
      ...prev,
      [key]: filterValue,
      page: 1 // 重置到第一页
    }))
  }

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }))
  }

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      status: '',
      paymentType: '',
      searchEmail: '',
      dateFrom: '',
      dateTo: ''
    })
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      succeeded: { variant: 'default' as const, label: t('admin.orders.status.success'), className: 'bg-green-100 text-green-800 text-xs h-4' },
      pending: { variant: 'secondary' as const, label: t('admin.orders.status.pending'), className: 'bg-yellow-100 text-yellow-800 text-xs h-4' },
      failed: { variant: 'destructive' as const, label: t('admin.orders.status.failed'), className: 'bg-red-100 text-red-800 text-xs h-4' },
      canceled: { variant: 'outline' as const, label: t('admin.orders.status.canceled'), className: 'bg-gray-100 text-gray-800 text-xs h-4' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    )
  }

  const getPaymentTypeBadge = (type: string) => {
    const typeConfig = {
      subscription: { label: '订阅', className: 'bg-blue-100 text-blue-800 text-xs h-4' },
      credit_purchase: { label: '积分', className: 'bg-purple-100 text-purple-800 text-xs h-4' },
      other: { label: '其他', className: 'bg-gray-100 text-gray-800 text-xs h-4' }
    }
    
    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.other
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">错误: {error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">暂无数据</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">订单管理</h1>
          <p className="text-sm text-muted-foreground">查看和管理所有支付订单</p>
        </div>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          导出数据
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">总订单数</CardTitle>
            <Receipt className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold">{data.summary.total_orders}</div>
            <p className="text-xs text-muted-foreground">
              成功: {data.summary.successful_orders} | 失败: {data.summary.failed_orders}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">总收入</CardTitle>
            <DollarSign className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold">{formatCurrency(data.summary.total_revenue)}</div>
            <p className="text-xs text-muted-foreground">
              平均: {formatCurrency(data.summary.avg_order_amount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">订阅订单</CardTitle>
            <TrendingUp className="h-3 w-3 text-blue-500" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold text-blue-600">{data.summary.subscription_orders}</div>
            <p className="text-xs text-muted-foreground">
              占比: {((data.summary.subscription_orders / data.summary.total_orders) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">积分订单</CardTitle>
            <Users className="h-3 w-3 text-purple-500" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold text-purple-600">{data.summary.credit_purchase_orders}</div>
            <p className="text-xs text-muted-foreground">
              占比: {((data.summary.credit_purchase_orders / data.summary.total_orders) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">状态</label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="所有状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="succeeded">成功</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="canceled">取消</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">类型</label>
              <Select
                value={filters.paymentType || 'all'}
                onValueChange={(value) => handleFilterChange('paymentType', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="所有类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有类型</SelectItem>
                  <SelectItem value="subscription">订阅</SelectItem>
                  <SelectItem value="credit_purchase">积分购买</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">用户邮箱</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="搜索邮箱..."
                  value={filters.searchEmail}
                  onChange={(e) => handleFilterChange('searchEmail', e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">开始日期</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">结束日期</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">操作</label>
              <Button
                variant="outline"
                onClick={clearFilters}
                size="sm"
                className="w-full h-8 text-xs"
              >
                清空筛选
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">订单列表</CardTitle>
          <p className="text-xs text-muted-foreground">
            共 {data.pagination.totalCount} 条订单，当前第 {data.pagination.page} 页
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">订单ID</TableHead>
                  <TableHead className="text-xs h-8">用户</TableHead>
                  <TableHead className="text-xs h-8">金额</TableHead>
                  <TableHead className="text-xs h-8">状态</TableHead>
                  <TableHead className="text-xs h-8">类型</TableHead>
                  <TableHead className="text-xs h-8">描述</TableHead>
                  <TableHead className="text-xs h-8">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((order) => (
                  <TableRow key={order.id} className="h-12">
                    <TableCell className="font-mono text-xs py-2">
                      {order.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium">{order.user_email}</div>
                        <Badge variant="outline" className="text-xs h-4">
                          {order.user_role === 'admin' ? '管理员' : '用户'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium py-2">
                      {formatCurrency(order.amount, order.currency)}
                    </TableCell>
                    <TableCell className="py-2">
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell className="py-2">
                      {getPaymentTypeBadge(order.payment_type)}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs py-2">
                      {order.description}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2">
                      {formatShortDate(order.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-muted-foreground">
              显示 {Math.min((data.pagination.page - 1) * data.pagination.limit + 1, data.pagination.totalCount)} - {Math.min(data.pagination.page * data.pagination.limit, data.pagination.totalCount)} 条，共 {data.pagination.totalCount} 条
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(data.pagination.page - 1)}
                disabled={!data.pagination.hasPrev}
                className="h-7 text-xs"
              >
                <ChevronLeft className="h-3 w-3" />
                上一页
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, data.pagination.page - 2) + i
                  if (pageNum > data.pagination.totalPages) return null
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === data.pagination.page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className="h-7 w-7 text-xs"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(data.pagination.page + 1)}
                disabled={!data.pagination.hasNext}
                className="h-7 text-xs"
              >
                下一页
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}