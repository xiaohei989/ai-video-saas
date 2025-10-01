import React, { useEffect, useState } from 'react'
import { formatShortDate } from '@/utils/dateFormat'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import {
  getAdminStats,
  getWebsiteAnalytics,
  getPageViewTrends,
  getPopularPages,
  getDeviceDistribution,
  getTrafficSources
} from '@/services/adminDataProvider'
import {
  Users,
  DollarSign,
  Video,
  MessageCircle,
  AlertTriangle,
  Eye,
  Monitor,
  Globe
} from '@/components/icons'

interface DashboardStats {
  total_users: number
  new_users_today: number
  new_users_this_week: number
  new_users_this_month: number
  total_revenue: number
  subscription_revenue: number
  credit_purchase_revenue: number
  revenue_today: number
  subscription_revenue_today: number
  credit_purchase_revenue_today: number
  revenue_this_week: number
  subscription_revenue_this_week: number
  credit_purchase_revenue_this_week: number
  revenue_this_month: number
  subscription_revenue_this_month: number
  credit_purchase_revenue_this_month: number
  active_subscriptions: number
  total_videos: number
  videos_today: number
  pending_tickets: number
  banned_users: number
  trends: {
    user_growth: Record<string, number>
    sales_growth: Record<string, number>
    video_generation: Record<string, number>
  }
  geo_distribution: {
    countries: Record<string, number>
  }
  subscription_breakdown: Record<string, number>
  security_alerts: {
    suspicious_ips: Array<{ ip_address: string; attempt_count: number }>
    credit_anomalies: Array<any>
  }
}

