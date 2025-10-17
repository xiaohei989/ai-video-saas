/**
 * Vercel Cron API端点
 * 调用 Supabase Edge Function 执行定时清理
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 验证 Cron Secret
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron] 未授权的请求')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('[Cron] 开始执行定时清理任务')

    // 调用 Supabase Edge Function
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase configuration')
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/retry-stuck-thumbnails`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Edge Function failed: ${result.error}`)
    }

    console.log('[Cron] 清理完成:', result)

    return res.status(200).json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Cron] 执行失败:', error)

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
