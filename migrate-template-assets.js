/**
 * 迁移所有模板资源（视频和缩略图）到R2存储
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// R2配置
const config = {
  cloudflareAccountId: process.env.VITE_CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucketName: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage',
  publicDomain: process.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN || 'cdn.veo3video.me'
}

console.log('🔧 配置检查:')
console.log(`  Account ID: ${config.cloudflareAccountId ? '✅' : '❌'}`)
console.log(`  Access Key: ${config.accessKeyId ? '✅' : '❌'}`)
console.log(`  Secret Key: ${config.secretAccessKey ? '✅' : '❌'}`)
console.log(`  Bucket: ${config.bucketName}`)
console.log(`  Domain: ${config.publicDomain}`)
console.log('')

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.cloudflareAccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

// 生成R2公开URL
function getR2PublicUrl(key) {
  if (config.publicDomain) {
    return `https://${config.publicDomain}/${key}`
  }
  return `https://pub-e0e4075257f3403f990bacc5d3282fc5.r2.dev/${key}`
}

// 上传文件到R2
async function uploadToR2(filePath, key, contentType) {
  try {
    const fileBuffer = await fs.readFile(filePath)
    
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1年缓存
      Metadata: {
        uploadedAt: new Date().toISOString(),
        source: 'template-migration'
      }
    })

    await r2Client.send(uploadCommand)
    const publicUrl = getR2PublicUrl(key)
    
    console.log(`✅ ${key} -> ${publicUrl}`)
    return { success: true, url: publicUrl, size: fileBuffer.length }
  } catch (error) {
    console.error(`❌ 上传失败 ${key}:`, error.message)
    return { success: false, error: error.message }
  }
}

// 处理模板文件
async function processTemplate(templatePath) {
  try {
    const templateContent = await fs.readFile(templatePath, 'utf-8')
    const template = JSON.parse(templateContent)
    
    console.log(`\n📄 处理模板: ${template.name}`)
    
    let updated = false
    const results = {
      template: template.name,
      updates: [],
      errors: []
    }
    
    // 处理预览视频
    if (template.previewUrl && template.previewUrl.startsWith('/templates/')) {
      const videoPath = path.join(__dirname, 'public', template.previewUrl)
      const videoKey = `templates${template.previewUrl.replace('/templates', '')}`
      
      try {
        await fs.access(videoPath)
        const uploadResult = await uploadToR2(videoPath, videoKey, 'video/mp4')
        
        if (uploadResult.success) {
          template.previewUrl = uploadResult.url
          results.updates.push(`视频: ${uploadResult.url}`)
          updated = true
        } else {
          results.errors.push(`视频上传失败: ${uploadResult.error}`)
        }
      } catch (error) {
        console.log(`⚠️  视频文件不存在: ${videoPath}`)
        results.errors.push(`视频文件不存在: ${videoPath}`)
      }
    }
    
    // 处理缩略图
    if (template.thumbnailUrl && template.thumbnailUrl.startsWith('/templates/')) {
      const thumbnailPath = path.join(__dirname, 'public', template.thumbnailUrl)
      const thumbnailKey = `templates${template.thumbnailUrl.replace('/templates', '')}`
      
      try {
        await fs.access(thumbnailPath)
        const uploadResult = await uploadToR2(thumbnailPath, thumbnailKey, 'image/jpeg')
        
        if (uploadResult.success) {
          template.thumbnailUrl = uploadResult.url
          results.updates.push(`缩略图: ${uploadResult.url}`)
          updated = true
        } else {
          results.errors.push(`缩略图上传失败: ${uploadResult.error}`)
        }
      } catch (error) {
        console.log(`⚠️  缩略图文件不存在: ${thumbnailPath}`)
        results.errors.push(`缩略图文件不存在: ${thumbnailPath}`)
      }
    }
    
    // 处理模糊缩略图
    if (template.blurThumbnailUrl && template.blurThumbnailUrl.startsWith('/templates/')) {
      const blurThumbnailPath = path.join(__dirname, 'public', template.blurThumbnailUrl)
      const blurThumbnailKey = `templates${template.blurThumbnailUrl.replace('/templates', '')}`
      
      try {
        await fs.access(blurThumbnailPath)
        const uploadResult = await uploadToR2(blurThumbnailPath, blurThumbnailKey, 'image/jpeg')
        
        if (uploadResult.success) {
          template.blurThumbnailUrl = uploadResult.url
          results.updates.push(`模糊缩略图: ${uploadResult.url}`)
          updated = true
        } else {
          results.errors.push(`模糊缩略图上传失败: ${uploadResult.error}`)
        }
      } catch (error) {
        console.log(`⚠️  模糊缩略图文件不存在: ${blurThumbnailPath}`)
        results.errors.push(`模糊缩略图文件不存在: ${blurThumbnailPath}`)
      }
    }
    
    // 保存更新后的模板文件
    if (updated) {
      await fs.writeFile(templatePath, JSON.stringify(template, null, 2))
      console.log(`💾 模板文件已更新: ${path.basename(templatePath)}`)
    }
    
    return results
  } catch (error) {
    console.error(`💥 处理模板失败 ${templatePath}:`, error.message)
    return {
      template: path.basename(templatePath),
      updates: [],
      errors: [error.message]
    }
  }
}

async function migrateAllTemplates() {
  try {
    console.log('🚀 开始迁移所有模板资源到R2...\n')
    
    const templatesDir = path.join(__dirname, 'src/features/video-creator/data/templates')
    const templateFiles = await fs.readdir(templatesDir)
    const jsonFiles = templateFiles.filter(file => file.endsWith('.json'))
    
    console.log(`📊 找到 ${jsonFiles.length} 个模板文件\n`)
    
    const results = []
    let totalUpdates = 0
    let totalErrors = 0
    
    for (const file of jsonFiles) {
      const templatePath = path.join(templatesDir, file)
      const result = await processTemplate(templatePath)
      results.push(result)
      totalUpdates += result.updates.length
      totalErrors += result.errors.length
    }
    
    // 生成报告
    console.log('\n' + '='.repeat(60))
    console.log('📈 迁移总结报告')
    console.log('='.repeat(60))
    console.log(`处理模板数量: ${results.length}`)
    console.log(`成功更新数量: ${totalUpdates}`)
    console.log(`错误数量: ${totalErrors}`)
    console.log('')
    
    results.forEach(result => {
      if (result.updates.length > 0 || result.errors.length > 0) {
        console.log(`📄 ${result.template}:`)
        result.updates.forEach(update => console.log(`  ✅ ${update}`))
        result.errors.forEach(error => console.log(`  ❌ ${error}`))
        console.log('')
      }
    })
    
    console.log('🎉 模板资源迁移完成！')
    
  } catch (error) {
    console.error('💥 迁移过程异常:', error.message)
  }
}

// 运行迁移
migrateAllTemplates()