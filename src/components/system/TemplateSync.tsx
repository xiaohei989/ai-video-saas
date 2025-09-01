/**
 * Template Sync Component
 * 在应用启动时自动同步模板数据，带智能缓存
 */

import { useEffect } from 'react'
import { useTemplateSync } from '@/hooks/useTemplateSync'
import { useAuthState } from '@/hooks/useAuthState'

const CACHE_KEY = 'template_sync_cache'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24小时缓存

interface SyncCache {
  lastSync: string
  templateCount: number
  version: string
}

export function TemplateSync() {
  const { user } = useAuthState()
  const { status, checkSync } = useTemplateSync({
    autoSync: true,
    checkOnMount: false // 手动控制检查时机
  })

  // 检查缓存是否有效
  const isCacheValid = (): boolean => {
    try {
      const cacheData = localStorage.getItem(CACHE_KEY)
      if (!cacheData) return false

      const cache: SyncCache = JSON.parse(cacheData)
      const lastSync = new Date(cache.lastSync).getTime()
      const now = Date.now()
      
      // 开发环境跳过缓存，生产环境使用24小时缓存
      if (process.env.NODE_ENV === 'development') {
        // 开发环境完全禁用缓存，强制重新同步以测试点赞功能
        return false
      }

      return (now - lastSync) < CACHE_DURATION
    } catch {
      return false
    }
  }

  // 更新缓存
  const updateCache = (templateCount: number) => {
    const cache: SyncCache = {
      lastSync: new Date().toISOString(),
      templateCount,
      version: '1.0.0'
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  }

  // 在用户认证状态确定后才开始同步
  useEffect(() => {
    // 检查缓存，如果缓存有效则跳过同步
    if (isCacheValid()) {
      console.log('🔄 模板同步缓存有效，跳过同步')
      return
    }

    // 防止无限循环的标志
    let hasRun = false

    // 无论是否登录都需要同步模板，因为点赞功能依赖数据库中的模板记录
    const timer = setTimeout(async () => {
      if (hasRun) return // 防止重复执行
      hasRun = true

      try {
        const result = await checkSync()
        // 如果同步成功，更新缓存
        if (result && !result.needsSync) {
          updateCache(result.totalDbTemplates)
        }
      } catch (error) {
        console.error('模板同步失败:', error)
      }
    }, 1000) // 延迟1秒执行，确保其他初始化完成

    return () => {
      clearTimeout(timer)
      hasRun = true // 组件卸载时标记已运行
    }
  }, []) // 移除 checkSync 依赖，避免无限循环

  // 在开发环境中显示同步状态
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (status.isChecking) {
      }
      if (status.isSyncing) {
        console.log('🔄 正在同步模板到数据库...')
      }
      if (status.result) {
        console.log(`✅ 模板同步完成: 新增${status.result.synced}个, 更新${status.result.updated}个`)
        if (status.result.details) {
          if (status.result.details.newTemplates.length > 0) {
            console.log('📝 新增模板:', status.result.details.newTemplates)
          }
          if (status.result.details.updatedTemplates.length > 0) {
            console.log('🔄 更新模板:', status.result.details.updatedTemplates)
          }
        }
        if (status.result.errors.length > 0) {
          console.warn('⚠️ 同步警告:', status.result.errors)
        }
      }
      if (status.error) {
        console.error('❌ 模板同步错误:', status.error)
      }
    }
  }, [status])

  // 这个组件不渲染任何UI
  return null
}

export default TemplateSync