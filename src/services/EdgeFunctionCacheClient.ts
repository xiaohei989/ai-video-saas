/**
 * Edge Function Redis缓存客户端
 * 通过Supabase Edge Functions与Upstash Redis通信
 * 提供高性能的分布式缓存功能
 */

import { supabase } from '@/lib/supabase'

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending'

export interface CacheRequest {
  action: 'get' | 'set' | 'delete' | 'exists'
  key: string
  value?: any
  ttl?: number
}

export interface CacheResponse {
  success: boolean
  data?: any
  error?: string
  cache_hit?: boolean
  timestamp: string
}

export interface CounterEvent {
  type: 'template_like' | 'template_comment' | 'template_view' | 'template_usage' | 'template_share'
  template_id: string
  user_id: string
  delta: number
  timestamp: number
  metadata?: Record<string, any>
}

export interface UserSubscriptionCache {
  tier: SubscriptionTier
  status: SubscriptionStatus
  expires_at: string
  stripe_subscription_id?: string
  last_updated: string
}

export interface UserCreditsCache {
  balance: number
  total_earned: number
  total_spent: number
  last_updated: string
}

export interface UserProfileCache {
  id: string
  email: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  website: string | null
  social_links: Record<string, any>
  language: string
  credits: number
  total_credits_earned: number
  total_credits_spent: number
  referral_code: string | null
  follower_count: number
  following_count: number
  template_count: number
  is_verified: boolean
  role?: string | null
  created_at: string
  updated_at: string
  last_updated: string
}

export interface TemplateStatsCache {
  like_count: number
  comment_count: number
  view_count: number
  usage_count: number
  share_count: number
  last_updated: string
}

/**
 * Edge Function Redis缓存客户端类
 */
class EdgeFunctionCacheClient {
  private readonly CACHE_FUNCTION_URL: string
  private readonly COUNTER_FUNCTION_URL: string
  private readonly DEFAULT_TTL = 3600 // 1小时
  private readonly SHORT_TTL = 300 // 5分钟
  // private readonly LONG_TTL = 86400 // 24小时 // unused

  // 本地内存缓存作为二级缓存
  private localCache = new Map<string, { data: any, expiry: number }>()

