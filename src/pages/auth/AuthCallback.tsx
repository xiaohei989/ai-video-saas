import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AuthCallback() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AuthCallback] 开始处理OAuth回调')
        
        const currentUrl = new URL(window.location.href)
        const urlParams = new URLSearchParams(window.location.search)
        
        // 🚀 首先检查是否已经有有效的会话
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        if (existingSession) {
          console.log('[AuthCallback] 用户已有有效会话，跳过OAuth处理:', existingSession.user.email)
          await handleSuccessfulAuth(existingSession.user.email || 'unknown')
          return
        }
        
        // 检测OAuth提供商类型
        const oauthProvider = localStorage.getItem('oauth_provider')
        const isAppleOAuth = oauthProvider === 'apple' || 
                            document.referrer.includes('appleid.apple.com') ||
                            currentUrl.searchParams.has('state')
        
        console.log('[AuthCallback] OAuth提供商检测:', {
          provider: oauthProvider,
          isAppleOAuth,
          hasCode: urlParams.has('code'),
          hasState: urlParams.has('state'),
          referrer: document.referrer,
          currentUrl: currentUrl.href
        })

        // 清理OAuth提供商标记
        if (oauthProvider) {
          localStorage.removeItem('oauth_provider')
        }

        // PKCE流程：处理授权码
        const code = urlParams.get('code')
        
        if (code) {
          console.log('[AuthCallback] 检测到授权码，开始PKCE流程交换')
          
          // 🚀 添加详细的PKCE调试信息
          console.log('[AuthCallback] PKCE调试信息:', {
            code: code.substring(0, 20) + '...',
            codeLength: code.length,
            localStorage: {
              authToken: !!localStorage.getItem('sb-hvkzwrnvxsleeonqqrzq-auth-token'),
              pkceKeys: Object.keys(localStorage).filter(k => k.includes('pkce') || k.includes('verifier')),
              supabaseKeys: Object.keys(localStorage).filter(k => k.includes('supabase')),
            },
            sessionStorage: {
              pkceKeys: Object.keys(sessionStorage).filter(k => k.includes('pkce') || k.includes('verifier')),
              allKeys: Object.keys(sessionStorage),
            }
          })
          
          // 使用exchangeCodeForSession进行代码交换
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            console.error('[AuthCallback] 代码交换失败:', exchangeError)
            console.error('[AuthCallback] 错误详情:', {
              message: exchangeError.message,
              code: exchangeError.status,
              details: exchangeError
            })
            
            // 🚀 如果是PKCE错误，尝试检查当前会话状态
            if (exchangeError.message?.includes('code verifier')) {
              console.log('[AuthCallback] PKCE错误，检查是否已有有效会话...')
              const { data: { session: retrySession } } = await supabase.auth.getSession()
              if (retrySession) {
                console.log('[AuthCallback] 找到有效会话，忽略PKCE错误')
                await handleSuccessfulAuth(retrySession.user.email || 'unknown')
                return
              }
            }
            
            throw new Error(`认证失败: ${exchangeError.message}`)
          }
          
          if (data?.session) {
            console.log('[AuthCallback] 会话交换成功，用户:', data.session.user.email)
            await handleSuccessfulAuth(data.session.user.email || 'unknown')
            return
          } else {
            console.error('[AuthCallback] 代码交换成功但没有返回会话')
            throw new Error('会话建立失败，请重试')
          }
        }

        // 检查是否有现有会话（用于处理可能的延迟情况）
        console.log('[AuthCallback] 未找到授权码，检查现有会话')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[AuthCallback] 获取会话出错:', sessionError)
          throw new Error(`会话检查失败: ${sessionError.message}`)
        }
        
        if (session) {
          console.log('[AuthCallback] 发现现有会话，用户:', session.user.email)
          await handleSuccessfulAuth(session.user.email || 'unknown')
          return
        }

        // 特殊处理：如果是Apple OAuth但没有找到代码或会话，可能需要等待
        if (isAppleOAuth && urlParams.has('state')) {
          console.log('[AuthCallback] Apple OAuth detected but no code found, checking for form_post data...')
          // Apple可能使用form_post模式，需要等待后端处理
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          const { data: { session: delayedSession } } = await supabase.auth.getSession()
          if (delayedSession) {
            console.log('[AuthCallback] Apple OAuth延迟会话检测成功')
            await handleSuccessfulAuth(delayedSession.user.email || 'unknown')
            return
          }
        }

        // 如果都没有找到，则认为是无效的回调
        console.error('[AuthCallback] 未找到有效的认证数据')
        throw new Error(isAppleOAuth ? 
          'Apple登录失败，请重试' : 
          '登录验证失败，请重试'
        )

      } catch (err: any) {
        console.error('[AuthCallback] 认证回调处理出错:', err)
        setError(err.message || '登录过程中发生错误')
        setIsProcessing(false)
        
        // 3秒后跳转到登录页面
        setTimeout(() => {
          navigate('/signin', { replace: true })
        }, 3000)
      }
    }

    // 成功认证处理函数
    const handleSuccessfulAuth = async (userEmail: string) => {
      console.log('[AuthCallback] 处理成功认证，用户:', userEmail)
      setSuccess(true)
      setIsProcessing(false)
      
      // 清理URL参数
      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
      
      // 1.5秒后跳转
      setTimeout(() => {
        const redirectTo = localStorage.getItem('redirectAfterLogin') || '/templates'
        localStorage.removeItem('redirectAfterLogin')
        console.log('[AuthCallback] 跳转到目标页面:', redirectTo)
        navigate(redirectTo, { replace: true })
      }, 1500)
    }

    handleCallback()
  }, [navigate, t])

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full space-y-4 p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <p className="text-center text-sm text-muted-foreground">
            3秒后将跳转到登录页面...
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => navigate('/signin', { replace: true })}
              className="text-sm text-primary hover:underline"
            >
              立即跳转到登录页面
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 成功状态
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
          <h2 className="text-xl font-semibold text-green-600">登录成功！</h2>
          <p className="text-sm text-muted-foreground">
            正在跳转到应用...
          </p>
        </div>
      </div>
    )
  }

  // 处理中状态
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <h2 className="text-lg font-semibold">正在完成登录</h2>
        <p className="text-sm text-muted-foreground">
          正在验证您的身份信息，请稍候...
        </p>
      </div>
    </div>
  )
}