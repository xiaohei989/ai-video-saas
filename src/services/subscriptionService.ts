import { supabase } from '@/lib/supabase'
import type { Subscription, SubscriptionPlanId, BasePlanId, BillingInterval } from '@/types'

export class SubscriptionService {
  /**
   * 将数据库的tier值映射为前端使用的planId
   * 支持年度和月度订阅的完整映射
   */
  private static mapTierToPlanId(dbTier: string): SubscriptionPlanId {
    const tierMap: Record<string, SubscriptionPlanId> = {
      // 传统映射（向后兼容）
      'free': 'basic',
      'basic': 'basic',
      'pro': 'pro',
      'premium': 'enterprise', // 数据库中的premium对应前端的enterprise
      
      // 年度计划映射
      'basic-annual': 'basic-annual',
      'pro-annual': 'pro-annual',
      'enterprise-annual': 'enterprise-annual'
    }
    
    return tierMap[dbTier] || 'basic'
  }

  /**
   * 从planId提取基础计划类型
   */
  private static getBasePlanId(planId: SubscriptionPlanId): BasePlanId {
    return planId.replace('-annual', '') as BasePlanId
  }

  /**
   * 从planId提取计费周期
   */
  private static getBillingInterval(planId: SubscriptionPlanId): BillingInterval {
    return planId.includes('-annual') ? 'year' : 'month'
  }

  /**
   * 获取用户当前订阅信息
   */
  static async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 没有找到订阅记录
          return null
        }
        throw error
      }

      return {
        id: data.id,
        userId: data.user_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        planId: this.mapTierToPlanId(data.tier),
        status: data.status as 'active' | 'cancelled' | 'expired',
        currentPeriodStart: data.current_period_start ? new Date(data.current_period_start) : new Date(),
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : new Date(),
        cancelAtPeriodEnd: data.cancel_at_period_end,
        createdAt: data.created_at ? new Date(data.created_at) : new Date(),
        updatedAt: data.updated_at ? new Date(data.updated_at) : new Date()
      }
    } catch (error) {
      console.error('获取订阅信息失败:', error)
      throw error
    }
  }

  /**
   * 获取用户所有订阅历史
   */
  static async getSubscriptionHistory(userId: string): Promise<Subscription[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data.map(sub => ({
        id: sub.id,
        userId: sub.user_id,
        stripeSubscriptionId: sub.stripe_subscription_id,
        planId: this.mapTierToPlanId(sub.tier),
        status: sub.status as 'active' | 'cancelled' | 'expired',
        currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start) : new Date(),
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : new Date(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        createdAt: sub.created_at ? new Date(sub.created_at) : new Date(),
        updatedAt: sub.updated_at ? new Date(sub.updated_at) : new Date()
      }))
    } catch (error) {
      console.error('获取订阅历史失败:', error)
      throw error
    }
  }

  /**
   * 取消订阅
   */
  static async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      // 调用后端API取消订阅
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId }),
      })

      if (!response.ok) {
        throw new Error('取消订阅失败')
      }
    } catch (error) {
      console.error('取消订阅失败:', error)
      throw error
    }
  }

  /**
   * 获取计划详情 - 支持年度和月度计划
   */
  static getPlanDetails(planId: SubscriptionPlanId | string) {
    const basePlanId = this.getBasePlanId(planId as SubscriptionPlanId)
    const interval = this.getBillingInterval(planId as SubscriptionPlanId)
    
    const basePlans = {
      basic: {
        name: '基础版',
        monthlyPrice: 9.99,
        monthlyCredits: 200,
        features: ['每月200积分', '基础模板库', '标准视频质量']
      },
      pro: {
        name: '专业版', 
        monthlyPrice: 59.99,
        monthlyCredits: 1500,
        features: ['每月1500积分', '全部模板库', '高清视频质量', '优先处理']
      },
      enterprise: {
        name: '企业版',
        monthlyPrice: 199.99,
        monthlyCredits: 6000,
        features: ['每月6000积分', '全部模板库', '4K视频质量', '专属客服', 'API访问']
      }
    }

    const basePlan = basePlans[basePlanId] || basePlans.basic
    
    // 根据计费周期计算价格和积分
    return {
      name: basePlan.name,
      price: interval === 'year' ? basePlan.monthlyPrice * 10 : basePlan.monthlyPrice,
      credits: interval === 'year' ? basePlan.monthlyCredits * 12 : basePlan.monthlyCredits,
      interval: interval,
      features: basePlan.features
    }
  }

  /**
   * 格式化订阅状态
   */
  static formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      active: '活跃',
      cancelled: '已取消',
      expired: '已过期',
      pending: '待激活'
    }
    
    return statusMap[status] || status
  }

  /**
   * 检查订阅是否即将到期
   */
  static isSubscriptionExpiringSoon(subscription: Subscription): boolean {
    const now = new Date()
    const daysUntilExpiry = Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }
}