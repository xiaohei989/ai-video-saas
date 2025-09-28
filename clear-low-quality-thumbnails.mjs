#!/usr/bin/env node

/**
 * 清理低质量缩略图缓存脚本
 * 清除小于15KB的Base64缓存图片，强制重新生成高质量缩略图
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * 分析Base64图片质量
 */
function analyzeBase64Quality(dataUrl) {
  if (!dataUrl.startsWith('data:image/')) return null
  
  const base64Part = dataUrl.split(',')[1]
  if (!base64Part) return null
  
  const sizeKB = (base64Part.length * 0.75 / 1024)
  const format = dataUrl.includes('webp') ? 'WebP' : dataUrl.includes('jpeg') ? 'JPEG' : 'PNG'
  
  return {
    sizeKB: parseFloat(sizeKB.toFixed(2)),
    format,
    isLowQuality: sizeKB < 15 // 小于15KB认为是低质量
  }
}

/**
 * 清理低质量缩略图缓存
 */
async function clearLowQualityThumbnailCache() {
  console.log('🧹 开始清理低质量缩略图缓存...')
  
  try {
    // 查询所有有Base64缩略图的用户视频
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, user_id, created_at')
      .not('thumbnail_url', 'is', null)
      .like('thumbnail_url', 'data:image/%')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('❌ 查询视频失败:', error)
      return
    }

    if (!videos || videos.length === 0) {
      console.log('✅ 没有找到Base64缓存的缩略图')
      return
    }

    console.log(`📊 找到 ${videos.length} 个Base64缓存缩略图`)

    let lowQualityCount = 0
    let highQualityCount = 0
    let clearedCount = 0
    const lowQualityVideos = []

    // 分析所有Base64缩略图的质量
    for (const video of videos) {
      const quality = analyzeBase64Quality(video.thumbnail_url)
      
      if (quality) {
        console.log(`📹 ${video.title}`)
        console.log(`   大小: ${quality.sizeKB}KB (${quality.format})`)
        console.log(`   质量: ${quality.isLowQuality ? '⚠️ 低质量' : '✅ 高质量'}`)
        console.log(`   创建时间: ${new Date(video.created_at).toLocaleString('zh-CN')}`)
        
        if (quality.isLowQuality) {
          lowQualityCount++
          lowQualityVideos.push({
            id: video.id,
            title: video.title,
            sizeKB: quality.sizeKB,
            format: quality.format
          })
        } else {
          highQualityCount++
        }
        console.log('   ---')
      }
    }

    console.log('\n📊 质量分析结果:')
    console.log(`高质量缓存: ${highQualityCount} 个`)
    console.log(`低质量缓存: ${lowQualityCount} 个`)

    if (lowQualityCount === 0) {
      console.log('🎉 没有发现低质量缓存，无需清理！')
      return
    }

    console.log('\n🧹 开始清理低质量缓存...')
    
    // 清理低质量缓存
    for (const video of lowQualityVideos) {
      console.log(`🗑️ 清理: ${video.title} (${video.sizeKB}KB ${video.format})`)
      
      const { error: updateError } = await supabase
        .from('videos')
        .update({ 
          thumbnail_url: null,
          thumbnail_generation_status: 'pending'
        })
        .eq('id', video.id)

      if (updateError) {
        console.error(`❌ 清理失败 ${video.id}:`, updateError)
      } else {
        clearedCount++
        console.log(`✅ 已清理: ${video.title}`)
      }
    }

    console.log(`\n🎉 清理完成！`)
    console.log(`总数: ${videos.length}`)
    console.log(`高质量保留: ${highQualityCount}`)  
    console.log(`低质量清理: ${clearedCount}`)
    console.log(`\n💡 下次页面加载时，系统将自动为这些视频生成新的高质量缩略图`)
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error)
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
清理低质量缩略图缓存脚本

用法: node clear-low-quality-thumbnails.mjs

功能:
  - 扫描所有Base64缓存的缩略图
  - 识别小于15KB的低质量图片  
  - 清除低质量缓存，保留高质量缓存
  - 标记为重新生成，下次访问时自动生成高质量缩略图

特点:
  - 安全清理：只清理确认的低质量缓存
  - 保护高质量：保留23KB以上的高质量缓存
  - 自动恢复：清理后系统自动重新生成
    `)
    return
  }

  await clearLowQualityThumbnailCache()
}

main().catch(console.error)