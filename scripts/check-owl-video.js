#!/usr/bin/env node
// 检查 "Tiny Baby Owl on Your Finger" 视频的缩略图生成情况

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ 缺少环境变量：VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function main() {
  console.log('🔎 查询 "Tiny Baby Owl on Your Finger" 视频...\n')

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .ilike('title', '%Tiny Baby Owl on Your Finger%')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('❌ 查询失败:', error.message)
    process.exit(1)
  }

  if (!data?.length) {
    console.log('❌ 没有找到该视频')
    process.exit(0)
  }

  const video = data[0]

  console.log('📊 视频基本信息:')
  console.log('  ID:', video.id)
  console.log('  标题:', video.title)
  console.log('  状态:', video.status)
  console.log('  创建时间:', video.created_at)
  console.log('  更新时间:', video.updated_at)
  console.log('  处理完成时间:', video.processing_completed_at || '(未设置)')

  console.log('\n🎬 视频链接:')
  console.log('  video_url:', video.video_url || '(无)')
  console.log('  r2_url:', video.r2_url || '(无)')

  console.log('\n🖼️ 缩略图信息:')
  console.log('  thumbnail_url:', video.thumbnail_url || '(无)')
  console.log('  thumbnail_blur_url:', video.thumbnail_blur_url || '(无)')
  console.log('  thumbnail_generated_at:', video.thumbnail_generated_at || '(未生成)')
  console.log('  thumbnail_metadata:', JSON.stringify(video.thumbnail_metadata, null, 2) || '(无)')

  console.log('\n🔄 迁移状态:')
  console.log('  migration_status:', video.migration_status || '(无)')
  console.log('  r2_uploaded_at:', video.r2_uploaded_at || '(未上传)')

  // 检查缩略图是否为占位符
  if (video.thumbnail_url?.startsWith('data:image/svg+xml')) {
    console.log('\n⚠️ 警告: 缩略图仍为占位符 SVG!')
  }

  // 尝试访问缩略图链接
  if (video.thumbnail_url && video.thumbnail_url.startsWith('http')) {
    console.log('\n🌐 正在检测缩略图可访问性...')
    try {
      const res = await fetch(video.thumbnail_url, { method: 'HEAD' })
      console.log('  HTTP状态:', res.status, res.ok ? '✅' : '❌')
    } catch (e) {
      console.log('  访问失败:', e.message)
    }
  }

  // 检查触发器执行日志（如果有pg_net扩展）
  console.log('\n🔍 检查pg_net请求日志...')
  const { data: netLogs, error: netError } = await supabase
    .from('_net_http_response')
    .select('*')
    .order('created', { ascending: false })
    .limit(5)

  if (netError) {
    console.log('  无法访问 _net_http_response 表:', netError.message)
  } else if (netLogs?.length) {
    console.log('  最近的pg_net请求:')
    netLogs.forEach((log, i) => {
      console.log(`    [${i+1}] ${log.created}: ${log.url} -> ${log.status_code}`)
    })
  } else {
    console.log('  无pg_net请求日志')
  }
}

main().catch(err => {
  console.error('❌ 执行失败:', err)
  process.exit(1)
})
