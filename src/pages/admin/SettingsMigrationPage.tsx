/**
 * 设置迁移管理页面
 * 仅供管理员使用，用于执行和监控用户设置迁移
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Users,
  Settings,
  Database,
  Loader2
} from 'lucide-react'
import { migrateUserSettings, batchMigrateAllUsers, validateMigration } from '@/scripts/migrateUserSettings'
import { useAuth } from '@/contexts/AuthContext'

interface MigrationStatus {
  running: boolean
  completed: boolean
  success: boolean
  message: string
  migratedUsers: number
  errors: string[]
}

export default function SettingsMigrationPage() {
  const { user } = useAuth()
  const [currentUserMigration, setCurrentUserMigration] = useState<MigrationStatus>({
    running: false,
    completed: false,
    success: false,
    message: '',
    migratedUsers: 0,
    errors: []
  })
  
  const [batchMigration, setBatchMigration] = useState<MigrationStatus>({
    running: false,
    completed: false,
    success: false,
    message: '',
    migratedUsers: 0,
    errors: []
  })

  const [validationResult, setValidationResult] = useState<{
    completed: boolean
    valid: boolean
    message: string
    settings?: any
  }>({
    completed: false,
    valid: false,
    message: ''
  })

  // 执行当前用户迁移
  const handleCurrentUserMigration = async () => {
    if (!user) return
    
    setCurrentUserMigration({
      running: true,
      completed: false,
      success: false,
      message: '正在迁移当前用户设置...',
      migratedUsers: 0,
      errors: []
    })

    try {
      const result = await migrateUserSettings()
      
      setCurrentUserMigration({
        running: false,
        completed: true,
        success: result.success,
        message: result.message,
        migratedUsers: result.migratedUsers,
        errors: result.errors
      })

    } catch (error) {
      setCurrentUserMigration({
        running: false,
        completed: true,
        success: false,
        message: '迁移过程中发生异常',
        migratedUsers: 0,
        errors: [(error as Error).message]
      })
    }
  }

  // 执行批量迁移
  const handleBatchMigration = async () => {
    setBatchMigration({
      running: true,
      completed: false,
      success: false,
      message: '正在执行批量迁移...',
      migratedUsers: 0,
      errors: []
    })

    try {
      const result = await batchMigrateAllUsers()
      
      setBatchMigration({
        running: false,
        completed: true,
        success: result.success,
        message: result.message,
        migratedUsers: result.migratedUsers,
        errors: result.errors
      })

    } catch (error) {
      setBatchMigration({
        running: false,
        completed: true,
        success: false,
        message: '批量迁移过程中发生异常',
        migratedUsers: 0,
        errors: [(error as Error).message]
      })
    }
  }

  // 验证迁移结果
  const handleValidation = async () => {
    if (!user) return

    setValidationResult({
      completed: false,
      valid: false,
      message: '正在验证迁移结果...'
    })

    try {
      const result = await validateMigration(user.id)
      
      setValidationResult({
        completed: true,
        valid: result.valid,
        message: result.message,
        settings: result.settings
      })

    } catch (error) {
      setValidationResult({
        completed: true,
        valid: false,
        message: `验证过程中发生错误: ${(error as Error).message}`
      })
    }
  }

  const renderMigrationStatus = (status: MigrationStatus, title: string) => {
    if (!status.completed && !status.running) return null

    return (
      <Alert className={status.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <div className="flex items-center gap-2">
          {status.running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <div className="flex-1">
            <div className="font-medium">{title}</div>
            <AlertDescription className="mt-1">
              {status.message}
              {status.migratedUsers > 0 && (
                <div className="mt-2">
                  <Badge variant="secondary">
                    迁移用户数: {status.migratedUsers}
                  </Badge>
                </div>
              )}
              {status.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-sm font-medium text-red-600">错误详情:</div>
                  {status.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="text-xs text-red-600 pl-2 border-l-2 border-red-200">
                      {error}
                    </div>
                  ))}
                  {status.errors.length > 5 && (
                    <div className="text-xs text-red-600">
                      ... 还有 {status.errors.length - 5} 个错误
                    </div>
                  )}
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">用户设置迁移管理</h1>
        <p className="text-muted-foreground">
          管理和执行用户设置从本地存储到数据库的迁移
        </p>
      </div>

      <div className="space-y-6">
        {/* 当前用户迁移 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              当前用户设置迁移
            </CardTitle>
            <CardDescription>
              迁移当前登录用户的本地设置到数据库
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleCurrentUserMigration}
              disabled={currentUserMigration.running || !user}
              className="w-full"
            >
              {currentUserMigration.running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在迁移...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  开始迁移当前用户设置
                </>
              )}
            </Button>
            
            {renderMigrationStatus(currentUserMigration, '当前用户迁移结果')}
          </CardContent>
        </Card>

        {/* 批量迁移 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              批量用户设置迁移
            </CardTitle>
            <CardDescription>
              批量迁移所有用户的设置，为缺失字段设置默认值
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>警告:</strong> 此操作将影响所有用户，请谨慎使用。建议先在测试环境验证。
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={handleBatchMigration}
              disabled={batchMigration.running}
              variant="destructive"
              className="w-full"
            >
              {batchMigration.running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在批量迁移...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  开始批量迁移所有用户
                </>
              )}
            </Button>
            
            {renderMigrationStatus(batchMigration, '批量迁移结果')}
          </CardContent>
        </Card>

        {/* 迁移验证 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              迁移结果验证
            </CardTitle>
            <CardDescription>
              验证当前用户的设置迁移是否成功
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleValidation}
              disabled={!user}
              variant="outline"
              className="w-full"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              验证迁移结果
            </Button>
            
            {validationResult.completed && (
              <Alert className={validationResult.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {validationResult.valid ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">验证结果</div>
                    <AlertDescription className="mt-1">
                      {validationResult.message}
                      {validationResult.settings && (
                        <details className="mt-2">
                          <summary className="text-sm font-medium cursor-pointer">
                            查看设置详情
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                            {JSON.stringify(validationResult.settings, null, 2)}
                          </pre>
                        </details>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>当前用户迁移:</strong> 将当前登录用户的本地存储设置迁移到数据库。</p>
            <p><strong>批量迁移:</strong> 为所有用户的缺失设置字段补充默认值。</p>
            <p><strong>验证:</strong> 检查当前用户的设置是否完整且格式正确。</p>
            <p><strong>注意:</strong> 本地设置会备份到 localStorage 的 user_settings_backup 键中。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}