interface WebsiteAnalytics {
  total_page_views: number
  unique_visitors: number
  total_sessions: number
  avg_session_duration: number
  bounce_rate: number
  page_views_today: number
  unique_visitors_today: number
  page_views_this_week: number
  unique_visitors_this_week: number
}

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#ea580c', '#ca8a04']

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [websiteAnalytics, setWebsiteAnalytics] = useState<WebsiteAnalytics | null>(null)
  const [pageViewTrends, setPageViewTrends] = useState<any[]>([])
  const [popularPages, setPopularPages] = useState<any[]>([])
  const [deviceDistribution, setDeviceDistribution] = useState<any[]>([])
  const [trafficSources, setTrafficSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')

  useEffect(() => {
    loadStats()
    loadWebsiteAnalytics()
  }, [period])

  const loadWebsiteAnalytics = async () => {
    try {
      const daysBack = period === 'day' ? 7 : period === 'week' ? 30 : 90

      const [analytics, trends, pages, devices, sources] = await Promise.all([
        getWebsiteAnalytics(daysBack),
        getPageViewTrends(daysBack),
        getPopularPages(daysBack, 10),
        getDeviceDistribution(daysBack),
        getTrafficSources(daysBack)
      ])

      setWebsiteAnalytics(analytics)
      setPageViewTrends(trends)
      setPopularPages(pages)
      setDeviceDistribution(devices)
      setTrafficSources(sources)
    } catch (err) {
      console.error('[Dashboard] Load website analytics error:', err)
    }
  }

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('[Dashboard] Loading stats...')
      const rawData = await getAdminStats(period)
      console.log('[Dashboard] Raw stats data:', rawData)
      
      // 后端现在直接返回展平的数据结构
      const processedData = {
        // 核心统计数据 - 直接从顶级字段获取
        total_users: rawData.total_users || 0,
        new_users_today: rawData.new_users_today || 0,
        new_users_this_week: rawData.new_users_this_week || 0,
        new_users_this_month: rawData.new_users_this_month || 0,
        total_revenue: rawData.total_revenue || 0,
        subscription_revenue: rawData.subscription_revenue || 0,
        credit_purchase_revenue: rawData.credit_purchase_revenue || 0,
        revenue_today: rawData.revenue_today || 0,
        subscription_revenue_today: rawData.subscription_revenue_today || 0,
        credit_purchase_revenue_today: rawData.credit_purchase_revenue_today || 0,
        revenue_this_week: rawData.revenue_this_week || 0,
        subscription_revenue_this_week: rawData.subscription_revenue_this_week || 0,
        credit_purchase_revenue_this_week: rawData.credit_purchase_revenue_this_week || 0,
        revenue_this_month: rawData.revenue_this_month || 0,
        subscription_revenue_this_month: rawData.subscription_revenue_this_month || 0,
        credit_purchase_revenue_this_month: rawData.credit_purchase_revenue_this_month || 0,
        active_subscriptions: rawData.active_subscriptions || 0,
        total_videos: rawData.total_videos || 0,
        videos_today: rawData.videos_today || 0,
        pending_tickets: rawData.pending_tickets || 0,
        banned_users: rawData.banned_users || 0,
        
        // 趋势数据
        trends: rawData.trends || {
          user_growth: {},
          sales_growth: {},
          video_generation: {}
        },
        
        // 地理分布
        geo_distribution: rawData.geo_distribution || {
          countries: {}
        },
        
        // 订阅分布
        subscription_breakdown: rawData.subscription_breakdown || {},
        
        // 安全警告
        security_alerts: rawData.security_alerts || {
          suspicious_ips: [],
          credit_anomalies: []
        }
      }
      
      console.log('[Dashboard] Processed stats:', processedData)
      setStats(processedData)
    } catch (err) {
      console.error('[Dashboard] Load stats error:', err)
      setError(err instanceof Error ? err.message : '加载统计数据失败')
      
      // 设置默认数据以避免空白页面
      setStats({
        total_users: 0,
        new_users_today: 0,
        new_users_this_week: 0,
        new_users_this_month: 0,
        total_revenue: 0,
        subscription_revenue: 0,
        credit_purchase_revenue: 0,
        revenue_today: 0,
        subscription_revenue_today: 0,
        credit_purchase_revenue_today: 0,
        revenue_this_week: 0,
        subscription_revenue_this_week: 0,
        credit_purchase_revenue_this_week: 0,
        revenue_this_month: 0,
        subscription_revenue_this_month: 0,
        credit_purchase_revenue_this_month: 0,
        active_subscriptions: 0,
        total_videos: 0,
        videos_today: 0,
        pending_tickets: 0,
        banned_users: 0,
        trends: {
          user_growth: {},
          sales_growth: {},
          video_generation: {}
        },
        geo_distribution: {
          countries: {}
        },
        subscription_breakdown: {},
        security_alerts: {
          suspicious_ips: [],
          credit_anomalies: []
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatTrendData = (data: Record<string, number>) => {
    return Object.entries(data)
      .map(([date, value]) => ({
        date: formatShortDate(date),
        value
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7) // 最近7天
  }

  const formatCountryData = (data: Record<string, number>) => {
    return Object.entries(data)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // 前10个国家
  }

  const formatSubscriptionData = (data: Record<string, number>) => {
    const tierNames: Record<string, string> = {
      free: '免费用户',
      basic: '基础版',
      pro: '专业版',
      enterprise: '企业版'
    }

    return Object.entries(data).map(([tier, count], index) => ({
      name: tierNames[tier] || tier,
      value: count,
      color: COLORS[index % COLORS.length]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载统计数据...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
        <strong>错误:</strong> {error}
        <button 
          onClick={loadStats}
          className="ml-4 text-red-600 underline hover:text-red-800"
        >
          重试
        </button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          暂无统计数据
        </div>
      </div>
    )
  }

  const dashboardStats = stats

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题和时间选择器 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">管理员仪表板</h1>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p === 'day' ? '今日' : p === 'week' ? '本周' : '本月'}
            </button>
          ))}
        </div>
      </div>

      {/* 网站访问统计卡片 */}
      {websiteAnalytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总浏览量</CardTitle>
              <Eye className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{websiteAnalytics.total_page_views?.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                今日 {websiteAnalytics.page_views_today?.toLocaleString()} | 本周 {websiteAnalytics.page_views_this_week?.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">独立访客</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{websiteAnalytics.unique_visitors?.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                今日 {websiteAnalytics.unique_visitors_today?.toLocaleString()} | 本周 {websiteAnalytics.unique_visitors_this_week?.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均访问时长</CardTitle>
              <Monitor className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {Math.round(websiteAnalytics.avg_session_duration || 0)}秒
              </div>
              <p className="text-xs text-muted-foreground">
                跳出率 {websiteAnalytics.bounce_rate?.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总会话数</CardTitle>
              <Globe className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{websiteAnalytics.total_sessions?.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                用户活跃度统计
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.total_users?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              今日新增 {dashboardStats.new_users_today}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">订阅收入</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(dashboardStats.subscription_revenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              今日 {formatCurrency(dashboardStats.subscription_revenue_today || 0)} | 本月 {formatCurrency(dashboardStats.subscription_revenue_this_month || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">积分购买收入</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(dashboardStats.credit_purchase_revenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              今日 {formatCurrency(dashboardStats.credit_purchase_revenue_today || 0)} | 本月 {formatCurrency(dashboardStats.credit_purchase_revenue_this_month || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">视频生成</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.total_videos?.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              今日生成 {dashboardStats.videos_today}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理工单</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{dashboardStats.pending_tickets}</div>
            <p className="text-xs text-muted-foreground">
              需要及时处理
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 趋势图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 用户增长趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>用户注册趋势</CardTitle>
            <CardDescription>最近7天的用户注册情况</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={formatTrendData(stats.trends?.user_growth || {})}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 收入趋势 */}
        <Card>
          <CardHeader>
            <CardTitle>收入趋势</CardTitle>
            <CardDescription>最近7天的收入情况</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formatTrendData(stats.trends?.sales_growth || {})}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), '收入']} />
                <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 网站访问趋势和数据分析 */}
      {pageViewTrends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 页面访问趋势 */}
          <Card>
            <CardHeader>
              <CardTitle>页面访问趋势</CardTitle>
              <CardDescription>每日页面浏览量和独立访客数</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={pageViewTrends.slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="view_date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="page_views" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} name="页面浏览量" />
                  <Area type="monotone" dataKey="unique_visitors" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} name="独立访客" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 设备类型分布 */}
          <Card>
            <CardHeader>
              <CardTitle>设备类型分布</CardTitle>
              <CardDescription>访客使用的设备类型统计</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={deviceDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="visitor_count"
                    label={({ device_type, percentage }) => `${device_type} ${percentage}%`}
                  >
                    {deviceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 热门页面和流量来源 */}
      {(popularPages.length > 0 || trafficSources.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 热门页面 */}
          {popularPages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>热门页面</CardTitle>
                <CardDescription>访问量最高的页面（前10）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {popularPages.slice(0, 10).map((page, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{page.page_path}</p>
                        <p className="text-xs text-muted-foreground">
                          {page.unique_visitors} 独立访客 · 平均 {Math.round(page.avg_time_on_page)}秒
                        </p>
                      </div>
                      <div className="ml-4 text-sm font-semibold text-purple-600">
                        {page.view_count}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 流量来源 */}
          {trafficSources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>流量来源</CardTitle>
                <CardDescription>访客来源分析</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trafficSources.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="referrer_domain" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="visitor_count" fill="#059669" name="访客数" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 分布图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 地理分布 */}
        <Card>
          <CardHeader>
            <CardTitle>用户地理分布</CardTitle>
            <CardDescription>用户注册地区分布（前10）</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={formatCountryData(stats.geo_distribution?.countries || {})}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="country" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 订阅分布 */}
        <Card>
          <CardHeader>
            <CardTitle>用户订阅分布</CardTitle>
            <CardDescription>各订阅等级的用户分布</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={formatSubscriptionData(stats.subscription_breakdown || {})}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => {
                    const value = typeof percent === 'number' ? percent : 0
                    return `${name} ${(value * 100).toFixed(0)}%`
                  }}
                >
                  {formatSubscriptionData(stats.subscription_breakdown || {}).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 安全警告 */}
      {(stats.security_alerts?.suspicious_ips?.length > 0 || stats.security_alerts?.credit_anomalies?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              安全警告
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.security_alerts.suspicious_ips.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-800">可疑IP活动</h4>
                  <div className="mt-2 space-y-1">
                    {stats.security_alerts.suspicious_ips.slice(0, 5).map((ip, index) => (
                      <div key={index} className="text-sm text-gray-700">
                        IP: {ip.ip_address} - {ip.attempt_count} 次注册尝试
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {stats.security_alerts.credit_anomalies.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-800">积分异常活动</h4>
                  <div className="mt-2 space-y-1">
                    {stats.security_alerts.credit_anomalies.slice(0, 3).map((anomaly, index) => (
                      <div key={index} className="text-sm text-gray-700">
                        用户: {anomaly.profiles?.username || anomaly.profiles?.email} - 异常积分奖励 {anomaly.total_rewards}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 快速操作区域 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-medium">用户管理</h3>
                <p className="text-sm text-gray-600">管理用户账户和权限</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-8 w-8 text-green-600" />
              <div>
                <h3 className="font-medium">工单处理</h3>
                <p className="text-sm text-gray-600">处理用户反馈和问题</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div>
                <h3 className="font-medium">系统监控</h3>
                <p className="text-sm text-gray-600">监控系统健康状态</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
