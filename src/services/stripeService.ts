import { loadStripe, Stripe } from '@stripe/stripe-js'
import { supabase } from '@/lib/supabase'
import { getStripePriceId, getStripePublishableKey, getStripeEnvironmentInfo, getStripePriceIdByInterval, getStripeAnnualPriceId } from '@/config/stripe-env'

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  currency: string
  interval: 'month' | 'year'
  features: string[]
  credits: number
  stripePriceId: string
  popular?: boolean
}

export interface PaymentIntent {
  id: string
  client_secret: string
  status: string
  amount: number
  currency: string
}

export interface SubscriptionStatus {
  id: string
  status: 'active' | 'cancelled' | 'expired' | 'pending'
  current_period_start: string
  current_period_end: string
  plan: SubscriptionPlan
  cancel_at_period_end: boolean
}

class StripeService {
  private stripe: Promise<Stripe | null>
  
  constructor() {
    // 使用新的环境配置系统
    const stripePublicKey = getStripePublishableKey()
    this.stripe = loadStripe(stripePublicKey)
  }

  /**
   * 获取当前Stripe环境信息
   */
  getEnvironmentInfo() {
    return getStripeEnvironmentInfo()
  }

  /**
   * 获取订阅计划配置
   */
  /**
   * 获取所有订阅计划（6个独立产品）
   */
  getAllSubscriptionPlans(): SubscriptionPlan[] {
    return [
      // 月度计划
      {
        id: 'basic',
        name: '基础版',
        price: 9.99,
        currency: 'USD',
        interval: 'month',
        credits: 200,
        stripePriceId: getStripePriceId('basic'),
        features: [
          '每月200积分',
          '标准视频质量 (20积分/视频)',
          '基础模板库',
          '邮件支持'
        ]
      },
      {
        id: 'pro',
        name: '专业版',
        price: 59.99,
        currency: 'USD',
        interval: 'month',
        credits: 1500,
        stripePriceId: getStripePriceId('pro'),
        popular: true,
        features: [
          '每月1500积分',
          '高质量视频 (100积分/视频)',
          '标准视频 (20积分/视频)',
          '完整模板库',
          '优先支持'
        ]
      },
      {
        id: 'enterprise',
        name: '企业版',
        price: 199.99,
        currency: 'USD',
        interval: 'month',
        credits: 6000,
        stripePriceId: getStripePriceId('enterprise'),
        features: [
          '每月6000积分',
          '高质量视频 (100积分/视频)',
          '标准视频 (20积分/视频)',
          '无限模板使用',
          '专属客服',
          'API访问',
          '团队协作'
        ]
      },
      // 年度计划（独立产品）
      {
        id: 'basic-annual',
        name: '基础版年度',
        price: 99.90,
        currency: 'USD',
        interval: 'year',
        credits: 2400,
        stripePriceId: getStripeAnnualPriceId('basic'),
        features: [
          '每月200积分',
          '标准视频质量 (20积分/视频)',
          '基础模板库',
          '邮件支持'
        ]
      },
      {
        id: 'pro-annual',
        name: '专业版年度',
        price: 599.90,
        currency: 'USD',
        interval: 'year',
        credits: 18000,
        stripePriceId: getStripeAnnualPriceId('pro'),
        popular: true,
        features: [
          '每月1500积分',
          '高质量视频 (100积分/视频)',
          '标准视频 (20积分/视频)',
          '完整模板库',
          '优先支持'
        ]
      },
      {
        id: 'enterprise-annual',
        name: '企业版年度',
        price: 1999.90,
        currency: 'USD',
        interval: 'year',
        credits: 72000,
        stripePriceId: getStripeAnnualPriceId('enterprise'),
        features: [
          '每月6000积分',
          '高质量视频 (100积分/视频)',
          '标准视频 (20积分/视频)',
          '无限模板使用',
          '专属客服',
          'API访问',
          '团队协作'
        ]
      }
    ]
  }

  /**
   * 根据计费周期获取对应的订阅计划
   */
  getSubscriptionPlans(interval: 'month' | 'year' = 'month'): SubscriptionPlan[] {
    const allPlans = this.getAllSubscriptionPlans();
    return allPlans.filter(plan => plan.interval === interval);
  }

