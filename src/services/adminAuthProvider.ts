import { AuthProvider } from 'react-admin'
import { supabase } from '@/lib/supabase'

export const adminAuthProvider: AuthProvider = {
  // 登录
  login: async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(error.message)
      }

      // 验证用户是否有管理员权限
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_banned, full_name, avatar_url')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        throw new Error('Failed to fetch user profile')
      }

      if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        await supabase.auth.signOut()
        throw new Error('Insufficient permissions. Admin access required.')
      }

      if (profile.is_banned) {
        await supabase.auth.signOut()
        throw new Error('Account is banned')
      }

      // 存储用户信息到localStorage
      localStorage.setItem('admin_user', JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        role: profile.role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      }))

      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    }
  },

  // 登出
  logout: async () => {
    try {
      await supabase.auth.signOut()
      localStorage.removeItem('admin_user')
      return Promise.resolve()
    } catch (error) {
      return Promise.reject(error)
    }
  },

  // 检查认证状态
  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        localStorage.removeItem('admin_user')
        throw new Error('Not authenticated')
      }

      // 验证管理员权限
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, is_banned, full_name, avatar_url')
        .eq('id', session.user.id)
        .single()

      if (error || !profile || !['admin', 'super_admin'].includes(profile.role)) {
        localStorage.removeItem('admin_user')
        throw new Error('Insufficient permissions')
      }

      if (profile.is_banned) {
        localStorage.removeItem('admin_user')
        throw new Error('Account is banned')
      }

      // 确保localStorage中有管理员信息
      const adminUser = {
        id: session.user.id,
        email: session.user.email || '',
        role: profile.role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      }
      
      localStorage.setItem('admin_user', JSON.stringify(adminUser))
      console.log('Admin user stored:', adminUser)

      return Promise.resolve()
    } catch (error) {
      console.error('CheckAuth error:', error)
      return Promise.reject(error)
    }
  },

  // 检查权限
  checkError: async (error) => {
    const status = error.status
    if (status === 401 || status === 403) {
      localStorage.removeItem('admin_user')
      return Promise.reject()
    }
    return Promise.resolve()
  },

  // 获取用户身份
  getIdentity: async () => {
    try {
      let adminUser = localStorage.getItem('admin_user')
      
      // 如果localStorage中没有，尝试从当前session获取
      if (!adminUser) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name, avatar_url')
            .eq('id', session.user.id)
            .single()

          if (profile && ['admin', 'super_admin'].includes(profile.role)) {
            const userData = {
              id: session.user.id,
              email: session.user.email || '',
              role: profile.role,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url
            }
            localStorage.setItem('admin_user', JSON.stringify(userData))
            adminUser = JSON.stringify(userData)
          }
        }
      }

      if (!adminUser) {
        throw new Error('No admin user found')
      }

      const user = JSON.parse(adminUser)
      return Promise.resolve({
        id: user.id,
        fullName: user.full_name || user.email,
        avatar: user.avatar_url,
        email: user.email,
        role: user.role
      })
    } catch (error) {
      console.error('GetIdentity error:', error)
      return Promise.reject(error)
    }
  },

  // 获取权限
  getPermissions: async () => {
    try {
      let adminUser = localStorage.getItem('admin_user')
      
      // 如果localStorage中没有，尝试从当前session获取
      if (!adminUser) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          if (profile && ['admin', 'super_admin'].includes(profile.role)) {
            return Promise.resolve(profile.role)
          }
        }
        throw new Error('No admin user found')
      }

      const user = JSON.parse(adminUser)
      return Promise.resolve(user.role)
    } catch (error) {
      console.error('GetPermissions error:', error)
      return Promise.reject(error)
    }
  },
}