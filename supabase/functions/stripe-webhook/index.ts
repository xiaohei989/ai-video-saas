import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import {
  getStripeSecretKey,
  getWebhookSecret,
  mapPriceIdToTier,
  getEdgeStripeEnvironmentInfo,
  validateEdgeStripeConfig
} from '../_shared/stripe-config.ts'

// 初始化Stripe，使用共享配置
const stripe = new Stripe(getStripeSecretKey(), {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 使用共享配置获取webhook密钥
const WEBHOOK_SECRETS = [
  getWebhookSecret()
].filter(Boolean)

// ============================================
// 常量定义
// ============================================

// 订阅等级价值（用于判断升降级）
const TIER_VALUES = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,  // 统一使用enterprise
  // 年度计划使用相同的基础价值（因为年度是计费周期变化，不是等级变化）
  'basic-annual': 1,
  'pro-annual': 2,
  'enterprise-annual': 3
} as const

// 积分配额
const TIER_CREDITS = {
  free: 0,
  basic: 200,
  pro: 1500,
  enterprise: 6000,  // 统一使用enterprise
  // 年度计划的积分配额（年度总积分）
  'basic-annual': 2400,     // 200 * 12
  'pro-annual': 18000,      // 1500 * 12  
  'enterprise-annual': 72000 // 6000 * 12
} as const

// 订阅操作类型
enum SubscriptionAction {
  NEW = 'new',
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
  RENEWAL = 'renewal',
  CANCEL = 'cancel'
}

type TierType = keyof typeof TIER_VALUES

// ============================================
// 工具函数
// ============================================

// mapPriceIdToTier函数现在从共享配置导入

/**
 * 判断订阅操作类型
 */
function determineSubscriptionAction(
  existingSubscription: any,
  newSubscription: Stripe.Subscription
): SubscriptionAction {
  console.log('[DETERMINE_ACTION] Analyzing subscription action...')
  
  if (!existingSubscription) {
    console.log('[DETERMINE_ACTION] No existing subscription found -> NEW')
    return SubscriptionAction.NEW
  }
  
  const existingStripeId = existingSubscription.stripe_subscription_id
  const newStripeId = newSubscription.id
  
  if (existingStripeId === newStripeId) {
    console.log('[DETERMINE_ACTION] Same subscription ID -> RENEWAL')
    return SubscriptionAction.RENEWAL
  }
  
  // 不同订阅ID，判断升降级
  const existingTierValue = TIER_VALUES[existingSubscription.tier as TierType] || 0
  const newTier = mapPriceIdToTier(newSubscription.items?.data?.[0]?.price?.id || '')
  const newTierValue = TIER_VALUES[newTier]
  
  console.log(`[DETERMINE_ACTION] Tier comparison: ${existingSubscription.tier}(${existingTierValue}) -> ${newTier}(${newTierValue})`)
  
  if (newTierValue > existingTierValue) {
    console.log('[DETERMINE_ACTION] Higher tier value -> UPGRADE')
    return SubscriptionAction.UPGRADE
  } else if (newTierValue < existingTierValue) {
    console.log('[DETERMINE_ACTION] Lower tier value -> DOWNGRADE')
    return SubscriptionAction.DOWNGRADE
  } else {
    console.log('[DETERMINE_ACTION] Same tier value but different subscription -> NEW')
    return SubscriptionAction.NEW
  }
}

/**
 * 获取订阅的月度积分（统一转换为月度单位）
 */
function getMonthlyCredits(tier: TierType): number {
  const credits = TIER_CREDITS[tier] || 0
  // 如果是年度计划，除以12得到月均积分
  if (tier.includes('-annual')) {
    return Math.floor(credits / 12)
  }
  return credits
}

/**
 * 获取订阅的周期天数
 */
function getPeriodDays(tier: TierType): number {
  return tier.includes('-annual') ? 365 : 30
}

/**
 * 计算升级积分 - 改进版
 * 支持跨周期升级（annual <-> monthly）的正确补偿
 */
function calculateUpgradeCredits(
  oldTier: TierType,
  newTier: TierType,
  daysRemaining: number
): { credits: number, details: any } {
  console.log(`[UPGRADE_CREDITS] 开始计算升级补偿: ${oldTier} -> ${newTier}, 剩余${daysRemaining}天`)

  // 🔧 修复：统一转换为月度积分进行比较
  const oldMonthlyCredits = getMonthlyCredits(oldTier)
  const newMonthlyCredits = getMonthlyCredits(newTier)
  const monthlyDiff = newMonthlyCredits - oldMonthlyCredits

  console.log(`[UPGRADE_CREDITS] 月度积分: ${oldTier}(${oldMonthlyCredits}) -> ${newTier}(${newMonthlyCredits})`)

  if (monthlyDiff <= 0) {
    console.log(`[UPGRADE_CREDITS] 月度积分未增加，不予补偿`)
    return {
      credits: 0,
      details: {
        reason: 'No upgrade or monthly credit increase',
        oldMonthlyCredits,
        newMonthlyCredits,
        monthlyDiff
      }
    }
  }

  // 方案：基础补偿（原订阅剩余价值）+ 升级奖励（当月差价补偿）

  // 1. 计算原订阅剩余价值补偿
  const oldPeriodDays = getPeriodDays(oldTier)
  const oldTotalCredits = TIER_CREDITS[oldTier] || 0
  const oldDailyCredits = oldTotalCredits / oldPeriodDays
  const remainingValueCredits = Math.floor(oldDailyCredits * daysRemaining)

  console.log(`[UPGRADE_CREDITS] 原订阅剩余价值: ${oldDailyCredits.toFixed(2)} 积分/天 × ${daysRemaining}天 = ${remainingValueCredits} 积分`)

  // 2. 计算升级差价补偿（当月的差价，最多补偿30天）
  const daysInCurrentMonth = Math.min(daysRemaining, 30)
  const ratio = daysInCurrentMonth / 30
  const upgradeBonusCredits = Math.floor(monthlyDiff * ratio)

  console.log(`[UPGRADE_CREDITS] 升级差价补偿: (${newMonthlyCredits} - ${oldMonthlyCredits}) × ${ratio.toFixed(2)} = ${upgradeBonusCredits} 积分`)

  // 3. 总补偿 = 剩余价值 + 升级奖励
  const totalCredits = remainingValueCredits + upgradeBonusCredits

  console.log(`[UPGRADE_CREDITS] 总补偿: ${remainingValueCredits} + ${upgradeBonusCredits} = ${totalCredits} 积分`)

  const details = {
    oldTier,
    newTier,
    daysRemaining,
    oldPeriodDays,
    // 原订阅信息
    oldTotalCredits,
    oldMonthlyCredits,
    oldDailyCredits: parseFloat(oldDailyCredits.toFixed(2)),
    // 新订阅信息
    newMonthlyCredits,
    monthlyDiff,
    // 补偿计算
    remainingValueCredits,
    upgradeBonusCredits,
    totalCredits,
    calculation: `剩余价值 ${remainingValueCredits} + 升级奖励 ${upgradeBonusCredits} = ${totalCredits}`
  }

  return { credits: totalCredits, details }
}

/**
 * 计算剩余天数
 */
function calculateDaysRemaining(startTimestamp: number, endTimestamp: number): number {
  const now = Math.floor(Date.now() / 1000)
  const daysRemaining = Math.ceil((endTimestamp - now) / (24 * 60 * 60))
  return Math.max(0, daysRemaining)
}

// ============================================
// 主处理函数
// ============================================

serve(async (request) => {
  console.log(`[WEBHOOK] ${new Date().toISOString()} - Received ${request.method} request`)
  
  // 启动时打印环境配置信息
  const envInfo = getEdgeStripeEnvironmentInfo()
  console.log(`[WEBHOOK] 🔧 运行环境: ${envInfo.environment}`)
  
  // 验证配置
  const validation = validateEdgeStripeConfig()
  if (!validation.valid) {
    console.warn('[WEBHOOK] ⚠️  配置验证警告:', validation.errors)
  }
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  const signature = request.headers.get('Stripe-Signature')
  if (!signature) {
    console.error('[WEBHOOK] Missing Stripe-Signature header')
    return new Response('No signature', { status: 400, headers: corsHeaders })
  }

  const body = await request.text()
  let receivedEvent: Stripe.Event

  // 验证webhook签名
  let verificationSuccess = false
  for (let i = 0; i < WEBHOOK_SECRETS.length; i++) {
    const secret = WEBHOOK_SECRETS[i]
    if (!secret) continue
    
    try {
      receivedEvent = await stripe.webhooks.constructEventAsync(
        body, signature, secret, undefined, cryptoProvider
      )
      verificationSuccess = true
      console.log(`[WEBHOOK] ✅ Signature verification successful with secret ${i + 1}`)
      break
    } catch (err) {
      console.log(`[WEBHOOK] ❌ Secret ${i + 1} failed: ${err.message}`)
      continue
    }
  }
  
  if (!verificationSuccess) {
    console.error('[WEBHOOK] 🚨 ALL signature verifications failed!')
    return new Response('Signature verification failed', { status: 400, headers: corsHeaders })
  }

  // 创建Supabase客户端
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  )

  console.log(`[WEBHOOK] Processing event: ${receivedEvent.type}`)

  try {
    switch (receivedEvent.type) {
      case 'checkout.session.completed': {
        const session = receivedEvent.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session, supabaseClient)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = receivedEvent.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription, supabaseClient)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = receivedEvent.data.object as Stripe.Subscription
        await handleSubscriptionCanceled(subscription, supabaseClient)
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = receivedEvent.data.object as Stripe.PaymentIntent
        await handlePaymentSucceeded(paymentIntent, supabaseClient)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = receivedEvent.data.object as Stripe.Invoice
        await handleInvoicePaymentSucceeded(invoice, supabaseClient)
        break
      }

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${receivedEvent.type}`)
    }
  } catch (error) {
    console.error(`[WEBHOOK] Error processing ${receivedEvent.type}:`, error)
    return new Response(`Webhook Error: ${error.message}`, { 
      status: 400, 
      headers: corsHeaders 
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    status: 200,
  })
})

// ============================================
// 事件处理函数
// ============================================

/**
 * 处理结账完成 - 只负责记录支付信息
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: any) {
  console.log(`[CHECKOUT] Processing checkout completion: ${session.id}`)
  
  const userId = session.metadata?.user_id
  if (!userId) {
    console.warn('[CHECKOUT] No user_id in session metadata - likely a test event, skipping')
    return
  }

  // 检查幂等性
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('stripe_payment_intent_id', session.payment_intent)
    .single()

  if (existingPayment) {
    console.log(`[CHECKOUT] Payment already recorded for session ${session.id}`)
    return
  }

  // 只记录支付信息，不处理积分
  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      stripe_payment_intent_id: session.payment_intent,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency || 'usd',
      status: 'succeeded',
      description: session.mode === 'subscription' ? '订阅支付' : '积分购买',
      metadata: {
        session_id: session.id,
        mode: session.mode,
        ...session.metadata
      }
    })

  if (paymentError) {
    console.error('[CHECKOUT] Error recording payment:', paymentError)
    throw paymentError
  }

  console.log('[CHECKOUT] ✅ Payment recorded successfully')
}

/**
 * 处理订阅更新 - 负责订阅状态和积分处理
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription, supabase: any) {
  console.log(`[SUBSCRIPTION] Processing subscription: ${subscription.id}, status: ${subscription.status}`)
  console.log(`[SUBSCRIPTION] Subscription metadata:`, subscription.metadata)
  
  let userId = subscription.metadata?.user_id
  
  // 如果subscription metadata中没有user_id，尝试从customer获取
  if (!userId && subscription.customer) {
    try {
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
      const customer = await stripe.customers.retrieve(customerId)
      if (customer && !customer.deleted) {
        userId = customer.metadata?.user_id
        console.log(`[SUBSCRIPTION] Found user_id from customer metadata: ${userId}`)
      }
    } catch (error) {
      console.error('[SUBSCRIPTION] Error retrieving customer:', error)
    }
  }
  
  if (!userId) {
    console.warn('[SUBSCRIPTION] No user_id found in subscription or customer metadata - skipping')
    console.warn('[SUBSCRIPTION] Subscription object:', JSON.stringify(subscription, null, 2))
    return
  }

  if (subscription.status !== 'active') {
    console.log(`[SUBSCRIPTION] Subscription status is ${subscription.status}, skipping processing`)
    return
  }

  // 获取订阅信息 - 添加详细调试日志
  const priceId = subscription.items?.data?.[0]?.price?.id || ''
  console.log(`[SUBSCRIPTION] 🔍 Price ID from Stripe: ${priceId}`)
  console.log(`[SUBSCRIPTION] 🔍 Available TIER_VALUES keys:`, Object.keys(TIER_VALUES))
  console.log(`[SUBSCRIPTION] 🔍 Available TIER_CREDITS keys:`, Object.keys(TIER_CREDITS))
  
  const newTier = mapPriceIdToTier(priceId)
  console.log(`[SUBSCRIPTION] 🎯 mapPriceIdToTier returned: ${newTier}`)
  console.log(`[SUBSCRIPTION] 🎯 TIER_VALUES[${newTier}]:`, TIER_VALUES[newTier as keyof typeof TIER_VALUES])
  console.log(`[SUBSCRIPTION] 🎯 TIER_CREDITS[${newTier}]:`, TIER_CREDITS[newTier as keyof typeof TIER_CREDITS])
  
  let periodStart = subscription.current_period_start
  let periodEnd = subscription.current_period_end
  
  // 如果缺少周期时间戳，尝试从发票获取
  if (!periodStart || !periodEnd) {
    console.warn(`[SUBSCRIPTION] Missing period timestamps for subscription ${subscription.id}, fetching from invoice...`)
    
    try {
      // 获取订阅的最新发票
      const invoices = await stripe.invoices.list({
        subscription: subscription.id,
        limit: 1
      })
      
      if (invoices.data.length > 0) {
        const invoice = invoices.data[0]
        if (invoice.lines?.data?.length > 0) {
          const line = invoice.lines.data[0]
          if (line.period?.start && line.period?.end) {
            periodStart = line.period.start
            periodEnd = line.period.end
            console.log(`[SUBSCRIPTION] ✅ Got period from invoice: ${new Date(periodStart * 1000).toISOString()} - ${new Date(periodEnd * 1000).toISOString()}`)
          }
        }
      }
      
      // 如果仍然没有周期信息，使用默认值（当前时间到下个月）
      if (!periodStart || !periodEnd) {
        const now = Math.floor(Date.now() / 1000)
        periodStart = now
        periodEnd = now + (30 * 24 * 60 * 60) // 30天后
        console.warn(`[SUBSCRIPTION] Using default period: ${new Date(periodStart * 1000).toISOString()} - ${new Date(periodEnd * 1000).toISOString()}`)
      }
    } catch (invoiceError) {
      console.error('[SUBSCRIPTION] Error fetching invoice:', invoiceError)
      // 使用默认值
      const now = Math.floor(Date.now() / 1000)
      periodStart = now
      periodEnd = now + (30 * 24 * 60 * 60) // 30天后
      console.warn(`[SUBSCRIPTION] Using fallback period: ${new Date(periodStart * 1000).toISOString()} - ${new Date(periodEnd * 1000).toISOString()}`)
    }
  }

  const daysRemaining = calculateDaysRemaining(periodStart, periodEnd)
  
  console.log(`[SUBSCRIPTION] New subscription details:`)
  console.log(`  - Tier: ${newTier}`)
  console.log(`  - Period: ${new Date(periodStart * 1000).toISOString()} - ${new Date(periodEnd * 1000).toISOString()}`)
  console.log(`  - Days remaining: ${daysRemaining}`)

  // 获取现有订阅 - 添加调试日志
  console.log(`[SUBSCRIPTION] 🔍 Checking existing subscription for user: ${userId}`)
  const { data: existingSubscription, error: rpcError } = await supabase
    .rpc('get_active_subscription', { p_user_id: userId })
    .single()
  
  console.log(`[SUBSCRIPTION] 🔍 RPC get_active_subscription result:`, { existingSubscription, rpcError })

  // 判断操作类型 - 添加调试日志
  console.log(`[SUBSCRIPTION] 🔍 Determining subscription action...`)
  console.log(`[SUBSCRIPTION] 🔍 Existing subscription:`, existingSubscription)
  console.log(`[SUBSCRIPTION] 🔍 New subscription ID: ${subscription.id}`)
  
  const action = determineSubscriptionAction(existingSubscription, subscription)
  console.log(`[SUBSCRIPTION] 🎯 Determined action: ${action}`)

  // 检查幂等性
  const referenceId = `${subscription.id}_${action}_${Date.now()}`
  const { data: existingProcessing } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('reference_id', referenceId)
    .single()

  if (existingProcessing) {
    console.log(`[SUBSCRIPTION] Already processed subscription ${subscription.id} with action ${action}`)
    return
  }

  // 构建订阅数据
  const subscriptionData = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    tier: newTier,
    status: subscription.status,
    current_period_start: new Date(periodStart * 1000).toISOString(),
    current_period_end: new Date(periodEnd * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    action,
    previous_tier: existingSubscription?.tier || null,
    upgraded_from: existingSubscription?.id || null,
    days_remaining: daysRemaining,
    updated_at: new Date().toISOString()
  }

  let subscriptionId: string

  // 处理不同操作类型 - 添加调试日志
  console.log(`[SUBSCRIPTION] 🚀 Processing action: ${action}`)
  console.log(`[SUBSCRIPTION] 🚀 Subscription data:`, subscriptionData)
  
  switch (action) {
    case SubscriptionAction.NEW:
      console.log(`[SUBSCRIPTION] 🆕 Calling handleNewSubscription with tier: ${newTier}`)
      await handleNewSubscription(subscriptionData, supabase, newTier, referenceId)
      break
      
    case SubscriptionAction.UPGRADE:
      subscriptionId = await handleSubscriptionUpgrade(
        existingSubscription, subscriptionData, supabase, newTier, daysRemaining, referenceId
      )
      break
      
    case SubscriptionAction.DOWNGRADE:
      subscriptionId = await handleSubscriptionDowngrade(
        existingSubscription, subscriptionData, supabase, newTier, referenceId
      )
      break
      
    case SubscriptionAction.RENEWAL:
      subscriptionId = await handleSubscriptionRenewal(
        existingSubscription, subscriptionData, supabase, newTier, referenceId
      )
      break
  }
}

/**
 * 处理新订阅
 */
async function handleNewSubscription(
  subscriptionData: any,
  supabase: any,
  tier: TierType,
  referenceId: string
) {
  console.log('[NEW_SUBSCRIPTION] 🆕 Creating new subscription')
  console.log('[NEW_SUBSCRIPTION] 🆕 Input tier:', tier)
  console.log('[NEW_SUBSCRIPTION] 🆕 TierType check:', typeof tier, tier)
  console.log('[NEW_SUBSCRIPTION] 🆕 subscriptionData:', JSON.stringify(subscriptionData, null, 2))
  
  // 🔧 在创建新订阅前，先取消用户的其他active订阅
  console.log('[NEW_SUBSCRIPTION] 🔄 Cancelling existing active subscriptions...')
  const { error: cancelError } = await supabase
    .from('subscriptions')
    .update({ 
      status: 'cancelled', 
      updated_at: new Date().toISOString() 
    })
    .eq('user_id', subscriptionData.user_id)
    .eq('status', 'active')

  if (cancelError) {
    console.warn('[NEW_SUBSCRIPTION] ⚠️ Error cancelling existing subscriptions:', cancelError)
    // 不抛出错误，继续创建新订阅
  } else {
    console.log('[NEW_SUBSCRIPTION] ✅ Existing active subscriptions cancelled')
  }
  
  // 创建订阅记录 - 添加详细调试
  console.log('[NEW_SUBSCRIPTION] 🔄 Attempting database insert...')
  const { data: newSub, error: subError } = await supabase
    .from('subscriptions')
    .insert(subscriptionData)
    .select()
    .single()

  if (subError) {
    console.error('[NEW_SUBSCRIPTION] ❌ Database insert failed!')
    console.error('[NEW_SUBSCRIPTION] ❌ Error details:', JSON.stringify(subError, null, 2))
    console.error('[NEW_SUBSCRIPTION] ❌ Failed data:', JSON.stringify(subscriptionData, null, 2))
    throw subError
  }

  console.log('[NEW_SUBSCRIPTION] ✅ Database insert successful!')
  console.log('[NEW_SUBSCRIPTION] ✅ Created subscription:', JSON.stringify(newSub, null, 2))

  // 添加初始积分 - 添加调试
  const initialCredits = TIER_CREDITS[tier] || 0
  console.log('[NEW_SUBSCRIPTION] 🎯 Initial credits for tier', tier, ':', initialCredits)
  if (initialCredits > 0) {
    const { error: creditError } = await supabase.rpc('add_user_credits', {
      p_user_id: subscriptionData.user_id,
      p_amount: initialCredits,
      p_type: 'reward',
      p_description: `${tier}订阅初始积分`,
      p_reference_id: referenceId,
      p_reference_type: 'subscription_initial'
    })

    if (creditError) {
      console.error('[NEW_SUBSCRIPTION] Error adding initial credits:', creditError)
    } else {
      console.log(`[NEW_SUBSCRIPTION] ✅ Added ${initialCredits} initial credits`)
    }
  }

  // 记录变更日志
  await supabase.rpc('record_subscription_change', {
    p_subscription_id: newSub.id,
    p_user_id: subscriptionData.user_id,
    p_action: 'new',
    p_to_tier: tier,
    p_to_subscription_id: subscriptionData.stripe_subscription_id,
    p_credits_change: initialCredits,
    p_reason: '新订阅创建'
  })

  console.log('[NEW_SUBSCRIPTION] ✅ New subscription processed successfully')
}

/**
 * 处理订阅升级
 */
async function handleSubscriptionUpgrade(
  existingSubscription: any,
  subscriptionData: any,
  supabase: any,
  newTier: TierType,
  daysRemaining: number,
  referenceId: string
): Promise<string> {
  console.log('[UPGRADE] Processing subscription upgrade')
  
  const oldTier = existingSubscription.tier as TierType
  const { credits, details } = calculateUpgradeCredits(oldTier, newTier, daysRemaining)
  
  console.log(`[UPGRADE] Credit calculation:`, details)
  
  // 更新订阅记录
  const { data: updatedSub, error: subError } = await supabase
    .from('subscriptions')
    .update({
      ...subscriptionData,
      credits_change: credits
    })
    .eq('id', existingSubscription.id)
    .select()
    .single()

  if (subError) {
    console.error('[UPGRADE] Error updating subscription:', subError)
    throw subError
  }

  // 添加升级积分
  if (credits > 0) {
    const { error: creditError } = await supabase.rpc('add_user_credits', {
      p_user_id: subscriptionData.user_id,
      p_amount: credits,
      p_type: 'reward',
      p_description: `升级到${newTier}版本奖励积分`,
      p_reference_id: referenceId,
      p_reference_type: 'subscription_upgrade'
    })

    if (creditError) {
      console.error('[UPGRADE] Error adding upgrade credits:', creditError)
    } else {
      console.log(`[UPGRADE] ✅ Added ${credits} upgrade credits`)
    }
  }

  // 记录变更日志
  await supabase.rpc('record_subscription_change', {
    p_subscription_id: updatedSub.id,
    p_user_id: subscriptionData.user_id,
    p_action: 'upgrade',
    p_from_tier: oldTier,
    p_to_tier: newTier,
    p_from_subscription_id: existingSubscription.stripe_subscription_id,
    p_to_subscription_id: subscriptionData.stripe_subscription_id,
    p_credits_change: credits,
    p_days_remaining: daysRemaining,
    p_calculation_details: details,
    p_reason: `从${oldTier}升级到${newTier}`
  })

  console.log('[UPGRADE] ✅ Subscription upgrade processed successfully')
  return updatedSub.id
}

/**
 * 处理订阅降级
 */
async function handleSubscriptionDowngrade(
  existingSubscription: any,
  subscriptionData: any,
  supabase: any,
  newTier: TierType,
  referenceId: string
): Promise<string> {
  console.log('[DOWNGRADE] Processing subscription downgrade')
  
  const oldTier = existingSubscription.tier as TierType
  
  // 更新订阅记录（降级不添加积分）
  const { data: updatedSub, error: subError } = await supabase
    .from('subscriptions')
    .update({
      ...subscriptionData,
      credits_change: 0
    })
    .eq('id', existingSubscription.id)
    .select()
    .single()

  if (subError) {
    console.error('[DOWNGRADE] Error updating subscription:', subError)
    throw subError
  }

  // 记录变更日志
  await supabase.rpc('record_subscription_change', {
    p_subscription_id: updatedSub.id,
    p_user_id: subscriptionData.user_id,
    p_action: 'downgrade',
    p_from_tier: oldTier,
    p_to_tier: newTier,
    p_from_subscription_id: existingSubscription.stripe_subscription_id,
    p_to_subscription_id: subscriptionData.stripe_subscription_id,
    p_credits_change: 0,
    p_reason: `从${oldTier}降级到${newTier}`
  })

  console.log(`[DOWNGRADE] ✅ Subscription downgrade processed: ${oldTier} -> ${newTier}`)
  return updatedSub.id
}

/**
 * 处理订阅续费
 */
async function handleSubscriptionRenewal(
  existingSubscription: any,
  subscriptionData: any,
  supabase: any,
  tier: TierType,
  referenceId: string
): Promise<string> {
  console.log('[RENEWAL] Processing subscription renewal')
  
  // 更新订阅周期
  const { data: updatedSub, error: subError } = await supabase
    .from('subscriptions')
    .update({
      current_period_start: subscriptionData.current_period_start,
      current_period_end: subscriptionData.current_period_end,
      action: 'renewal',
      updated_at: subscriptionData.updated_at
    })
    .eq('id', existingSubscription.id)
    .select()
    .single()

  if (subError) {
    console.error('[RENEWAL] Error updating subscription:', subError)
    throw subError
  }

  // 添加续费积分
  const renewalCredits = TIER_CREDITS[tier] || 0
  if (renewalCredits > 0) {
    const { error: creditError } = await supabase.rpc('add_user_credits', {
      p_user_id: subscriptionData.user_id,
      p_amount: renewalCredits,
      p_type: 'reward',
      p_description: `${tier}订阅续费积分`,
      p_reference_id: referenceId,
      p_reference_type: 'subscription_renewal'
    })

    if (creditError) {
      console.error('[RENEWAL] Error adding renewal credits:', creditError)
    } else {
      console.log(`[RENEWAL] ✅ Added ${renewalCredits} renewal credits`)
    }
  }

  console.log('[RENEWAL] ✅ Subscription renewal processed successfully')
  return updatedSub.id
}

/**
 * 处理订阅取消
 */
async function handleSubscriptionCanceled(subscription: Stripe.Subscription, supabase: any) {
  console.log(`[CANCEL] Processing subscription cancellation: ${subscription.id}`)
  
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      action: 'cancel',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('[CANCEL] Error updating subscription to cancelled:', error)
    throw error
  }

  console.log('[CANCEL] ✅ Subscription cancellation processed')
}

/**
 * 处理支付成功
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  console.log(`[PAYMENT] Processing payment success: ${paymentIntent.id}`)
  
  const userId = paymentIntent.metadata?.user_id
  const credits = parseInt(paymentIntent.metadata?.credits || '0')
  const type = paymentIntent.metadata?.type

  if (!userId) {
    console.warn('[PAYMENT] No user_id in payment metadata - skipping')
    return
  }

  // 只处理积分购买，订阅相关的积分由subscription事件处理
  if (type === 'credit_purchase' && credits > 0) {
    const { error: creditError } = await supabase.rpc('add_user_credits', {
      p_user_id: userId,
      p_amount: credits,
      p_type: 'purchase',
      p_description: `购买${credits}积分`,
      p_reference_id: paymentIntent.id,
      p_reference_type: 'payment_intent'
    })

    if (creditError) {
      console.error('[PAYMENT] Error adding purchased credits:', creditError)
      throw creditError
    } else {
      console.log(`[PAYMENT] ✅ Added ${credits} purchased credits`)
    }
  }

  // 更新支付状态
  const { error: updateError } = await supabase
    .from('payments')
    .update({ status: 'succeeded', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (updateError) {
    console.error('[PAYMENT] Error updating payment status:', updateError)
  }
}

/**
 * 处理发票支付成功
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, supabase: any) {
  console.log(`[INVOICE] Processing invoice payment success: ${invoice.id}`)
  // 发票支付成功通常由subscription事件处理，这里只记录日志
}