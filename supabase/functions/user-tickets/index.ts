import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserTicketRequest {
  action: 'create' | 'list' | 'get_details' | 'reply'
  ticketId?: string
  subject?: string
  category?: string
  priority?: string
  description?: string
  content?: string
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

    // 验证用户认证
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    const requestData: UserTicketRequest = await req.json()
    const { action } = requestData

    switch (action) {
      case 'create': {
        if (!requestData.subject || !requestData.description || !requestData.category) {
          throw new Error('Subject, description, and category are required')
        }

        // 获取用户profile信息
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('username, email, full_name')
          .eq('id', user.id)
          .single()

        // 创建ticket
        const { data: ticket, error } = await supabaseClient
          .from('support_tickets')
          .insert({
            user_id: user.id,
            subject: requestData.subject,
            category: requestData.category,
            priority: requestData.priority || 'medium',
            user_email: user.email || profile?.email,
            user_name: profile?.full_name || profile?.username || 'Unknown User'
          })
          .select(`
            id,
            ticket_number,
            subject,
            category,
            priority,
            status,
            created_at
          `)
          .single()

        if (error) throw error

        // 创建初始消息
        await supabaseClient
          .from('ticket_messages')
          .insert({
            ticket_id: ticket.id,
            sender_id: user.id,
            content: requestData.description
          })

        return new Response(
          JSON.stringify({
            success: true,
            data: ticket
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'list': {
        const page = requestData.pagination?.page || 1
        const pageSize = requestData.pagination?.pageSize || 20
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        const { data: tickets, error, count } = await supabaseClient
          .from('support_tickets')
          .select(`
            id,
            ticket_number,
            subject,
            category,
            priority,
            status,
            created_at,
            updated_at,
            first_response_at,
            last_response_at,
            assigned_admin:profiles!assigned_admin_id(username, full_name)
          `, { count: 'exact' })
          .eq('user_id', user.id)
          .range(from, to)
          .order('created_at', { ascending: false })

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

        // 获取ticket详情
        const { data: ticket, error: ticketError } = await supabaseClient
          .from('support_tickets')
          .select(`
            *,
            assigned_admin:profiles!assigned_admin_id(username, full_name, avatar_url)
          `)
          .eq('id', requestData.ticketId)
          .eq('user_id', user.id) // 确保用户只能查看自己的ticket
          .single()

        if (ticketError || !ticket) {
          throw new Error('Ticket not found or access denied')
        }

        // 获取消息
        const { data: messages, error: messagesError } = await supabaseClient
          .from('ticket_messages')
          .select(`
            id,
            content,
            message_type,
            attachments,
            is_internal,
            is_system_message,
            created_at,
            sender:profiles!sender_id(id, username, full_name, avatar_url, role)
          `)
          .eq('ticket_id', requestData.ticketId)
          .eq('is_internal', false) // 用户不能看到内部消息
          .order('created_at', { ascending: true })

        if (messagesError) throw messagesError

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ticket,
              messages: messages || []
            }
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

        // 验证用户对此ticket的访问权限
        const { data: ticket } = await supabaseClient
          .from('support_tickets')
          .select('id, status')
          .eq('id', requestData.ticketId)
          .eq('user_id', user.id)
          .single()

        if (!ticket) {
          throw new Error('Ticket not found or access denied')
        }

        if (ticket.status === 'closed') {
          throw new Error('Cannot reply to closed ticket')
        }

        // 创建回复消息
        const { error } = await supabaseClient
          .from('ticket_messages')
          .insert({
            ticket_id: requestData.ticketId,
            sender_id: user.id,
            content: requestData.content
          })

        if (error) throw error

        // 更新ticket状态为等待管理员回复
        await supabaseClient
          .from('support_tickets')
          .update({ 
            status: 'in_progress',
            last_response_at: new Date().toISOString()
          })
          .eq('id', requestData.ticketId)

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

      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    console.error('User tickets error:', error)
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