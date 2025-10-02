import { useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

// Google Identity Services 类型定义
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleOneTapConfig) => void
          prompt: (callback?: (notification: PromptNotification) => void) => void
          cancel: () => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

interface GoogleOneTapConfig {
  client_id: string
  callback: (response: CredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: 'signin' | 'signup' | 'use'
  itp_support?: boolean
  prompt_parent_id?: string
  state_cookie_domain?: string
  ux_mode?: 'popup' | 'redirect'
  login_uri?: string
  native_callback?: (response: { id: string; password: string }) => void
  intermediate_iframe_close_callback?: () => void
  allowed_parent_origin?: string | string[]
}

interface CredentialResponse {
  credential: string // JWT token
  select_by?: string
  clientId?: string
}

interface PromptNotification {
  isDisplayMoment: () => boolean
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  getNotDisplayedReason: () => string
  isSkippedMoment: () => boolean
  getSkippedReason: () => string
  isDismissedMoment: () => boolean
  getDismissedReason: () => string
}

interface UseGoogleOneTapOptions {
  /** 是否在用户已登录时禁用 One Tap */
  disableIfLoggedIn?: boolean
  /** 延迟显示时间(毫秒),默认1000ms */
  delay?: number
  /** 提示上下文 */
  context?: 'signin' | 'signup' | 'use'
  /** 是否在点击外部时取消 */
  cancelOnTapOutside?: boolean
  /** 成功回调 */
  onSuccess?: () => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

/**
 * Google One Tap 登录 Hook
 * 自动检测用户是否已登录Google账户并显示One Tap提示
 */
export function useGoogleOneTap(options: UseGoogleOneTapOptions = {}) {
  const {
    disableIfLoggedIn = true,
    delay = 1000,
    context = 'signin',
    cancelOnTapOutside = false,
    onSuccess,
    onError,
  } = options

  const { user, signIn } = useAuth()
  const { t } = useTranslation()
  const isInitializedRef = useRef(false)
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 处理Google凭证响应
   */
  const handleCredentialResponse = useCallback(
    async (response: CredentialResponse) => {
      try {
        console.log('[Google One Tap] 收到凭证响应')

        // 解码JWT获取用户信息(仅用于日志,不用于认证)
        const payload = JSON.parse(atob(response.credential.split('.')[1]))
        console.log('[Google One Tap] 用户信息:', {
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        })

        // 使用Supabase的signInWithIdToken方法
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        })

        if (error) {
          console.error('[Google One Tap] Supabase登录失败:', error)
          toast.error(t('auth.googleSignInError') + ': ' + error.message)
          onError?.(error)
          return
        }

        if (data?.user) {
          console.log('[Google One Tap] 登录成功:', data.user.email)
          toast.success(t('auth.signInSuccess'))
          onSuccess?.()

          // 检查是否有待处理的邀请码
          const pendingInviteCode = localStorage.getItem('pending_invite_code')
          if (pendingInviteCode) {
            console.log('[Google One Tap] 检测到待处理的邀请码:', pendingInviteCode)
            // 这里可以调用邀请处理逻辑
            // referralService.acceptInvitation(...)
            localStorage.removeItem('pending_invite_code')
          }
        }
      } catch (err) {
        console.error('[Google One Tap] 凭证处理错误:', err)
        const error = err as Error
        toast.error(t('auth.googleSignInError') + ': ' + error.message)
        onError?.(error)
      }
    },
    [t, onSuccess, onError]
  )

  /**
   * 初始化Google One Tap
   */
  const initializeOneTap = useCallback(() => {
    // 检查是否已初始化
    if (isInitializedRef.current) {
      console.log('[Google One Tap] 已初始化,跳过')
      return
    }

    // 检查Google SDK是否加载
    if (!window.google?.accounts?.id) {
      console.warn('[Google One Tap] Google SDK未加载,将在1秒后重试')
      setTimeout(initializeOneTap, 1000)
      return
    }

    // 检查是否有Client ID
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      console.error('[Google One Tap] 缺少VITE_GOOGLE_CLIENT_ID环境变量')
      return
    }

    // 检查用户是否已登录
    if (disableIfLoggedIn && user) {
      console.log('[Google One Tap] 用户已登录,禁用One Tap')
      return
    }

    try {
      console.log('[Google One Tap] 开始初始化...')

      // 初始化Google One Tap
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: true, // 如果只有一个Google账户,自动选择
        cancel_on_tap_outside: cancelOnTapOutside,
        context: context,
        itp_support: true, // 支持ITP浏览器
      })

      isInitializedRef.current = true
      console.log('[Google One Tap] 初始化成功')

      // 延迟显示提示
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current)
      }

      delayTimerRef.current = setTimeout(() => {
        if (window.google?.accounts?.id) {
          console.log('[Google One Tap] 显示提示...')
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
              const reason = notification.getNotDisplayedReason()
              console.log('[Google One Tap] 未显示原因:', reason)

              // 常见原因处理
              switch (reason) {
                case 'browser_not_supported':
                  console.warn('[Google One Tap] 浏览器不支持')
                  break
                case 'invalid_client':
                  console.error('[Google One Tap] 无效的Client ID')
                  break
                case 'missing_client_id':
                  console.error('[Google One Tap] 缺少Client ID')
                  break
                case 'opt_out_or_no_session':
                  console.log('[Google One Tap] 用户选择退出或无Google会话')
                  break
                case 'secure_http_required':
                  console.warn('[Google One Tap] 需要HTTPS')
                  break
                case 'suppressed_by_user':
                  console.log('[Google One Tap] 被用户抑制')
                  break
                case 'unregistered_origin':
                  console.error('[Google One Tap] 未注册的来源')
                  break
                case 'unknown_reason':
                  console.log('[Google One Tap] 未知原因')
                  break
              }
            } else if (notification.isDisplayed()) {
              console.log('[Google One Tap] 提示已显示')
            } else if (notification.isSkippedMoment()) {
              console.log('[Google One Tap] 跳过显示:', notification.getSkippedReason())
            } else if (notification.isDismissedMoment()) {
              console.log('[Google One Tap] 用户关闭提示:', notification.getDismissedReason())
            }
          })
        }
      }, delay)
    } catch (err) {
      console.error('[Google One Tap] 初始化错误:', err)
      onError?.(err as Error)
    }
  }, [user, disableIfLoggedIn, context, cancelOnTapOutside, delay, handleCredentialResponse, onError])

  /**
   * 取消One Tap提示
   */
  const cancel = useCallback(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.cancel()
      console.log('[Google One Tap] 已取消提示')
    }
  }, [])

  /**
   * 禁用自动选择
   */
  const disableAutoSelect = useCallback(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
      console.log('[Google One Tap] 已禁用自动选择')
    }
  }, [])

  // 初始化效果
  useEffect(() => {
    // 等待Google SDK加载
    const checkGoogleSDK = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogleSDK)
        initializeOneTap()
      }
    }, 100)

    // 超时后停止检查
    const timeout = setTimeout(() => {
      clearInterval(checkGoogleSDK)
      console.warn('[Google One Tap] Google SDK加载超时')
    }, 10000)

    return () => {
      clearInterval(checkGoogleSDK)
      clearTimeout(timeout)

      // 清理延迟定时器
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current)
      }
    }
  }, [initializeOneTap])

  // 用户登录状态变化时重置
  useEffect(() => {
    if (user && disableIfLoggedIn) {
      cancel()
      isInitializedRef.current = false
    }
  }, [user, disableIfLoggedIn, cancel])

  return {
    cancel,
    disableAutoSelect,
    isInitialized: isInitializedRef.current,
  }
}
