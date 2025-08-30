import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { getAdminStats } from '@/services/adminDataProvider'

const AdminDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const runDebugCheck = async () => {
    setTesting(true)
    const info: any = {}

    try {
      // 1. 检查当前会话
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      info.session = {
        exists: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        accessToken: session?.access_token ? 'exists' : 'missing',
        error: sessionError?.message
      }

      // 2. 检查用户权限
      if (session) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, is_banned, full_name')
          .eq('id', session.user.id)
          .single()

        info.profile = {
          role: profile?.role,
          is_banned: profile?.is_banned,
          full_name: profile?.full_name,
          error: profileError?.message
        }
      }

      // 3. 检查localStorage
      const adminUser = localStorage.getItem('admin_user')
      info.localStorage = {
        exists: !!adminUser,
        data: adminUser ? JSON.parse(adminUser) : null
      }

      // 4. 测试API调用
      try {
        await getAdminStats('day')
        info.apiTest = { success: true }
      } catch (error: any) {
        info.apiTest = { 
          success: false, 
          error: error.message 
        }
      }

      // 5. 测试模板API调用
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-templates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'list',
            pagination: { page: 1, pageSize: 5 }
          })
        })
        
        const result = await response.json()
        info.templatesApiTest = {
          success: response.ok,
          status: response.status,
          result: result
        }
      } catch (error: any) {
        info.templatesApiTest = {
          success: false,
          error: error.message
        }
      }

      // 5. 检查环境变量
      info.environment = {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? 'exists' : 'missing',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'exists' : 'missing'
      }

      setDebugInfo(info)
    } catch (error: any) {
      setDebugInfo({ error: error.message })
    } finally {
      setTesting(false)
    }
  }

  const refreshAdminAuth = async () => {
    try {
      // 清除现有数据
      localStorage.removeItem('admin_user')
      
      // 重新获取session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url, is_banned')
          .eq('id', session.user.id)
          .single()

        if (profile && ['admin', 'super_admin'].includes(profile.role) && !profile.is_banned) {
          const adminUser = {
            id: session.user.id,
            email: session.user.email || '',
            role: profile.role,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url
          }
          localStorage.setItem('admin_user', JSON.stringify(adminUser))
          alert('管理员认证已刷新')
          window.location.reload()
        } else {
          alert('当前用户没有管理员权限')
        }
      }
    } catch (error: any) {
      alert(`刷新失败: ${error.message}`)
    }
  }

  useEffect(() => {
    runDebugCheck()
  }, [])

  return (
    <Card className="m-6">
      <CardHeader>
        <CardTitle>管理员系统调试信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={runDebugCheck} disabled={testing}>
            {testing ? '检查中...' : '重新检查'}
          </Button>
          <Button onClick={refreshAdminAuth} variant="outline">
            刷新管理员认证
          </Button>
        </div>

        {debugInfo && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">会话状态</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.session, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">用户权限</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.profile, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">本地存储</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.localStorage, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">API测试</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.apiTest, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">模板API测试</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.templatesApiTest, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">环境变量</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.environment, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AdminDebug