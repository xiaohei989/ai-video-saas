#!/usr/bin/env node
// 检查所有卡在pending状态的视频

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('🔍 检查卡在pending状态的视频\n')

  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, status, migration_status, migration_last_attempt_at, migration_attempts, migration_error, video_url, r2_url, created_at, updated_at')
    .eq('status', 'completed')
    .eq('migration_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    console.error('❌ 查询失败:', error.message)
    return
  }

  console.log(`📊 找到 ${videos.length} 个卡在pending的视频\n`)

  videos.forEach((v, i) => {
    const createdAt = new Date(v.created_at)
    const now = new Date()
    const stuckMinutes = Math.floor((now - createdAt) / 1000 / 60)

    console.log(`[${i + 1}] ${v.title}`)
    console.log(`    ID: ${v.id}`)
    console.log(`    视频生成时间: ${v.created_at}`)
    console.log(`    最后更新时间: ${v.updated_at}`)
    console.log(`    卡在pending时长: ${stuckMinutes} 分钟`)
    console.log(`    迁移尝试次数: ${v.migration_attempts || 0}`)
    console.log(`    迁移最后尝试: ${v.migration_last_attempt_at || '从未尝试'}`)
    console.log(`    video_url: ${v.video_url ? '✅ 有' : '❌ 无'}`)
    console.log(`    r2_url: ${v.r2_url ? '✅ 有' : '❌ 无'}`)
    console.log(`    错误信息: ${v.migration_error || '无'}`)
    console.log('')
  })

  // 统计
  const hasAttempted = videos.filter(v => v.migration_last_attempt_at)
  const neverAttempted = videos.filter(v => !v.migration_last_attempt_at)

  console.log('📈 统计分析:')
  console.log(`  尝试过迁移: ${hasAttempted.length} 个`)
  console.log(`  从未尝试迁移: ${neverAttempted.length} 个`)

  const avgStuckMinutes = videos.reduce((sum, v) => {
    const created = new Date(v.created_at)
    const now = new Date()
    return sum + (now - created) / 1000 / 60
  }, 0) / videos.length

  console.log(`  平均卡住时长: ${Math.floor(avgStuckMinutes)} 分钟`)

  console.log('\n🎯 诊断结论:')

  if (neverAttempted.length > 0) {
    console.log(`  ❌ ${neverAttempted.length} 个视频的迁移从未启动（migration_last_attempt_at 为 NULL）`)
    console.log('     说明 R2 迁移触发器可能根本没执行！')
  }

  const longStuck = videos.filter(v => {
    const created = new Date(v.created_at)
    const now = new Date()
    return (now - created) / 1000 / 60 > 10
  })

  if (longStuck.length > 0) {
    console.log(`  ⚠️  ${longStuck.length} 个视频卡在pending超过10分钟，需要超时机制`)
  }
}

main().catch(console.error)
