/**
 * Redis缓存集成服务
 * 通过Supabase Edge Functions与Upstash Redis集成
 * 提供高性能的分布式缓存功能
 */

import edgeCacheClient, { SubscriptionTier } from './EdgeFunctionCacheClient'
import { supabase } from '@/lib/supabase'

/**
 * Redis缓存集成服务类
 */
class RedisCacheIntegrationService {
  private initialized = false

  /**
   * 初始化缓存集成服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      console.log('[REDIS CACHE INTEGRATION] 初始化Redis缓存集成服务...')
      
      // 测试Redis连接
      const healthStatus = await edgeCacheClient.getHealthStatus()
      
      if (healthStatus.redis_connected) {
        console.log('[REDIS CACHE INTEGRATION] ✅ Redis连接测试成功')
      } else {
        console.warn('[REDIS CACHE INTEGRATION] ⚠️ Redis连接测试失败，将使用降级模式')
      }
      
      this.initialized = true
      console.log('[REDIS CACHE INTEGRATION] Redis缓存集成服务初始化完成')
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 初始化失败:', error)
      
      // 即使初始化失败也标记为已初始化，使用降级模式
      this.initialized = true
    }
  }

  /**
   * 检查是否启用缓存
   */
  private isCacheEnabled(): boolean {
    return import.meta.env.VITE_ENABLE_CACHE === 'true'
  }

  // ============================================
  // 用户订阅相关缓存集成
  // ============================================

