#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fixLowQualityR2Thumbnails() {
  console.log('🔧 修复低质量R2缩略图...')
  
  // 设置是否为测试模式
  const dryRun = process.argv.includes('--dry-run')
  
  if (dryRun) {
    console.log('🔍 [DRY RUN] 测试模式，不会实际修改数据')
  }

  // 查询所有R2 CDN缩略图，检查质量
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, created_at, processing_completed_at')
    .not('thumbnail_url', 'is', null)
    .like('thumbnail_url', '%cdn.veo3video.me%')
    .order('created_at', { ascending: false })
    .limit(50) // 扩大检查范围

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  if (!videos || videos.length === 0) {
    console.log('❌ 未找到R2 CDN存储的缩略图')
    return
  }

  console.log(`📹 检查 ${videos.length} 个R2 CDN缩略图...`)

  const lowQualityVideos = []

  // 检查每个缩略图的质量
  for (const video of videos) {
    try {
      const response = await fetch(video.thumbnail_url, { method: 'HEAD' })
      
      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        
        if (contentLength) {
          const sizeNum = parseInt(contentLength)
          const sizeKB = (sizeNum / 1024).toFixed(2)
          
          // 识别低质量缩略图（<10KB）
          if (sizeNum < 10000) {
            lowQualityVideos.push({
              id: video.id,
              title: video.title,
              url: video.thumbnail_url,
              sizeKB: parseFloat(sizeKB),
              created: video.created_at,
              completed: video.processing_completed_at
            })
            
            console.log(`⚠️ 发现低质量: ${video.title} (${sizeKB}KB)`)
          }
        }
      }
    } catch (error) {
      console.log(`❌ 检查失败: ${video.title} - ${error.message}`)
    }
  }

  if (lowQualityVideos.length === 0) {
    console.log('🎉 未发现低质量R2缩略图！')
    return
  }

  console.log(`\n🚨 发现 ${lowQualityVideos.length} 个低质量R2缩略图`)

  let fixedCount = 0

  for (const video of lowQualityVideos) {
    console.log(`\n🔧 处理: ${video.title} (${video.sizeKB}KB)`)
    console.log(`   视频ID: ${video.id}`)
    console.log(`   创建时间: ${new Date(video.created).toLocaleString('zh-CN')}`)
    
    if (dryRun) {
      console.log(`   [DRY RUN] 将清除低质量缩略图并重新生成`)
      fixedCount++
    } else {
      try {
        // 清除低质量缩略图，触发重新生成
        const { error: updateError } = await supabase
          .from('videos')
          .update({ 
            thumbnail_url: null,
            thumbnail_generation_status: 'pending'
          })
          .eq('id', video.id)

        if (updateError) {
          console.error(`   ❌ 更新失败:`, updateError.message)
        } else {
          fixedCount++
          console.log(`   ✅ 已清除低质量缩略图，标记为重新生成`)
        }
      } catch (error) {
        console.error(`   ❌ 处理异常:`, error.message)
      }
    }
  }

  console.log(`\n📊 修复结果:`)
  console.log(`总检查数: ${videos.length}`)
  console.log(`低质量发现: ${lowQualityVideos.length}`)
  console.log(`成功修复: ${fixedCount}`)
  console.log(`模式: ${dryRun ? 'DRY RUN (测试)' : '实际修复'}`)

  if (!dryRun && fixedCount > 0) {
    console.log(`\n💡 修复完成！`)
    console.log(`系统将在下次页面访问时自动为这些视频生成新的高质量缩略图`)
    console.log(`新的缩略图将使用最新的高质量配置 (640x360, 0.90质量)`)
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
修复低质量R2缩略图脚本

用法: 
  node fix-low-quality-r2-thumbnails.mjs [选项]

选项:
  --dry-run    测试模式，不实际修改数据
  --help, -h   显示帮助信息

功能:
  - 自动检测所有R2存储的缩略图质量
  - 识别小于10KB的低质量缩略图
  - 清除低质量缩略图并标记重新生成
  - 下次访问时自动生成高质量缩略图

示例:
  node fix-low-quality-r2-thumbnails.mjs --dry-run  # 测试模式
  node fix-low-quality-r2-thumbnails.mjs            # 实际修复
    `)
    return
  }

  await fixLowQualityR2Thumbnails()
}

await main()