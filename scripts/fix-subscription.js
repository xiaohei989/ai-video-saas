#!/usr/bin/env node

/**
 * 手动修复用户订阅状态
 * 当webhook处理失败时使用此脚本手动创建订阅记录
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fixUserSubscription() {
  const userId = 'fa38674f-1e5b-4132-9fb7-192940e52a32'
  const stripeSubscriptionId = 'sub_test_manual_fix_' + Date.now()
  
  console.log('🔧 开始修复用户订阅状态...')
  console.log('用户ID:', userId)
  
  try {
    // 检查是否已存在活跃订阅
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()
    
    if (existing) {
      console.log('✅ 用户已有活跃订阅:', existing)
      return
    }
    
    // 创建专业版订阅记录
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    
    const subscriptionData = {
      user_id: userId,
      stripe_subscription_id: stripeSubscriptionId,
      tier: 'pro',
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      action: 'new',
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }
    
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single()
    
    if (error) {
      console.error('❌ 创建订阅记录失败:', error)
      return
    }
    
    console.log('✅ 成功创建专业版订阅记录:', data)
    
    // 记录变更日志
    await supabase.rpc('record_subscription_change', {
      p_subscription_id: data.id,
      p_user_id: userId,
      p_action: 'new',
      p_to_tier: 'pro',
      p_to_subscription_id: stripeSubscriptionId,
      p_credits_change: 0,
      p_reason: '手动修复订阅状态'
    })
    
    console.log('🎉 订阅状态修复完成！用户现在应该显示为专业版用户。')
    
  } catch (error) {
    console.error('❌ 修复失败:', error)
  }
}

// 执行修复
fixUserSubscription()