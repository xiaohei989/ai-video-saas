/**
 * R2迁移自动重试 Edge Function
 * 由 Cron 触发，每5分钟执行一次
 * 智能重试策略：第1次2分钟，第2次5分钟，第3次10分钟
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
    console.log('[RetryFailedMigrations] ========== 开始自动重试任务 ==========')

    // 验证授权（防止未授权调用）
    const authHeader = req.headers.get('authorization')
    const expectedToken = Deno.env.get('CRON_SECRET') || Deno.env.get('SERVICE_ROLE_KEY')

    if (expectedToken && !authHeader?.includes(expectedToken)) {
      console.log('[RetryFailedMigrations] ⚠️  未授权的请求')
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

    // 调用数据库自动重试函数
    const { data, error } = await supabase.rpc('auto_retry_failed_migrations')

    if (error) {
      throw new Error(`Database function failed: ${error.message}`)
    }

    console.log('[RetryFailedMigrations] ✅ 重试完成:', data)
    console.log(`  - 已重试: ${data.retriedCount} 个视频`)
    console.log(`  - 跳过: ${data.skippedCount} 个视频（等待时间不足）`)

    // 如果有重试，查询一下当前健康状况
    let healthData = null
    if (data.retriedCount > 0) {
      const { data: health } = await supabase
        .from('migration_health')
        .select('*')
        .single()

      healthData = health
      console.log('[RetryFailedMigrations] 📊 系统健康状况:')
      console.log(`  - 迁移成功: ${health?.completed_count || 0}`)
      console.log(`  - 迁移失败: ${health?.failed_count || 0}`)
      console.log(`  - 成功率: ${health?.success_rate_percent || 0}%`)
      console.log(`  - 可重试: ${health?.retriable_count || 0}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data,
        health: healthData,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[RetryFailedMigrations] ❌ 执行失败:', error)

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
