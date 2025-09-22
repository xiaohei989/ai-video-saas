import type { SupabaseClient } from '@supabase/supabase-js'

export interface SecureClientOptions {
  enableCSRF: boolean
  enableRateLimit: boolean
  enableInputValidation: boolean
  enableQueryLogging: boolean
  maxQueryComplexity: number
}

/**
 * 兼容旧代码的轻量包装：直接返回传入的 Supabase 客户端。
 * 如需恢复安全增强逻辑，可在此重新实现。
 */
export function createSecureSupabaseClient(
  client: SupabaseClient,
  _anonKey?: string,
  _options: Partial<SecureClientOptions> = {}
): SupabaseClient {
  return client
}
