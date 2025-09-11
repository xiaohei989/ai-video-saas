import { useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Hook to get current auth state
 */
export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, session, loading }
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated() {
  const { user, loading } = useAuthState()
  return { isAuthenticated: !!user, loading }
}

/**
 * Hook to get user profile
 */
export function useProfile(userId?: string) {
  const { user } = useAuthState()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const targetUserId = userId || user?.id

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false)
      return
    }

    const fetchProfile = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .single()

        if (error) throw error
        setProfile(data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [targetUserId])

  return { profile, loading, error }
}

/**
 * Hook to check user permissions
 */
export function usePermissions() {
  const { profile } = useProfile()
  
  const hasCredits = (amount: number = 1) => {
    return (profile?.credits || 0) >= amount
  }

  const hasSubscription = (tier?: string) => {
    if (!tier) return !!profile?.subscription_tier
    return profile?.subscription_tier === tier
  }

  const isVerified = () => {
    return profile?.is_verified || false
  }

  const canCreateTemplate = () => {
    return hasSubscription() || hasCredits(10)
  }

  const canGenerateVideo = (creditCost: number = 10) => {
    return hasCredits(creditCost)
  }

  return {
    hasCredits,
    hasSubscription,
    isVerified,
    canCreateTemplate,
    canGenerateVideo,
  }
}

/**
 * Hook to handle auth redirects
 */
export function useAuthRedirect() {
  const { user, loading } = useAuthState()
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      const savedRedirect = sessionStorage.getItem('auth_redirect')
      if (savedRedirect && user) {
        setRedirectUrl(savedRedirect)
        sessionStorage.removeItem('auth_redirect')
      }
    }
  }, [user, loading])

  const saveRedirect = (url: string) => {
    sessionStorage.setItem('auth_redirect', url)
  }

  return { redirectUrl, saveRedirect }
}

/**
 * Hook for session refresh
 */
export function useSessionRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshSession = async () => {
    try {
      setIsRefreshing(true)
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      return data.session
    } catch (error) {
      console.error('Failed to refresh session:', error)
      return null
    } finally {
      setIsRefreshing(false)
    }
  }

  return { refreshSession, isRefreshing }
}

/**
 * Hook for monitoring auth errors
 */
export function useAuthError() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          setError(null)
        } else if (event === 'TOKEN_REFRESHED') {
          setError(null)
        } else if (event === 'USER_UPDATED') {
          setError(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const clearError = () => setError(null)

  return { error, setError, clearError }
}