import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface UserManagementRequest {
  action: 'list' | 'ban' | 'unban' | 'get_details' | 'search'
  userId?: string
  reason?: string
  searchTerm?: string
  filters?: {
    role?: string
    country?: string
    banned?: boolean
    registrationDate?: { start: string; end: string }
  }
  pagination?: {
    page: number
    pageSize: number
  }
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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    const { data: adminProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
      throw new Error('Insufficient permissions')
    }

    const requestData: UserManagementRequest = await req.json()
    const { action, userId, reason, searchTerm, filters, pagination } = requestData

    switch (action) {
      case 'list':
      case 'search': {
        let query = supabaseClient
          .from('profiles')
          .select(`
            id,
            email,
            username,
            full_name,
            avatar_url,
            role,
            credits,
            is_banned,
            banned_at,
            banned_reason,
            registration_ip,
            registration_country,
            last_login_ip,
            last_login_country,
            last_active_at,
            created_at
          `)

        // 应用搜索条件
        if (searchTerm) {
          query = query.or(`email.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
        }

        // 应用过滤条件
        if (filters?.role) {
          query = query.eq('role', filters.role)
        }
        if (filters?.country) {
          query = query.eq('registration_country', filters.country)
        }
        if (filters?.banned !== undefined) {
          query = query.eq('is_banned', filters.banned)
        }
        if (filters?.registrationDate) {
          query = query
            .gte('created_at', filters.registrationDate.start)
            .lte('created_at', filters.registrationDate.end)
        }

        // 分页
        const page = pagination?.page || 1
        const pageSize = pagination?.pageSize || 50
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        query = query.range(from, to).order('created_at', { ascending: false })

        const { data: users, error, count } = await query

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              users: users || [],
              pagination: {
                page,
                pageSize,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / pageSize)
              }
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'get_details': {
        if (!userId) {
          throw new Error('User ID is required')
        }

        // 获取用户详细信息
        const { data: userDetails } = await supabaseClient
          .from('profiles')
          .select(`
            *,
            subscriptions(*),
            credit_transactions(*, created_at),
            videos(*, created_at),
            templates(*, created_at),
            ip_registration_attempts(*),
            device_fingerprints(*)
          `)
          .eq('id', userId)
          .single()

        if (!userDetails) {
          throw new Error('User not found')
        }

        // 获取用户的支付记录
        const { data: payments } = await supabaseClient
          .from('payments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        // 获取用户的邀请记录
        const { data: invitations } = await supabaseClient
          .from('invitations')
          .select('*')
          .eq('inviter_id', userId)
          .order('created_at', { ascending: false })

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...userDetails,
              payments: payments || [],
              invitations: invitations || []
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'ban': {
        if (!userId || !reason) {
          throw new Error('User ID and reason are required')
        }

        const { error } = await supabaseClient
          .rpc('ban_user', {
            p_user_id: userId,
            p_admin_id: user.id,
            p_reason: reason
          })

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'User banned successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'unban': {
        if (!userId) {
          throw new Error('User ID is required')
        }

        const { error } = await supabaseClient
          .rpc('unban_user', {
            p_user_id: userId,
            p_admin_id: user.id
          })

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'User unbanned successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    console.error('Admin users error:', error)
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