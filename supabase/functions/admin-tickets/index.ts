import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface TicketManagementRequest {
  action: 'list' | 'get_details' | 'assign' | 'update_status' | 'reply' | 'create' | 'delete' | 'list_faqs' | 'create_faq' | 'update_faq' | 'delete_faq'
  ticketId?: string
  assignedAdminId?: string
  status?: string
  priority?: string
  category?: string
  subject?: string
  content?: string
  isInternal?: boolean
  faqId?: string
  question?: string
  answer?: string
  faqCategory?: string
  language?: string
  filters?: {
    status?: string
    priority?: string
    category?: string
    assignedAdmin?: string
    dateRange?: { start: string; end: string }
  }
  pagination?: {
    page: number
    pageSize: number
  }
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

    const requestData: TicketManagementRequest = await req.json()
    const { action, filters, pagination } = requestData

    switch (action) {
      case 'list': {
        let query = supabaseClient
          .from('support_tickets')
          .select(`
            *,
            user:profiles!user_id(username, email, avatar_url),
            assigned_admin:profiles!assigned_admin_id(username, email, avatar_url),
            _count_messages:ticket_messages(count)
          `, { count: 'exact' })

        // 应用过滤条件
        if (filters?.status) {
          query = query.eq('status', filters.status)
        }
        if (filters?.priority) {
          query = query.eq('priority', filters.priority)
        }
        if (filters?.category) {
          query = query.eq('category', filters.category)
        }
        if (filters?.assignedAdmin) {
          query = query.eq('assigned_admin_id', filters.assignedAdmin)
        }
        if (filters?.dateRange) {
          query = query
            .gte('created_at', filters.dateRange.start)
            .lte('created_at', filters.dateRange.end)
        }

        // 分页
        const page = pagination?.page || 1
        const pageSize = pagination?.pageSize || 20
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        query = query.range(from, to).order('created_at', { ascending: false })

        const { data: tickets, error, count } = await query

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              tickets: tickets || [],
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
        if (!requestData.ticketId) {
          throw new Error('Ticket ID is required')
        }

        // 获取工单详情
        const { data: ticket } = await supabaseClient
          .from('support_tickets')
          .select(`
            *,
            user:profiles!user_id(*),
            assigned_admin:profiles!assigned_admin_id(*)
          `)
          .eq('id', requestData.ticketId)
          .single()

        if (!ticket) {
          throw new Error('Ticket not found')
        }

        // 获取工单消息
        const { data: messages } = await supabaseClient
          .from('ticket_messages')
          .select(`
            *,
            sender:profiles!sender_id(username, email, avatar_url, role, full_name)
          `)
          .eq('ticket_id', requestData.ticketId)
          .order('created_at', { ascending: true })

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...ticket,
              messages: messages || []
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'assign': {
        if (!requestData.ticketId || !requestData.assignedAdminId) {
          throw new Error('Ticket ID and admin ID are required')
        }

        const { error } = await supabaseClient
          .from('support_tickets')
          .update({ 
            assigned_admin_id: requestData.assignedAdminId,
            status: 'in_progress'
          })
          .eq('id', requestData.ticketId)

        if (error) throw error

        // 记录操作日志
        await supabaseClient
          .from('admin_operations_log')
          .insert({
            admin_id: user.id,
            operation_type: 'assign_ticket',
            target_type: 'ticket',
            target_id: requestData.ticketId,
            operation_details: { assigned_to: requestData.assignedAdminId }
          })

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Ticket assigned successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'update_status': {
        if (!requestData.ticketId || !requestData.status) {
          throw new Error('Ticket ID and status are required')
        }

        const { error } = await supabaseClient
          .from('support_tickets')
          .update({ status: requestData.status })
          .eq('id', requestData.ticketId)

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Ticket status updated successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'reply': {
        if (!requestData.ticketId || !requestData.content) {
          throw new Error('Ticket ID and content are required')
        }

        const { error } = await supabaseClient
          .from('ticket_messages')
          .insert({
            ticket_id: requestData.ticketId,
            sender_id: user.id,
            content: requestData.content,
            is_internal: requestData.isInternal || false
          })

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Reply sent successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'create': {
        if (!requestData.subject || !requestData.content) {
          throw new Error('Subject and content are required')
        }

        const { error } = await supabaseClient
          .from('support_tickets')
          .insert({
            user_id: user.id, // 管理员代替用户创建工单
            subject: requestData.subject,
            category: requestData.category || 'other',
            priority: requestData.priority || 'medium',
            user_email: requestData.subject, // 可以从其他地方获取用户邮箱
            user_name: 'Admin Created'
          })

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Ticket created successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'list_faqs': {
        const page = pagination?.page || 1
        const pageSize = pagination?.pageSize || 50
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        let query = supabaseClient
          .from('faq_items')
          .select('*')
          .range(from, to)
          .order('sort_order', { ascending: true })

        if (requestData.faqCategory) {
          query = query.eq('category', requestData.faqCategory)
        }
        if (requestData.language) {
          query = query.eq('language', requestData.language)
        }

        const { data: faqs, error, count } = await query

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              faqs: faqs || [],
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

      case 'create_faq': {
        if (!requestData.question || !requestData.answer || !requestData.faqCategory) {
          throw new Error('Question, answer, and category are required')
        }

        const { error } = await supabaseClient
          .from('faq_items')
          .insert({
            question: requestData.question,
            answer: requestData.answer,
            category: requestData.faqCategory,
            language: requestData.language || 'en',
            created_by: user.id
          })

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'FAQ created successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'update_faq': {
        if (!requestData.faqId) {
          throw new Error('FAQ ID is required')
        }

        const updates: any = { updated_by: user.id }
        if (requestData.question) updates.question = requestData.question
        if (requestData.answer) updates.answer = requestData.answer
        if (requestData.faqCategory) updates.category = requestData.faqCategory

        const { error } = await supabaseClient
          .from('faq_items')
          .update(updates)
          .eq('id', requestData.faqId)

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'FAQ updated successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'delete': {
        if (!requestData.ticketId) {
          throw new Error('Ticket ID is required')
        }

        // 先删除相关消息
        const { error: messagesError } = await supabaseClient
          .from('ticket_messages')
          .delete()
          .eq('ticket_id', requestData.ticketId)

        if (messagesError) throw messagesError

        // 删除工单
        const { error } = await supabaseClient
          .from('support_tickets')
          .delete()
          .eq('id', requestData.ticketId)

        if (error) throw error

        // 记录操作日志
        await supabaseClient
          .from('admin_operations_log')
          .insert({
            admin_id: user.id,
            operation_type: 'delete_ticket',
            target_type: 'ticket',
            target_id: requestData.ticketId,
            operation_details: { deleted_at: new Date().toISOString() }
          })

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Ticket deleted successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'delete_faq': {
        if (!requestData.faqId) {
          throw new Error('FAQ ID is required')
        }

        const { error } = await supabaseClient
          .from('faq_items')
          .update({ is_active: false })
          .eq('id', requestData.faqId)

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'FAQ deleted successfully'
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
    console.error('Admin tickets error:', error)
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