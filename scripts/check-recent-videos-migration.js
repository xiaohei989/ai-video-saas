#!/usr/bin/env node
// 检查最近视频的迁移和缩略图状态

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
  console.log('🔍 检查最近 20 个已完成视频的状态\n')

  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, status, migration_status, video_url, r2_url, thumbnail_url, thumbnail_generation_status, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ 查询失败:', error.message)
    return
  }

  if (!videos || videos.length === 0) {
    console.log('❌ 没有找到已完成的视频')
    return
  }

  console.log(`找到 ${videos.length} 个已完成的视频\n`)
  console.log('============================================')

  let withThumbnail = 0
  let withoutThumbnail = 0
  let migrationCompleted = 0
  let migrationFailed = 0
  let migrationNull = 0
  let onlyOSS = 0
  let onR2 = 0

  videos.forEach((v, idx) => {
    console.log(`\n[${idx + 1}] ${v.title.substring(0, 50)}`)
    console.log(`    ID: ${v.id}`)
    console.log(`    创建时间: ${v.created_at}`)
    console.log(`    migration_status: ${v.migration_status || 'NULL'} ${
      v.migration_status === 'completed' ? '✅' :
      v.migration_status === 'failed' ? '❌' :
      v.migration_status === 'pending' ? '⏳' : '⚠️'
    }`)
    console.log(`    video_url (OSS): ${v.video_url ? '✅' : '❌'}`)
    console.log(`    r2_url: ${v.r2_url ? '✅' : '❌'}`)
    console.log(`    thumbnail_url: ${v.thumbnail_url ? '✅' : '❌'}`)
    console.log(`    thumbnail_generation_status: ${v.thumbnail_generation_status || 'NULL'}`)

    // 统计
    if (v.thumbnail_url && !v.thumbnail_url.startsWith('data:image/svg')) {
      withThumbnail++
    } else {
      withoutThumbnail++
    }

    if (v.migration_status === 'completed') migrationCompleted++
    else if (v.migration_status === 'failed') migrationFailed++
    else migrationNull++

    if (v.video_url && !v.r2_url) onlyOSS++
    if (v.r2_url) onR2++
  })

  console.log('\n============================================')
  console.log('📊 统计摘要:')
  console.log('============================================')
  console.log(`总数: ${videos.length}`)
  console.log(`\n缩略图状态:`)
  console.log(`  ✅ 有缩略图: ${withThumbnail}`)
  console.log(`  ❌ 无缩略图: ${withoutThumbnail}`)
  console.log(`\n迁移状态:`)
  console.log(`  ✅ migration_status = completed: ${migrationCompleted}`)
  console.log(`  ❌ migration_status = failed: ${migrationFailed}`)
  console.log(`  ⚠️  migration_status = NULL: ${migrationNull}`)
  console.log(`\n存储位置:`)
  console.log(`  📦 仅在 OSS: ${onlyOSS}`)
  console.log(`  ☁️  已迁移到 R2: ${onR2}`)

  console.log('\n============================================')
  console.log('🎯 关键发现:')
  console.log('============================================')

  if (onlyOSS > 0 && withoutThumbnail > 0) {
    console.log(`❌ 有 ${onlyOSS} 个视频仅在 OSS 上，其中 ${withoutThumbnail} 个没有缩略图`)
    console.log('   原因：触发器只监听 migration_status = "completed"')
    console.log('   这些视频的 migration_status 是 failed 或 NULL，触发器不会执行')
  }

  if (migrationFailed > 0) {
    console.log(`\n⚠️  有 ${migrationFailed} 个视频迁移失败`)
    console.log('   这些视频永远不会触发缩略图生成')
  }

  if (withoutThumbnail > 0) {
    console.log(`\n💡 建议:`)
    console.log(`   1. 修改触发器，监听 status = "completed" 而不仅是 migration_status`)
    console.log(`   2. 或者为迁移失败的视频添加备用触发逻辑`)
    console.log(`   3. 或者手动触发缩略图生成`)
  }

  console.log('')
}

main().catch(err => {
  console.error('❌ 执行失败:', err)
  process.exit(1)
})
