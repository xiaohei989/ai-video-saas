/**
 * 用户设置服务
 * 负责管理用户的偏好设置，包括主题、语言、时区等
 */

import { supabase } from '@/lib/supabase'

// 用户设置接口定义
export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  timezone: string
  date_format: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  language: string
  notification_preferences: {
    email_notifications: boolean
    push_notifications: boolean
    marketing_emails: boolean
    video_completion: boolean
    template_likes: boolean
    referral_rewards: boolean
  }
}

// 用户设置更新接口
export interface UserSettingsUpdate {
  theme?: 'light' | 'dark' | 'system'
  timezone?: string
  date_format?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  language?: string
  notification_preferences?: Partial<UserSettings['notification_preferences']>
}

// 操作结果接口
export interface SettingsOperationResult {
  success: boolean
  message: string
  data?: UserSettings
  error?: string
}

class UserSettingsService {
  /**
   * 获取用户设置
   */
  async getUserSettings(userId: string): Promise<SettingsOperationResult> {
    try {
      
      const { data, error } = await supabase
        .from('profiles')
        .select('theme, timezone, date_format, language, notification_preferences')
        .eq('id', userId)
        .single()

      if (error) {
        return {
          success: false,
          message: '获取用户设置失败',
          error: error.message
        }
      }

      if (!data) {
        return {
          success: true,
          message: '使用默认设置',
          data: this.getDefaultSettings()
        }
      }

      const settings: UserSettings = {
        theme: data.theme || 'system',
        timezone: data.timezone || 'UTC',
        date_format: data.date_format || 'MM/DD/YYYY',
        language: data.language || 'en',
        notification_preferences: data.notification_preferences || this.getDefaultNotificationPreferences()
      }

      return {
        success: true,
        message: '获取设置成功',
        data: settings
      }

    } catch (error) {
      return {
        success: false,
        message: '获取设置时发生异常',
        error: (error as Error).message,
        data: this.getDefaultSettings() // 提供默认设置作为后备
      }
    }
  }

  /**
   * 更新用户设置
   */
  async updateUserSettings(userId: string, updates: UserSettingsUpdate): Promise<SettingsOperationResult> {
    try {

      // 如果有通知偏好更新，需要合并现有设置
      let notificationPreferences = updates.notification_preferences
      if (notificationPreferences) {
        const currentSettings = await this.getUserSettings(userId)
        if (currentSettings.success && currentSettings.data) {
          notificationPreferences = {
            ...currentSettings.data.notification_preferences,
            ...updates.notification_preferences
          }
        }
      }

      const updateData: any = {}
      if (updates.theme) updateData.theme = updates.theme
      if (updates.timezone) updateData.timezone = updates.timezone
      if (updates.date_format) updateData.date_format = updates.date_format
      if (updates.language) updateData.language = updates.language
      if (notificationPreferences) updateData.notification_preferences = notificationPreferences

      // 添加更新时间戳
      updateData.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select('theme, timezone, date_format, language, notification_preferences')
        .single()

      if (error) {
        return {
          success: false,
          message: '更新用户设置失败',
          error: error.message
        }
      }

      const updatedSettings: UserSettings = {
        theme: data.theme || 'system',
        timezone: data.timezone || 'UTC',
        date_format: data.date_format || 'MM/DD/YYYY',
        language: data.language || 'en',
        notification_preferences: data.notification_preferences || this.getDefaultNotificationPreferences()
      }

      return {
        success: true,
        message: '设置更新成功',
        data: updatedSettings
      }

    } catch (error) {
      return {
        success: false,
        message: '更新设置时发生异常',
        error: (error as Error).message
      }
    }
  }

