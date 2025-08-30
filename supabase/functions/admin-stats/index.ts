import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdminStatsRequest {
  period?: 'day' | 'week' | 'month'
  startDate?: string
  endDate?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 验证管理员权限
    const token = authHeader.replace('Bearer ', '')
    console.log('Auth token received:', token?.substring(0, 20) + '...')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      throw new Error(`Invalid authentication: ${authError?.message || 'No user found'}`)
    }

    console.log('User authenticated:', user.id, user.email)

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      throw new Error(`Failed to fetch profile: ${profileError.message}`)
    }

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      console.error('Insufficient permissions:', profile?.role)
      throw new Error('Insufficient permissions')
    }

    console.log('Admin permissions verified:', profile.role)

    const { period = 'day', startDate, endDate }: AdminStatsRequest = await req.json()

    // 获取基础统计数据
    const { data: dashboardStats } = await supabaseClient
      .rpc('get_admin_dashboard_stats')

    // 获取时间范围
    const daysBack = period === 'day' ? 7 : period === 'week' ? 30 : 90

    // 使用RPC函数获取趋势数据
    const { data: userTrends } = await supabaseClient
      .rpc('get_user_registration_trends', { days_back: daysBack })

    const { data: salesTrends } = await supabaseClient
      .rpc('get_sales_trends', { days_back: daysBack })

    const { data: videoTrends } = await supabaseClient
      .rpc('get_video_generation_trends', { days_back: daysBack })

    const { data: countryStats } = await supabaseClient
      .rpc('get_country_distribution')

    const { data: subscriptionStats } = await supabaseClient
      .rpc('get_subscription_distribution')

    // 处理趋势数据
    const userGrowthTrend = userTrends?.reduce((acc: Record<string, number>, curr) => {
      const date = curr.registration_date
      acc[date] = (acc[date] || 0) + parseInt(curr.user_count.toString())
      return acc
    }, {}) || {}

    const salesGrowthTrend = salesTrends?.reduce((acc: Record<string, number>, curr) => {
      const date = curr.payment_date
      acc[date] = parseFloat(curr.daily_revenue.toString())
      return acc
    }, {}) || {}

    const videoGrowthTrend = videoTrends?.reduce((acc: Record<string, number>, curr) => {
      const date = curr.video_date
      acc[date] = parseInt(curr.video_count.toString())
      return acc
    }, {}) || {}

    // 处理国家分布
    const countryDistribution = countryStats?.reduce((acc: Record<string, number>, curr) => {
      acc[curr.country] = parseInt(curr.user_count.toString())
      return acc
    }, {}) || {}

    // 获取异常监控数据 - 使用RPC函数
    const { data: suspiciousIPs } = await supabaseClient
      .rpc('get_suspicious_ips', { 
        hours_back: 24, 
        min_attempts: 5 
      })

    // 积分异常用户 - 使用RPC函数
    const { data: creditAnomalies } = await supabaseClient
      .rpc('get_credit_anomalies', {
        hours_back: 24,
        min_reward_amount: 1000
      })

    const response = {
      success: true,
      data: {
        dashboard_stats: dashboardStats?.[0] || {},
        trends: {
          user_growth: userGrowthTrend,
          sales_growth: salesGrowthTrend,
          video_generation: videoGrowthTrend
        },
        geo_distribution: {
          countries: countryDistribution
        },
        subscription_breakdown: subscriptionStats?.reduce((acc: Record<string, number>, curr) => {
          acc[curr.tier] = parseInt(curr.user_count.toString())
          return acc
        }, {}) || {},
        security_alerts: {
          suspicious_ips: suspiciousIPs || [],
          credit_anomalies: creditAnomalies || []
        }
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Admin stats error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})