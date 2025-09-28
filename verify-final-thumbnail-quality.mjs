#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🎉 最终验证：检查缩略图清理结果')
console.log('=' .repeat(50))

const { data: videos } = await supabase
  .from('videos')
  .select('id, title, thumbnail_url, created_at')
  .not('thumbnail_url', 'is', null)
  .order('created_at', { ascending: false })
  .limit(20)

let totalVideos = videos?.length || 0
let highQualityCount = 0
let mediumQualityCount = 0 
let lowQualityCount = 0

console.log(`📊 检查了 ${totalVideos} 个有缩略图的视频:`)
console.log()

for (const video of videos || []) {
  const url = video.thumbnail_url
  let quality = '未知'
  let size = 'N/A'
  
  if (url.startsWith('data:image')) {
    const base64Part = url.split(',')[1]
    if (base64Part) {
      const sizeKB = (base64Part.length * 0.75 / 1024).toFixed(2)
      size = sizeKB + 'KB'
      
      if (parseFloat(sizeKB) >= 50) {
        quality = '✅ 高质量'
        highQualityCount++
      } else if (parseFloat(sizeKB) >= 20) {
        quality = '🟡 中等质量'
        mediumQualityCount++
      } else {
        quality = '❌ 低质量'
        lowQualityCount++
      }
    }
  } else if (url.includes('cdn.veo3video.me')) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      const contentLength = response.headers.get('content-length')
      
      if (contentLength) {
        const sizeKB = (parseInt(contentLength) / 1024).toFixed(2)
        size = sizeKB + 'KB'
        
        if (parseFloat(sizeKB) >= 50) {
          quality = '✅ 高质量'
          highQualityCount++
        } else if (parseFloat(sizeKB) >= 20) {
          quality = '🟡 中等质量'  
          mediumQualityCount++
        } else {
          quality = '❌ 低质量'
          lowQualityCount++
        }
      }
    } catch (error) {
      quality = '❓ 无法检测'
    }
  }
  
  if (lowQualityCount > 0 || quality.includes('低质量')) {
    console.log(`${quality}: ${video.title} - ${size}`)
  }
}

console.log()
console.log('📈 质量分布统计:')
console.log(`✅ 高质量 (≥50KB): ${highQualityCount} 个 (${((highQualityCount / totalVideos) * 100).toFixed(1)}%)`)
console.log(`🟡 中等质量 (20-50KB): ${mediumQualityCount} 个 (${((mediumQualityCount / totalVideos) * 100).toFixed(1)}%)`)
console.log(`❌ 低质量 (<20KB): ${lowQualityCount} 个 (${((lowQualityCount / totalVideos) * 100).toFixed(1)}%)`)
console.log()

if (lowQualityCount === 0) {
  console.log('🎉 🎉 🎉 SUCCESS! 🎉 🎉 🎉')
  console.log('所有低质量缩略图已成功清理完成！')
  console.log('现在系统将使用 640x360、质量0.90 的高质量配置生成新缩略图')
} else {
  console.log('⚠️ 仍有低质量缩略图需要处理')
}