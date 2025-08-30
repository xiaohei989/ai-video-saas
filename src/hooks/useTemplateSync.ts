/**
 * Template Sync Hook
 * 在应用启动时自动同步模板数据
 */

import { useEffect, useState } from 'react'
import { syncTemplatesToDatabase, checkTemplateSync, type SyncResult } from '@/utils/syncTemplates'

export interface TemplateSyncStatus {
  isChecking: boolean
  isSyncing: boolean
  needsSync: boolean
  lastSync?: Date
  error?: string
  result?: SyncResult
}

export function useTemplateSync(options?: {
  autoSync?: boolean  // 是否自动同步
  checkOnMount?: boolean  // 是否在挂载时检查
}) {
  const { autoSync = true, checkOnMount = true } = options || {}
  
  const [status, setStatus] = useState<TemplateSyncStatus>({
    isChecking: false,
    isSyncing: false,
    needsSync: false
  })

  // 检查是否需要同步
  const checkSync = async () => {
    setStatus(prev => ({ ...prev, isChecking: true, error: undefined }))
    
    try {
      const syncStatus = await checkTemplateSync()
      
      setStatus(prev => ({
        ...prev,
        isChecking: false,
        needsSync: syncStatus.needsSync
      }))

      // 如果需要同步且开启了自动同步
      if (syncStatus.needsSync && autoSync) {
        await performSync()
      }

      return syncStatus
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '检查同步状态失败'
      setStatus(prev => ({
        ...prev,
        isChecking: false,
        error: errorMessage
      }))
      throw error
    }
  }

  // 执行同步
  const performSync = async () => {
    setStatus(prev => ({ ...prev, isSyncing: true, error: undefined }))

    try {
      const result = await syncTemplatesToDatabase()
      
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        needsSync: false,
        lastSync: new Date(),
        result,
        error: result.success ? undefined : '部分同步失败'
      }))

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '同步失败'
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: errorMessage
      }))
      throw error
    }
  }

  // 手动同步
  const manualSync = async () => {
    return await performSync()
  }

  // 重新检查
  const recheck = async () => {
    return await checkSync()
  }

  // 在组件挂载时检查
  useEffect(() => {
    if (checkOnMount) {
      checkSync().catch(console.error)
    }
  }, [checkOnMount, autoSync])

  return {
    status,
    checkSync,
    manualSync,
    recheck,
    // 便捷状态
    isLoading: status.isChecking || status.isSyncing,
    hasError: !!status.error,
    needsSync: status.needsSync
  }
}