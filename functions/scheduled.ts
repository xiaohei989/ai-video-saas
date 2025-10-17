/**
 * Cloudflare Pages Functions - Scheduled Event Handler
 * 定时清理缩略图任务
 *
 * 部署说明：
 * 1. 确保在 wrangler.toml 中配置了 triggers.crons
 * 2. 部署后会自动按照cron表达式执行
 * 3. 可在 Cloudflare Dashboard → Workers & Pages → 你的项目 → Triggers 查看执行日志
 */

interface Env {
  VITE_SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  CRON_SECRET?: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // 处理 CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  // 验证授权（防止未授权调用）
  const authHeader = request.headers.get('authorization')
  const expectedToken = env.CRON_SECRET || env.SUPABASE_SERVICE_ROLE_KEY

  if (expectedToken && !authHeader?.includes(expectedToken)) {
    console.log('[Cloudflare Cron] ⚠️  未授权的请求')
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }

  try {
    console.log('[Cloudflare Cron] ========== 开始定时清理任务 ==========')

    const supabaseUrl = env.VITE_SUPABASE_URL
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase configuration')
    }

    // 调用 Supabase Edge Function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/retry-stuck-thumbnails`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Edge Function failed: ${result.error}`)
    }

    console.log('[Cloudflare Cron] ✅ 清理完成:', result)

    return new Response(
      JSON.stringify({
        success: true,
        result,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('[Cloudflare Cron] ❌ 执行失败:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}