  /**
   * 获取用户订阅信息（Redis缓存优先）
   */
  async getUserSubscription(userId: string): Promise<SubscriptionTier> {
    if (!this.isCacheEnabled()) {
      return this.getUserSubscriptionFromDB(userId)
    }

    try {
      
      // 使用Edge Function Redis缓存
      const tier = await edgeCacheClient.getUserSubscription(userId)
      
      return tier
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] Redis缓存获取失败，回退到数据库:', error)
      return this.getUserSubscriptionFromDB(userId)
    }
  }

  /**
   * 从数据库获取用户订阅信息
   */
  private async getUserSubscriptionFromDB(userId: string): Promise<SubscriptionTier> {
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('tier, status, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // 没有找到记录
          return 'free'
        }
        throw error
      }

      return (subscription?.tier as SubscriptionTier) || 'free'
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 数据库查询用户订阅失败:', error)
      return 'free'
    }
  }

  // ============================================
  // 用户积分相关缓存集成
  // ============================================

  /**
   * 获取用户积分余额（Redis缓存优先）
   */
  async getUserCredits(userId: string): Promise<number> {
    if (!this.isCacheEnabled()) {
      return this.getUserCreditsFromDB(userId)
    }

    try {
      console.log(`[REDIS CACHE INTEGRATION] 获取用户积分 (缓存优先): ${userId}`)
      
      // 使用Edge Function Redis缓存
      const credits = await edgeCacheClient.getUserCredits(userId)
      
      console.log(`[REDIS CACHE INTEGRATION] 用户积分获取成功: ${userId} -> ${credits}`)
      return credits
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] Redis积分缓存获取失败，回退到数据库:', error)
      return this.getUserCreditsFromDB(userId)
    }
  }

  /**
   * 从数据库获取用户积分
   */
  private async getUserCreditsFromDB(userId: string): Promise<number> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single()

      if (error) {
        throw error
      }

      return profile?.credits || 0
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 数据库查询用户积分失败:', error)
      return 0
    }
  }

  /**
   * 使用户缓存失效（积分更新后调用）
   */
  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.isCacheEnabled()) {
      return
    }

    try {
      await edgeCacheClient.invalidateUserCache(userId)
      console.log(`[REDIS CACHE INTEGRATION] 用户缓存失效: ${userId}`)
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 用户缓存失效失败:', error)
    }
  }

  // ============================================
  // 模板统计相关缓存集成
  // ============================================

  /**
   * 获取模板统计信息（Redis缓存优先）
   */
  async getTemplateStats(templateId: string): Promise<{
    like_count: number
    comment_count: number
    view_count: number
    usage_count: number
    share_count: number
  } | null> {
    if (!this.isCacheEnabled()) {
      return this.getTemplateStatsFromDB(templateId)
    }

    try {
      console.log(`[REDIS CACHE INTEGRATION] 获取模板统计 (缓存优先): ${templateId}`)
      
      // 使用Edge Function Redis缓存
      const stats = await edgeCacheClient.getTemplateStats(templateId)
      
      if (stats) {
        console.log(`[REDIS CACHE INTEGRATION] 模板统计缓存命中: ${templateId}`)
        return stats
      }

      console.log(`[REDIS CACHE INTEGRATION] 模板统计缓存未命中，从数据库获取: ${templateId}`)
      return this.getTemplateStatsFromDB(templateId)
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 模板统计获取失败，回退到数据库:', error)
      return this.getTemplateStatsFromDB(templateId)
    }
  }

  /**
   * 从数据库获取模板统计信息
   */
  private async getTemplateStatsFromDB(templateId: string): Promise<{
    like_count: number
    comment_count: number
    view_count: number
    usage_count: number
    share_count: number
  } | null> {
    try {
      const { data: template, error } = await supabase
        .from('templates')
        .select('like_count, comment_count, view_count, usage_count, share_count')
        .eq('id', templateId)
        .single()

      if (error) {
        throw error
      }

      return template ? {
        like_count: template.like_count || 0,
        comment_count: template.comment_count || 0,
        view_count: template.view_count || 0,
        usage_count: template.usage_count || 0,
        share_count: template.share_count || 0
      } : null
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 数据库查询模板统计失败:', error)
      return null
    }
  }

  // ============================================
  // 社交功能相关缓存集成
  // ============================================

  /**
   * 用户点赞模板
   */
  async likeTemplate(userId: string, templateId: string): Promise<{ success: boolean, alreadyLiked: boolean }> {
    try {
      console.log(`[REDIS CACHE INTEGRATION] 用户点赞: ${userId} -> ${templateId}`)
      
      if (this.isCacheEnabled()) {
        const success = await edgeCacheClient.likeTemplate(userId, templateId)
        if (success) {
          return { success: true, alreadyLiked: false }
        }
      }

      // 回退到直接数据库操作
      return this.likeTemplateInDB(userId, templateId)
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 用户点赞失败:', error)
      return { success: false, alreadyLiked: false }
    }
  }

  /**
   * 用户取消点赞模板
   */
  async unlikeTemplate(userId: string, templateId: string): Promise<{ success: boolean, wasLiked: boolean }> {
    try {
      console.log(`[REDIS CACHE INTEGRATION] 用户取消点赞: ${userId} -> ${templateId}`)
      
      if (this.isCacheEnabled()) {
        const success = await edgeCacheClient.unlikeTemplate(userId, templateId)
        if (success) {
          return { success: true, wasLiked: true }
        }
      }

      // 回退到直接数据库操作
      return this.unlikeTemplateInDB(userId, templateId)
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 用户取消点赞失败:', error)
      return { success: false, wasLiked: false }
    }
  }

  /**
   * 记录模板浏览
   */
  async recordTemplateView(templateId: string, userId: string): Promise<void> {
    try {
      if (this.isCacheEnabled()) {
        await edgeCacheClient.recordTemplateView(templateId, userId)
      }
      
      console.log(`[REDIS CACHE INTEGRATION] 记录模板浏览: ${userId} -> ${templateId}`)
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 记录模板浏览失败:', error)
    }
  }

  /**
   * 记录模板使用
   */
  async recordTemplateUsage(templateId: string, userId: string): Promise<void> {
    try {
      if (this.isCacheEnabled()) {
        await edgeCacheClient.recordTemplateUsage(templateId, userId)
      }
      
      console.log(`[REDIS CACHE INTEGRATION] 记录模板使用: ${userId} -> ${templateId}`)
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 记录模板使用失败:', error)
    }
  }

  // ============================================
  // 数据库降级方法
  // ============================================

  private async likeTemplateInDB(userId: string, templateId: string): Promise<{ success: boolean, alreadyLiked: boolean }> {
    try {
      const { error } = await supabase
        .from('template_likes')
        .insert({
          user_id: userId,
          template_id: templateId
        })

      if (error) {
        if (error.code === '23505') { // 重复键错误
          return { success: false, alreadyLiked: true }
        }
        throw error
      }

      return { success: true, alreadyLiked: false }
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 数据库点赞操作失败:', error)
      return { success: false, alreadyLiked: false }
    }
  }

  private async unlikeTemplateInDB(userId: string, templateId: string): Promise<{ success: boolean, wasLiked: boolean }> {
    try {
      const { error, count } = await supabase
        .from('template_likes')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
        .eq('template_id', templateId)

      if (error) {
        throw error
      }

      return { success: true, wasLiked: (count || 0) > 0 }
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 数据库取消点赞操作失败:', error)
      return { success: false, wasLiked: false }
    }
  }

  // ============================================
  // 监控和管理
  // ============================================

  /**
   * 获取缓存服务健康状态
   */
  async getHealthStatus(): Promise<{
    initialized: boolean
    redis_connected: boolean
    local_cache_size: number
    counter_processing_status: any
    last_check: string
  }> {
    try {
      const healthStatus = await edgeCacheClient.getHealthStatus()
      
      return {
        initialized: this.initialized,
        redis_connected: healthStatus.redis_connected,
        local_cache_size: healthStatus.local_cache_size,
        counter_processing_status: healthStatus.counter_processing_status,
        last_check: healthStatus.last_check
      }
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 获取健康状态失败:', error)
      return {
        initialized: this.initialized,
        redis_connected: false,
        local_cache_size: 0,
        counter_processing_status: null,
        last_check: new Date().toISOString()
      }
    }
  }

  /**
   * 手动触发计数器批量处理
   */
  async triggerCounterBatchProcessing(): Promise<{ processed: number, success: boolean }> {
    try {
      return await edgeCacheClient.processBatchCounters()
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 触发计数器批量处理失败:', error)
      return { processed: 0, success: false }
    }
  }

  /**
   * 预热重要缓存数据
   */
  async warmupCache(userId?: string): Promise<void> {
    if (!this.isCacheEnabled() || !userId) {
      return
    }

    try {
      console.log(`[REDIS CACHE INTEGRATION] 开始缓存预热: ${userId}`)
      
      // 预热用户数据
      await Promise.all([
        this.getUserSubscription(userId),
        this.getUserCredits(userId)
      ])
      
      console.log(`[REDIS CACHE INTEGRATION] 缓存预热完成: ${userId}`)
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 缓存预热失败:', error)
    }
  }

  /**
   * 清理和关闭
   */
  async cleanup(): Promise<void> {
    try {
      console.log('[REDIS CACHE INTEGRATION] 清理Redis缓存集成服务')
      this.initialized = false
    } catch (error) {
      console.error('[REDIS CACHE INTEGRATION] 清理失败:', error)
    }
  }
}

// 创建单例实例
export const redisCacheIntegrationService = new RedisCacheIntegrationService()

export default redisCacheIntegrationService