import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { getAdminStats } from '@/services/adminDataProvider'
import { useCacheManager } from '@/utils/cacheManager'
import { Trash2, RefreshCcw, HardDrive, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

const AdminDebug: React.FC = () => {
  const { t } = useTranslation()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [cacheStats, setCacheStats] = useState<any>(null)
  
  // 缓存管理hook
  const {
    isClearing,
    lastClearResult,
    clearAllCache,
    getCacheStats,
    forceRefresh,
    resetVideoLoaders
  } = useCacheManager()

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
          toast.success(t('admin.authRefreshed'))
          window.location.reload()
        } else {
          toast.error(t('admin.noPermission'))
        }
      }
    } catch (error: any) {
      toast.error(`${t('admin.refreshFailed')}: ${error.message}`)
    }
  }

  // 加载缓存统计
  const loadCacheStats = async () => {
    try {
      const stats = await getCacheStats()
      setCacheStats(stats)
    } catch (error) {
      console.error('获取缓存统计失败:', error)
    }
  }

  // 处理清除所有缓存
  const handleClearAllCache = async () => {
    if (confirm(t('admin.clearCacheConfirm'))) {
      await clearAllCache()
      await loadCacheStats()
    }
  }

  useEffect(() => {
    runDebugCheck()
    loadCacheStats()
  }, [])

  return (
    <Card className="m-6">
      <CardHeader>
        <CardTitle>{t('admin.debugInfo')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={runDebugCheck} disabled={testing}>
            {testing ? t('admin.checking') : t('admin.recheck')}
          </Button>
          <Button onClick={refreshAdminAuth} variant="outline">
            {t('admin.refreshAuth')}
          </Button>
          <Button onClick={loadCacheStats} variant="outline">
            <HardDrive className="w-4 h-4 mr-2" />
            {t('admin.refreshCacheStats')}
          </Button>
        </div>

        {debugInfo && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">{t('admin.sessionStatus')}</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.session, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">{t('admin.userPermissions')}</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.profile, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">{t('admin.localStorage')}</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded">
                {JSON.stringify(debugInfo.localStorage, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">{t('admin.apiTest')}</h4>
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

        {/* 缓存管理面板 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              缓存管理
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 缓存操作按钮 */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={handleClearAllCache} 
                disabled={isClearing}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isClearing ? '清除中...' : '清除所有视频缓存'}
              </Button>
              <Button 
                onClick={resetVideoLoaders} 
                variant="outline"
                size="sm"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                重置视频加载器
              </Button>
              <Button 
                onClick={forceRefresh} 
                variant="outline"
                size="sm"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                强制刷新页面
              </Button>
              <Button 
                onClick={loadCacheStats} 
                variant="outline"
                size="sm"
              >
                <HardDrive className="w-4 h-4 mr-2" />
                刷新统计
              </Button>
            </div>

            {/* 缓存统计显示 */}
            {cacheStats && (
              <div className="space-y-3">
                <h4 className="font-medium">缓存使用情况</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="font-medium text-blue-800 mb-1">视频加载器</div>
                    <div>正在加载: {cacheStats.videoLoader.loadingVideos}</div>
                    <div>队列中: {cacheStats.videoLoader.preloadQueue}</div>
                  </div>
                  
                  <div className="bg-green-50 p-3 rounded">
                    <div className="font-medium text-green-800 mb-1">缩略图缓存</div>
                    <div>内存项: {cacheStats.thumbnailCache.memoryItems}</div>
                    <div>数据库项: {cacheStats.thumbnailCache.dbItems}</div>
                    <div>大小: {cacheStats.thumbnailCache.totalSize}</div>
                  </div>
                  
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="font-medium text-purple-800 mb-1">本地存储</div>
                    <div>项目: {cacheStats.localStorage.items}</div>
                    <div>大小: {cacheStats.localStorage.totalSize}</div>
                  </div>
                  
                  <div className="bg-orange-50 p-3 rounded">
                    <div className="font-medium text-orange-800 mb-1">会话存储</div>
                    <div>项目: {cacheStats.sessionStorage.items}</div>
                    <div>大小: {cacheStats.sessionStorage.totalSize}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 清除结果显示 */}
            {lastClearResult && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 p-3 rounded ${
                  lastClearResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {lastClearResult.success ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">
                    {lastClearResult.success ? '缓存清除成功' : '缓存清除失败'}
                  </span>
                </div>
                
                {lastClearResult.clearedItems.length > 0 && (
                  <div className="text-xs">
                    <div className="font-medium mb-1">已清除:</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {lastClearResult.clearedItems.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {lastClearResult.errors.length > 0 && (
                  <div className="text-xs text-red-600">
                    <div className="font-medium mb-1">错误:</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {lastClearResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}

export default AdminDebug