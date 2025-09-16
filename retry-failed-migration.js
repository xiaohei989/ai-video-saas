/**
 * 重试失败的迁移
 * 手动迁移刚才失败的视频
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// 从环境变量获取配置
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  cloudflareAccountId: process.env.VITE_CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucketName: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage',
  publicDomain: process.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN
}

const supabase = createClient(config.supabaseUrl, config.supabaseKey)

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.cloudflareAccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

async function retryMigration() {
  const videoId = '21fd3f22-aaef-45af-971f-1c771bc140c6'
  
  try {
    console.log(`🔄 重试迁移视频: ${videoId}\n`)

    // 1. 获取视频信息（使用修复后的查询）
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, r2_key, migration_status, original_video_url, title')
      .eq('id', videoId)
      .single()

    if (fetchError || !video) {
      throw new Error(`视频不存在: ${fetchError?.message}`)
    }

    console.log(`📹 视频信息:`)
    console.log(`   标题: ${video.title}`)
    console.log(`   当前状态: ${video.migration_status}`)
    console.log(`   视频URL: ${video.video_url}`)
    console.log(`   R2 URL: ${video.r2_url || 'NULL'}`)
    console.log('')

    // 2. 检查是否需要迁移
    if (video.migration_status === 'completed' && video.r2_url) {
      console.log('✅ 视频已完成迁移')
      return
    }

    if (!video.video_url) {
      console.log('❌ 视频URL为空，无法迁移')
      return
    }

    // 3. 更新状态为下载中
    console.log('⬇️ 开始下载视频...')
    await supabase
      .from('videos')
      .update({ migration_status: 'downloading' })
      .eq('id', videoId)

    // 4. 下载视频
    console.log(`📥 从源地址下载: ${video.video_url}`)
    const response = await fetch(video.video_url)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`)
    }

    const videoBuffer = await response.arrayBuffer()
    console.log(`✅ 视频下载完成: ${videoBuffer.byteLength} bytes`)

    // 5. 更新状态为上传中
    console.log('⬆️ 开始上传到R2...')
    await supabase
      .from('videos')
      .update({ migration_status: 'uploading' })
      .eq('id', videoId)

    // 6. 上传到R2
    const key = `videos/${videoId}.mp4`
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: new Uint8Array(videoBuffer),
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000',
      Metadata: {
        originalUrl: video.video_url,
        uploadedAt: new Date().toISOString(),
        videoId: videoId
      }
    })

    await r2Client.send(uploadCommand)
    
    // 7. 生成公开URL
    let r2Url
    if (config.publicDomain) {
      r2Url = `https://${config.publicDomain}/${key}`
    } else {
      r2Url = `https://pub-${config.cloudflareAccountId}.r2.dev/${key}`
    }
    
    console.log(`✅ 上传完成: ${r2Url}`)

    // 8. 更新数据库
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        video_url: r2Url,  // 直接使用R2 URL作为主URL
        r2_url: r2Url,
        r2_key: key,
        migration_status: 'completed',
        r2_uploaded_at: new Date().toISOString(),
        original_video_url: video.original_video_url || video.video_url
      })
      .eq('id', videoId)

    if (updateError) {
      throw new Error(`数据库更新失败: ${updateError.message}`)
    }

    console.log('\n🎉 迁移完成！')
    console.log(`🎬 最终结果:`)
    console.log(`   主URL: ${r2Url}`)
    console.log(`   R2 URL: ${r2Url}`)
    console.log(`   R2 Key: ${key}`)
    console.log(`   原始URL: ${video.video_url}`)
    console.log('')
    console.log(`🖼️ 缩略图测试URL:`)
    console.log(`   2秒预览: ${r2Url}#t=2.0`)
    console.log(`   5秒预览: ${r2Url}#t=5.0`)

  } catch (error) {
    console.error('💥 迁移失败:', error.message)
    
    // 更新状态为失败
    try {
      await supabase
        .from('videos')
        .update({ migration_status: 'failed' })
        .eq('id', videoId)
    } catch (updateError) {
      console.error('❌ 更新失败状态出错:', updateError.message)
    }
  }
}

// 运行重试
retryMigration()