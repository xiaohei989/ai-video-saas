#!/usr/bin/env node
/**
 * Supabase Realtime 连接测试脚本
 * 用于验证 Realtime 订阅是否正常工作
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: join(__dirname, '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  process.exit(1)
}

console.log('🔧 Supabase Realtime 连接测试')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`📡 Supabase URL: ${supabaseUrl}`)
console.log(`🔑 使用 anon key (前20字符): ${supabaseAnonKey.substring(0, 20)}...`)
console.log('')

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

console.log('1️⃣ 测试基础连接...')

// 测试基础查询
try {
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, ai_title_status')
    .limit(1)

  if (error) {
    console.error('❌ 数据库查询失败:', error.message)
  } else {
    console.log('✅ 数据库连接正常')
    console.log(`   找到视频记录: ${data.length} 条`)
  }
} catch (err) {
  console.error('❌ 查询异常:', err.message)
}

console.log('')
console.log('2️⃣ 测试 Realtime 订阅...')

const testUserId = 'test-user-id' // 这里需要替换成真实的用户ID
const channelName = `test-realtime-${Date.now()}`

let subscriptionSuccess = false
let updateReceived = false

const channel = supabase
  .channel(channelName)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'videos'
    },
    (payload) => {
      console.log('✅ 收到 Realtime 事件:', payload.eventType)
      updateReceived = true
    }
  )
  .subscribe((status, err) => {
    console.log(`📡 订阅状态: ${status}`)

    if (status === 'SUBSCRIBED') {
      console.log('✅ Realtime 订阅成功建立!')
      subscriptionSuccess = true
    } else if (status === 'CLOSED') {
      console.log('🔴 订阅连接关闭')
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ 订阅频道错误:', err)
    } else if (status === 'TIMED_OUT') {
      console.error('⏱️ 订阅连接超时')
    }
  })

// 等待 5 秒观察结果
await new Promise(resolve => setTimeout(resolve, 5000))

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 测试结果总结:')
console.log(`   订阅建立: ${subscriptionSuccess ? '✅ 成功' : '❌ 失败'}`)
console.log(`   频道状态: ${channel.state}`)

if (!subscriptionSuccess) {
  console.log('')
  console.log('🔧 故障排查建议:')
  console.log('   1. 检查 Supabase Dashboard -> Database -> Replication')
  console.log('   2. 确认 videos 表已启用 Replication')
  console.log('   3. 检查 RLS 策略是否阻止了订阅')
  console.log('   4. 验证网络连接和防火墙设置')
}

// 清理
channel.unsubscribe()
process.exit(subscriptionSuccess ? 0 : 1)
