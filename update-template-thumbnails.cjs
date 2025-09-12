#!/usr/bin/env node
/**
 * 批量为模板配置缩略图URL的脚本
 * 使用方式: node update-template-thumbnails.cjs
 */

const fs = require('fs')
const path = require('path')

const templatesDir = path.join(__dirname, 'src/features/video-creator/data/templates')
const thumbnailsDir = path.join(__dirname, 'public/templates/thumbnails')

// 获取所有模板JSON文件
const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'))

console.log(`🔄 找到 ${templateFiles.length} 个模板文件`)

let updatedCount = 0
let skippedCount = 0
let errorCount = 0

for (const templateFile of templateFiles) {
  const templatePath = path.join(templatesDir, templateFile)
  const templateName = path.basename(templateFile, '.json')
  
  // 生成缩略图路径
  const thumbnailPath = `/templates/thumbnails/${templateName}-thumbnail.jpg`
  const blurThumbnailPath = `/templates/thumbnails/${templateName}-thumbnail-blur.jpg`
  
  // 检查缩略图文件是否存在
  const thumbnailExists = fs.existsSync(path.join(__dirname, 'public', 'templates/thumbnails', `${templateName}-thumbnail.jpg`))
  const blurThumbnailExists = fs.existsSync(path.join(__dirname, 'public', 'templates/thumbnails', `${templateName}-thumbnail-blur.jpg`))
  
  try {
    console.log(`📝 处理: ${templateFile}`)
    
    // 读取模板JSON文件
    const templateContent = fs.readFileSync(templatePath, 'utf8')
    const template = JSON.parse(templateContent)
    
    // 检查是否已有缩略图配置
    if (template.thumbnailUrl) {
      console.log(`  ⏭️ 跳过 (已有缩略图配置: ${template.thumbnailUrl})`)
      skippedCount++
      continue
    }
    
    // 添加缩略图配置
    let hasChanges = false
    if (thumbnailExists) {
      template.thumbnailUrl = thumbnailPath
      hasChanges = true
      console.log(`  ✅ 添加普通缩略图: ${thumbnailPath}`)
    }
    
    // 如果有模糊版本，可以考虑添加额外字段（可选）
    if (blurThumbnailExists && hasChanges) {
      template.blurThumbnailUrl = blurThumbnailPath
      console.log(`  🎨 添加模糊缩略图: ${blurThumbnailPath}`)
    }
    
    if (!hasChanges) {
      console.log(`  ⚠️ 缩略图文件不存在，跳过配置`)
      skippedCount++
      continue
    }
    
    // 保持JSON格式化
    const updatedContent = JSON.stringify(template, null, 2)
    
    // 写回文件
    fs.writeFileSync(templatePath, updatedContent, 'utf8')
    
    console.log(`  ✅ 更新成功`)
    updatedCount++
    
  } catch (error) {
    console.log(`  ❌ 更新失败: ${error.message}`)
    errorCount++
  }
}

console.log(`\n🎯 批量更新完成:`)
console.log(`  更新: ${updatedCount}`)
console.log(`  跳过: ${skippedCount}`)
console.log(`  错误: ${errorCount}`)
console.log(`  总计: ${templateFiles.length}`)

if (updatedCount > 0) {
  console.log(`\n🚀 建议:`)
  console.log(`  1. 检查更新后的模板配置是否正确`)
  console.log(`  2. 重启开发服务器以加载新配置`)
  console.log(`  3. 测试模板页面缩略图显示效果`)
}