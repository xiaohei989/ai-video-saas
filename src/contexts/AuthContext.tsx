import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, ensureValidSession } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { referralService } from '@/services/referralService'
import { edgeCacheClient } from '@/services/EdgeFunctionCacheClient'
import i18n from '@/i18n/config'

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
  signInWithApple: () => Promise<void>
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
  const isInitialLoadRef = useRef(true)
  
  // 🚀 性能优化：使用ref跟踪loading状态，确保原子性
  const loadingRef = useRef(loading)
  
  // 每次loading状态变化时同步更新ref
  useEffect(() => {
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
    credits: parseInt(import.meta.env.VITE_DEFAULT_USER_CREDITS || '50'),
    total_credits_earned: parseInt(import.meta.env.VITE_DEFAULT_USER_CREDITS || '50'),
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
      
      // 🚀 优先使用缓存获取profile
      try {
        const cachedProfile = await edgeCacheClient.getUserProfile(userId)
        
        if (cachedProfile) {
          const profileData: Profile = {
            id: cachedProfile.id,
            email: cachedProfile.email,
            username: cachedProfile.username,
            full_name: cachedProfile.full_name,
            avatar_url: cachedProfile.avatar_url,
            bio: cachedProfile.bio,
            website: cachedProfile.website,
            social_links: cachedProfile.social_links,
            language: cachedProfile.language,
            credits: cachedProfile.credits,
            total_credits_earned: cachedProfile.total_credits_earned,
            total_credits_spent: cachedProfile.total_credits_spent,
            referral_code: cachedProfile.referral_code,
            follower_count: cachedProfile.follower_count,
            following_count: cachedProfile.following_count,
            template_count: cachedProfile.template_count,
            is_verified: cachedProfile.is_verified,
            created_at: cachedProfile.created_at,
            updated_at: cachedProfile.updated_at
          }
          setProfile(profileData)
          return profileData
        }
      } catch (cacheError) {
        console.info('[AUTH] 缓存服务暂不可用，从数据库获取profile')
      }
      
      // 缓存未命中或失败，从数据库获取
      console.log('[AUTH] 🔄 缓存未命中，从数据库获取最新profile数据')
      
      // 创建带超时的查询（缩短到1.5秒，因为有缓存作为主要来源）
      const profileQuery = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      // 1.5秒超时Promise（比之前更短，因为不是主要数据源）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 1500)
      })
      
      try {
        // 使用Promise.race实现超时
        const { data, error } = await Promise.race([
          profileQuery,
          timeoutPromise
        ]) as any
        
        if (error) {
          console.error('[AUTH] 数据库查询profile出错:', error)
          
          // 如果是表不存在的错误
          if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            console.warn('[AUTH] Profiles表不存在，使用基本profile')
            const basicProfile = createBasicProfile()
            setProfile(basicProfile as Profile)
            return basicProfile
          }
          
          // 其他错误，返回基本profile但不崩溃
          console.warn('[AUTH] 数据库查询失败，使用基本profile')
          const basicProfile = createBasicProfile(userId, userEmail)
          setProfile(basicProfile as Profile)
          return basicProfile
        }
        
        if (data) {
          console.log('[AUTH] ✅ 数据库查询成功，已加载用户profile')
          setProfile(data)
          
          // 后台更新缓存，将新数据存入缓存系统
          try {
            await edgeCacheClient.getUserProfile(userId)
          } catch (err) {
            // 静默处理缓存更新失败，不影响用户体验
          }
          
          return data
        }
        
        // 没有数据，使用基本profile
        console.warn('[AUTH] 数据库中没有找到profile，使用基本profile')
        const basicProfile = createBasicProfile(userId, userEmail)
        setProfile(basicProfile as Profile)
        return basicProfile
        
      } catch (timeoutError) {
        // 数据库查询超时，使用基本profile，这在有缓存系统的情况下是正常的
        const basicProfile = createBasicProfile(userId, userEmail)
        setProfile(basicProfile as Profile)
        return basicProfile
      }
    } catch (err) {
      console.error('[AUTH] fetchProfile发生意外错误:', err)
      // 确保不会因为profile获取失败而导致应用崩溃
      const basicProfile = createBasicProfile(userId, userEmail)
      setProfile(basicProfile as Profile)
      return basicProfile
    }
  }

  // Token检查定时器
  const tokenCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
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
        const errorMessage = (error as Error)?.message || ''
        if (errorMessage.includes('refresh_token_not_found') || 
            errorMessage.includes('invalid_grant')) {
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
      const authStart = performance.now()
      try {
        
        // 🚀 性能优化：设置合理的网络超时，平衡速度和稳定性
        const sessionPromise = Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Session timeout')), 2500) // 2.5秒超时，给Supabase充足时间
          )
        ])
        
        const { data: { session }, error } = await sessionPromise as any
        
        
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
            } catch (error) {
              console.warn('[AUTH] 缓存更新失败:', error)
            }
          }
          
          // 立即清除超时计时器，避免后续误报
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          
          
          // 在后台异步获取profile，不阻塞应用
          if (session?.user) {
            fetchProfile(session.user.id, session.user.email).then(() => {
            }).catch(err => {
              console.error('AuthContext: Profile fetch failed:', err)
            })
          }
        }
      } catch (err) {
        const authTime = performance.now() - authStart
        const errorMessage = (err as Error)?.message || 'Unknown error'
        const isTimeoutError = errorMessage.includes('Session timeout')
        
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
        
        switch (event) {
          case 'INITIAL_SESSION':
            // 初始会话加载，不进行导航，保持用户在当前页面
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
            const authPages = ['/signin', '/signup', '/forgot-password', '/reset-password']
            const protectedPages = ['/videos', '/profile', '/create']
            
            const currentPath = window.location.pathname
            const isOnAuthPage = authPages.some(path => currentPath.startsWith(path))
            const isOnProtectedPage = protectedPages.some(path => currentPath.startsWith(path))
            
            // 只有在以下条件下才进行导航：
            // 1. 非初始加载（真正的用户操作）
            // 2. 当前在认证页面（登录/注册页面）
            // 3. 不在公开页面和受保护页面上
            const isUserInitiatedSignIn = !isInitialLoadRef.current && 
              isOnAuthPage && !isOnProtectedPage
            
            
            if (isUserInitiatedSignIn) {
              console.log('[AUTH] User-initiated sign in from auth page, navigating to templates')
              navigate('/templates')
            } else {
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

      // 🚀 保护当前语言设置 - 在OAuth前保存当前语言状态
      const preserveLanguageSettings = () => {
        try {
          const currentLanguage = i18n.language
          const preferredLanguage = localStorage.getItem('preferred_language')
          
          console.log('[AuthContext] Google OAuth前语言状态保护:', {
            currentLanguage,
            preferredLanguage,
            navigatorLanguage: navigator.language
          })
          
          // 保存当前语言到临时存储，供回调时恢复
          if (currentLanguage && currentLanguage !== 'ar') {
            localStorage.setItem('pre_oauth_language', currentLanguage)
            console.log('[AuthContext] 已保存OAuth前语言设置:', currentLanguage)
          }
          
          // 确保preferred_language存在并且不是阿拉伯语（除非用户明确选择）
          if (!preferredLanguage || (preferredLanguage === 'ar' && currentLanguage !== 'ar')) {
            const safeLanguage = navigator.language.startsWith('zh') ? 'zh' : 'en'
            localStorage.setItem('preferred_language', safeLanguage)
            console.log('[AuthContext] 设置安全的偏好语言:', safeLanguage)
          }
          
        } catch (error) {
          console.error('[AuthContext] 语言设置保护失败:', error)
        }
      }
      
      // 执行语言保护
      preserveLanguageSettings()

      // 标记当前使用Google OAuth
      localStorage.setItem('oauth_provider', 'google')

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

      if (error) {
        localStorage.removeItem('oauth_provider') // 清理标记
        localStorage.removeItem('pre_oauth_language') // 清理语言保护
        throw error
      }
    } catch (err) {
      setError(err as AuthError)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Apple OAuth 登录
  const signInWithApple = async () => {
    try {
      setError(null)
      setLoading(true)

      // 🚀 保护当前语言设置 - 在OAuth前保存当前语言状态
      const preserveLanguageSettings = () => {
        try {
          const currentLanguage = i18n.language
          const preferredLanguage = localStorage.getItem('preferred_language')
          
          console.log('[AuthContext] Apple OAuth前语言状态保护:', {
            currentLanguage,
            preferredLanguage,
            navigatorLanguage: navigator.language
          })
          
          // 保存当前语言到临时存储，供回调时恢复
          if (currentLanguage && currentLanguage !== 'ar') {
            localStorage.setItem('pre_oauth_language', currentLanguage)
            console.log('[AuthContext] 已保存OAuth前语言设置:', currentLanguage)
          }
          
          // 确保preferred_language存在并且不是阿拉伯语（除非用户明确选择）
          if (!preferredLanguage || (preferredLanguage === 'ar' && currentLanguage !== 'ar')) {
            const safeLanguage = navigator.language.startsWith('zh') ? 'zh' : 'en'
            localStorage.setItem('preferred_language', safeLanguage)
            console.log('[AuthContext] 设置安全的偏好语言:', safeLanguage)
          }
          
        } catch (error) {
          console.error('[AuthContext] 语言设置保护失败:', error)
        }
      }
      
      // 执行语言保护
      preserveLanguageSettings()

      // 标记当前使用Apple OAuth，供AuthCallback识别
      localStorage.setItem('oauth_provider', 'apple')

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // 移除response_mode配置，让Supabase使用Apple OAuth的默认form_post模式
          // Apple OAuth需要使用form_post模式来正确传递用户信息
        },
      })

      if (error) {
        localStorage.removeItem('oauth_provider') // 清理标记
        localStorage.removeItem('pre_oauth_language') // 清理语言保护
        throw error
      }
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
      
      // 🚀 更新缓存中的profile数据
      if (data) {
        edgeCacheClient.updateUserProfileCache(user.id, updates).catch(err => {
          console.warn('[AUTH] 更新profile缓存失败:', err)
        })
      }
      
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
    
    // 🚀 清除缓存后重新获取，确保获取最新数据
    edgeCacheClient.invalidateUserCache(user.id).catch(err => {
      console.warn('[AUTH] 清除用户缓存失败:', err)
    })
    
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
    signInWithApple,
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