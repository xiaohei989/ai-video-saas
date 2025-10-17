/**
 * 定时清理Edge Function - 重试卡住的缩略图
 * 由 Vercel Cron 或 Supabase Cron 触发
 * 每小时执行一次
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // 处理 CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    console.log('[RetryStuckThumbnails] ========== 开始定时清理任务 ==========')

    // 验证授权（可选，用于防止未授权调用）
    const authHeader = req.headers.get('authorization')
    const expectedToken = Deno.env.get('CRON_SECRET') || Deno.env.get('SERVICE_ROLE_KEY')

    if (expectedToken && !authHeader?.includes(expectedToken)) {
      console.log('[RetryStuckThumbnails] ⚠️  未授权的请求')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 创建 Supabase Admin 客户端
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 调用数据库函数
    const { data, error } = await supabase.rpc('auto_retry_stuck_thumbnails')

    if (error) {
      throw new Error(`Database function failed: ${error.message}`)
    }

    console.log('[RetryStuckThumbnails] ✅ 清理完成:', data)

    return new Response(
      JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[RetryStuckThumbnails] ❌ 执行失败:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
