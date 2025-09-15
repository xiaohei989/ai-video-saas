/**
 * 批量迁移所有用户视频到R2
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// 配置
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  cloudflareAccountId: process.env.VITE_CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucketName: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage',
  publicDomain: process.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN || 'cdn.veo3video.me'
}

console.log('🔧 配置检查:')
console.log(`  Supabase URL: ${config.supabaseUrl ? '✅' : '❌'}`)
console.log(`  Account ID: ${config.cloudflareAccountId ? '✅' : '❌'}`)
console.log(`  Access Key: ${config.accessKeyId ? '✅' : '❌'}`)
console.log(`  Public Domain: ${config.publicDomain}`)
console.log('')

const supabase = createClient(config.supabaseUrl, config.supabaseKey)

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.cloudflareAccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

function getR2PublicUrl(key) {
  if (config.publicDomain) {
    return `https://${config.publicDomain}/${key}`
  }
  return `https://pub-e0e4075257f3403f990bacc5d3282fc5.r2.dev/${key}`
}

async function updateMigrationStatus(videoId, status) {
  try {
    await supabase
      .from('videos')
      .update({ migration_status: status })
      .eq('id', videoId)
  } catch (error) {
    console.error(`状态更新失败 ${videoId}:`, error.message)
  }
}

async function migrateVideo(video) {
  try {
    console.log(`\n📹 迁移视频: ${video.title || video.id}`)
    console.log(`   原始URL: ${video.video_url}`)
    
    // 1. 更新状态为下载中
    await updateMigrationStatus(video.id, 'downloading')
    
    // 2. 下载视频
    const response = await fetch(video.video_url)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`)
    }
    
    const videoBuffer = await response.arrayBuffer()
    console.log(`✅ 视频下载完成: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`)
    
    // 3. 更新状态为上传中
    await updateMigrationStatus(video.id, 'uploading')
    
    // 4. 上传到R2
    const key = `videos/${video.id}.mp4`
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: new Uint8Array(videoBuffer),
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000',
      Metadata: {
        originalUrl: video.video_url,
        uploadedAt: new Date().toISOString(),
        videoId: video.id,
        // 清理标题中的特殊字符，只保留ASCII字符
        title: (video.title || '').replace(/[^\x20-\x7E]/g, '').substring(0, 100)
      }
    })
    
    await r2Client.send(uploadCommand)
    
    // 5. 生成公开URL
    const r2Url = getR2PublicUrl(key)
    console.log(`✅ 上传完成: ${r2Url}`)
    
    // 6. 更新数据库
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        r2_url: r2Url,
        r2_key: key,
        migration_status: 'completed',
        r2_uploaded_at: new Date().toISOString(),
        original_video_url: video.original_video_url || video.video_url
      })
      .eq('id', video.id)
    
    if (updateError) {
      throw new Error(`数据库更新失败: ${updateError.message}`)
    }
    
    console.log(`🎉 迁移完成: ${video.title || video.id}`)
    
    return {
      success: true,
      videoId: video.id,
      title: video.title,
      r2Url,
      size: videoBuffer.byteLength
    }
    
  } catch (error) {
    console.error(`💥 迁移失败 ${video.id}:`, error.message)
    
    // 更新状态为失败
    await updateMigrationStatus(video.id, 'failed')
    
    return {
      success: false,
      videoId: video.id,
      title: video.title,
      error: error.message
    }
  }
}

async function migrateAllVideos() {
  try {
    console.log('🚀 开始批量迁移用户视频到R2...\n')
    
    // 1. 获取待迁移的视频
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, title, migration_status, original_video_url')
      .eq('status', 'completed')
      .in('migration_status', ['pending', 'failed'])
      .not('video_url', 'is', null)
      .neq('video_url', '')
    
    if (error) {
      throw new Error(`查询失败: ${error.message}`)
    }
    
    if (!videos || videos.length === 0) {
      console.log('✅ 没有需要迁移的视频')
      return
    }
    
    console.log(`📊 找到 ${videos.length} 个待迁移视频\n`)
    
    const results = []
    let successCount = 0
    let failCount = 0
    let totalSize = 0
    
    // 2. 依次迁移视频（避免并发过多）
    for (const video of videos) {
      const result = await migrateVideo(video)
      results.push(result)
      
      if (result.success) {
        successCount++
        totalSize += result.size || 0
      } else {
        failCount++
      }
      
      // 稍作休息避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // 3. 生成报告
    console.log('\n' + '='.repeat(60))
    console.log('📈 批量迁移完成报告')
    console.log('='.repeat(60))
    console.log(`总计视频: ${videos.length}`)
    console.log(`成功迁移: ${successCount}`)
    console.log(`迁移失败: ${failCount}`)
    console.log(`总计大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log('')
    
    // 成功的视频
    const successVideos = results.filter(r => r.success)
    if (successVideos.length > 0) {
      console.log('✅ 成功迁移的视频:')
      successVideos.forEach(video => {
        console.log(`  - ${video.title || video.videoId}`)
        console.log(`    URL: ${video.r2Url}`)
        console.log(`    大小: ${(video.size / 1024 / 1024).toFixed(2)} MB`)
        console.log('')
      })
    }
    
    // 失败的视频
    const failedVideos = results.filter(r => !r.success)
    if (failedVideos.length > 0) {
      console.log('❌ 迁移失败的视频:')
      failedVideos.forEach(video => {
        console.log(`  - ${video.title || video.videoId}`)
        console.log(`    错误: ${video.error}`)
        console.log('')
      })
    }
    
    console.log('🎉 用户视频迁移任务完成！')
    
  } catch (error) {
    console.error('💥 批量迁移异常:', error.message)
  }
}

// 运行迁移
migrateAllVideos()