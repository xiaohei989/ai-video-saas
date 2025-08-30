import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, ensureValidSession } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { referralService } from '@/services/referralService'

// 认证上下文类型定义
interface AuthContextType {
  // 状态
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: AuthError | null

  // 认证方法
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  
  // 用户资料方法
  updateProfile: (updates: ProfileUpdate) => Promise<void>
  refreshProfile: () => Promise<void>
}

// 用户资料类型
interface Profile {
  id: string
  email: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  website: string | null
  social_links: Record<string, any>
  language: string
  credits: number
  total_credits_earned: number
  total_credits_spent: number
  referral_code: string | null
  follower_count: number
  following_count: number
  template_count: number
  is_verified: boolean
  created_at: string
  updated_at: string
}

// 注册元数据
interface SignUpMetadata {
  username?: string
  full_name?: string
  referral_code?: string
  device_fingerprint?: any
  ip_address?: string
}

// 资料更新类型
interface ProfileUpdate {
  username?: string
  full_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  social_links?: Record<string, any>
  language?: string
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// 认证提供者组件
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  // 🚀 关键修复：同步初始化user和loading状态，避免状态不一致
  const getInitialAuthState = () => {
    try {
      // 多重缓存检查，确保准确性
      const supabaseAuthToken = localStorage.getItem('sb-hvkzwrnvxsleeonqqrzq-auth-token')
      const supabaseSession = localStorage.getItem('supabase.auth.token') 
      const lastSuccessTime = localStorage.getItem('__auth_last_success')
      
      // 检查最近认证成功时间（24小时内认为有效）
      const recentlyAuthenticated = lastSuccessTime && 
        (Date.now() - parseInt(lastSuccessTime)) < 24 * 60 * 60 * 1000
      
      const hasAnyValidCache = (supabaseAuthToken && supabaseAuthToken !== 'null') ||
                               (supabaseSession && supabaseSession !== 'null') ||
                               recentlyAuthenticated
      
      console.log('[AUTH] 🔍 智能预检查结果:', {
        hasAuthToken: !!supabaseAuthToken,
        hasSession: !!supabaseSession, 
        recentlyAuth: recentlyAuthenticated,
        willSkipLoading: hasAnyValidCache,
        decision: hasAnyValidCache ? '直接显示内容' : '显示loading'
      })
      
      return {
        shouldSkipLoading: hasAnyValidCache,
        hasValidCache: hasAnyValidCache
      }
    } catch (error) {
      console.warn('[AUTH] 智能预检查失败，保守显示loading:', error)
      return {
        shouldSkipLoading: false,
        hasValidCache: false
      }
    }
  }
  
