/**
 * 防刷系统相关的TypeScript类型定义
 */

// IP注册限制检查结果
export interface IPRegistrationLimitCheck {
  can_register: boolean
  current_count: number
  blocked_until: string | null
  reason: string
}

// 设备指纹限制检查结果
export interface DeviceFingerprintLimitCheck {
  can_register: boolean
  current_count: number
  reason: string
}

// 邀请速率限制检查结果
export interface InvitationRateLimitCheck {
  can_create: boolean
  reason: string
  total_count: number
  hourly_count: number
  daily_count: number
  monthly_count: number
}

// 邮箱域名检查结果
export interface EmailDomainCheck {
  is_blocked: boolean
  reason?: string
}

// 认证阻止检查结果
export interface AuthBlockCheck {
  is_blocked: boolean
  blocked_until: string | null
  reason: string
  failure_count: number
}

// 限流检查结果
export interface RateLimitCheck {
  allowed: boolean
  total_hits: number
  remaining: number
  reset_time: string
  retry_after: number | null
}

// Supabase RPC调用的通用结果类型
export interface SupabaseRPCResult<T> {
  data: T | null
  error: {
    message: string
    details?: string
    hint?: string
    code?: string
  } | null
}

// 防刷检查的错误类型
export type AntiFraudError = 
  | 'ip_limit_exceeded'
  | 'device_limit_exceeded' 
  | 'blocked_email_domain'
  | 'rate_limit_exceeded'
  | 'network_error'
  | 'permission_denied'
  | 'unknown_error'

// 防刷检查结果
export interface AntiFraudCheckResult {
  success: boolean
  errorType?: AntiFraudError
  message?: string
  details?: Record<string, any>
}