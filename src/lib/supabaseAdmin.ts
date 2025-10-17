/**
 * Supabase Admin Client
 * 用于需要绕过 RLS 的管理员操作
 * 仅在服务端或管理员功能中使用
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

// 如果没有 service key,返回 null
// 这样可以优雅地降级到使用普通客户端
let adminClient: ReturnType<typeof createClient> | null = null

if (supabaseServiceKey) {
  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
} else {
  console.warn('[Supabase Admin] Service role key not found. Admin operations will use authenticated client.')
}

export const supabaseAdmin = adminClient
