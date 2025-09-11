import React, { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthState } from '@/hooks/useAuthState'

interface AdminRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'super_admin'
}

interface PermissionState {
  isAuthorized: boolean | null // null = checking, true = authorized, false = denied
  userRole: string | null
  error: string | null
}

const AdminRoute: React.FC<AdminRouteProps> = ({ 
  children, 
  requiredRole = 'admin' 
}) => {
  const { user, loading: authLoading } = useAuthState()
  const [permissionState, setPermissionState] = useState<PermissionState>({
    isAuthorized: null,
    userRole: null,
    error: null
  })
  const [retryCount, setRetryCount] = useState(0)

  const checkAdminPermission = useCallback(async (attempt = 1) => {
    console.log(`[AdminRoute] Permission check attempt ${attempt}`)
    
    try {
      // 确保有用户session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !session.user) {
        console.log('[AdminRoute] No session found')
        setPermissionState({
          isAuthorized: false,
          userRole: null,
          error: 'No session'
        })
        return
      }

      console.log('[AdminRoute] Session found for user:', session.user.email)

      // 获取用户权限信息
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_banned, full_name, avatar_url')
        .eq('id', session.user.id)
        .single()

      if (error) {
        console.error('[AdminRoute] Profile fetch error:', error)
        
        // 如果是网络错误且重试次数少于3次，则重试
        if (attempt < 3 && (error.message?.includes('network') || error.code === 'PGRST000')) {
          console.log(`[AdminRoute] Retrying permission check (${attempt + 1}/3)`)
          setTimeout(() => checkAdminPermission(attempt + 1), 1000 * attempt)
          return
        }
        
        setPermissionState({
          isAuthorized: false,
          userRole: null,
          error: error.message
        })
        return
      }

      console.log('[AdminRoute] Profile found:', { role: profile?.role, is_banned: profile?.is_banned })

      // 检查权限
      if (!profile || profile.is_banned) {
        setPermissionState({
          isAuthorized: false,
          userRole: profile?.role || null,
          error: profile?.is_banned ? 'Account is banned' : 'Profile not found'
        })
        return
      }

      const hasPermission = requiredRole === 'super_admin' 
        ? profile.role === 'super_admin'
        : ['admin', 'super_admin'].includes(profile.role)

      if (!hasPermission) {
        setPermissionState({
          isAuthorized: false,
          userRole: profile.role,
          error: 'Insufficient permissions'
        })
        return
      }

      // 权限验证通过，存储管理员信息到localStorage
      const adminUser = {
        id: session.user.id,
        email: session.user.email || '',
        role: profile.role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      }
      localStorage.setItem('admin_user', JSON.stringify(adminUser))

      setPermissionState({
        isAuthorized: true,
        userRole: profile.role,
        error: null
      })

      console.log('[AdminRoute] Permission granted:', profile.role)

    } catch (error) {
      console.error('[AdminRoute] Permission check error:', error)
      setPermissionState({
        isAuthorized: false,
        userRole: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [requiredRole])

  // 监听用户状态变化
  useEffect(() => {
    if (!authLoading && user) {
      // 延迟一点确保所有状态都已稳定
      const timer = setTimeout(() => {
        checkAdminPermission()
        setRetryCount(prev => prev + 1)
      }, 300)
      
      return () => clearTimeout(timer)
    } else if (!authLoading && !user) {
      // 没有用户，直接设置为未授权
      setPermissionState({
        isAuthorized: false,
        userRole: null,
        error: 'Not authenticated'
      })
    }
  }, [user, authLoading, checkAdminPermission])

  // 如果还在身份验证加载中，或者权限状态未确定，显示加载指示器
  if (authLoading || permissionState.isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">验证管理员权限中...</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-2">重试第 {retryCount} 次</p>
          )}
        </div>
      </div>
    )
  }

  // 如果用户未登录，重定向到登录页
  if (!user) {
    return <Navigate to="/signin?redirect=/admin" replace />
  }

  // 如果权限验证失败，显示无权限页面
  if (permissionState.isAuthorized === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              访问被拒绝
            </h2>
            <p className="text-gray-600 mb-2">
              您没有权限访问管理员后台。
            </p>
            {permissionState.error && (
              <p className="text-sm text-red-600 mb-4">
                错误详情: {permissionState.error}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-6">
              当前角色: {permissionState.userRole || '未知'}
              <br />
              需要角色: {requiredRole === 'super_admin' ? '超级管理员' : '管理员'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => checkAdminPermission()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                重新检查权限
              </button>
              <button
                onClick={() => window.history.back()}
                className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
              >
                返回上一页
              </button>
              <button
                onClick={() => {
                  supabase.auth.signOut()
                  window.location.href = '/signin'
                }}
                className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
              >
                切换账户
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 如果权限验证通过，渲染子组件
  if (permissionState.isAuthorized === true) {
    return <>{children}</>
  }

  // 其他情况显示加载状态
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">正在验证权限...</p>
      </div>
    </div>
  )
}

export default AdminRoute