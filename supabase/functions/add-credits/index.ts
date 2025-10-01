import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    )

    // Parse request body
    const { userId, amount, type, description, referenceId, referenceType } = await req.json()

    console.log('Adding credits:', { userId, amount, type, description, referenceId, referenceType })

    // Validate required fields
    if (!userId || !amount || !type || !description) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必要参数' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate type field
    const validTypes = ['purchase', 'reward', 'refund']
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ success: false, error: '无效的积分类型' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Call the database function to add credits
    const { data, error } = await supabaseClient.rpc('add_user_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description,
      p_reference_id: referenceId || null,
      p_reference_type: referenceType || null
    })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message || '数据库操作失败'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        newBalance: data,
        message: '积分添加成功'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || '服务器内部错误'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})