  constructor() {
    // 构建Edge Function URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
    this.CACHE_FUNCTION_URL = `${supabaseUrl}/functions/v1/get-cached-data`
    this.COUNTER_FUNCTION_URL = `${supabaseUrl}/functions/v1/batch-update-counters`

  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    // 先检查本地缓存
    const localData = this.getLocalCache<T>(key)
    if (localData !== null) {
      return localData
    }

    try {
      const { data: session } = await supabase.auth.getSession()
      
      const response = await fetch(this.CACHE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'get',
          key
        } as CacheRequest)
      })

      const result: CacheResponse = await response.json()
      
      if (result.success && result.data) {
        // 缓存到本地
        this.setLocalCache(key, result.data, this.DEFAULT_TTL)
        return result.data as T
      }

      return null
    } catch (error) {
      console.error(`[EDGE CACHE CLIENT] 获取缓存失败 ${key}:`, error)
      return null
    }
  }

  /**
   * 设置缓存数据
   */
  async set(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    try {
      const { data: session } = await supabase.auth.getSession()
      
      const response = await fetch(this.CACHE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'set',
          key,
          value,
          ttl
        } as CacheRequest)
      })

      const result: CacheResponse = await response.json()
      
      if (result.success) {
        // 同时缓存到本地
        this.setLocalCache(key, value, ttl * 1000) // 转换为毫秒
        return true
      }

      console.error(`[EDGE CACHE CLIENT] 缓存设置失败 ${key}:`, result.error)
      return false
    } catch (error) {
      console.error(`[EDGE CACHE CLIENT] 设置缓存异常 ${key}:`, error)
      return false
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<boolean> {
    try {
      const { data: session } = await supabase.auth.getSession()
      
      const response = await fetch(this.CACHE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'delete',
          key
        } as CacheRequest)
      })

      const result: CacheResponse = await response.json()
      
      // 删除本地缓存
      this.deleteLocalCache(key)
      
      return result.success
    } catch (error) {
      console.error(`[EDGE CACHE CLIENT] 删除缓存失败 ${key}:`, error)
      return false
    }
  }

  /**
   * 发布计数器事件
   */
  async publishCounterEvent(event: CounterEvent): Promise<boolean> {
    try {
      const { data: session } = await supabase.auth.getSession()
      
      const response = await fetch(this.COUNTER_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'publish_event',
          event
        })
      })

      const result = await response.json()
      
      if (result.success) {
        console.log(`[EDGE CACHE CLIENT] 计数器事件发布成功: ${event.type} for ${event.template_id}`)
        return true
      }

      console.error(`[EDGE CACHE CLIENT] 计数器事件发布失败:`, result.error)
      return false
    } catch (error) {
      console.error(`[EDGE CACHE CLIENT] 发布计数器事件异常:`, error)
      return false
    }
  }

  /**
   * 手动触发计数器批量处理
   */
  async processBatchCounters(): Promise<{ processed: number, success: boolean }> {
    try {
      const { data: session } = await supabase.auth.getSession()
      
      const response = await fetch(this.COUNTER_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'process_batch'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        console.log(`[EDGE CACHE CLIENT] 批量处理完成: ${result.data.processed} 个模板更新`)
        return { processed: result.data.processed, success: true }
      }

      return { processed: 0, success: false }
    } catch (error) {
      console.error(`[EDGE CACHE CLIENT] 批量处理失败:`, error)
      return { processed: 0, success: false }
    }
  }

  // ============================================
  // 高级缓存功能
  // ============================================

  /**
   * 获取用户订阅信息（带缓存）
   */
  async getUserSubscription(userId: string): Promise<SubscriptionTier> {
    const cacheKey = `user:${userId}:subscription`
    
    try {
      const cached = await this.get<UserSubscriptionCache>(cacheKey)
      if (cached) {
        return cached.tier
      }

      // 缓存未命中，从数据库获取并缓存
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('tier, status, current_period_end, stripe_subscription_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      if (error) {
        console.error('Error fetching subscription for cache:', error)
        // 如果查询出错，返回默认的免费用户状态
      }

      const tier = (subscription?.tier as SubscriptionTier) || 'free'
      
      // 缓存结果
      const cacheData: UserSubscriptionCache = {
        tier,
        status: subscription?.status as SubscriptionStatus || 'active',
        expires_at: subscription?.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_subscription_id: subscription?.stripe_subscription_id,
        last_updated: new Date().toISOString()
      }
      
      await this.set(cacheKey, cacheData, this.DEFAULT_TTL)
      
      return tier
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 获取用户订阅失败:', error)
      return 'free'
    }
  }

  /**
   * 获取用户积分（带缓存）
   */
  async getUserCredits(userId: string): Promise<number> {
    const cacheKey = `user:${userId}:credits`
    
    try {
      const cached = await this.get<UserCreditsCache>(cacheKey)
      if (cached) {
        return cached.balance
      }

      // 缓存未命中，从数据库获取并缓存
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits, total_credits_earned, total_credits_spent')
        .eq('id', userId)
        .single()

      const balance = profile?.credits || 0
      
      // 缓存结果
      const cacheData: UserCreditsCache = {
        balance,
        total_earned: profile?.total_credits_earned || 0,
        total_spent: profile?.total_credits_spent || 0,
        last_updated: new Date().toISOString()
      }
      
      await this.set(cacheKey, cacheData, this.DEFAULT_TTL)
      
      return balance
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 获取用户积分失败:', error)
      return 0
    }
  }

  /**
   * 获取用户完整Profile（带缓存）
   */
  async getUserProfile(userId: string): Promise<UserProfileCache | null> {
    const cacheKey = `user:${userId}:profile`
    
    try {
      // 先检查本地缓存
      const localCached = this.getLocalCache<UserProfileCache>(cacheKey)
      if (localCached) {
        return localCached
      }

      // 检查Redis缓存
      const cached = await this.get<UserProfileCache>(cacheKey)
      if (cached) {
        return cached
      }

      // 缓存未命中，从数据库获取并缓存
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('[EDGE CACHE CLIENT] 数据库查询profile失败:', error)
        return null
      }

      if (!profile) {
        return null
      }
      
      // 构建缓存数据
      const cacheData: UserProfileCache = {
        ...profile,
        last_updated: new Date().toISOString()
      }
      
      // 缓存到Redis（较长TTL，15分钟）
      await this.set(cacheKey, cacheData, 900)
      
      return cacheData
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 获取用户Profile失败:', error)
      return null
    }
  }

  /**
   * 更新用户Profile缓存
   */
  async updateUserProfileCache(userId: string, updates: Partial<UserProfileCache>): Promise<boolean> {
    const cacheKey = `user:${userId}:profile`
    
    try {
      // 获取当前缓存的profile
      const currentProfile = await this.get<UserProfileCache>(cacheKey)
      
      if (currentProfile) {
        // 合并更新
        const updatedProfile = {
          ...currentProfile,
          ...updates,
          last_updated: new Date().toISOString()
        }
        
        return await this.set(cacheKey, updatedProfile, 900) // 15分钟TTL
      }
      
      return false
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 更新Profile缓存失败:', error)
      return false
    }
  }

  /**
   * 获取模板统计（带缓存）
   */
  async getTemplateStats(templateId: string): Promise<TemplateStatsCache | null> {
    const cacheKey = `template:${templateId}:stats`
    
    try {
      const cached = await this.get<TemplateStatsCache>(cacheKey)
      if (cached) {
        return cached
      }

      // 缓存未命中，从数据库获取并缓存
      const { data: template } = await supabase
        .from('templates')
        .select('like_count, comment_count, view_count, usage_count, share_count')
        .eq('id', templateId)
        .single()

      if (!template) {
        return null
      }

      // 缓存结果
      const cacheData: TemplateStatsCache = {
        like_count: template.like_count || 0,
        comment_count: template.comment_count || 0,
        view_count: template.view_count || 0,
        usage_count: template.usage_count || 0,
        share_count: template.share_count || 0,
        last_updated: new Date().toISOString()
      }
      
      await this.set(cacheKey, cacheData, this.SHORT_TTL) // 模板统计使用较短TTL
      
      return cacheData
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 获取模板统计失败:', error)
      return null
    }
  }

  // ============================================
  // 社交功能缓存
  // ============================================

  /**
   * 用户点赞模板
   */
  async likeTemplate(userId: string, templateId: string): Promise<boolean> {
    try {
      // 发布点赞事件
      const success = await this.publishCounterEvent({
        type: 'template_like',
        template_id: templateId,
        user_id: userId,
        delta: 1,
        timestamp: Date.now()
      })

      if (success) {
        // 立即更新本地缓存
        await this.invalidateTemplateStatsCache(templateId)
        console.log(`[EDGE CACHE CLIENT] 用户点赞成功: ${userId} -> ${templateId}`)
      }

      return success
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 用户点赞失败:', error)
      return false
    }
  }

  /**
   * 用户取消点赞模板
   */
  async unlikeTemplate(userId: string, templateId: string): Promise<boolean> {
    try {
      // 发布取消点赞事件
      const success = await this.publishCounterEvent({
        type: 'template_like',
        template_id: templateId,
        user_id: userId,
        delta: -1,
        timestamp: Date.now()
      })

      if (success) {
        // 立即更新本地缓存
        await this.invalidateTemplateStatsCache(templateId)
        console.log(`[EDGE CACHE CLIENT] 用户取消点赞成功: ${userId} -> ${templateId}`)
      }

      return success
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 用户取消点赞失败:', error)
      return false
    }
  }

  /**
   * 记录模板浏览
   */
  async recordTemplateView(templateId: string, userId: string): Promise<boolean> {
    return this.publishCounterEvent({
      type: 'template_view',
      template_id: templateId,
      user_id: userId,
      delta: 1,
      timestamp: Date.now()
    })
  }

  /**
   * 记录模板使用
   */
  async recordTemplateUsage(templateId: string, userId: string): Promise<boolean> {
    return this.publishCounterEvent({
      type: 'template_usage',
      template_id: templateId,
      user_id: userId,
      delta: 1,
      timestamp: Date.now()
    })
  }

  // ============================================
  // 本地缓存辅助方法
  // ============================================

  /**
   * 获取本地缓存
   */
  private getLocalCache<T>(key: string): T | null {
    const cached = this.localCache.get(key)
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T
    }
    
    // 过期删除
    if (cached) {
      this.localCache.delete(key)
    }
    
    return null
  }

  /**
   * 设置本地缓存
   */
  private setLocalCache(key: string, data: any, ttlMs: number): void {
    this.localCache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    })
  }

  /**
   * 删除本地缓存
   */
  private deleteLocalCache(key: string): void {
    this.localCache.delete(key)
  }

  /**
   * 使模板统计缓存失效
   */
  private async invalidateTemplateStatsCache(templateId: string): Promise<void> {
    const cacheKey = `template:${templateId}:stats`
    await this.delete(cacheKey)
  }

  /**
   * 使用户缓存失效
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const keys = [
      `user:${userId}:subscription`,
      `user:${userId}:credits`,
      `user:${userId}:profile`,
      `user:${userId}:stats`
    ]

    for (const key of keys) {
      await this.delete(key)
    }
  }

  // ============================================
  // 监控和健康检查
  // ============================================

  /**
   * 获取缓存健康状态
   */
  async getHealthStatus(): Promise<{
    redis_connected: boolean
    local_cache_size: number
    counter_processing_status: any
    last_check: string
  }> {
    try {
      // 🔧 修复：先检查用户是否已登录，未登录时跳过Redis健康检查
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.log('[EDGE CACHE CLIENT] 用户未登录，跳过Redis健康检查')
        return {
          redis_connected: false,
          local_cache_size: this.localCache.size,
          counter_processing_status: null,
          last_check: new Date().toISOString()
        }
      }

      // 测试Redis连接
      const testKey = `health_check_${Date.now()}`
      const testValue = { test: true }

      const setSuccess = await this.set(testKey, testValue, 10) // 10秒TTL
      const getResult = await this.get(testKey)

      // 清理测试数据
      await this.delete(testKey)

      // 获取计数器处理状态
      const counterStatus = await this.getCounterProcessingStatus()

      return {
        redis_connected: setSuccess && getResult !== null,
        local_cache_size: this.localCache.size,
        counter_processing_status: counterStatus,
        last_check: new Date().toISOString()
      }
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 健康检查失败:', error)
      return {
        redis_connected: false,
        local_cache_size: this.localCache.size,
        counter_processing_status: null,
        last_check: new Date().toISOString()
      }
    }
  }

  /**
   * 获取计数器处理状态
   */
  private async getCounterProcessingStatus(): Promise<any> {
    try {
      // 开发环境下跳过Edge Function调用，避免CORS错误
      if (import.meta.env.DEV) {
        return {
          queue_size: 0,
          processing: false,
          last_processed: new Date().toISOString()
        }
      }

      const { data: session } = await supabase.auth.getSession()
      
      const response = await fetch(this.COUNTER_FUNCTION_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token || ''}`
        }
      })

      const result = await response.json()
      return result.success ? result.data : null
    } catch (error) {
      console.error('[EDGE CACHE CLIENT] 获取计数器状态失败:', error)
      return null
    }
  }

  /**
   * 清理本地缓存
   */
  cleanupLocalCache(): void {
    const now = Date.now()
    for (const [key, value] of this.localCache.entries()) {
      if (value.expiry < now) {
        this.localCache.delete(key)
      }
    }
  }

  /**
   * 强制清理所有本地缓存（用于环境变更后的清理）
   */
  clearAllLocalCache(): void {
    this.localCache.clear()
    console.log('[EDGE CACHE CLIENT] 已清理所有本地缓存')
  }
}

// 创建单例实例
export const edgeCacheClient = new EdgeFunctionCacheClient()

// 定期清理本地缓存
setInterval(() => {
  edgeCacheClient.cleanupLocalCache()
}, 60000) // 每分钟清理一次

export default edgeCacheClient
