#!/usr/bin/env node

/**
 * 检查用户的所有订阅记录
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkUserSubscriptions() {
  const userId = 'fa38674f-1e5b-4132-9fb7-192940e52a32'
  
  console.log('🔍 检查用户订阅记录...')
  console.log('用户ID:', userId)
  console.log('==========================================')
  
  try {
    // 获取所有订阅记录
    const { data: allSubs, error: allError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (allError) {
      console.error('❌ 查询失败:', allError)
      return
    }
    
    console.log(`\n📊 找到 ${allSubs.length} 条订阅记录:`)
    
    allSubs.forEach((sub, index) => {
      console.log(`\n${index + 1}. 订阅记录 ${sub.id}`)
      console.log(`   Tier: ${sub.tier}`)
      console.log(`   状态: ${sub.status}`)
      console.log(`   Stripe订阅ID: ${sub.stripe_subscription_id}`)
      console.log(`   创建时间: ${sub.created_at}`)
      console.log(`   周期: ${sub.current_period_start} → ${sub.current_period_end}`)
      console.log(`   操作: ${sub.action}`)
    })
    
    // 检查活跃订阅
    console.log('\n🎯 检查活跃订阅查询:')
    const { data: activeSubs, error: activeError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
    
    if (activeError) {
      console.error('❌ 活跃订阅查询失败:', activeError)
    } else {
      console.log(`找到 ${activeSubs.length} 个活跃订阅:`)
      activeSubs.forEach(sub => {
        console.log(`- ${sub.tier} (ID: ${sub.id})`)
      })
      
      if (activeSubs.length > 1) {
        console.log('\n⚠️  检测到多个活跃订阅！这会导致.single()查询失败')
        console.log('建议保留最新的订阅，其他的改为cancelled状态')
      }
    }
    
    // 测试single查询
    console.log('\n🧪 测试single查询:')
    const { data: singleSub, error: singleError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()
    
    if (singleError) {
      console.log(`❌ Single查询失败: ${singleError.message} (${singleError.code})`)
    } else {
      console.log(`✅ Single查询成功: ${singleSub.tier}`)
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error)
  }
}

// 执行检查
checkUserSubscriptions()