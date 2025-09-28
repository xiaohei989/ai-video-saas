#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function analyzeAndFixLowQualityR2() {
  console.log('🔍 分析和修复低质量R2缩略图...')

  // 查询所有R2 CDN缩略图
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, created_at, processing_completed_at')
    .not('thumbnail_url', 'is', null)
    .like('thumbnail_url', '%cdn.veo3video.me%')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  if (!videos || videos.length === 0) {
    console.log('❌ 未找到R2 CDN存储的缩略图')
    return
  }

  console.log(`📹 分析 ${videos.length} 个R2 CDN缩略图...`)

  let highQualityCount = 0
  let mediumQualityCount = 0
  let lowQualityCount = 0
  const lowQualityVideos = []

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i]
    
    try {
      const response = await fetch(video.thumbnail_url, { method: 'HEAD' })
      
      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        
        if (contentLength) {
          const sizeNum = parseInt(contentLength)
          const sizeKB = (sizeNum / 1024).toFixed(2)
          
          console.log(`${i+1}. ${video.title} - ${sizeKB}KB`)
          
          if (sizeNum < 10000) {
            lowQualityCount++
            lowQualityVideos.push({
              id: video.id,
              title: video.title,
              url: video.thumbnail_url,
              sizeKB: parseFloat(sizeKB),
              created: video.created_at,
              completed: video.processing_completed_at
            })
            console.log(`   ⚠️ 低质量 (<10KB)`)
          } else if (sizeNum < 30000) {
            mediumQualityCount++
            console.log(`   🟡 中等质量 (10-30KB)`)
          } else {
            highQualityCount++
            console.log(`   ✅ 高质量 (>30KB)`)
          }
        }
      }
    } catch (error) {
      console.log(`${i+1}. ${video.title} - ❌ 无法访问`)
    }
  }

  console.log('\n📊 R2 CDN质量统计:')
  console.log(`高质量 (>30KB): ${highQualityCount} 个`)
  console.log(`中等质量 (10-30KB): ${mediumQualityCount} 个`)
  console.log(`低质量 (<10KB): ${lowQualityCount} 个`)

  if (lowQualityCount > 0) {
    console.log('\n🚨 发现低质量R2缩略图详情:')
    for (const video of lowQualityVideos) {
      console.log(`\n📹 ${video.title}`)
      console.log(`   ID: ${video.id}`)
      console.log(`   文件大小: ${video.sizeKB}KB`)
      console.log(`   创建时间: ${new Date(video.created).toLocaleString('zh-CN')}`)
      console.log(`   完成时间: ${video.completed ? new Date(video.completed).toLocaleString('zh-CN') : '未完成'}`)
      console.log(`   URL: ${video.url}`)
      
      // 检查这个缩略图是何时生成的
      const timeDiff = video.completed ? new Date(video.completed) - new Date(video.created) : 0
      if (timeDiff > 0) {
        const processingMinutes = Math.round(timeDiff / 60000)
        console.log(`   处理时长: ${processingMinutes} 分钟`)
        
        // 如果是在我们修复之前生成的，说明是老的低质量缩略图
        const fixDate = new Date('2025-09-25') // 我们修复的日期
        if (new Date(video.completed) < fixDate) {
          console.log(`   🔧 建议: 这是修复前生成的低质量缩略图，应该重新生成`)
        }
      }
    }

    console.log(`\n💡 修复建议:`)
    console.log(`发现了 ${lowQualityCount} 个低质量的R2缩略图`)
    console.log(`这些可能是在质量修复之前生成的旧缩略图`)
    console.log(`建议清除这些低质量缩略图，让系统重新生成高质量版本`)
  } else {
    console.log('\n🎉 所有R2缩略图质量都符合标准！')
  }
}

await analyzeAndFixLowQualityR2()