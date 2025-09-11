import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { Loader2, Mail, Lock } from 'lucide-react'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'
import { useLoginLimiter } from '@/hooks/useRateLimiter'
import { useCSRF } from '@/services/csrfService'
import { InputValidator } from '@/utils/inputValidator'
import { securityMonitor } from '@/services/securityMonitorService'
import { ThreatType, SecurityLevel } from '@/config/security'

// Google 图标组件
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function SignInForm() {
  const { t } = useTranslation()
  const { signIn, signInWithGoogle, loading, error } = useAuth()
  const { trackLogin } = useAnalytics()
  const { executeWithLimit, isLimited } = useLoginLimiter()
  const { } = useCSRF()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({})

  // SEO优化
  useSEO('signin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 检查是否被限流
    if (isLimited()) {
      alert('登录尝试过于频繁，请稍后再试')
      return
    }
    
    if (!email || !password) {
      alert(t('auth.fillAllFields'))
      return
    }

    // 输入验证
    const emailValidation = InputValidator.validateEmail(email)
    const passwordValidation = InputValidator.validateString(password, {
      maxLength: 100,
      sanitize: true
    })

    const newValidationErrors: { email?: string; password?: string } = {}
    
    if (!emailValidation.isValid) {
      newValidationErrors.email = emailValidation.errors[0]
    }
    
    if (!passwordValidation.isValid) {
      newValidationErrors.password = passwordValidation.errors[0]
    }
    
    setValidationErrors(newValidationErrors)
    
    if (Object.keys(newValidationErrors).length > 0) {
      return
    }

    // 使用限流保护的登录
    await executeWithLimit(async () => {
      try {
        setIsSubmitting(true)
        
        // 记录登录尝试
        await securityMonitor.logSecurityEvent({
          type: ThreatType.SUSPICIOUS_PATTERN,
          level: SecurityLevel.LOW,
          details: {
            email: email,
            action: 'login_attempt',
            timestamp: Date.now()
          },
          blocked: false,
          action: 'user_login_attempt'
        })
        
        await signIn(emailValidation.sanitized || email, passwordValidation.sanitized || password)
        
        // 跟踪邮箱登录成功事件
        trackLogin('email')
        
        // 记录登录成功
        await securityMonitor.logSecurityEvent({
          type: ThreatType.SUSPICIOUS_PATTERN,
          level: SecurityLevel.LOW,
          details: {
            email: email,
            action: 'login_success'
          },
          blocked: false,
          action: 'user_login_success'
        })
        
      } catch (err: any) {
        console.error('Sign in error:', err)
        
        // 记录登录失败
        await securityMonitor.logSecurityEvent({
          type: ThreatType.SUSPICIOUS_PATTERN,
          level: SecurityLevel.MEDIUM,
          details: {
            email: email,
            error: err.message,
            action: 'login_failed'
          },
          blocked: false,
          action: 'user_login_failed'
        })
        
        if (err.message?.includes('Invalid login credentials')) {
          alert(t('auth.invalidCredentials'))
        } else if (err.message?.includes('Email not confirmed')) {
          alert(t('auth.emailNotConfirmed'))
        } else {
          alert(t('auth.signInError') + ': ' + err.message)
        }
      } finally {
        setIsSubmitting(false)
      }
    })
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true)
      await signInWithGoogle()
      
      // 跟踪Google登录成功事件
      trackLogin('google')
    } catch (err: any) {
      console.error('Google sign in error:', err)
      alert(t('auth.googleSignInError') + ': ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {t('auth.signIn')}
        </CardTitle>
        <CardDescription className="text-center">
          {t('auth.signInDescription')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Google OAuth 按钮 */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || loading}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 h-4 w-4" />
          )}
          {t('auth.signInWithGoogle')}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t('auth.orContinueWith')}
            </span>
          </div>
        </div>

        {/* 邮箱密码登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  // 清除验证错误
                  if (validationErrors.email) {
                    setValidationErrors(prev => ({ ...prev, email: undefined }))
                  }
                }}
                disabled={isSubmitting || loading}
                className={`pl-10 ${validationErrors.email ? 'border-red-500' : ''}`}
                required
              />
            </div>
            {validationErrors.email && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  // 清除验证错误
                  if (validationErrors.password) {
                    setValidationErrors(prev => ({ ...prev, password: undefined }))
                  }
                }}
                disabled={isSubmitting || loading}
                className={`pl-10 ${validationErrors.password ? 'border-red-500' : ''}`}
                required
              />
            </div>
            {validationErrors.password && (
              <p className="text-sm text-red-600 mt-1">{validationErrors.password}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Link
              to="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || loading || isLimited()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.signingIn')}
              </>
            ) : (
              t('auth.signIn')
            )}
          </Button>
        </form>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
            {error.message}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-center text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" className="text-primary hover:underline">
            {t('auth.signUp')}
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}