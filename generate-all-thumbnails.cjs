#!/usr/bin/env node
/**
 * 为所有视频生成缩略图的脚本
 * 使用方式: node generate-all-thumbnails.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const videosDir = path.join(__dirname, 'public/templates/videos')
const thumbnailsDir = path.join(__dirname, 'public/templates/thumbnails')

// 确保缩略图目录存在
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true })
  console.log('✅ 创建缩略图目录')
}

// 获取所有视频文件
const videoFiles = fs.readdirSync(videosDir).filter(file => file.endsWith('.mp4'))

console.log(`🎬 找到 ${videoFiles.length} 个视频文件`)

let successCount = 0
let errorCount = 0

for (const videoFile of videoFiles) {
  const videoPath = path.join(videosDir, videoFile)
  const videoName = path.basename(videoFile, '.mp4')
  const thumbnailPath = path.join(thumbnailsDir, `${videoName}-thumbnail.jpg`)
  const blurThumbnailPath = path.join(thumbnailsDir, `${videoName}-thumbnail-blur.jpg`)
  
  try {
    console.log(`📸 处理: ${videoFile}`)
    
    // 检查缩略图是否已存在
    if (fs.existsSync(thumbnailPath) && fs.existsSync(blurThumbnailPath)) {
      console.log(`  ⏭️ 跳过 (缩略图已存在)`)
      successCount++
      continue
    }
    
    // 生成普通缩略图 (取第2秒的帧)
    const ffmpegCmd1 = `ffmpeg -i "${videoPath}" -ss 00:00:02 -vframes 1 -q:v 2 -y "${thumbnailPath}"`
    execSync(ffmpegCmd1, { stdio: 'pipe' })
    
    // 生成模糊缩略图
    const ffmpegCmd2 = `ffmpeg -i "${thumbnailPath}" -vf "gblur=sigma=20" -y "${blurThumbnailPath}"`
    execSync(ffmpegCmd2, { stdio: 'pipe' })
    
    console.log(`  ✅ 生成成功`)
    successCount++
    
  } catch (error) {
    console.log(`  ❌ 生成失败: ${error.message}`)
    errorCount++
  }
}

console.log(`\n🎯 总结:`)
console.log(`  成功: ${successCount}`)
console.log(`  失败: ${errorCount}`)
console.log(`  总计: ${videoFiles.length}`)

if (successCount > 0) {
  console.log(`\n📁 缩略图已保存到: ${thumbnailsDir}`)
  console.log(`\n🚀 使用建议:`)
  console.log(`  1. 缩略图将自动用于视频加载过渡`)
  console.log(`  2. 模糊版本用于更平滑的加载体验`)
  console.log(`  3. 减少了从logo切换到视频的突兀感`)
}