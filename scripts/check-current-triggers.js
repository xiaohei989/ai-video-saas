#!/usr/bin/env node
// 检查当前数据库中的触发器配置

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('🔍 检查当前触发器配置\n')

  // 查询所有与缩略图相关的触发器
  const { data: triggers, error } = await supabase
    .rpc('sql', {
      query: `
        SELECT
          t.tgname as trigger_name,
          p.proname as function_name,
          pg_get_triggerdef(t.oid) as trigger_definition
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'videos'
          AND (t.tgname LIKE '%thumbnail%' OR t.tgname LIKE '%migrate%')
        ORDER BY t.tgname;
      `
    })

  if (error) {
    console.log('⚠️  无法直接查询触发器，尝试其他方法...\n')

    // 手动检查最新的7个视频，看看触发器是否工作
    const { data: videos } = await supabase
      .from('videos')
      .select('id, title, status, migration_status, thumbnail_url, thumbnail_generation_status, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10)

    console.log('📋 最近10个已完成视频的状态:\n')
    videos.forEach((v, i) => {
      console.log(`[${i+1}] ${v.title}`)
      console.log(`    migration_status: ${v.migration_status || 'NULL'}`)
      console.log(`    thumbnail_url: ${v.thumbnail_url ? '有' : '无'}`)
      console.log(`    thumbnail_generation_status: ${v.thumbnail_generation_status || 'NULL'}`)
      console.log('')
    })

    // 分析触发模式
    const withMigrationCompleted = videos.filter(v => v.migration_status === 'completed')
    const withThumbnail = videos.filter(v => v.thumbnail_url && !v.thumbnail_url.startsWith('data:image/svg'))
    const withoutThumbnail = videos.filter(v => !v.thumbnail_url || v.thumbnail_url.startsWith('data:image/svg'))

    console.log('📊 统计分析:')
    console.log(`  migration_status = completed: ${withMigrationCompleted.length} 个`)
    console.log(`  有缩略图: ${withThumbnail.length} 个`)
    console.log(`  无缩略图: ${withoutThumbnail.length} 个`)
    console.log('')

    console.log('🎯 触发器行为分析:')
    if (withMigrationCompleted.length > 0) {
      const completedWithThumbnail = withMigrationCompleted.filter(v =>
        v.thumbnail_url && !v.thumbnail_url.startsWith('data:image/svg')
      )
      console.log(`  迁移完成的视频中，${completedWithThumbnail.length}/${withMigrationCompleted.length} 有缩略图`)

      if (completedWithThumbnail.length === withMigrationCompleted.length) {
        console.log('  ✅ 触发器似乎正常工作（迁移完成 = 有缩略图）')
      } else {
        console.log('  ⚠️  部分迁移完成的视频没有缩略图')
      }
    }

    const migrationFailed = videos.filter(v => v.migration_status === 'failed')
    if (migrationFailed.length > 0) {
      const failedWithThumbnail = migrationFailed.filter(v =>
        v.thumbnail_url && !v.thumbnail_url.startsWith('data:image/svg')
      )
      console.log(`  迁移失败的视频中，${failedWithThumbnail.length}/${migrationFailed.length} 有缩略图`)

      if (failedWithThumbnail.length > 0) {
        console.log('  ✅ 新触发器（027）正在工作（迁移失败也能生成缩略图）')
      } else {
        console.log('  ❌ 迁移失败的视频都没有缩略图')
      }
    }

    const migrationPending = videos.filter(v => v.migration_status === 'pending' || v.migration_status === 'downloading' || v.migration_status === 'uploading')
    if (migrationPending.length > 0) {
      console.log(`  ⚠️  有 ${migrationPending.length} 个视频卡在迁移过程中（pending/downloading/uploading）`)
      console.log('     这些视频需要超时机制来自动重试')
    }

  } else {
    console.log('✅ 触发器信息:')
    console.log(JSON.stringify(triggers, null, 2))
  }
}

main().catch(console.error)
