import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface AdminOrdersRequest {
  page?: number
  limit?: number
  status?: string
  paymentType?: string
  searchEmail?: string
  dateFrom?: string
  dateTo?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error(`Invalid authentication: ${authError?.message || 'No user found'}`)
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !['admin', 'super_admin'].includes(profile.role)) {
      throw new Error('Insufficient permissions')
    }

    // 解析请求参数
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status') || null
    const paymentType = url.searchParams.get('paymentType') || null
    const searchEmail = url.searchParams.get('searchEmail') || null
    const dateFrom = url.searchParams.get('dateFrom') || null
    const dateTo = url.searchParams.get('dateTo') || null

    const offset = (page - 1) * limit

    // 构建参数数组
    const params = {
      page_offset: offset,
      page_limit: limit,
      status_filter: status,
      payment_type_filter: paymentType,
      search_email: searchEmail,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
      date_to: dateTo ? new Date(dateTo).toISOString() : null
    }

    // 获取订单列表
    const { data: orders, error: ordersError } = await supabaseClient
      .rpc('get_orders_list', params)

    if (ordersError) {
      console.error('Orders query error:', ordersError)
      throw new Error(`Failed to fetch orders: ${ordersError.message}`)
    }

    // 获取总数
    const { data: totalCount, error: countError } = await supabaseClient
      .rpc('get_orders_count', {
        status_filter: status,
        payment_type_filter: paymentType,
        search_email: searchEmail,
        date_from: dateFrom ? new Date(dateFrom).toISOString() : null,
        date_to: dateTo ? new Date(dateTo).toISOString() : null
      })

    if (countError) {
      console.error('Count query error:', countError)
      throw new Error(`Failed to fetch orders count: ${countError.message}`)
    }

    // 获取订单统计概览
    const { data: summary, error: summaryError } = await supabaseClient
      .rpc('get_orders_summary')

    if (summaryError) {
      console.error('Summary query error:', summaryError)
      throw new Error(`Failed to fetch orders summary: ${summaryError.message}`)
    }

    const totalPages = Math.ceil((totalCount || 0) / limit)

    const response = {
      success: true,
      data: {
        orders: orders || [],
        pagination: {
          page,
          limit,
          totalCount: totalCount || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        summary: summary?.[0] || {
          total_orders: 0,
          successful_orders: 0,
          pending_orders: 0,
          failed_orders: 0,
          total_revenue: 0,
          subscription_orders: 0,
          credit_purchase_orders: 0,
          avg_order_amount: 0
        },
        filters: {
          status,
          paymentType,
          searchEmail,
          dateFrom,
          dateTo
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
    console.error('Admin orders error:', error)
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