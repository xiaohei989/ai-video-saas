#!/usr/bin/env node
// 立即为卡在pending的视频生成缩略图（不等待R2迁移）

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('🔧 开始为pending视频生成缩略图\n')

  // 1. 查找所有卡在pending的视频（有video_url但没有缩略图）
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, video_url, thumbnail_url, migration_status')
    .eq('status', 'completed')
    .eq('migration_status', 'pending')
    .not('video_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ 查询失败:', error.message)
    return
  }

  console.log(`📊 找到 ${videos.length} 个pending视频\n`)

  let successCount = 0
  let failedCount = 0
  let skippedCount = 0

  for (const video of videos) {
    // 跳过已有缩略图的视频
    if (video.thumbnail_url && !video.thumbnail_url.startsWith('data:image/svg')) {
      console.log(`⏭️  跳过 (已有缩略图): ${video.title}`)
      skippedCount++
      continue
    }

    console.log(`🔄 处理: ${video.title}`)
    console.log(`   video_url: ${video.video_url}`)

    try {
      // 调用缩略图生成Edge Function
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/auto-generate-thumbnail`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            videoId: video.id,
            videoUrl: video.video_url
          })
        }
      )

      const result = await response.json()

      if (response.ok && result.success) {
        console.log(`   ✅ 成功: ${result.thumbnailUrl || '生成中'}`)
        successCount++
      } else {
        console.log(`   ❌ 失败: ${result.error || '未知错误'}`)
        failedCount++
      }
    } catch (err) {
      console.log(`   ❌ 异常: ${err.message}`)
      failedCount++
    }

    console.log('')
  }

  console.log('========================================')
  console.log('📈 执行统计:')
  console.log(`  成功: ${successCount} 个`)
  console.log(`  失败: ${failedCount} 个`)
  console.log(`  跳过: ${skippedCount} 个`)
  console.log('========================================')
  console.log('')

  if (successCount > 0) {
    console.log('✅ 缩略图生成已触发！请等待1-2分钟后检查结果')
  }
}

main().catch(console.error)
