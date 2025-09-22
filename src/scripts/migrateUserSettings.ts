/**
 * 用户设置迁移脚本
 * 用于将现有的本地存储设置迁移到数据库
 */

import { userSettingsService } from '@/services/userSettingsService'
import { supabase } from '@/lib/supabase'

interface MigrationResult {
  success: boolean
  message: string
  migratedUsers: number
  errors: string[]
}

/**
 * 执行用户设置迁移
 */
export async function migrateUserSettings(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    message: '',
    migratedUsers: 0,
    errors: []
  }

  try {
    console.log('🚀 开始用户设置迁移...')

    // 获取当前用户会话
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      result.errors.push('用户未登录，无法执行迁移')
      result.message = '迁移失败：用户未登录'
      return result
    }

    const userId = session.user.id
    console.log('📋 当前用户ID:', userId)

    // 检查本地存储中的设置
    const localSettings = getLocalStorageSettings()
    console.log('📦 检测到的本地设置:', localSettings)

    if (Object.keys(localSettings).length === 0) {
      result.success = true
      result.message = '没有检测到需要迁移的本地设置'
      return result
    }

    // 执行迁移
    console.log('🔄 开始迁移用户设置...')
    const migrationResult = await userSettingsService.migrateLocalSettings(userId)

    if (migrationResult.success) {
      result.success = true
      result.migratedUsers = 1
      result.message = '设置迁移成功'
      console.log('✅ 设置迁移完成')
      
      // 可选：备份本地设置后清理
      backupLocalSettings()
      
    } else {
      result.errors.push(migrationResult.error || '迁移失败')
      result.message = '设置迁移失败'
      console.error('❌ 设置迁移失败:', migrationResult.error)
    }

  } catch (error) {
    console.error('❌ 迁移过程中发生异常:', error)
    result.errors.push((error as Error).message)
    result.message = '迁移过程中发生异常'
  }

  return result
}

/**
 * 获取本地存储的设置
 */
function getLocalStorageSettings(): Record<string, any> {
  const settings: Record<string, any> = {}

  try {
    // 检查各种可能的设置键
    const settingsKeys = [
      'theme',
      'language', 
      'timezone',
      'dateFormat'
    ]

    for (const key of settingsKeys) {
      const value = localStorage.getItem(key)
      if (value && value !== 'null' && value !== 'undefined') {
        settings[key] = value
      }
    }

    return settings
  } catch (error) {
    console.warn('读取本地存储设置失败:', error)
    return {}
  }
}

/**
 * 备份本地设置到一个特殊的键
 */
function backupLocalSettings(): void {
  try {
    const localSettings = getLocalStorageSettings()
    if (Object.keys(localSettings).length > 0) {
      const backup = {
        settings: localSettings,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
      localStorage.setItem('user_settings_backup', JSON.stringify(backup))
      console.log('📦 本地设置已备份到 user_settings_backup')
    }
  } catch (error) {
    console.warn('备份本地设置失败:', error)
  }
}

/**
 * 批量迁移所有用户的设置（管理员功能）
 */
export async function batchMigrateAllUsers(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    message: '',
    migratedUsers: 0,
    errors: []
  }

  try {
    console.log('🚀 开始批量迁移所有用户设置...')

    // 获取所有用户
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, theme, timezone, date_format, language, notification_preferences')
      .limit(1000) // 分批处理

    if (error) {
      result.errors.push(`获取用户列表失败: ${error.message}`)
      result.message = '批量迁移失败：无法获取用户列表'
      return result
    }

    if (!users || users.length === 0) {
      result.success = true
      result.message = '没有找到需要迁移的用户'
      return result
    }

    console.log(`📋 找到 ${users.length} 个用户`)

    let migratedCount = 0
    const errors: string[] = []

    // 遍历用户进行迁移
    for (const user of users) {
      try {
        // 检查用户是否已有完整的设置
        const hasCompleteSettings = (
          user.theme && 
          user.timezone && 
          user.date_format && 
          user.language && 
          user.notification_preferences
        )

        if (hasCompleteSettings) {
          console.log(`⏭️ 用户 ${user.email} 已有完整设置，跳过`)
          continue
        }

        // 为没有完整设置的用户设置默认值
        const updates: any = {}
        
        if (!user.theme) updates.theme = 'system'
        if (!user.timezone) updates.timezone = 'UTC'
        if (!user.date_format) updates.date_format = 'MM/DD/YYYY'
        if (!user.language) updates.language = 'en'
        if (!user.notification_preferences) {
          updates.notification_preferences = {
            email_notifications: true,
            push_notifications: true,
            marketing_emails: false,
            video_completion: true,
            template_likes: true,
            referral_rewards: true
          }
        }

        if (Object.keys(updates).length > 0) {
          const updateResult = await userSettingsService.updateUserSettings(user.id, updates)
          
          if (updateResult.success) {
            migratedCount++
            console.log(`✅ 用户 ${user.email} 设置迁移成功`)
          } else {
            errors.push(`用户 ${user.email} 迁移失败: ${updateResult.error}`)
            console.error(`❌ 用户 ${user.email} 迁移失败:`, updateResult.error)
          }
        }

      } catch (userError) {
        const errorMsg = `用户 ${user.email} 迁移异常: ${(userError as Error).message}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    result.migratedUsers = migratedCount
    result.errors = errors
    result.success = errors.length === 0
    result.message = `批量迁移完成，成功迁移 ${migratedCount} 个用户${errors.length > 0 ? `，${errors.length} 个错误` : ''}`

    console.log(`🎉 批量迁移完成: ${migratedCount}/${users.length} 成功`)

  } catch (error) {
    console.error('❌ 批量迁移过程中发生异常:', error)
    result.errors.push((error as Error).message)
    result.message = '批量迁移过程中发生异常'
  }

  return result
}

/**
 * 验证迁移结果
 */
export async function validateMigration(userId: string): Promise<{
  valid: boolean
  message: string
  settings?: any
}> {
  try {
    console.log('🔍 验证迁移结果...')
    
    const result = await userSettingsService.getUserSettings(userId)
    
    if (!result.success || !result.data) {
      return {
        valid: false,
        message: '无法获取用户设置'
      }
    }

    const settings = result.data
    const requiredFields = ['theme', 'timezone', 'date_format', 'language', 'notification_preferences']
    const missingFields = requiredFields.filter(field => !settings[field as keyof typeof settings])

    if (missingFields.length > 0) {
      return {
        valid: false,
        message: `缺少必要字段: ${missingFields.join(', ')}`,
        settings
      }
    }

    return {
      valid: true,
      message: '迁移验证成功',
      settings
    }

  } catch (error) {
    return {
      valid: false,
      message: `验证过程中发生错误: ${(error as Error).message}`
    }
  }
}

// 如果直接运行此脚本
if (typeof window !== 'undefined' && window.location) {
  console.log('🔧 用户设置迁移脚本已加载')
  console.log('💡 使用方法:')
  console.log('  - migrateUserSettings(): 迁移当前用户设置')
  console.log('  - batchMigrateAllUsers(): 批量迁移所有用户设置（管理员）')
  console.log('  - validateMigration(userId): 验证迁移结果')
  
  // 暴露到全局作用域以便调试
  ;(window as any).userSettingsMigration = {
    migrateUserSettings,
    batchMigrateAllUsers,
    validateMigration
  }
}