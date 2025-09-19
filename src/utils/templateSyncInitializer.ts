/**
 * Template Sync Initializer
 * 应用启动时自动同步模板到数据库
 */

import { templateSyncService } from '@/services/templateSyncService'

// 同步标志，防止重复同步
let syncInitialized = false
let syncPromise: Promise<any> | null = null

/**
 * 初始化模板同步
 * 在应用启动时自动执行，确保数据库与JSON文件同步
 */
export const initializeTemplateSync = async (options: {
  skipInProduction?: boolean
  forceSync?: boolean
  silent?: boolean
} = {}): Promise<void> => {
  const {
    skipInProduction = false,
    forceSync = false,
    silent = false
  } = options

  // 防止重复初始化
  if (syncInitialized && !forceSync) {
    if (!silent) {
      console.log('[TemplateSyncInit] 模板同步已初始化，跳过')
    }
    return syncPromise || Promise.resolve()
  }

  // 生产环境跳过（可选）
  if (skipInProduction && import.meta.env.PROD) {
    if (!silent) {
      console.log('[TemplateSyncInit] 生产环境跳过模板同步')
    }
    return
  }

  syncInitialized = true

  if (!silent) {
    console.log('[TemplateSyncInit] 🚀 开始初始化模板同步...')
  }

  syncPromise = performInitialSync(silent)
  return syncPromise
}

/**
 * 执行初始同步
 */
async function performInitialSync(silent: boolean): Promise<void> {
  try {
    // 获取同步状态
    const status = await templateSyncService.getSyncStatus()
    
    if (!silent) {
      console.log('[TemplateSyncInit] 📊 同步状态检查:')
      console.log(`  JSON模板数: ${status.jsonTemplateCount}`)
      console.log(`  数据库模板数: ${status.dbTemplateCount}`)
      console.log(`  需要创建: ${status.missingInDb.length}`)
      console.log(`  需要更新: ${status.needsUpdate.length}`)
      console.log(`  数据库多余: ${status.extraInDb.length}`)
    }

    // 如果没有需要同步的内容，直接退出
    if (status.missingInDb.length === 0 && status.needsUpdate.length === 0) {
      if (!silent) {
        console.log('[TemplateSyncInit] ✅ 模板已是最新状态，无需同步')
      }
      return
    }

    // 执行同步
    if (!silent) {
      console.log('[TemplateSyncInit] 🔄 开始同步模板...')
    }

    const result = await templateSyncService.syncAllTemplates({
      dryRun: false,
      batchSize: 10,
      cleanupOrphaned: false // 启动时不清理孤立模板，避免意外删除
    })

    if (result.success) {
      if (!silent) {
        console.log('[TemplateSyncInit] ✅ 模板同步完成!')
        console.log(`  创建: ${result.created}`)
        console.log(`  更新: ${result.updated}`)
        console.log(`  跳过: ${result.skipped}`)
      }
    } else {
      console.error('[TemplateSyncInit] ❌ 模板同步失败:', result.errors)
      
      // 同步失败时，记录错误但不阻塞应用启动
      if (result.errors.length > 0) {
        console.error('[TemplateSyncInit] 错误详情:', result.errors.slice(0, 5)) // 只显示前5个错误
      }
    }

  } catch (error) {
    console.error('[TemplateSyncInit] ❌ 初始化同步异常:', error)
    
    // 初始化失败不应该阻塞应用启动
    // 只记录错误，让应用继续运行
  }
}

/**
 * 重置同步状态（用于测试或强制重新同步）
 */
export const resetSyncState = (): void => {
  syncInitialized = false
  syncPromise = null
  console.log('[TemplateSyncInit] 🔄 同步状态已重置')
}

/**
 * 检查是否已初始化
 */
export const isSyncInitialized = (): boolean => {
  return syncInitialized
}

/**
 * 获取同步Promise（用于等待同步完成）
 */
export const getSyncPromise = (): Promise<any> | null => {
  return syncPromise
}

/**
 * 手动触发同步（用于管理界面或调试）
 */
export const manualSync = async (options: {
  dryRun?: boolean
  force?: boolean
} = {}): Promise<any> => {
  const { dryRun = false, force = false } = options

  console.log(`[TemplateSyncInit] 🔧 手动触发同步 (${dryRun ? '预览模式' : '执行模式'})`)

  try {
    if (force) {
      resetSyncState()
    }

    const result = await templateSyncService.syncAllTemplates({
      dryRun,
      batchSize: 20,
      cleanupOrphaned: true // 手动同步时可以清理孤立模板
    })

    console.log('[TemplateSyncInit] 📊 手动同步结果:', {
      success: result.success,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length
    })

    return result
  } catch (error) {
    console.error('[TemplateSyncInit] ❌ 手动同步失败:', error)
    throw error
  }
}

// 开发环境下暴露到全局对象，方便调试
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).templateSyncDebug = {
    init: initializeTemplateSync,
    reset: resetSyncState,
    manual: manualSync,
    status: () => templateSyncService.getSyncStatus(),
    service: templateSyncService
  }
  
  console.log('[TemplateSyncInit] 🛠️ 调试工具已加载到 window.templateSyncDebug')
}