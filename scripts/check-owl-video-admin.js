#!/usr/bin/env node
// 检查 "Tiny Baby Owl on Your Finger" 视频的缩略图生成情况（使用 service_role key）

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 缺少环境变量：VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function main() {
  console.log('🔎 查询包含 "Owl" 的视频...\n')

  // 先查询包含 Owl 的视频
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .ilike('title', '%owl%')
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.error('❌ 查询失败:', error.message)

    // 如果查询失败，尝试查询最近的视频
    console.log('\n尝试查询最近10个视频...')
    const { data: recentData, error: recentError } = await supabase
      .from('videos')
      .select('id, title, status, created_at, thumbnail_url')
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentError) {
      console.error('❌ 查询最近视频也失败:', recentError.message)
      process.exit(1)
    }

    if (recentData?.length) {
      console.log('\n📋 最近生成的视频:')
      recentData.forEach((v, i) => {
        console.log(`  ${i+1}. [${v.status}] ${v.title}`)
        console.log(`     ID: ${v.id}`)
        console.log(`     创建时间: ${v.created_at}`)
        console.log(`     缩略图: ${v.thumbnail_url?.substring(0, 50) || '(无)'}`)
        console.log('')
      })
    }
    return
  }

  if (!data?.length) {
    console.log('❌ 没有找到包含 "Owl" 的视频')

    // 尝试查询最近的视频
    console.log('\n尝试查询最近10个视频...')
    const { data: recentData, error: recentError } = await supabase
      .from('videos')
      .select('id, title, status, created_at, thumbnail_url, thumbnail_generated_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!recentError && recentData?.length) {
      console.log('\n📋 最近生成的视频:')
      recentData.forEach((v, i) => {
        console.log(`  ${i+1}. [${v.status}] ${v.title}`)
        console.log(`     ID: ${v.id}`)
        console.log(`     创建时间: ${v.created_at}`)
        console.log(`     缩略图生成: ${v.thumbnail_generated_at || '(未生成)'}`)
        console.log(`     缩略图URL: ${v.thumbnail_url?.substring(0, 60) || '(无)'}`)
        console.log('')
      })
    }
    return
  }

  console.log(`✅ 找到 ${data.length} 个包含 "Owl" 的视频\n`)

  for (const video of data) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
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
    console.log('  thumbnail_url:', video.thumbnail_url?.substring(0, 100) || '(无)')
    console.log('  thumbnail_blur_url:', video.thumbnail_blur_url?.substring(0, 100) || '(无)')
    console.log('  thumbnail_generated_at:', video.thumbnail_generated_at || '(未生成)')

    if (video.thumbnail_metadata) {
      console.log('  thumbnail_metadata:', JSON.stringify(video.thumbnail_metadata, null, 2))
    }

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

    console.log('')
  }
}

main().catch(err => {
  console.error('❌ 执行失败:', err)
  process.exit(1)
})
