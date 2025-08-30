#!/usr/bin/env node

/**
 * 分析积分异常增加原因
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function analyzeCreditTransactions() {
  const userId = 'fa38674f-1e5b-4132-9fb7-192940e52a32'
  
  console.log('🔍 分析积分交易记录...')
  console.log('用户ID:', userId)
  
  try {
    // 获取最近的积分交易记录
    const { data: transactions, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (error) {
      console.error('❌ 查询失败:', error)
      return
    }
    
    console.log('📊 最近20条积分交易记录:')
    console.log('==========================================')
    
    transactions.forEach((transaction, index) => {
      console.log(`${index + 1}. 时间: ${transaction.created_at}`)
      console.log(`   类型: ${transaction.type} | 金额: ${transaction.amount}`)
      console.log(`   描述: ${transaction.description}`)
      console.log(`   引用ID: ${transaction.reference_id}`)
      console.log(`   引用类型: ${transaction.reference_type}`)
      console.log(`   余额: ${transaction.balance}`)
      console.log('------------------------------------------')
    })
    
    // 分析重复处理
    const referenceGroups = {}
    transactions.forEach(t => {
      if (t.reference_id) {
        if (!referenceGroups[t.reference_id]) {
          referenceGroups[t.reference_id] = []
        }
        referenceGroups[t.reference_id].push(t)
      }
    })
    
    console.log('🔄 重复处理分析:')
    Object.entries(referenceGroups).forEach(([refId, txns]) => {
      if (txns.length > 1) {
        console.log(`⚠️  引用ID ${refId} 有 ${txns.length} 条记录:`)
        txns.forEach(t => {
          console.log(`   - ${t.amount} 积分 (${t.description}) - ${t.created_at}`)
        })
      }
    })
    
    // 统计最近24小时的积分变化
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.created_at) > yesterday
    )
    
    const totalCredits = recentTransactions.reduce((sum, t) => sum + t.amount, 0)
    
    console.log('📈 最近24小时积分统计:')
    console.log(`   总变化: ${totalCredits} 积分`)
    console.log(`   交易数: ${recentTransactions.length}`)
    
  } catch (error) {
    console.error('❌ 分析失败:', error)
  }
}

// 执行分析
analyzeCreditTransactions()