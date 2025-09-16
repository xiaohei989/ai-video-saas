import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { Loader2, Mail, Lock, User, Tag, Shield, AlertTriangle } from 'lucide-react'
import { validateEmailAsync } from '@/services/emailValidator'
import { collectDeviceEnvironment, type DeviceFingerprint } from '@/utils/deviceFingerprint'
import { supabase } from '@/lib/supabase'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useSEO } from '@/hooks/useSEO'
import type { IPRegistrationLimitCheck, DeviceFingerprintLimitCheck, SupabaseRPCResult } from '@/types/antifraud'
import { toast } from 'sonner'
import { EmailVerification } from './EmailVerification'

// Google 图标组件
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

// Apple 图标组件
const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
  </svg>
)


export default function SignUpForm() {
  const { t } = useTranslation()
  const { signUp, signInWithGoogle, signInWithApple, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const { trackSignUp, trackEvent } = useAnalytics()

  // SEO优化
  useSEO('signup')
  
  // 表单状态
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [referralCode, setReferralCode] = useState(searchParams.get('invite') || searchParams.get('ref') || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // 安全相关状态
  const [deviceFingerprint, setDeviceFingerprint] = useState<DeviceFingerprint | null>(null)
  const [ipAddress, setIpAddress] = useState<string | null>(null)
  const [securityChecking, setSecurityChecking] = useState(false)
  const [securityBlocked, setSecurityBlocked] = useState<string | null>(null)
  const [emailValidating, setEmailValidating] = useState(false)
  const [showEmailVerification, setShowEmailVerification] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  
  // 收集设备指纹
  useEffect(() => {
    const initSecurity = async () => {
      try {
        setSecurityChecking(true)
        console.log('[SecurityCheck] 开始安全检查...')
        
        // 设置超时机制，8秒后自动完成检查（增加时间避免过早超时）
        const timeoutId = setTimeout(() => {
          console.log('[SecurityCheck] 安全检查超时，自动启用注册按钮')
          setSecurityChecking(false)
          setSecurityBlocked(null) // 清除任何阻止状态
        }, 8000)
        
        let deviceEnv
        try {
          deviceEnv = await collectDeviceEnvironment()
          console.log('[SecurityCheck] 设备环境信息收集完成')
        } catch (envError) {
          console.warn('[SecurityCheck] 设备环境收集失败，使用基础检查:', envError)
          // 设备环境收集失败时，仍然允许注册但跳过高级检查
          clearTimeout(timeoutId)
          setSecurityChecking(false)
          return
        }
        
        // 如果成功获取到环境信息，清除超时
        clearTimeout(timeoutId)
        
        setDeviceFingerprint(deviceEnv.fingerprint)
        setIpAddress(deviceEnv.ipAddress)
        
        // 检查是否为自动化环境
        if (deviceEnv.automationDetection.isLikelyBot) {
          console.warn('[SecurityCheck] 检测到可能的自动化环境，但不阻止注册')
          // 不再直接阻止，而是记录警告
        }
        
        // 如果有IP地址，检查IP注册限制（优雅处理错误）
        // 开发环境下的本地IP跳过检查
        if (deviceEnv.ipAddress && !['127.0.0.1', 'localhost', '::1'].includes(deviceEnv.ipAddress)) {
          try {
            const ipCheckPromise = supabase.rpc('check_ip_registration_limit', {
              p_ip_address: deviceEnv.ipAddress,
              p_time_window_hours: 24,
              p_max_registrations: 5
            })
            
            // 为RPC调用设置3秒超时
            const ipCheckResult = await Promise.race([
              ipCheckPromise,
              new Promise<SupabaseRPCResult<IPRegistrationLimitCheck>>((_, reject) => 
                setTimeout(() => reject(new Error('IP检查超时')), 3000)
              )
            ])
            
            const { data: ipCheck, error } = ipCheckResult
            
            if (error) {
              console.warn('[SecurityCheck] IP检查RPC调用失败，跳过限制检查:', error.message)
            } else if (ipCheck && typeof ipCheck === 'object' && 'can_register' in ipCheck) {
              if (!ipCheck.can_register) {
                // 确保有明确的错误消息才阻止注册
                const blockReason = (ipCheck.reason && ipCheck.reason.trim()) || 'IP注册限制检查未通过'
                console.warn('[SecurityCheck] IP注册限制检查未通过:', blockReason)
                setSecurityBlocked(blockReason)
                setSecurityChecking(false)
                return
              } else {
                console.log('[SecurityCheck] IP检查通过')
              }
            } else {
              console.warn('[SecurityCheck] IP检查返回无效数据，跳过检查')
            }
          } catch (ipError) {
            console.warn('[SecurityCheck] IP检查异常，跳过检查:', ipError.message || ipError)
            // IP检查异常时，清除任何可能的阻止状态
            if (securityBlocked && securityBlocked.includes('IP')) {
              setSecurityBlocked(null)
            }
          }
        }
        
        // 检查设备指纹限制（优雅处理错误）
        if (deviceEnv.fingerprintHash) {
          try {
            const deviceCheckPromise = supabase.rpc('check_device_fingerprint_limit', {
              p_fingerprint_hash: deviceEnv.fingerprintHash,
              p_max_registrations: 3
            })
            
            // 为RPC调用设置3秒超时
            const deviceCheckResult = await Promise.race([
              deviceCheckPromise,
              new Promise<SupabaseRPCResult<DeviceFingerprintLimitCheck>>((_, reject) => 
                setTimeout(() => reject(new Error('设备指纹检查超时')), 3000)
              )
            ])
            
            const { data: deviceCheck, error: deviceError } = deviceCheckResult
            
            if (deviceError) {
              console.warn('[SecurityCheck] 设备指纹检查RPC调用失败，跳过限制检查:', deviceError.message)
            } else if (deviceCheck && typeof deviceCheck === 'object' && 'can_register' in deviceCheck) {
              if (!deviceCheck.can_register) {
                // 确保有明确的错误消息才阻止注册
                const blockReason = (deviceCheck.reason && deviceCheck.reason.trim()) || '设备指纹限制检查未通过'
                console.warn('[SecurityCheck] 设备指纹限制检查未通过:', blockReason)
                setSecurityBlocked(blockReason)
                setSecurityChecking(false)
                return
              } else {
                console.log('[SecurityCheck] 设备指纹检查通过')
              }
            } else {
              console.warn('[SecurityCheck] 设备指纹检查返回无效数据，跳过检查')
            }
          } catch (deviceError) {
            console.warn('[SecurityCheck] 设备指纹检查异常，跳过检查:', deviceError.message || deviceError)
          }
        }
        
        console.log('[SecurityCheck] 所有安全检查完成，允许注册')
        
      } catch (error) {
        console.warn('[SecurityCheck] 安全检查总体失败:', error)
        // 安全检查失败时不阻止注册，但记录错误
        console.log('[SecurityCheck] 由于检查失败，允许注册继续进行')
      } finally {
        setSecurityChecking(false)
        console.log('[SecurityCheck] 安全检查流程结束，注册按钮已启用')
      }
    }
    
    initSecurity()
  }, [])

  // 邮箱实时验证
  const handleEmailChange = async (newEmail: string) => {
    setEmail(newEmail)
    
    if (newEmail && newEmail.includes('@')) {
      setEmailValidating(true)
      try {
        // 为邮箱验证设置5秒超时
        const validationPromise = validateEmailAsync(newEmail)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('邮箱验证超时')), 5000)
        )
        
        const validation = await Promise.race([validationPromise, timeoutPromise]) as any
        
        if (!validation.isValid) {
          setErrors(prev => ({ ...prev, email: validation.error || t('auth.emailInvalid') }))
        } else {
          setErrors(prev => {
            const { email, ...rest } = prev
            return rest
          })
        }
      } catch (error) {
        console.warn('Email validation failed:', error)
        // 验证失败时清除错误，允许继续
        setErrors(prev => {
          const { email, ...rest } = prev
          return rest
        })
      } finally {
        setEmailValidating(false)
      }
    } else {
      // 如果邮箱格式不完整，清除验证状态
      setEmailValidating(false)
    }
  }

  // 验证表单
  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}

    // 安全检查
    if (securityBlocked) {
      newErrors.security = securityBlocked
      setErrors(newErrors)
      return false
    }

    if (!email) {
      newErrors.email = t('auth.emailRequired')
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('auth.invalidEmail')
    } else {
      // 异步验证邮箱（带超时处理）
      try {
        const validationPromise = validateEmailAsync(email)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('邮箱验证超时')), 3000)
        )
        
        const validation = await Promise.race([validationPromise, timeoutPromise]) as any
        if (!validation.isValid) {
          newErrors.email = validation.error || t('auth.emailInvalid')
        }
      } catch (error) {
        console.warn('Email validation during form submit failed:', error)
        // 验证失败时不阻止提交，但记录警告
        console.log('邮箱验证失败，但允许继续提交')
      }
    }

    if (!password) {
      newErrors.password = t('auth.passwordRequired')
    } else if (password.length < 8) {
      newErrors.password = t('auth.passwordMinLength')
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = t('auth.passwordComplexity')
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch')
    }

    if (username && !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      newErrors.username = t('auth.invalidUsername')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 记录注册尝试（失败时记录）
  const recordFailure = async (reason: string) => {
    try {
      if (ipAddress) {
        await supabase.rpc('record_registration_attempt', {
          p_ip_address: ipAddress,
          p_email: email,
          p_user_agent: navigator.userAgent,
          p_device_fingerprint: deviceFingerprint,
          p_success: false,
          p_failure_reason: reason
        })
      }
    } catch (recordError) {
      console.warn('Failed to record registration attempt:', recordError)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const isValid = await validateForm()
    if (!isValid) {
      return
    }

    try {
      setIsSubmitting(true)
      
      // 执行注册（传递安全信息）
      await signUp(email, password, {
        username,
        full_name: fullName,
        referral_code: referralCode || undefined,
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress || undefined,
      })
      
      // 注册成功，记录成功的注册尝试
      try {
        if (ipAddress) {
          await supabase.rpc('record_registration_attempt', {
            p_ip_address: ipAddress,
            p_email: email,
            p_user_agent: navigator.userAgent,
            p_device_fingerprint: deviceFingerprint,
            p_success: true
          })
        }
      } catch (recordError) {
        console.warn('Failed to record successful registration:', recordError)
      }
      
      // 跟踪注册成功事件
      trackSignUp('email')
      
      toast.success(t('auth.signUpSuccess'), {
        description: '请查看您的邮箱以验证账户',
        duration: 5000
      })
    } catch (err: any) {
      console.error('Sign up error:', err)
      
      let errorReason = 'unknown_error'
      let errorMessage = t('auth.signUpError') + ': ' + err.message
      
      if (err.message === 'EMAIL_VERIFICATION_REQUIRED') {
        setRegisteredEmail(email)
        setShowEmailVerification(true)
        toast.success('注册成功！', {
          description: `验证邮件已发送到 ${email}`,
          duration: 5000
        })
        errorReason = 'email_verification_required'
        // 不记录为失败，因为这是正常的邮箱验证流程
        return
      } else if (err.message?.includes('already registered')) {
        setErrors({ email: t('auth.emailAlreadyRegistered') })
        errorReason = 'email_already_exists'
      } else if (err.message?.includes('weak password')) {
        setErrors({ password: t('auth.weakPassword') })
        errorReason = 'weak_password'
      } else if (err.message?.includes('invalid email')) {
        setErrors({ email: t('auth.invalidEmailFormat') })
        errorReason = 'invalid_email'
      } else {
        toast.error(errorMessage, {
          description: '请检查网络连接或稍后重试',
          duration: 5000
        })
        errorReason = 'auth_service_error'
      }
      
      // 记录失败尝试
      await recordFailure(errorReason)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      setIsSubmitting(true)
      await signInWithGoogle()
      
      // 跟踪Google注册成功事件
      trackSignUp('google')
    } catch (err: any) {
      console.error('Google sign up error:', err)
      toast.error(t('auth.googleSignUpError'), {
        description: err.message,
        duration: 5000
      })
      
      // 跟踪注册失败事件
      trackEvent({
        action: 'sign_up_failed',
        category: 'user_engagement',
        label: 'google',
        custom_parameters: {
          error_type: 'google_auth_error',
          method: 'google'
        }
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAppleSignUp = async () => {
    try {
      setIsSubmitting(true)
      await signInWithApple()
      
      // 跟踪Apple注册成功事件
      trackSignUp('apple')
    } catch (err: any) {
      console.error('Apple sign up error:', err)
      toast.error(t('auth.appleSignUpError'), {
        description: err.message,
        duration: 5000
      })
      
      // 跟踪注册失败事件
      trackEvent({
        action: 'sign_up_failed',
        category: 'user_engagement',
        label: 'apple',
        custom_parameters: {
          error_type: 'apple_auth_error',
          method: 'apple'
        }
      })
    } finally {
      setIsSubmitting(false)
    }
  }


  // 如果需要显示邮箱验证界面
  if (showEmailVerification) {
    return (
      <EmailVerification 
        email={registeredEmail}
        onBack={() => {
          setShowEmailVerification(false)
          setRegisteredEmail('')
        }}
      />
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {t('auth.signUp')}
        </CardTitle>
        <CardDescription className="text-center">
          {t('auth.signUpDescription')}
        </CardDescription>
        
        {/* 安全状态显示 */}
        {securityChecking && (
          <div className="flex items-center justify-center space-x-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border">
            <Shield className="h-4 w-4 animate-pulse" />
            <span>{t('auth.securityCheckInProgress')}</span>
          </div>
        )}
        
        {/* 成功状态显示 */}
        {!securityChecking && !securityBlocked && deviceFingerprint && (
          <div className="flex items-center justify-center space-x-2 text-sm text-green-600 bg-green-50 p-2 rounded border">
            <Shield className="h-4 w-4" />
            <span>{t('auth.securityCheckCompleted')}</span>
          </div>
        )}
        
        {securityBlocked && (
          <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded border">
            <AlertTriangle className="h-4 w-4" />
            <span>{securityBlocked}</span>
          </div>
        )}
        
        {errors.security && (
          <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-2 rounded border">
            <AlertTriangle className="h-4 w-4" />
            <span>{errors.security}</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* OAuth 按钮组 */}
        <div className="space-y-3">
          {/* Google OAuth 按钮 */}
          <Button
            type="button"
            variant="outline"
            className="w-full transition-colors duration-200"
            onClick={handleGoogleSignUp}
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-4 w-4" />
            )}
            {t('auth.signUpWithGoogle')}
          </Button>

          {/* Apple OAuth 按钮 */}
          <Button
            type="button"
            variant="outline"
            className="w-full bg-black text-white hover:bg-gray-800 hover:text-white border-black transition-colors duration-200"
            onClick={handleAppleSignUp}
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <AppleIcon className="mr-2 h-4 w-4" />
            )}
            {t('auth.signUpWithApple')}
          </Button>

        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t('auth.orContinueWithEmail')}
            </span>
          </div>
        </div>

        {/* 注册表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('auth.username')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder={t('auth.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting || loading}
                  className="pl-10"
                />
              </div>
              {errors.username && (
                <p className="text-xs text-red-600">{errors.username}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">{t('auth.fullName')}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t('auth.fullNamePlaceholder')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting || loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')} *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                disabled={isSubmitting || loading}
                className="pl-10"
                required
              />
            </div>
            {emailValidating && (
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{t('auth.validatingEmail')}</span>
              </div>
            )}
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')} *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || loading}
                className="pl-10"
                required
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')} *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t('auth.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting || loading}
                className="pl-10"
                required
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="referralCode">{t('auth.referralCode')}</Label>
            <div className="relative">
              <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="referralCode"
                type="text"
                placeholder={t('auth.referralCodePlaceholder')}
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                disabled={isSubmitting || loading}
                className="pl-10"
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {t('auth.termsAgreement')}{' '}
            <Link to="/terms" className="text-primary hover:underline">
              {t('auth.termsOfService')}
            </Link>{' '}
            {t('auth.and')}{' '}
            <Link to="/privacy" className="text-primary hover:underline">
              {t('auth.privacyPolicy')}
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || loading || (securityBlocked && securityBlocked.trim() !== '')}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.signingUp')}
              </>
            ) : securityBlocked ? (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                {t('auth.registrationBlocked')}
              </>
            ) : (
              t('auth.signUp')
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-center text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/signin" className="text-primary hover:underline">
            {t('auth.signIn')}
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}