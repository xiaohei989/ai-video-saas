#!/usr/bin/env node

/**
 * 删除用户视频中所有小于50KB的低质量缩略图
 * 只处理用户生成的视频，不影响模板缩略图
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function deleteLowQualityUserThumbnails() {
  console.log('🔍 扫描用户视频缩略图质量...')
  
  // 设置是否为测试模式
  const dryRun = process.argv.includes('--dry-run')
  const threshold = 50 // 50KB阈值
  
  if (dryRun) {
    console.log('🔍 [DRY RUN] 测试模式，不会实际修改数据')
  }
  
  console.log(`📏 质量阈值: ${threshold}KB`)

  // 查询所有用户视频的缩略图（排除模板）
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, user_id, created_at')
    .not('thumbnail_url', 'is', null)
    .not('user_id', 'is', null) // 确保是用户视频
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  if (!videos || videos.length === 0) {
    console.log('❌ 未找到用户视频缩略图')
    return
  }

  console.log(`📹 检查 ${videos.length} 个用户视频缩略图...`)

  const lowQualityVideos = []
  let checkedCount = 0
  let highQualityCount = 0
  let mediumQualityCount = 0

  // 分析每个缩略图的质量
  for (const video of videos) {
    checkedCount++
    console.log(`进度: ${checkedCount}/${videos.length} - ${video.title}`)
    
    const url = video.thumbnail_url
    let sizeKB = 0
    let qualityStatus = '未知'
    
    try {
      if (url.startsWith('data:image/')) {
        // Base64缩略图 - 估算大小
        const base64Part = url.split(',')[1]
        if (base64Part) {
          sizeKB = (base64Part.length * 0.75 / 1024)
          qualityStatus = 'Base64'
        }
      } else if (url.includes('cdn.veo3video.me') || url.includes('http')) {
        // 远程缩略图 - HTTP检查
        const response = await fetch(url, { method: 'HEAD' })
        
        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          if (contentLength) {
            sizeKB = parseInt(contentLength) / 1024
            qualityStatus = 'R2 CDN'
          }
        } else {
          console.log(`   ❌ HTTP错误: ${response.status}`)
          continue
        }
      }
      
      const sizeKBRounded = parseFloat(sizeKB.toFixed(2))
      
      // 根据质量分类
      if (sizeKBRounded < threshold) {
        lowQualityVideos.push({
          id: video.id,
          title: video.title,
          url: video.thumbnail_url,
          sizeKB: sizeKBRounded,
          type: qualityStatus,
          userId: video.user_id,
          created: video.created_at
        })
        console.log(`   ⚠️ 低质量: ${sizeKBRounded}KB (${qualityStatus})`)
      } else if (sizeKBRounded < 100) {
        mediumQualityCount++
        console.log(`   🟡 中等质量: ${sizeKBRounded}KB (${qualityStatus})`)
      } else {
        highQualityCount++
        console.log(`   ✅ 高质量: ${sizeKBRounded}KB (${qualityStatus})`)
      }
      
    } catch (error) {
      console.log(`   ❌ 检查失败: ${error.message}`)
    }
  }

  console.log(`\n📊 用户视频缩略图质量统计:`)
  console.log(`总检查数: ${checkedCount}`)
  console.log(`高质量 (≥100KB): ${highQualityCount} 个`)
  console.log(`中等质量 (${threshold}-100KB): ${mediumQualityCount} 个`)
  console.log(`低质量 (<${threshold}KB): ${lowQualityVideos.length} 个`)

  if (lowQualityVideos.length === 0) {
    console.log('🎉 未发现需要删除的低质量缩略图！')
    return
  }

  console.log(`\n🚨 发现 ${lowQualityVideos.length} 个低质量用户视频缩略图`)
  console.log('详细列表:')

  // 按用户分组显示
  const userGroups = {}
  for (const video of lowQualityVideos) {
    const userId = video.userId.substring(0, 8) + '...'
    if (!userGroups[userId]) userGroups[userId] = []
    userGroups[userId].push(video)
  }

  for (const [userId, userVideos] of Object.entries(userGroups)) {
    console.log(`\n👤 用户 ${userId}: ${userVideos.length} 个低质量缩略图`)
    for (const video of userVideos) {
      console.log(`   📹 ${video.title} - ${video.sizeKB}KB (${video.type})`)
    }
  }

  let deletedCount = 0

  if (dryRun) {
    console.log(`\n[DRY RUN] 将删除 ${lowQualityVideos.length} 个低质量缩略图`)
    deletedCount = lowQualityVideos.length
  } else {
    console.log(`\n🗑️ 开始删除低质量缩略图...`)
    
    for (const video of lowQualityVideos) {
      try {
        const { error: updateError } = await supabase
          .from('videos')
          .update({ 
            thumbnail_url: null
          })
          .eq('id', video.id)

        if (updateError) {
          console.error(`   ❌ 删除失败 ${video.title}:`, updateError.message)
        } else {
          deletedCount++
          console.log(`   ✅ 已删除: ${video.title} (${video.sizeKB}KB)`)
        }
      } catch (error) {
        console.error(`   ❌ 处理异常 ${video.title}:`, error.message)
      }
    }
  }

  console.log(`\n📊 删除结果:`)
  console.log(`总检查数: ${checkedCount}`)
  console.log(`低质量发现: ${lowQualityVideos.length}`)
  console.log(`成功删除: ${deletedCount}`)
  console.log(`保留高质量: ${highQualityCount + mediumQualityCount}`)
  console.log(`模式: ${dryRun ? 'DRY RUN (测试)' : '实际删除'}`)

  if (!dryRun && deletedCount > 0) {
    console.log(`\n💡 删除完成！`)
    console.log(`这些视频的缩略图将在下次访问时自动重新生成`)
    console.log(`新的缩略图将使用最新的高质量配置 (640x360, 0.90质量)`)
    console.log(`预期文件大小: 30-100KB (WebP格式)`)
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
删除低质量用户视频缩略图脚本

用法: 
  node delete-low-quality-user-thumbnails.mjs [选项]

选项:
  --dry-run    测试模式，不实际删除数据
  --help, -h   显示帮助信息

功能:
  - 扫描所有用户视频的缩略图质量
  - 删除小于50KB的低质量缩略图
  - 只处理用户视频，不影响模板
  - 支持Base64和远程CDN缩略图检查
  - 自动标记重新生成

质量标准:
  - 低质量: <50KB (将被删除)
  - 中等质量: 50-100KB (保留)
  - 高质量: ≥100KB (保留)

示例:
  node delete-low-quality-user-thumbnails.mjs --dry-run  # 测试模式
  node delete-low-quality-user-thumbnails.mjs            # 实际删除
    `)
    return
  }

  await deleteLowQualityUserThumbnails()
}

await main()