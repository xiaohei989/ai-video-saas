/**
 * Redis缓存集成服务 - 升级版
 * 使用多级缓存架构优化性能
 * 
 * 架构：
 * - L1: 内存缓存 (MultiLevelCache)
 * - L2: IndexedDB (MultiLevelCache)
 * - L3: Redis (Edge Functions)
 * - L4: Supabase数据库
 */

import { multiLevelCache, CACHE_PREFIX, TTL_STRATEGY } from './MultiLevelCacheService'
import edgeCacheClient, { SubscriptionTier } from './EdgeFunctionCacheClient'
import { supabase } from '@/lib/supabase'

/**
 * Redis缓存集成服务类 - 使用多级缓存优化
 */
class RedisCacheIntegrationService {
  private initialized = false
  private warmupCompleted = false

  /**
   * 初始化缓存集成服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      console.log('[REDIS CACHE] 🚀 初始化多级缓存服务...')
      
      // 测试Redis连接
      const healthStatus = await edgeCacheClient.getHealthStatus()
      
      if (healthStatus.redis_connected) {
        console.log('[REDIS CACHE] ✅ Redis连接成功，启用完整多级缓存')
        
        // 预热常用数据
        this.warmupCache()
      } else {
        console.warn('[REDIS CACHE] ⚠️ Redis不可用，使用L1+L2缓存模式')
      }
      
      this.initialized = true
      console.log('[REDIS CACHE] 多级缓存服务初始化完成')
    } catch (error) {
      console.error('[REDIS CACHE] 初始化失败:', error)
      this.initialized = true
    }
  }

  /**
   * 预热缓存 - 加载热点数据
   */
  private async warmupCache(): Promise<void> {
    if (this.warmupCompleted) return
    
    try {
      console.log('[REDIS CACHE] 🔥 开始预热缓存...')
      
      // 预热热门模板数据
      const { data: templates } = await supabase
        .from('templates')
        .select('*')
        .eq('is_featured', true)
        .limit(10)
      
      if (templates) {
        for (const template of templates) {
          const key = `${CACHE_PREFIX.TEMPLATE}${template.id}`
          await multiLevelCache.set(key, template, { 
            ttl: TTL_STRATEGY.STATIC 
          })
        }
        console.log(`[REDIS CACHE] 预热了 ${templates.length} 个热门模板`)
      }
      
      this.warmupCompleted = true
    } catch (error) {
      console.error('[REDIS CACHE] 预热失败:', error)
    }
  }

  /**
   * 检查是否启用缓存
   */
  private isCacheEnabled(): boolean {
    return import.meta.env.VITE_ENABLE_CACHE !== 'false'
  }

  // ============================================
  // 用户订阅相关缓存集成
  // ============================================

  /**
   * 获取用户订阅信息（使用多级缓存）
   */
  async getUserSubscription(userId: string): Promise<SubscriptionTier> {
    if (!this.isCacheEnabled()) {
      return this.getUserSubscriptionFromDB(userId)
    }

    const cacheKey = `${CACHE_PREFIX.SUBSCRIPTION}${userId}`
    
    try {
      // 尝试从多级缓存获取
      const cached = await multiLevelCache.get<SubscriptionTier>(cacheKey)
      
      if (cached) {
        console.log(`[REDIS CACHE] 🎯 缓存命中: ${cacheKey}`)
        return cached
      }
      
      // 缓存未命中，从数据库获取
      const subscription = await this.getUserSubscriptionFromDB(userId)
      
      // 写入多级缓存
      await multiLevelCache.set(cacheKey, subscription, {
        ttl: TTL_STRATEGY.USER
      })
      
      return subscription
    } catch (error) {
      console.error('[REDIS CACHE] 缓存操作失败，回退到数据库:', error)
      return this.getUserSubscriptionFromDB(userId)
    }
  }

  /**
   * 清理用户订阅缓存（清理所有级别）
   */
  async clearUserSubscriptionCache(userId: string): Promise<boolean> {
    if (!this.isCacheEnabled()) {
      return true
    }

    try {
      const cacheKey = `${CACHE_PREFIX.SUBSCRIPTION}${userId}`
      
      // 清理所有级别的缓存
      const deleted = await multiLevelCache.delete(cacheKey, 'all')
      
      if (deleted) {
        console.log(`[REDIS CACHE] ✅ 已清理用户订阅缓存: ${userId}`)
      }
      
      return deleted
    } catch (error) {
      console.error(`[REDIS CACHE] ❌ 清理缓存失败: ${userId}`, error)
      return false
    }
  }

