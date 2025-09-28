#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkR2ThumbnailQuality() {
  console.log('🔍 检查远程CDN缩略图质量...')

  // 查询最近的R2 CDN缩略图
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, created_at')
    .not('thumbnail_url', 'is', null)
    .like('thumbnail_url', '%cdn.veo3video.me%')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  if (!videos || videos.length === 0) {
    console.log('❌ 未找到R2 CDN存储的缩略图')
    return
  }

  console.log(`📹 找到 ${videos.length} 个R2 CDN缩略图，开始质量分析:`)

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i]
    console.log(`\n${i+1}. 视频: ${video.title}`)
    console.log(`   创建时间: ${new Date(video.created_at).toLocaleString('zh-CN')}`)
    console.log(`   CDN地址: ${video.thumbnail_url}`)
    
    try {
      // 检测远程图片质量
      const response = await fetch(video.thumbnail_url, { method: 'HEAD' })
      
      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        const contentType = response.headers.get('content-type')
        
        console.log(`   HTTP状态: ✅ ${response.status} OK`)
        console.log(`   Content-Type: ${contentType}`)
        
        if (contentLength) {
          const sizeKB = (parseInt(contentLength) / 1024).toFixed(2)
          console.log(`   文件大小: ${sizeKB}KB`)
          
          // 质量评估
          const sizeNum = parseInt(contentLength)
          if (sizeNum < 10000) {
            console.log(`   质量评估: ⚠️ 很小，可能是低质量 (<10KB)`)
          } else if (sizeNum < 30000) {
            console.log(`   质量评估: 🟡 中等质量 (10-30KB)`)
          } else {
            console.log(`   质量评估: ✅ 高质量 (>30KB)`)
          }
          
          // 检查是否是WebP格式
          if (contentType?.includes('webp')) {
            console.log(`   格式优势: ✅ WebP格式，压缩效率高`)
          }
        } else {
          console.log(`   文件大小: ❓ 无法获取`)
        }
      } else {
        console.log(`   HTTP状态: ❌ ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.log(`   访问状态: ❌ 无法访问 - ${error.message}`)
    }
  }

  console.log('\n📊 质量检查完成！')
}

await checkR2ThumbnailQuality()