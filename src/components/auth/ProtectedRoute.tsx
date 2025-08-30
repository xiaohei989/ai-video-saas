import React, { useEffect } from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children?: React.ReactNode
  requireAuth?: boolean
  requireProfile?: boolean
  requireSubscription?: boolean
  fallbackPath?: string
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  requireProfile = false,
  requireSubscription = false,
  fallbackPath = '/signin',
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  
  // 🚀 关键修复：添加认证完成的缓冲时间，避免误判
  const [authBuffer, setAuthBuffer] = React.useState(true)
  const [forceRedirect, setForceRedirect] = React.useState(false)
  
  React.useEffect(() => {
    // 给认证流程200ms的缓冲时间来完成user状态设置
    const bufferId = setTimeout(() => {
      setAuthBuffer(false)
      console.log('[PROTECTED ROUTE] 📋 认证缓冲期结束，开始最终检查')
    }, 200)
    
    // 添加强制重定向超时机制（3秒后强制重定向）
    const forceRedirectId = setTimeout(() => {
      if (!user && requireAuth) {
        console.log('[PROTECTED ROUTE] ⏰ 超时强制重定向到登录页面')
        setForceRedirect(true)
      }
    }, 3000)
    
    return () => {
      clearTimeout(bufferId)
      clearTimeout(forceRedirectId)
    }
  }, [user, requireAuth])

  // 🚀 关键优化：更智能的loading显示条件，进一步减少loading闪烁
  const shouldShowLoading = React.useMemo(() => {
    // 如果不是loading状态，直接不显示
    if (!loading) return false
    
    // 检查是否是真正需要等待的情况
    try {
      const hasLocalToken = localStorage.getItem('sb-hvkzwrnvxsleeonqqrzq-auth-token')
      const hasLocalUser = localStorage.getItem('supabase.auth.token')
      
      // 如果有任何本地认证信息，说明可能很快就会完成，不显示loading
      if (hasLocalToken || hasLocalUser) {
        console.log('[PROTECTED ROUTE] 🚀 检测到本地认证缓存，跳过loading显示')
        return false
      }
    } catch (error) {
      console.warn('[PROTECTED ROUTE] 本地缓存检查失败:', error)
    }
    
    // 只有真正没有任何缓存的情况才显示loading
    console.log('[PROTECTED ROUTE] 💫 显示loading界面（首次访问用户）')
    return true
  }, [loading])

  // 🚀 性能优化：只在真正需要时显示loading界面
  if (shouldShowLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-6">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-12 w-12 mx-auto mb-4"
            />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
              AI Video SaaS
            </h2>
          </div>
          
          {/* Loading spinner */}
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              正在初始化应用...
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 🚀 关键修复：智能认证检查，避免误判已登录用户
  const shouldRedirectToLogin = React.useMemo(() => {
    if (!requireAuth) return false
    
    // 如果有user，肯定不需要重定向
    if (user) return false
    
    // 强制重定向标志优先级最高
    if (forceRedirect) {
      console.log('[PROTECTED ROUTE] 🚪 强制重定向标志已设置')
      return true
    }
    
    // 如果正在loading，不要重定向，给认证流程时间
    if (loading) return false
    
    // 🚀 关键修复：如果还在认证缓冲期，不要重定向
    if (authBuffer) {
      console.log('[PROTECTED ROUTE] ⏰ 认证缓冲期中，暂不检查重定向')
      return false
    }
    
    // 如果没有user但也不在loading，检查是否有本地缓存
    // 如果有缓存，可能认证流程还在进行中，给它一点时间
    try {
      const hasLocalAuth = localStorage.getItem('sb-hvkzwrnvxsleeonqqrzq-auth-token') ||
                           localStorage.getItem('__auth_last_success')
      
      if (hasLocalAuth) {
        console.log('[PROTECTED ROUTE] 🔄 检测到本地认证缓存但user未设置，继续等待...')
        // 有缓存但user未设置，再给一点时间（但不会超过3秒强制超时）
        return false
      }
    } catch (error) {
      console.warn('[PROTECTED ROUTE] 缓存检查失败:', error)
    }
    
    // 没有user，没有loading，没有缓存，且缓冲期已结束，才重定向
    console.log('[PROTECTED ROUTE] 🚪 确认需要重定向到登录页')
    return true
  }, [requireAuth, user, loading, authBuffer, forceRedirect])
  
  // 检查认证要求
  if (shouldRedirectToLogin) {
    // 保存用户尝试访问的路径，登录后重定向回来
    return <Navigate to={fallbackPath} state={{ from: location }} replace />
  }

  // 检查用户资料要求
  if (requireProfile && (!profile || !profile.username)) {
    return <Navigate to="/profile/setup" state={{ from: location }} replace />
  }

  // 检查订阅要求
  if (requireSubscription) {
    // TODO: 实现订阅检查逻辑
    // const hasActiveSubscription = profile?.subscription_status === 'active'
    // if (!hasActiveSubscription) {
    //   return <Navigate to="/pricing" state={{ from: location }} replace />
    // }
  }

  // 如果没有传入 children，使用 Outlet（用于嵌套路由）
  return children ? <>{children}</> : <Outlet />
}

// 便捷组件：需要认证的路由
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireAuth>{children}</ProtectedRoute>
}

// 便捷组件：需要完整资料的路由
export function RequireProfile({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth requireProfile>
      {children}
    </ProtectedRoute>
  )
}

// 便捷组件：需要订阅的路由
export function RequireSubscription({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth requireProfile requireSubscription>
      {children}
    </ProtectedRoute>
  )
}

// 便捷组件：游客路由（已登录用户不能访问）
export function GuestRoute({
  children,
  redirectTo = '/templates',
}: {
  children: React.ReactNode
  redirectTo?: string
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-6">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-12 w-12 mx-auto mb-4"
            />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
              AI Video SaaS
            </h2>
          </div>
          
          {/* Loading spinner */}
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              正在验证身份...
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 如果已登录，重定向到指定页面
  if (user) {
    const from = location.state?.from?.pathname || redirectTo
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}