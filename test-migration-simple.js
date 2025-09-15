/**
 * 简单的视频迁移测试
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// 从环境变量获取配置
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  cloudflareAccountId: process.env.VITE_CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucketName: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage'
}

console.log('🔧 配置检查:')
console.log(`  Supabase URL: ${config.supabaseUrl ? '✅' : '❌'}`)
console.log(`  Account ID: ${config.cloudflareAccountId ? '✅' : '❌'}`)
console.log(`  Access Key: ${config.accessKeyId ? '✅' : '❌'}`)
console.log(`  Secret Key: ${config.secretAccessKey ? '✅' : '❌'}`)
console.log(`  Bucket Name: ${config.bucketName}`)
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

async function migrateVideo() {
  try {
    console.log('🚀 开始测试视频迁移...\n')

    // 1. 获取待迁移视频
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, title, migration_status')
      .eq('migration_status', 'pending')
      .not('video_url', 'is', null)
      .limit(1)

    if (error) {
      throw new Error(`查询失败: ${error.message}`)
    }

    if (!videos || videos.length === 0) {
      console.log('✅ 没有待迁移的视频')
      return
    }

    const video = videos[0]
    console.log(`📹 找到视频: ${video.title || video.id}`)
    console.log(`   原始URL: ${video.video_url}`)
    console.log('')

    // 2. 更新状态为下载中
    console.log('⬇️ 开始下载视频...')
    await supabase
      .from('videos')
      .update({ migration_status: 'downloading' })
      .eq('id', video.id)

    // 3. 下载视频
    const response = await fetch(video.video_url)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`)
    }

    const videoBuffer = await response.arrayBuffer()
    console.log(`✅ 视频下载完成: ${videoBuffer.byteLength} bytes`)

    // 4. 更新状态为上传中
    console.log('⬆️ 开始上传到R2...')
    await supabase
      .from('videos')
      .update({ migration_status: 'uploading' })
      .eq('id', video.id)

    // 5. 上传到R2
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
        videoId: video.id
      }
    })

    await r2Client.send(uploadCommand)
    
    // 6. 生成公开URL
    const r2Url = `https://pub-${config.cloudflareAccountId}.r2.dev/${key}`
    console.log(`✅ 上传完成: ${r2Url}`)

    // 7. 更新数据库
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        r2_url: r2Url,
        r2_key: key,
        migration_status: 'completed',
        r2_uploaded_at: new Date().toISOString(),
        original_video_url: video.video_url
      })
      .eq('id', video.id)

    if (updateError) {
      throw new Error(`数据库更新失败: ${updateError.message}`)
    }

    console.log('🎉 迁移完成！')
    console.log(`🎬 Media Fragments测试URL:`)
    console.log(`   基础URL: ${r2Url}`)
    console.log(`   2秒预览: ${r2Url}#t=2.0`)
    console.log(`   5秒预览: ${r2Url}#t=5.0`)

  } catch (error) {
    console.error('💥 迁移失败:', error.message)
    
    // 更新状态为失败
    if (video?.id) {
      await supabase
        .from('videos')
        .update({ migration_status: 'failed' })
        .eq('id', video.id)
    }
  }
}

// 运行迁移
migrateVideo()