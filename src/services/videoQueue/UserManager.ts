/**
 * 用户管理服务
 * 负责用户订阅等级、权限验证和语言设置
 */

import { supabase } from '@/lib/supabase'
import redisCacheIntegrationService from '../RedisCacheIntegrationService'
import type { SubscriptionTier, UserSubmitStatus } from './types'
import { mapAnnualToBaseTier } from './types'
import type { QueueConfig } from './config'

export class UserManager {
  constructor(private config: QueueConfig) {}

  /**
   * 获取用户的订阅等级（优先使用缓存）
   */
  async getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
    try {
      // 优先使用Redis缓存集成服务
      return await redisCacheIntegrationService.getUserSubscription(userId)
    } catch (error) {
      console.error('[USER MANAGER] Error getting user subscription from cache, falling back to direct DB query:', error)

      // 回退到直接数据库查询
      try {
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('tier')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        if (error) {
          if (error.code === '42P01' || error.code === '42703' ||
              error.message?.includes('does not exist') ||
              error.message?.includes('relation')) {
            console.log('[USER MANAGER] Subscriptions table not available, defaulting to free tier')
            return 'free'
          }
          console.warn('[USER MANAGER] Error getting user subscription:', error)
          return 'free'
        }

        return (subscription?.tier as SubscriptionTier) || 'free'
      } catch (dbError) {
        console.error('[USER MANAGER] Database fallback also failed:', dbError)
        return 'free'
      }
    }
  }

  /**
   * 获取用户的并发限制
   */
  async getUserConcurrentLimit(userId: string): Promise<number> {
    const tier = await this.getUserSubscriptionTier(userId)
    const baseTier = mapAnnualToBaseTier(tier)
    return this.config.getUserLimit(baseTier)
  }

  /**
   * 检查用户是否可以提交新任务（需要外部提供活跃任务数）
   */
  async canUserSubmit(userId: string, currentActiveCount: number): Promise<UserSubmitStatus> {
    const userMaxAllowed = await this.getUserConcurrentLimit(userId)
    const tier = await this.getUserSubscriptionTier(userId)

    if (currentActiveCount >= userMaxAllowed) {
      let reason = ''
      const baseTier = mapAnnualToBaseTier(tier)

      // 添加调试信息
      console.warn(`[USER MANAGER] 🚫 并发限制检查失败:`, {
        userId,
        tier: tier,
        baseTier: baseTier,
        activeCount: currentActiveCount,
        maxAllowed: userMaxAllowed,
        timestamp: new Date().toISOString()
      })

      if (baseTier === 'free') {
        reason = `您已达到免费用户限制（${currentActiveCount}/${userMaxAllowed}个并发视频）。升级订阅可同时生成更多视频！`
      } else if (baseTier === 'basic') {
        reason = `您已达到基础订阅限制（${currentActiveCount}/${userMaxAllowed}个并发视频）。升级到专业版可同时生成5个视频！`
      } else if (baseTier === 'pro') {
        reason = `您已达到专业订阅限制（${currentActiveCount}/${userMaxAllowed}个并发视频）。升级到高级版可同时生成10个视频！`
      } else {
        reason = `您已达到并发限制（${currentActiveCount}/${userMaxAllowed}个视频），请等待当前视频完成`
      }

      return {
        canSubmit: false,
        reason,
        activeCount: currentActiveCount,
        maxAllowed: userMaxAllowed,
        tier
      }
    }

    // 成功情况下也记录一些有用信息（但级别较低）
    console.log(`[USER MANAGER] ✅ 用户并发检查通过:`, {
      userId,
      tier,
      activeCount: currentActiveCount,
      maxAllowed: userMaxAllowed,
      available: userMaxAllowed - currentActiveCount
    })

    return {
      canSubmit: true,
      activeCount: currentActiveCount,
      maxAllowed: userMaxAllowed,
      tier
    }
  }

  /**
   * 获取用户语言设置
   */
  async getUserLanguage(userId: string): Promise<string> {
    try {
      // 优先使用界面当前语言
      const i18n = (await import('@/i18n/config')).default
      const currentUILanguage = i18n.language || 'zh-CN'

      console.log(`[USER MANAGER] 界面当前语言: ${currentUILanguage}`)

      // 尝试获取数据库中的用户语言设置
      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', userId)
        .single()

      // 优先使用界面当前语言，这样用户切换语言后立即生效
      const dbLanguage = profile?.language
      const finalLanguage = currentUILanguage

      console.log(`[USER MANAGER] 数据库语言: ${dbLanguage || 'null'}, 界面语言: ${currentUILanguage}, 最终语言: ${finalLanguage}`)

      // 如果数据库语言与界面语言不一致，更新数据库以保持同步
      if (dbLanguage !== currentUILanguage) {
        try {
          await supabase
            .from('profiles')
            .update({ language: currentUILanguage })
            .eq('id', userId)
          console.log(`[USER MANAGER] 已将数据库语言更新为: ${currentUILanguage}`)
        } catch (updateError) {
          console.warn(`[USER MANAGER] 更新数据库语言失败: ${updateError}`)
        }
      }

      return finalLanguage
    } catch (error) {
      console.warn(`[USER MANAGER] 获取用户语言失败，使用默认中文: ${error}`)
      return 'zh-CN'
    }
  }

  /**
   * 清理用户订阅缓存
   */
  async clearUserSubscriptionCache(userId: string): Promise<void> {
    try {
      await redisCacheIntegrationService.clearUserSubscriptionCache(userId)
      console.log(`[USER MANAGER] ✅ 清理用户缓存: ${userId}`)
    } catch (cacheError) {
      console.warn(`[USER MANAGER] 清理缓存失败:`, cacheError)
    }
  }

  /**
   * 获取用户信息概览（用于调试）
   */
  async getUserInfo(userId: string): Promise<{
    tier: SubscriptionTier
    baseTier: SubscriptionTier
    concurrentLimit: number
    language: string
  }> {
    const tier = await this.getUserSubscriptionTier(userId)
    const baseTier = mapAnnualToBaseTier(tier)
    const concurrentLimit = this.config.getUserLimit(baseTier)
    const language = await this.getUserLanguage(userId)

    return {
      tier,
      baseTier,
      concurrentLimit,
      language
    }
  }

  /**
   * 批量获取多个用户的订阅等级
   */
  async getBatchUserSubscriptionTiers(userIds: string[]): Promise<Map<string, SubscriptionTier>> {
    const results = new Map<string, SubscriptionTier>()

    // 并行获取所有用户的订阅等级
    const promises = userIds.map(async (userId) => {
      try {
        const tier = await this.getUserSubscriptionTier(userId)
        results.set(userId, tier)
      } catch (error) {
        console.error(`[USER MANAGER] Failed to get subscription for user ${userId}:`, error)
        results.set(userId, 'free')
      }
    })

    await Promise.all(promises)
    return results
  }

  /**
   * 验证用户是否存在
   */
  async validateUser(userId: string): Promise<boolean> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn(`[USER MANAGER] User validation failed for ${userId}:`, error)
        return false
      }

      return !!profile
    } catch (error) {
      console.error(`[USER MANAGER] User validation error for ${userId}:`, error)
      return false
    }
  }
}