  /**
   * 创建支付意图（一次性积分购买）
   */
  async createPaymentIntent(
    amount: number,
    credits: number,
    userId: string
  ): Promise<PaymentIntent | null> {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: Math.round(amount * 100), // Stripe需要最小货币单位
          currency: 'usd',
          credits,
          userId,
          type: 'credit_purchase'
        }
      })

      if (error) {
        console.error('Error creating payment intent:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in createPaymentIntent:', error)
      return null
    }
  }

  /**
   * 创建订阅结账会话
   */
  async createSubscriptionCheckout(
    planId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ url: string } | null> {
    try {
      // 从所有计划中查找，包括年度计划
      const plan = this.getAllSubscriptionPlans().find(p => p.id === planId)
      if (!plan) {
        console.error(`Plan not found: ${planId}. Available plans:`, this.getAllSubscriptionPlans().map(p => p.id))
        throw new Error(`Invalid plan ID: ${planId}`)
      }
      
      console.log(`Creating subscription checkout for plan:`, {
        planId: plan.id,
        planName: plan.name,
        interval: plan.interval,
        price: plan.price,
        stripePriceId: plan.stripePriceId
      })

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: plan.stripePriceId,
          userId,
          planId,
          successUrl,
          cancelUrl,
          mode: 'subscription'
        }
      })

      if (error) {
        console.error('Error creating checkout session:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in createSubscriptionCheckout:', error)
      return null
    }
  }

  /**
   * 创建一次性支付结账会话（积分购买）
   */
  async createCreditsPurchaseCheckout(
    amount: number,
    credits: number,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ url: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          amount: Math.round(amount * 100),
          currency: 'usd',
          userId,
          credits,
          successUrl,
          cancelUrl,
          mode: 'payment',
          type: 'credit_purchase'
        }
      })

      if (error) {
        console.error('Error creating checkout session:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in createCreditsPurchaseCheckout:', error)
      return null
    }
  }

  /**
   * 获取用户订阅状态
   */
  async getUserSubscription(userId: string): Promise<SubscriptionStatus | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          tier,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          stripe_subscription_id
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription found
          return null
        }
        console.error('Error fetching subscription:', error)
        return null
      }

      // 从所有计划中查找，包括年度计划
      const plan = this.getAllSubscriptionPlans().find(p => p.id === data.tier)
      if (!plan) {
        console.warn(`Plan not found for tier: ${data.tier}. Available plans:`, this.getAllSubscriptionPlans().map(p => p.id))
        return null
      }

      return {
        id: data.id,
        status: data.status,
        current_period_start: data.current_period_start,
        current_period_end: data.current_period_end,
        cancel_at_period_end: data.cancel_at_period_end,
        plan
      }
    } catch (error) {
      console.error('Error in getUserSubscription:', error)
      return null
    }
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: { subscriptionId }
      })

      if (error) {
        console.error('Error cancelling subscription:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in cancelSubscription:', error)
      return false
    }
  }

  /**
   * 恢复订阅
   */
  async resumeSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('resume-subscription', {
        body: { subscriptionId }
      })

      if (error) {
        console.error('Error resuming subscription:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in resumeSubscription:', error)
      return false
    }
  }

  /**
   * 获取客户门户URL（管理订阅和支付方式）
   */
  async getCustomerPortalUrl(
    userId: string,
    returnUrl: string
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          userId,
          returnUrl
        }
      })

      if (error) {
        console.error('Error creating portal session:', error)
        return null
      }

      return data.url
    } catch (error) {
      console.error('Error in getCustomerPortalUrl:', error)
      return null
    }
  }

  /**
   * 处理支付成功后的操作
   */
  async handlePaymentSuccess(
    paymentIntentId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('handle-payment-success', {
        body: {
          paymentIntentId,
          userId
        }
      })

      if (error) {
        console.error('Error handling payment success:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in handlePaymentSuccess:', error)
      return false
    }
  }

  /**
   * 获取支付历史
   */
  async getPaymentHistory(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching payment history:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getPaymentHistory:', error)
      return []
    }
  }

  /**
   * 格式化价格显示
   */
  formatPrice(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  /**
   * 计算折扣价格
   */
  calculateDiscountPrice(originalPrice: number, discountPercent: number): number {
    return originalPrice * (1 - discountPercent / 100)
  }

  /**
   * 获取Stripe实例
   */
  async getStripe(): Promise<Stripe | null> {
    return await this.stripe
  }
}

// 导出单例实例
export const stripeService = new StripeService()
export default stripeService