import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { Loader2, Lock, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function ResetPasswordForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { updatePassword, session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 检查是否有有效的恢复会话
  useEffect(() => {
    if (!session) {
      // 如果没有会话，可能是通过邮件链接访问的
      // Supabase 会自动处理恢复令牌
    }
  }, [session])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!password) {
      newErrors.password = t('auth.passwordRequired')
    } else if (password.length < 6) {
      newErrors.password = t('auth.passwordTooShort')
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      await updatePassword(password)
      setIsSuccess(true)
      
      // 3秒后跳转到个人资料页
      setTimeout(() => {
        navigate('/profile')
      }, 3000)
    } catch (err: any) {
      console.error('Password update error:', err)
      if (err.message?.includes('same as the old')) {
        setErrors({ password: t('auth.samePasswordError') })
      } else if (err.message?.includes('weak password')) {
        setErrors({ password: t('auth.weakPassword') })
      } else {
        toast.error(t('auth.updatePasswordError') + ': ' + err.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {t('auth.passwordUpdated')}
          </CardTitle>
          <CardDescription className="text-center">
            {t('auth.passwordUpdatedDescription')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              {t('auth.redirectingToProfile')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {t('auth.resetPassword')}
        </CardTitle>
        <CardDescription className="text-center">
          {t('auth.resetPasswordDescription')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.newPassword')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder={t('auth.newPasswordPlaceholder')}
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
            <Label htmlFor="confirmPassword">{t('auth.confirmNewPassword')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t('auth.confirmNewPasswordPlaceholder')}
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

          <div className="text-xs text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>{t('auth.passwordRequirement1')}</li>
              <li>{t('auth.passwordRequirement2')}</li>
              <li>{t('auth.passwordRequirement3')}</li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.updatingPassword')}
              </>
            ) : (
              t('auth.updatePassword')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}