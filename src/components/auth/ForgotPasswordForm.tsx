import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { Loader2, Mail, ArrowLeft, CheckCircle } from '@/components/icons'

export default function ForgotPasswordForm() {
  const { t } = useTranslation()
  const { resetPassword, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email) {
      setError(t('auth.emailRequired'))
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(t('auth.invalidEmail'))
      return
    }

    try {
      setIsSubmitting(true)
      await resetPassword(email)
      setIsSuccess(true)
    } catch (err: any) {
      console.error('Password reset error:', err)
      if (err.message?.includes('User not found')) {
        setError(t('auth.userNotFound'))
      } else if (err.message?.includes('rate limit')) {
        setError(t('auth.rateLimitError'))
      } else {
        setError(t('auth.resetPasswordError') + ': ' + err.message)
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
            {t('auth.checkYourEmail')}
          </CardTitle>
          <CardDescription className="text-center">
            {t('auth.resetPasswordEmailSent', { email })}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {t('auth.resetPasswordInstructions')}
            </p>
          </div>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setIsSuccess(false)
              setEmail('')
            }}
          >
            {t('auth.sendAnotherEmail')}
          </Button>
        </CardContent>

        <CardFooter>
          <Link
            to="/signin"
            className="flex items-center text-sm text-primary hover:underline mx-auto"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('auth.backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {t('auth.forgotPassword')}
        </CardTitle>
        <CardDescription className="text-center">
          {t('auth.forgotPasswordDescription')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
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
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || loading}
                className="pl-10"
                required
              />
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.sendingResetEmail')}
              </>
            ) : (
              t('auth.sendResetEmail')
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <Link
          to="/signin"
          className="flex items-center text-sm text-primary hover:underline mx-auto"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('auth.backToSignIn')}
        </Link>
      </CardFooter>
    </Card>
  )
}