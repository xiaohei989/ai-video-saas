#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function verifyThumbnailDeletion() {
  console.log('🔍 验证删除结果和新缩略图生成状况...')

  // 查询用户视频的缩略图状态
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, created_at, video_url')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  console.log(`📹 检查最近 ${videos.length} 个用户视频的缩略图状态:`)
  console.log('============================================')

  let hasNewThumbnails = 0
  let hasNoThumbnails = 0
  let hasOldThumbnails = 0

  for (const video of videos) {
    const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
    const hasThumbUrl = !!video.thumbnail_url
    
    console.log(`\n📱 ${video.title}`)
    console.log(`   创建时间: ${createdAt}`)
    
    if (hasThumbUrl) {
      const url = video.thumbnail_url
      console.log('   缩略图: ✅ 有')
      
      if (url.startsWith('data:image/')) {
        // Base64缩略图
        const base64Part = url.split(',')[1]
        if (base64Part) {
          const sizeKB = (base64Part.length * 0.75 / 1024).toFixed(2)
          console.log(`   类型: 📊 Base64缓存 (${sizeKB}KB)`)
          
          if (parseFloat(sizeKB) > 30) {
            hasNewThumbnails++
            console.log('   质量: ✅ 新的高质量缩略图')
          } else {
            hasOldThumbnails++
            console.log('   质量: ⚠️ 可能是旧的低质量图')
          }
        }
      } else if (url.includes('cdn.veo3video.me')) {
        // R2 CDN缩略图
        console.log('   类型: 🌐 R2 CDN图片')
        try {
          const response = await fetch(url, { method: 'HEAD' })
          if (response.ok) {
            const contentLength = response.headers.get('content-length')
            if (contentLength) {
              const sizeKB = (parseInt(contentLength) / 1024).toFixed(2)
              console.log(`   文件大小: ${sizeKB}KB`)
              
              if (parseFloat(sizeKB) >= 50) {
                hasNewThumbnails++
                console.log('   质量: ✅ 新的高质量缩略图')
              } else {
                hasOldThumbnails++
                console.log('   质量: ⚠️ 低质量图 (<50KB)')
              }
            } else {
              console.log('   状态: ❓ 无法获取大小')
              hasOldThumbnails++
            }
          } else {
            console.log('   状态: ❌ 无法访问')
            hasOldThumbnails++
          }
        } catch (e) {
          console.log('   状态: ❌ 检测失败')
          hasOldThumbnails++
        }
      }
    } else {
      hasNoThumbnails++
      console.log('   缩略图: ❌ 无 (等待生成)')
    }
  }

  console.log('\n📊 删除操作验证结果:')
  console.log('=============================')
  console.log(`总视频数: ${videos.length}`)
  console.log(`新的高质量缩略图: ${hasNewThumbnails} 个`)
  console.log(`无缩略图(等待生成): ${hasNoThumbnails} 个`)
  console.log(`仍有低质量图: ${hasOldThumbnails} 个`)

  if (hasNoThumbnails > 0) {
    console.log(`\n✅ 删除成功! ${hasNoThumbnails} 个视频的缩略图已被清除`)
    console.log('💡 这些视频将在下次访问时自动生成新的高质量缩略图')
  } else {
    console.log('\n❌ 似乎缩略图未被正确删除')
  }

  if (hasNewThumbnails > 0) {
    console.log(`\n🎉 发现 ${hasNewThumbnails} 个新生成的高质量缩略图!`)
    console.log('🔧 缩略图质量修复功能正常工作')
  }
}

await verifyThumbnailDeletion()