  const initialAuthState = getInitialAuthState()
  
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null) 
  const [profile, setProfile] = useState<Profile | null>(null)
  // 🚀 关键优化：智能初始loading状态，完全避免不必要的loading显示
  const [loading, setLoading] = useState(!initialAuthState.shouldSkipLoading)
  const [error, setError] = useState<AuthError | null>(null)
  
  // 用于跟踪是否是初始加载
  const isInitialLoadRef = React.useRef(true)
  
  // 🚀 性能优化：使用ref跟踪loading状态，确保原子性
  const loadingRef = React.useRef(loading)
  
  // 每次loading状态变化时同步更新ref
  React.useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  // 创建基本profile对象作为后备
  const createBasicProfile = (userId?: string, userEmail?: string) => ({
    id: userId || user?.id || '',
    email: userEmail || session?.user?.email || user?.email || '',
    username: null,
    full_name: null,
    avatar_url: null,
    bio: null,
    website: null,
    social_links: {},
    language: 'en',
    credits: 100,
    total_credits_earned: 100,
    total_credits_spent: 0,
    referral_code: null,
    follower_count: 0,
    following_count: 0,
    template_count: 0,
    is_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  // 获取用户资料
  const fetchProfile = async (userId: string, userEmail?: string) => {
    try {
      
      // 创建基本profile对象作为后备（使用外部函数）
      const basicProfileData = createBasicProfile(userId, userEmail || session?.user?.email || '')
      
      // 创建带超时的查询
      const profileQuery = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      // 2秒超时Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
      })
      
      try {
        // 使用Promise.race实现超时
        const { data, error } = await Promise.race([
          profileQuery,
          timeoutPromise
        ]) as any
        
        if (error) {
          console.error('Error fetching profile:', error)
          
          // 如果是表不存在的错误
          if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            console.warn('Profiles table not found, using basic profile')
            const basicProfile = createBasicProfile()
            setProfile(basicProfile as Profile)
            return basicProfile
          }
          
          // 其他错误，返回null但不崩溃
          setProfile(null)
          return null
        }
        
        setProfile(data)
        return data
      } catch (timeoutError) {
        console.warn('Profile fetch timed out, using basic profile')
        // 超时了，使用基本profile
        const basicProfile = createBasicProfile(userId, userEmail)
        setProfile(basicProfile as Profile)
        return basicProfile
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err)
      // 确保不会因为profile获取失败而导致应用崩溃
      const basicProfile = createBasicProfile(userId, userEmail)
      setProfile(basicProfile as Profile)
      return basicProfile
    }
  }

  // Token检查定时器
  const tokenCheckIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
  
  // 启动Token检查定时器
  const startTokenCheck = () => {
    // 清除现有的定时器
    if (tokenCheckIntervalRef.current) {
      clearInterval(tokenCheckIntervalRef.current)
    }
    
    // 每30秒检查一次Token状态
    tokenCheckIntervalRef.current = setInterval(async () => {
      try {
        if (session) {
          console.log('定期检查Token状态...')
          await ensureValidSession()
        }
      } catch (error) {
        console.error('定期Token检查失败:', error)
        // Token刷新失败，可能需要重新登录
        if (error.message?.includes('refresh_token_not_found') || 
            error.message?.includes('invalid_grant')) {
          console.log('Token无法刷新，清除会话状态')
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      }
    }, 30000) // 30秒检查一次
  }
  
  // 停止Token检查定时器
  const stopTokenCheck = () => {
    if (tokenCheckIntervalRef.current) {
      clearInterval(tokenCheckIntervalRef.current)
      tokenCheckIntervalRef.current = null
    }
  }

  // 初始化认证状态
  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null

    const initializeAuth = async () => {
      try {
        console.log('[AUTH] 🚀 开始认证初始化...')
        const authStart = performance.now()
        
        // 🚀 性能优化：设置合理的网络超时，平衡速度和稳定性
        const sessionPromise = Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Session timeout')), 2500) // 2.5秒超时，给Supabase充足时间
          )
        ])
        
        const { data: { session }, error } = await sessionPromise as any
        const authTime = performance.now() - authStart
        
        console.log(`[AUTH] ✅ 会话获取完成: ${Math.round(authTime)}ms`)
        
        if (error) {
          console.error('AuthContext: Error getting session:', error)
        }
        
        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          
          // 🚀 关键修复：立即设置loading为false并清除超时计时器
          setLoading(false)
          loadingRef.current = false
          
          // 🚀 增强缓存：确保session状态被正确缓存到localStorage
          if (session) {
            try {
              // 更新本地缓存状态，为下次访问做准备
              localStorage.setItem('__auth_last_success', Date.now().toString())
              console.log('[AUTH] 💾 已更新认证成功缓存')
            } catch (error) {
              console.warn('[AUTH] 缓存更新失败:', error)
            }
          }
          
          // 立即清除超时计时器，避免后续误报
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
            console.log(`[AUTH] 🔒 已清除超时计时器`)
          }
          
          console.log(`[AUTH] ⚡ Loading状态已清除: ${Math.round(performance.now() - authStart)}ms`)
          
          // 在后台异步获取profile，不阻塞应用
          if (session?.user) {
            fetchProfile(session.user.id, session.user.email).then(() => {
              console.log('[AUTH] 📋 用户profile获取完成')
            }).catch(err => {
              console.error('AuthContext: Profile fetch failed:', err)
            })
          }
        }
      } catch (err) {
        const authTime = performance.now() - authStart
        const errorMessage = (err as Error)?.message || 'Unknown error'
        const isTimeoutError = errorMessage.includes('Session timeout')
        const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch')
        
        if (isTimeoutError) {
          console.warn(`[AUTH] ⏰ 网络请求超时 (${Math.round(authTime)}ms)，这可能是网络延迟导致的`)
          console.warn('[AUTH] 💡 建议：检查网络连接或考虑增加超时时间')
        } else {
          console.error('AuthContext: Initialization error:', err)
          console.log(`[AUTH] ❌ 认证初始化失败: ${Math.round(authTime)}ms`)
        }
        
        if (mounted) {
          setLoading(false)
          loadingRef.current = false
          
          // 也要在错误情况下清除超时计时器
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
            console.log(`[AUTH] 🔒 错误处理：已清除超时计时器`)
          }
          
          console.log('[AUTH] 🔄 Loading状态已清除（错误处理）')
          
          // 🚀 错误恢复：即使初始化失败，也尝试直接显示页面
          // 用户可能处于离线状态或网络不佳，但应该能看到缓存的内容
          console.log('[AUTH] 🔄 尝试优雅降级，允许访问页面')
        }
      }
    }

    // 🚀 改进超时机制：只有在真正需要时才设置超时
    const startTimeout = () => {
      // 避免重复设置超时
      if (timeoutId) return
      
      timeoutId = setTimeout(() => {
        // 使用ref进行原子性检查，避免状态不同步
        const currentLoading = loadingRef.current
        const currentUser = user
        const currentSession = session
        
        console.log(`[AUTH] 🕐 超时检查详情:`, {
          mounted,
          loading: currentLoading,
          hasUser: !!currentUser,
          hasSession: !!currentSession,
          timeoutId: !!timeoutId,
          currentPath: window.location.pathname,
          elapsed: '3000ms'
        })
        
        if (mounted && currentLoading) {
          console.warn('[AUTH] ⚠️ 应用层超时触发 - 认证流程超过3秒')
          console.warn('[AUTH] 🔍 这通常表示网络连接问题或Supabase服务异常')
          console.warn('[AUTH] 💡 为保证用户体验，将强制显示页面内容')
          setLoading(false)
          loadingRef.current = false
        } else {
          console.log('[AUTH] ✅ 超时检查通过 - 认证已在3秒内正常完成')
        }
        
        // 清理计时器引用
        timeoutId = null
      }, 3000) // 3秒应用层超时，给网络层(2.5s)和处理时间足够缓冲
    }
    
    // 开始初始化，并启动超时保护
    startTimeout()
    initializeAuth()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        
        if (!mounted) return
        
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // 非阻塞方式获取profile
          fetchProfile(session.user.id, session.user.email).catch(err => {
            console.error('Auth state change: Profile fetch failed:', err)
          })
        } else {
          setProfile(null)
        }

        // 处理认证事件
        console.log(`[AUTH] Authentication event: ${event}`, { 
          isInitialLoad: isInitialLoadRef.current,
          currentPath: window.location.pathname 
        })
        
        switch (event) {
          case 'INITIAL_SESSION':
            // 初始会话加载，不进行导航，保持用户在当前页面
            console.log('[AUTH] Initial session loaded, setting isInitialLoad to false', {
              currentPath: window.location.pathname,
              action: 'staying_on_current_page'
            })
            isInitialLoadRef.current = false
            
            // 🚀 关键修复：初始会话加载完成时，确保清除loading状态和超时计时器
            if (mounted) {
              setLoading(false)
              loadingRef.current = false
              
              if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
                console.log('[AUTH] 🔒 INITIAL_SESSION: 已清除超时计时器')
              }
            }
            break
          case 'SIGNED_IN':
            // 启动Token检查定时器
            startTokenCheck()
            
            // 检查是否是真正的用户登录操作
            // 定义公开页面，这些页面不应该触发自动导航
            const publicPages = ['/pricing', '/templates', '/', '/privacy', '/terms', '/cookies']
            const authPages = ['/signin', '/signup', '/forgot-password', '/reset-password']
            const protectedPages = ['/videos', '/profile', '/create']
            
            const currentPath = window.location.pathname
            const isOnPublicPage = publicPages.some(path => currentPath === path || currentPath.startsWith(path))
            const isOnAuthPage = authPages.some(path => currentPath.startsWith(path))
            const isOnProtectedPage = protectedPages.some(path => currentPath.startsWith(path))
            
            // 只有在以下条件下才进行导航：
            // 1. 非初始加载（真正的用户操作）
            // 2. 当前在认证页面（登录/注册页面）
            // 3. 不在公开页面和受保护页面上
            const isUserInitiatedSignIn = !isInitialLoadRef.current && 
              isOnAuthPage && !isOnProtectedPage
            
            console.log('[AUTH] SIGNED_IN event detected', {
              isInitialLoad: isInitialLoadRef.current,
              currentPath: currentPath,
              isOnPublicPage,
              isOnAuthPage,
              isOnProtectedPage,
              willNavigate: isUserInitiatedSignIn
            })
            
            if (isUserInitiatedSignIn) {
              console.log('[AUTH] User-initiated sign in from auth page, navigating to templates')
              navigate('/templates')
            } else {
              console.log('[AUTH] Token refresh, session restoration, or already on target page - staying put')
            }
            
            // 标记初始加载已完成
            isInitialLoadRef.current = false
            break
          case 'TOKEN_REFRESHED':
            // 令牌刷新不应该导致页面跳转，仅记录事件和当前路径
            console.log('[AUTH] Token refreshed, no navigation needed', {
              isInitialLoad: isInitialLoadRef.current,
              currentPath: window.location.pathname,
              action: 'staying_on_current_page'
            })
            
            // 🚀 修复：确保token刷新时也清除loading状态
            if (mounted && loadingRef.current) {
              setLoading(false)
              loadingRef.current = false
              
              if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
                console.log('[AUTH] 🔒 TOKEN_REFRESHED: 已清除超时计时器')
              }
            }
            break
          case 'SIGNED_OUT':
            // 停止Token检查定时器
            stopTokenCheck()
            console.log('[AUTH] User signed out')
            isInitialLoadRef.current = false
            navigate('/')
            break
          case 'PASSWORD_RECOVERY':
            console.log('[AUTH] Password recovery, navigating to reset page')
            navigate('/reset-password')
            break
          case 'USER_UPDATED':
            console.log('[AUTH] User updated, refreshing profile')
            if (session?.user) {
              // 非阻塞方式获取profile
              fetchProfile(session.user.id, session.user.email).catch(err => {
                console.error('User updated: Profile fetch failed:', err)
              })
            }
            break
        }
      }
    )

    return () => {
      mounted = false
      
      // 🚀 清理超时计时器，防止内存泄漏
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
        console.log('[AUTH] 🧹 组件卸载：已清理超时计时器')
      }
      
      stopTokenCheck() // 清理Token检查定时器
      subscription.unsubscribe()
    }
  }, [navigate])

  // 注册
  const signUp = async (email: string, password: string, metadata?: SignUpMetadata) => {
    try {
      setError(null)
      setLoading(true)

      // 预先安全检查（如果提供了安全信息）
      if (metadata?.ip_address) {
        // 检查IP是否被阻止
        const { data: ipBlockCheck } = await supabase.rpc('check_ip_auth_block', {
          p_ip_address: metadata.ip_address,
          p_attempt_type: 'signup'
        })

        if (ipBlockCheck && ipBlockCheck.length > 0 && ipBlockCheck[0].is_blocked) {
          throw new Error(ipBlockCheck[0].reason)
        }
      }

      // 注册用户
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            ...metadata,
            // 不在auth metadata中包含敏感的设备信息
            device_fingerprint: undefined,
            ip_address: undefined
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      // 如果需要邮箱验证
      if (data?.user && !data.session) {
        alert('请检查您的邮箱以验证账户')
      }

      // 如果有引荐码，使用新的安全版本处理引荐关系
      if (metadata?.referral_code && data?.user) {
        try {
          // 使用增强版邀请接受函数
          const { success, error: inviteError } = await referralService.acceptInvitation(
            metadata.referral_code,
            data.user.id,
            data.user.email || email,
            metadata.device_fingerprint,
            metadata.ip_address
          )
          
          if (!success && inviteError) {
            console.warn('Referral processing failed:', inviteError)
            // 不阻止注册，但记录警告
          }
        } catch (referralError) {
          console.warn('Referral processing error:', referralError)
          // 不阻止注册，但记录错误
        }
      }
    } catch (err) {
      // 记录注册失败
      if (metadata?.ip_address) {
        try {
          await supabase.rpc('record_auth_failure', {
            p_ip_address: metadata.ip_address,
            p_email: email,
            p_attempt_type: 'signup',
            p_failure_reason: (err as Error).message,
            p_user_agent: navigator.userAgent
          })
        } catch (recordError) {
          console.warn('Failed to record auth failure:', recordError)
        }
      }
      
      setError(err as AuthError)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 登录
  const signIn = async (email: string, password: string) => {
    try {
      setError(null)
      setLoading(true)

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
    } catch (err) {
      setError(err as AuthError)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth 登录
  const signInWithGoogle = async () => {
    try {
      setError(null)
      setLoading(true)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error
    } catch (err) {
      setError(err as AuthError)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 登出
  const signOut = async () => {
    console.log('AuthContext: signOut called')
    
    try {
      setError(null)
      setLoading(true)

      // 创建一个超时Promise（减少到2秒）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sign out timeout after 2 seconds')), 2000)
      })

      console.log('AuthContext: Calling supabase.auth.signOut() with local scope')
      
      try {
        // 使用 scope: 'local' 只清除本地会话，避免网络请求
        const result = await Promise.race([
          supabase.auth.signOut({ scope: 'local' }),
          timeoutPromise
        ]) as { error?: AuthError }
        
        if (result?.error) {
          console.error('AuthContext: Supabase signOut error:', result.error)
          // 不抛出错误，继续执行本地清理
        } else {
          console.log('AuthContext: Supabase signOut successful')
        }
      } catch (apiError) {
        console.error('AuthContext: API call failed or timeout:', apiError)
        console.log('AuthContext: Proceeding with local cleanup anyway')
      }

      // 无论API调用是否成功，都清除本地状态
      console.log('AuthContext: Clearing local state and storage')
      
      // 清除localStorage中的会话数据
      const storageKey = 'ai-video-saas-auth'
      localStorage.removeItem(`sb-${storageKey}-auth-token`)
      localStorage.removeItem(storageKey)
      
      // 清除所有Supabase相关的localStorage项和ProtectedRoute检查的缓存
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          console.log(`Removing localStorage key: ${key}`)
          localStorage.removeItem(key)
        }
      })
      
      // 特别清除ProtectedRoute检查的特定缓存项
      localStorage.removeItem('sb-hvkzwrnvxsleeonqqrzq-auth-token')
      localStorage.removeItem('__auth_last_success')
      localStorage.removeItem('supabase.auth.token')
      
      // 停止Token检查定时器
      stopTokenCheck()
      
      // 清除状态
      setUser(null)
      setSession(null)
      setProfile(null)
      
      console.log('AuthContext: Local cleanup completed successfully')
    } catch (err) {
      console.error('AuthContext: signOut error:', err)
      
      // 即使出错也尝试清除本地状态
      console.log('AuthContext: Error occurred, forcing local cleanup')
      setUser(null)
      setSession(null)
      setProfile(null)
      
      // 清除localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })
      
      setError(err as AuthError)
      // 不再抛出错误，让用户能够"登出"
      // throw err
    } finally {
      setLoading(false)
      console.log('AuthContext: signOut completed')
    }
  }

  // 重置密码
  const resetPassword = async (email: string) => {
    try {
      setError(null)
      setLoading(true)

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error
      
      alert('密码重置链接已发送到您的邮箱')
    } catch (err) {
      setError(err as AuthError)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 更新密码
  const updatePassword = async (newPassword: string) => {
    try {
      setError(null)
      setLoading(true)

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error
      
      alert('密码更新成功')
      navigate('/profile')
    } catch (err) {
      setError(err as AuthError)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 更新用户资料
  const updateProfile = async (updates: ProfileUpdate) => {
    try {
      setError(null)
      setLoading(true)

      if (!user) throw new Error('No user logged in')

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return data
    } catch (err) {
      setError(err as AuthError)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 刷新用户资料
  const refreshProfile = async () => {
    if (!user) return
    await fetchProfile(user.id)
  }

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    error,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// 使用认证上下文的 Hook
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 导出别名
export const useAuthContext = useAuth

// 导出上下文和类型
export { AuthContext }
export type { Profile, ProfileUpdate, SignUpMetadata }