  /**
   * 强制刷新用户订阅缓存
   */
  async refreshUserSubscriptionCache(userId: string): Promise<SubscriptionTier> {
    console.log(`[REDIS CACHE INTEGRATION] 🔄 强制刷新用户订阅缓存: ${userId}`)
    
    try {
      // 先清理缓存
      await this.clearUserSubscriptionCache(userId)
      
      // 然后重新获取（这会触发缓存更新）
      const tier = await this.getUserSubscription(userId)
      
      console.log(`[REDIS CACHE INTEGRATION] ✅ 用户订阅缓存刷新完成: ${userId} -> ${tier}`)
      return tier
    } catch (error) {
      console.error(`[REDIS CACHE INTEGRATION] ❌ 刷新用户订阅缓存失败: ${userId}`, error)
      return 'free'
    }
  }

  /**
   * 批量清理多个用户的订阅缓存
   */
  async clearMultipleUserSubscriptionCaches(userIds: string[]): Promise<{
    success: number
    failed: number
    errors: string[]
  }> {
    console.log(`[REDIS CACHE INTEGRATION] 🧹 批量清理 ${userIds.length} 个用户的订阅缓存`)
    
    const result = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }
    
    for (const userId of userIds) {
      try {
        const cleared = await this.clearUserSubscriptionCache(userId)
        if (cleared) {
          result.success++
        } else {
          result.failed++
          result.errors.push(`用户 ${userId} 缓存清理失败`)
        }
      } catch (error) {
        result.failed++
        result.errors.push(`用户 ${userId} 缓存清理异常: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    console.log(`[REDIS CACHE INTEGRATION] 批量清理完成: 成功 ${result.success}, 失败 ${result.failed}`)
    return result
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
        .maybeSingle()

      if (error) {
        console.error('Error fetching subscription from DB:', error)
        return 'free'
      }

      // maybeSingle() 返回 null 当没有记录时，这是正常情况（免费用户）
      if (!subscription) {
        return 'free'
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
   * 获取用户积分余额（使用多级缓存）
   */
  async getUserCredits(userId: string): Promise<number> {
    if (!this.isCacheEnabled()) {
      return this.getUserCreditsFromDB(userId)
    }

    const cacheKey = `${CACHE_PREFIX.CREDITS}${userId}`
    
    try {
      // 尝试从多级缓存获取
      const cached = await multiLevelCache.get<number>(cacheKey)
      
      if (cached !== null) {
        console.log(`[REDIS CACHE] 🎯 积分缓存命中: ${cacheKey}`)
        return cached
      }
      
      // 缓存未命中，从数据库获取
      const credits = await this.getUserCreditsFromDB(userId)
      
      // 写入多级缓存（积分使用较短TTL）
      await multiLevelCache.set(cacheKey, credits, {
        ttl: TTL_STRATEGY.DYNAMIC
      })
      
      return credits
    } catch (error) {
      console.error('[REDIS CACHE] 积分缓存操作失败，回退到数据库:', error)
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
      // 清理所有用户相关缓存
      const prefixes = [
        `${CACHE_PREFIX.USER}${userId}`,
        `${CACHE_PREFIX.CREDITS}${userId}`,
        `${CACHE_PREFIX.SUBSCRIPTION}${userId}`
      ]
      
      await Promise.all(
        prefixes.map(prefix => multiLevelCache.delete(prefix, 'all'))
      )
      
      console.log(`[REDIS CACHE] 用户缓存失效: ${userId}`)
    } catch (error) {
      console.error('[REDIS CACHE] 用户缓存失效失败:', error)
    }
  }

  /**
   * 批量获取用户数据（新增方法）
   */
  async getBatchUserData(userIds: string[]): Promise<Map<string, any>> {
    if (!this.isCacheEnabled()) {
      return new Map()
    }

    const keys = userIds.map(id => `${CACHE_PREFIX.USER}${id}`)
    const result = await multiLevelCache.getBatch(keys)
    
    // 转换键名
    const userDataMap = new Map()
    result.hits.forEach((data, key) => {
      const userId = key.replace(CACHE_PREFIX.USER, '')
      userDataMap.set(userId, data)
    })
    
    return userDataMap
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

    const cacheKey = `${CACHE_PREFIX.STATS}${templateId}`
    
    try {
      // 尝试从多级缓存获取
      const cached = await multiLevelCache.get<any>(cacheKey)
      
      if (cached) {
        console.log(`[REDIS CACHE] 🎯 模板统计缓存命中: ${cacheKey}`)
        return cached
      }
      
      // 缓存未命中，从数据库获取
      const stats = await this.getTemplateStatsFromDB(templateId)
      
      if (stats) {
        // 写入多级缓存（统计数据使用较短TTL）
        await multiLevelCache.set(cacheKey, stats, {
          ttl: TTL_STRATEGY.DYNAMIC
        })
      }
      
      return stats
    } catch (error) {
      console.error('[REDIS CACHE] 模板统计缓存操作失败，回退到数据库:', error)
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
   * 预热用户缓存数据
   */
  async warmupUserCache(userId?: string): Promise<void> {
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