#!/usr/bin/env node

/**
 * 清理重复的活跃订阅，只保留最新的
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function cleanupDuplicateSubscriptions() {
  const userId = 'fa38674f-1e5b-4132-9fb7-192940e52a32'
  
  console.log('🔧 开始清理重复订阅...')
  console.log('用户ID:', userId)
  
  try {
    // 获取所有活跃订阅，按创建时间倒序
    const { data: activeSubs, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ 查询失败:', error)
      return
    }
    
    if (activeSubs.length <= 1) {
      console.log('✅ 没有重复订阅需要清理')
      return
    }
    
    console.log(`\n📊 找到 ${activeSubs.length} 个活跃订阅`)
    activeSubs.forEach((sub, index) => {
      console.log(`${index + 1}. ${sub.tier} - ${sub.created_at} (${sub.stripe_subscription_id})`)
    })
    
    // 保留最新的（第一个），取消其他的
    const keepSubscription = activeSubs[0]
    const cancelSubscriptions = activeSubs.slice(1)
    
    console.log(`\n✅ 保留订阅: ${keepSubscription.id} (${keepSubscription.tier})`)
    console.log(`❌ 取消订阅: ${cancelSubscriptions.length} 个`)
    
    // 批量取消重复订阅
    for (const sub of cancelSubscriptions) {
      console.log(`\n🚫 取消订阅 ${sub.id}...`)
      
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          action: 'cancel'
        })
        .eq('id', sub.id)
      
      if (updateError) {
        console.error(`❌ 取消订阅 ${sub.id} 失败:`, updateError)
      } else {
        console.log(`✅ 订阅 ${sub.id} 已取消`)
      }
      
      // 记录变更日志
      try {
        await supabase.rpc('record_subscription_change', {
          p_subscription_id: sub.id,
          p_user_id: userId,
          p_action: 'cancel',
          p_from_tier: sub.tier,
          p_to_tier: 'cancelled',
          p_from_subscription_id: sub.stripe_subscription_id,
          p_credits_change: 0,
          p_reason: '清理重复订阅'
        })
      } catch (logError) {
        console.log(`⚠️  记录变更日志失败: ${logError.message}`)
      }
    }
    
    // 验证清理结果
    console.log('\n🔍 验证清理结果...')
    const { data: remainingSubs, error: checkError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
    
    if (checkError) {
      console.error('❌ 验证失败:', checkError)
    } else {
      console.log(`✅ 清理完成！剩余活跃订阅: ${remainingSubs.length} 个`)
      remainingSubs.forEach(sub => {
        console.log(`   - ${sub.tier} (${sub.id})`)
      })
    }
    
  } catch (error) {
    console.error('❌ 清理失败:', error)
  }
}

// 执行清理
cleanupDuplicateSubscriptions()