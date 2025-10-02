import React, { useEffect } from 'react'
import { useGoogleOneTap } from '@/hooks/useGoogleOneTap'
import { useAuth } from '@/contexts/AuthContext'
import { useLocation } from 'react-router-dom'
import { useAnalytics } from '@/hooks/useAnalytics'

interface GoogleOneTapProps {
  /** 延迟显示时间(毫秒),默认1500ms */
  delay?: number
  /** 提示上下文 */
  context?: 'signin' | 'signup' | 'use'
  /** 是否在点击外部时取消 */
  cancelOnTapOutside?: boolean
  /** 是否在认证页面禁用 */
  disableOnAuthPages?: boolean
}

/**
 * Google One Tap 登录组件
 *
 * 自动检测用户是否已登录Google账户并显示One Tap提示
 *
 * 使用示例:
 * ```tsx
 * <GoogleOneTap delay={2000} context="signin" />
 * ```
 */
export default function GoogleOneTap({
  delay = 1500,
  context = 'signin',
  cancelOnTapOutside = false,
  disableOnAuthPages = true,
}: GoogleOneTapProps) {
  const { user } = useAuth()
  const location = useLocation()
  const { trackLogin } = useAnalytics()

  // 检查是否在认证页面
  const isOnAuthPage = React.useMemo(() => {
    const authPaths = ['/signin', '/signup', '/auth/callback', '/forgot-password', '/reset-password']
    return authPaths.some(path => location.pathname.includes(path))
  }, [location.pathname])

  // 是否应该禁用One Tap
  const shouldDisable = (disableOnAuthPages && isOnAuthPage) || !!user

  // 使用One Tap Hook
  const { isInitialized } = useGoogleOneTap({
    disableIfLoggedIn: true,
    delay: shouldDisable ? 0 : delay,
    context,
    cancelOnTapOutside,
    onSuccess: () => {
      // 跟踪Google One Tap登录成功
      trackLogin('google_one_tap')
      console.log('[GoogleOneTap] 用户通过One Tap成功登录')
    },
    onError: (error) => {
      console.error('[GoogleOneTap] One Tap登录失败:', error)
    },
  })

  // 日志输出(仅开发环境)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[GoogleOneTap] 组件状态:', {
        isOnAuthPage,
        shouldDisable,
        isInitialized,
        userLoggedIn: !!user,
        currentPath: location.pathname,
      })
    }
  }, [isOnAuthPage, shouldDisable, isInitialized, user, location.pathname])

  // One Tap是一个隐形组件,不渲染任何UI
  // Google SDK会自动在页面上显示提示框
  return null
}