  /**
   * 从本地存储迁移设置到数据库
   */
  async migrateLocalSettings(userId: string): Promise<SettingsOperationResult> {
    try {

      // 检查是否已经迁移过
      const existingSettings = await this.getUserSettings(userId)
      if (existingSettings.success && existingSettings.data) {
        // 检查是否是默认设置，如果不是则说明已经有数据库设置
        const isDefaultSettings = this.isDefaultSettings(existingSettings.data)
        if (!isDefaultSettings) {
          return existingSettings
        }
      }

      // 读取本地存储的设置
      const localTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
      const localLanguage = localStorage.getItem('language') || null
      const localTimezone = localStorage.getItem('timezone') || null
      const localDateFormat = localStorage.getItem('dateFormat') as 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | null

      // 构建要更新的设置
      const updates: UserSettingsUpdate = {}
      if (localTheme && ['light', 'dark', 'system'].includes(localTheme)) {
        updates.theme = localTheme
      }
      if (localLanguage) {
        updates.language = localLanguage
      }
      if (localTimezone) {
        updates.timezone = localTimezone
      }
      if (localDateFormat && ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(localDateFormat)) {
        updates.date_format = localDateFormat
      }

      // 如果没有任何本地设置需要迁移
      if (Object.keys(updates).length === 0) {
        return {
          success: true,
          message: '没有本地设置需要迁移',
          data: this.getDefaultSettings()
        }
      }

      // 执行迁移
      const result = await this.updateUserSettings(userId, updates)
      
      if (result.success) {
        // 可选：清理本地存储（但保留作为备份）
        // localStorage.removeItem('theme')
        // localStorage.removeItem('language')
        // localStorage.removeItem('timezone')
        // localStorage.removeItem('dateFormat')
      }

      return result

    } catch (error) {
      return {
        success: false,
        message: '迁移本地设置时发生异常',
        error: (error as Error).message
      }
    }
  }

  /**
   * 同步设置到本地存储（作为备份）
   */
  syncToLocalStorage(settings: UserSettings): void {
    try {
      localStorage.setItem('theme', settings.theme)
      localStorage.setItem('language', settings.language)
      localStorage.setItem('timezone', settings.timezone)
      localStorage.setItem('dateFormat', settings.date_format)
    } catch (error) {
    }
  }

  /**
   * 获取默认设置
   */
  private getDefaultSettings(): UserSettings {
    return {
      theme: 'system',
      timezone: 'UTC',
      date_format: 'MM/DD/YYYY',
      language: 'en',
      notification_preferences: this.getDefaultNotificationPreferences()
    }
  }

  /**
   * 获取默认通知偏好
   */
  private getDefaultNotificationPreferences(): UserSettings['notification_preferences'] {
    return {
      email_notifications: true,
      push_notifications: true,
      marketing_emails: false,
      video_completion: true,
      template_likes: true,
      referral_rewards: true
    }
  }

  /**
   * 检查是否为默认设置
   */
  private isDefaultSettings(settings: UserSettings): boolean {
    const defaultSettings = this.getDefaultSettings()
    return (
      settings.theme === defaultSettings.theme &&
      settings.timezone === defaultSettings.timezone &&
      settings.date_format === defaultSettings.date_format &&
      settings.language === defaultSettings.language
    )
  }

  /**
   * 验证设置数据
   */
  validateSettings(settings: Partial<UserSettings>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (settings.theme && !['light', 'dark', 'system'].includes(settings.theme)) {
      errors.push('无效的主题设置')
    }

    if (settings.date_format && !['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(settings.date_format)) {
      errors.push('无效的日期格式设置')
    }

    if (settings.language && !/^[a-z]{2}(-[A-Z]{2})?$/.test(settings.language)) {
      errors.push('无效的语言代码')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 批量更新设置（原子操作）
   */
  async batchUpdateSettings(userId: string, settingsUpdates: UserSettingsUpdate[]): Promise<SettingsOperationResult> {
    try {
      // 合并所有更新
      const mergedUpdates: UserSettingsUpdate = {}
      for (const update of settingsUpdates) {
        Object.assign(mergedUpdates, update)
      }

      return await this.updateUserSettings(userId, mergedUpdates)

    } catch (error) {
      return {
        success: false,
        message: '批量更新设置时发生异常',
        error: (error as Error).message
      }
    }
  }
}

// 导出单例实例
export const userSettingsService = new UserSettingsService()
export default userSettingsService