import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Mail, RefreshCw } from '@/components/icons'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'

interface EmailVerificationProps {
  email: string
  onBack?: () => void
}

export function EmailVerification({ email, onBack }: EmailVerificationProps) {
  const { t } = useTranslation()
  const { currentLanguage } = useLanguageRouter()
  const [isResending, setIsResending] = useState(false)
  const [lastSentTime, setLastSentTime] = useState<Date | null>(null)

  const handleResendEmail = async () => {
    // 检查是否在60秒内已发送过
    if (lastSentTime && Date.now() - lastSentTime.getTime() < 60000) {
      const remaining = 60 - Math.floor((Date.now() - lastSentTime.getTime()) / 1000)
      toast.error(t('emailVerification.resendWait', { seconds: remaining }))
      return
    }

    setIsResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/${currentLanguage}/auth/callback`
        }
      })

      if (error) {
        throw error
      }

      setLastSentTime(new Date())
      toast.success(t('emailVerification.resendSuccess'), {
        description: t('emailVerification.resendSuccessDescription'),
        duration: 5000
      })
    } catch (error: any) {
      console.error('Resend email error:', error)
      toast.error(t('emailVerification.resendError'), {
        description: error.message || t('emailVerification.resendErrorDescription'),
        duration: 5000
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>{t('emailVerification.title')}</CardTitle>
        <CardDescription>
          {t('emailVerification.description', { email: email })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="mb-2">{t('emailVerification.instructions')}</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>{t('emailVerification.step1')}</li>
            <li>{t('emailVerification.step2')}</li>
            <li>{t('emailVerification.step3')}</li>
            <li>{t('emailVerification.step4')}</li>
          </ol>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResendEmail}
            disabled={isResending}
          >
            {isResending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                {t('emailVerification.resendingButton')}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('emailVerification.resendButton')}
              </>
            )}
          </Button>

          {onBack && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={onBack}
            >
              {t('emailVerification.backToSignup')}
            </Button>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <p>{t('emailVerification.linkExpiry')}</p>
          <p className="mt-1">{t('emailVerification.noEmailContact')}</p>
        </div>
      </CardContent>
    </Card>
  )
}