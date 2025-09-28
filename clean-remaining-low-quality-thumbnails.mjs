#!/usr/bin/env node

/**
 * 清理剩余的低质量缩略图
 * 基于之前分析发现的5个低质量缩略图
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

// 根据之前分析识别的低质量缩略图
const LOW_QUALITY_TITLES = [
  "Fireside Whispers: Cozy Moments",
  "壁炉旁的温馨自娱时光", 
  "艺术咖啡机的魔法时刻",
  "小鸭子街头滑板秀",
  "Cozy Moments by the Fire"
]

async function analyzeLowQualityThumbnails() {
  console.log('🔍 分析剩余的低质量缩略图...')
  
  // 查询所有有缩略图的视频
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, created_at')
    .not('thumbnail_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('❌ 查询失败:', error)
    return []
  }

  const lowQualityVideos = []

  console.log('📊 分析缩略图质量...')
  for (const video of videos) {
    const url = video.thumbnail_url
    
    // 检查是否是Base64格式
    if (url.startsWith('data:image')) {
      const base64Part = url.split(',')[1]
      if (base64Part) {
        const sizeKB = (base64Part.length * 0.75 / 1024).toFixed(2)
        
        // 小于20KB认为是低质量
        if (parseFloat(sizeKB) < 20) {
          console.log(`⚠️ 发现低质量Base64缩略图: ${video.title} - ${sizeKB}KB`)
          lowQualityVideos.push({...video, type: 'base64', size: parseFloat(sizeKB)})
        }
      }
    } else if (url.includes('cdn.veo3video.me') || url.includes('http')) {
      // 检查远程缩略图大小
      try {
        const response = await fetch(url, { method: 'HEAD' })
        const contentLength = response.headers.get('content-length')
        
        if (contentLength) {
          const sizeKB = (parseInt(contentLength) / 1024).toFixed(2)
          
          // 小于20KB认为是低质量
          if (parseFloat(sizeKB) < 20) {
            console.log(`⚠️ 发现低质量远程缩略图: ${video.title} - ${sizeKB}KB`)
            lowQualityVideos.push({...video, type: 'remote', size: parseFloat(sizeKB)})
          }
        }
      } catch (error) {
        console.warn(`❓ 无法检测远程缩略图: ${video.title} - ${error.message}`)
      }
    }
  }

  return lowQualityVideos
}

async function deleteLowQualityThumbnails(videos) {
  if (videos.length === 0) {
    console.log('✅ 没有找到低质量缩略图需要删除')
    return
  }

  console.log(`🗑️ 开始删除 ${videos.length} 个低质量缩略图...`)
  
  let deletedCount = 0
  
  for (const video of videos) {
    try {
      console.log(`\n📹 处理视频: ${video.title}`)
      console.log(`   ID: ${video.id}`)
      console.log(`   类型: ${video.type}`)
      console.log(`   大小: ${video.size}KB`)
      
      // 删除缩略图URL，触发重新生成
      const { error } = await supabase
        .from('videos')
        .update({ 
          thumbnail_url: null
        })
        .eq('id', video.id)
      
      if (error) {
        console.error(`❌ 删除失败: ${video.id}`, error)
      } else {
        console.log(`✅ 删除成功: ${video.title}`)
        deletedCount++
      }
      
      // 避免过快操作数据库
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      console.error(`❌ 处理视频出错: ${video.id}`, error)
    }
  }
  
  console.log(`\n📊 删除完成统计:`)
  console.log(`总计处理: ${videos.length} 个`)
  console.log(`删除成功: ${deletedCount} 个`)
  console.log(`删除失败: ${videos.length - deletedCount} 个`)
}

async function verifyDeletion() {
  console.log('\n🔍 验证删除结果...')
  
  const { data: remainingVideos } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url')
    .not('thumbnail_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  let lowQualityCount = 0
  let highQualityCount = 0
  
  for (const video of remainingVideos || []) {
    const url = video.thumbnail_url
    
    if (url.startsWith('data:image')) {
      const base64Part = url.split(',')[1]
      if (base64Part) {
        const sizeKB = (base64Part.length * 0.75 / 1024).toFixed(2)
        if (parseFloat(sizeKB) < 20) {
          lowQualityCount++
          console.log(`⚠️ 仍有低质量: ${video.title} - ${sizeKB}KB`)
        } else {
          highQualityCount++
        }
      }
    } else if (url.includes('cdn.veo3video.me')) {
      try {
        const response = await fetch(url, { method: 'HEAD' })
        const contentLength = response.headers.get('content-length')
        
        if (contentLength) {
          const sizeKB = (parseInt(contentLength) / 1024).toFixed(2)
          if (parseFloat(sizeKB) < 20) {
            lowQualityCount++
            console.log(`⚠️ 仍有低质量: ${video.title} - ${sizeKB}KB`)
          } else {
            highQualityCount++
          }
        }
      } catch (error) {
        console.warn(`❓ 无法验证: ${video.title}`)
      }
    }
  }
  
  console.log(`\n📊 验证结果:`)
  console.log(`低质量缩略图: ${lowQualityCount} 个`)
  console.log(`高质量缩略图: ${highQualityCount} 个`)
  
  if (lowQualityCount === 0) {
    console.log('🎉 所有低质量缩略图已清理完成！')
  } else {
    console.log('⚠️ 还有低质量缩略图需要清理')
  }
}

async function main() {
  try {
    console.log('🚀 开始清理剩余的低质量缩略图...')
    console.log('=' .repeat(50))
    
    // 1. 分析现有缩略图质量
    const lowQualityVideos = await analyzeLowQualityThumbnails()
    
    // 2. 删除低质量缩略图
    await deleteLowQualityThumbnails(lowQualityVideos)
    
    // 3. 验证删除结果
    await verifyDeletion()
    
    console.log('\n✅ 低质量缩略图清理任务完成!')
    console.log('💡 下次视频播放时将自动生成高质量缩略图 (640x360, 质量0.90)')
    
  } catch (error) {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  }
}

// 检查环境变量
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 缺少必要的环境变量: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

main()