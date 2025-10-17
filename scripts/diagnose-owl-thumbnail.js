#!/usr/bin/env node
// 诊断 Tiny Baby Owl 视频的缩略图问题

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 缺少环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  const videoId = '3b9b3dc5-6bf4-4b37-ad28-511069c045a0'

  console.log('🔍 诊断 Owl 视频缩略图问题\n')
  console.log('============================================')
  console.log('第1步：检查视频字段状态')
  console.log('============================================\n')

  // 查询视频详细信息
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single()

  if (videoError) {
    console.error('❌ 查询失败:', videoError.message)
    return
  }

  console.log('📊 关键字段:')
  console.log('  ├─ status:', video.status)
  console.log('  ├─ migration_status:', video.migration_status || '❌ NULL (这是问题!)')
  console.log('  ├─ video_url:', video.video_url ? '✅ 存在' : '❌ 不存在')
  console.log('  ├─ r2_url:', video.r2_url || '❌ NULL')
  console.log('  ├─ thumbnail_url:', video.thumbnail_url || '❌ NULL')
  console.log('  ├─ thumbnail_generation_status:', video.thumbnail_generation_status || '❌ NULL')
  console.log('  ├─ thumbnail_generation_attempts:', video.thumbnail_generation_attempts || 0)
  console.log('  ├─ thumbnail_generation_error:', video.thumbnail_generation_error || '(无)')
  console.log('  └─ r2_uploaded_at:', video.r2_uploaded_at || '❌ NULL')

  console.log('\n============================================')
  console.log('第2步：检查触发器是否存在')
  console.log('============================================\n')

  // 检查触发器
  const { data: triggers, error: triggerError } = await supabase.rpc('check_triggers')

  if (triggerError) {
    console.log('⚠️ 无法使用RPC检查触发器，尝试直接查询...')

    // 尝试直接查询 pg_trigger
    const query = `
      SELECT
        tgname as trigger_name,
        tgtype,
        tgenabled as enabled
      FROM pg_trigger
      JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
      WHERE pg_class.relname = 'videos'
        AND tgname LIKE '%thumbnail%';
    `

    // 使用简单查询
    console.log('  触发器信息：需要管理员权限查询')
  } else {
    console.log('✅ 触发器存在:', triggers)
  }

  console.log('\n============================================')
  console.log('第3步：检查 system_config 配置')
  console.log('============================================\n')

  const { data: configs, error: configError } = await supabase
    .from('system_config')
    .select('*')
    .in('key', ['supabase_url', 'service_role_key'])

  if (configError) {
    console.log('❌ 无法读取 system_config:', configError.message)
  } else if (!configs || configs.length === 0) {
    console.log('❌ system_config 表为空！这是触发器失败的原因！')
  } else {
    console.log('✅ system_config 配置:')
    configs.forEach(c => {
      const displayValue = c.key === 'service_role_key'
        ? (c.value ? `${c.value.substring(0, 20)}...` : '(空)')
        : (c.value || '(空)')
      console.log(`  ├─ ${c.key}: ${displayValue}`)
    })
  }

  console.log('\n============================================')
  console.log('第4步：诊断结果')
  console.log('============================================\n')

  const issues = []
  const solutions = []

  // 检查 migration_status
  if (!video.migration_status || video.migration_status !== 'completed') {
    issues.push('❌ migration_status 不是 "completed"')
    solutions.push('✅ 触发器监听的是 migration_status 变为 completed，而不是 status')
    solutions.push('   解决方案：手动设置 migration_status = "completed" 或修改触发器逻辑')
  }

  // 检查 system_config
  if (!configs || configs.length < 2) {
    issues.push('❌ system_config 配置缺失')
    solutions.push('✅ 需要在 system_config 表中添加 supabase_url 和 service_role_key')
  }

  // 检查是否有 r2_url
  if (!video.r2_url) {
    issues.push('⚠️ 视频尚未迁移到 R2 存储')
    solutions.push('   说明：触发器设计为在 R2 迁移完成后触发')
  }

  if (issues.length > 0) {
    console.log('🔴 发现问题:')
    issues.forEach(issue => console.log(`  ${issue}`))
    console.log('')
    console.log('💡 解决方案:')
    solutions.forEach(sol => console.log(`  ${sol}`))
  } else {
    console.log('✅ 所有检查通过')
  }

  console.log('\n============================================')
  console.log('第5步：根本原因分析')
  console.log('============================================\n')

  console.log('🎯 根本原因:')
  console.log('')
  console.log('触发器配置为监听 "migration_status = completed"')
  console.log('但这个视频的 migration_status 是:', video.migration_status || 'NULL')
  console.log('')
  console.log('触发器条件 (supabase/migrations/026):')
  console.log('  IF NEW.migration_status = \'completed\'')
  console.log('     AND (OLD.migration_status IS NULL OR OLD.migration_status != \'completed\')')
  console.log('     AND NEW.video_url IS NOT NULL')
  console.log('     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE \'data:image/svg%\')')
  console.log('')
  console.log('📌 migration_status 用于追踪视频从阿里云OSS迁移到Cloudflare R2的状态')
  console.log('📌 这个视频还在阿里云OSS上 (video_url 有值但 r2_url 为空)')
  console.log('📌 所以 migration_status 永远不会变成 completed，触发器也就永远不会执行!')
  console.log('')
  console.log('💡 解决方案选项:')
  console.log('  方案1: 修改触发器，也监听 status = completed (适合未迁移的视频)')
  console.log('  方案2: 先将视频迁移到R2，migration_status 会自动更新为 completed')
  console.log('  方案3: 手动调用 Edge Function 生成缩略图 (临时方案)')
  console.log('')
}

main().catch(err => {
  console.error('❌ 执行失败:', err)
  process.exit(1)
})
