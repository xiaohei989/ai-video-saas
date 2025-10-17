#!/usr/bin/env node
// 列出最新的失败视频

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
  const limit = parseInt(process.argv[2] || '20', 10)

  console.log(`🔍 查询最近 ${limit} 个失败的视频\n`)

  // 查询条件：status = completed 但 migration_status = failed 或 thumbnail 缺失
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, status, migration_status, video_url, r2_url, thumbnail_url, thumbnail_generation_status, thumbnail_generation_error, created_at, processing_completed_at')
    .eq('status', 'completed')
    .or('migration_status.eq.failed,thumbnail_url.is.null')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ 查询失败:', error.message)
    return
  }

  if (!videos || videos.length === 0) {
    console.log('✅ 没有找到失败的视频')
    return
  }

  console.log(`找到 ${videos.length} 个问题视频\n`)
  console.log('============================================\n')

  let migrationFailed = 0
  let noThumbnail = 0
  let thumbnailFailed = 0

  videos.forEach((v, idx) => {
    const isMigrationFailed = v.migration_status === 'failed'
    const hasNoThumbnail = !v.thumbnail_url || v.thumbnail_url.startsWith('data:image/svg')
    const isThumbnailFailed = v.thumbnail_generation_status === 'failed'

    if (isMigrationFailed) migrationFailed++
    if (hasNoThumbnail) noThumbnail++
    if (isThumbnailFailed) thumbnailFailed++

    console.log(`[${idx + 1}] ${v.title}`)
    console.log(`    ID: ${v.id}`)
    console.log(`    创建时间: ${v.created_at}`)
    console.log(`    完成时间: ${v.processing_completed_at || '(未设置)'}`)

    // 迁移状态
    if (isMigrationFailed) {
      console.log(`    ❌ 迁移状态: failed`)
      console.log(`       - video_url (OSS): ${v.video_url ? '✅' : '❌'}`)
      console.log(`       - r2_url: ${v.r2_url ? '✅' : '❌'}`)
    } else {
      console.log(`    ⚠️  迁移状态: ${v.migration_status || 'NULL'}`)
    }

    // 缩略图状态
    if (hasNoThumbnail) {
      console.log(`    ❌ 缩略图: 缺失`)
      console.log(`       - thumbnail_generation_status: ${v.thumbnail_generation_status || 'NULL'}`)
      if (v.thumbnail_generation_error) {
        console.log(`       - 错误: ${v.thumbnail_generation_error}`)
      }
    } else {
      console.log(`    ✅ 缩略图: 存在`)
      if (isThumbnailFailed) {
        console.log(`       - 状态: failed`)
        if (v.thumbnail_generation_error) {
          console.log(`       - 错误: ${v.thumbnail_generation_error}`)
        }
      }
    }

    // 问题类型
    const issues = []
    if (isMigrationFailed) issues.push('迁移失败')
    if (hasNoThumbnail) issues.push('无缩略图')
    if (isThumbnailFailed) issues.push('缩略图生成失败')

    console.log(`    🔴 问题: ${issues.join(', ')}`)
    console.log('')
  })

  console.log('============================================')
  console.log('📊 问题统计:')
  console.log('============================================')
  console.log(`总问题视频数: ${videos.length}`)
  console.log(`  ❌ 迁移失败: ${migrationFailed} 个`)
  console.log(`  ❌ 无缩略图: ${noThumbnail} 个`)
  console.log(`  ❌ 缩略图生成失败: ${thumbnailFailed} 个`)
  console.log('')

  // 按问题类型分组
  const byIssue = {
    '迁移失败+无缩略图': 0,
    '仅迁移失败': 0,
    '仅无缩略图': 0,
    '缩略图生成失败': 0
  }

  videos.forEach(v => {
    const isMigrationFailed = v.migration_status === 'failed'
    const hasNoThumbnail = !v.thumbnail_url || v.thumbnail_url.startsWith('data:image/svg')
    const isThumbnailFailed = v.thumbnail_generation_status === 'failed'

    if (isMigrationFailed && hasNoThumbnail) {
      byIssue['迁移失败+无缩略图']++
    } else if (isMigrationFailed) {
      byIssue['仅迁移失败']++
    } else if (hasNoThumbnail) {
      byIssue['仅无缩略图']++
    }

    if (isThumbnailFailed) {
      byIssue['缩略图生成失败']++
    }
  })

  console.log('问题类型分布:')
  Object.entries(byIssue).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`  - ${type}: ${count} 个`)
    }
  })

  console.log('')
  console.log('============================================')
  console.log('💡 建议操作:')
  console.log('============================================')

  if (migrationFailed > 0 && noThumbnail > 0) {
    console.log(`1. 应用缩略图修复:`)
    console.log(`   chmod +x scripts/apply-thumbnail-fix.sh`)
    console.log(`   ./scripts/apply-thumbnail-fix.sh`)
    console.log('')
  }

  if (migrationFailed > 5) {
    console.log(`2. 调查 R2 迁移失败原因（${migrationFailed} 个视频迁移失败）`)
    console.log(`   - 检查 R2 配置和 API 密钥`)
    console.log(`   - 查看迁移 Edge Function 日志`)
    console.log('')
  }

  if (thumbnailFailed > 0) {
    console.log(`3. 查看缩略图生成失败详情:`)
    console.log(`   SELECT id, title, thumbnail_generation_error`)
    console.log(`   FROM videos`)
    console.log(`   WHERE thumbnail_generation_status = 'failed'`)
    console.log(`   ORDER BY created_at DESC;`)
    console.log('')
  }
}

main().catch(err => {
  console.error('❌ 执行失败:', err)
  process.exit(1)
})
