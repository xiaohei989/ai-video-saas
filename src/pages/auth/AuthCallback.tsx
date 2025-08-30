import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 获取URL中的code参数
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          throw error
        }

        if (session) {
          // 登录成功，跳转到模板页面或之前的页面
          const redirectTo = localStorage.getItem('redirectAfterLogin') || '/templates'
          localStorage.removeItem('redirectAfterLogin')
          navigate(redirectTo)
        } else {
          // 如果没有session，可能是code无效或过期
          throw new Error('无法建立会话，请重新登录')
        }
      } catch (err: any) {
        console.error('Auth callback error:', err)
        setError(err.message || '登录过程中出现错误')
        
        // 3秒后跳转到登录页面
        setTimeout(() => {
          navigate('/signin')
        }, 3000)
      }
    }

    handleCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full space-y-4 p-6">
          <Alert variant="destructive">
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <p className="text-center text-sm text-muted-foreground">
            即将跳转到登录页面...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <h2 className="text-lg font-semibold">正在完成登录...</h2>
        <p className="text-sm text-muted-foreground">
          请稍候，正在验证您的登录信息
        </p>
      </div>
    </div>
  )
}