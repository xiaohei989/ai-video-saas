#!/usr/bin/env node
// 检查 Owl 视频的缩略图生成详细状态

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  const videoId = '3b9b3dc5-6bf4-4b37-ad28-511069c045a0'

  console.log('🔍 检查 Owl 视频缩略图生成状态\n')

  const { data: video, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single()

  if (error) {
    console.error('❌ 查询失败:', error.message)
    return
  }

  console.log('📊 视频信息:')
  console.log('  标题:', video.title)
  console.log('  状态:', video.status)
  console.log('  video_url:', video.video_url ? '✅' : '❌')
  console.log('')
  console.log('🔄 迁移状态:')
  console.log('  migration_status:', video.migration_status || 'NULL')
  console.log('  r2_url:', video.r2_url ? '✅' : '❌')
  console.log('')
  console.log('🖼️ 缩略图状态:')
  console.log('  thumbnail_url:', video.thumbnail_url || '❌ NULL')
  console.log('  thumbnail_generation_status:', video.thumbnail_generation_status || 'NULL')
  console.log('  thumbnail_generation_attempts:', video.thumbnail_generation_attempts || 0)
  console.log('  thumbnail_generation_error:', video.thumbnail_generation_error || '(无)')
  console.log('  thumbnail_generation_started_at:', video.thumbnail_generation_started_at || '(未开始)')
  console.log('  thumbnail_generation_last_attempt_at:', video.thumbnail_generation_last_attempt_at || '(未尝试)')
  console.log('')

  // 判断问题
  console.log('🎯 问题分析:')

  if (!video.thumbnail_generation_status) {
    console.log('  ❌ thumbnail_generation_status 为 NULL')
    console.log('     说明缩略图生成从未被触发过！')
  }

  if (video.migration_status === 'failed') {
    console.log('  ⚠️  migration_status = failed')
    console.log('     触发器应该会为迁移失败的视频生成缩略图')
  }

  if (!video.video_url) {
    console.log('  ❌ video_url 为空，无法生成缩略图')
  }

  console.log('')
  console.log('💡 建议操作:')
  console.log('  手动触发这个视频的缩略图生成:')
  console.log(`  UPDATE videos SET updated_at = NOW() WHERE id = '${videoId}';`)
}

main().catch(console.error)
