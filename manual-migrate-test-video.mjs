/**
 * 手动迁移测试视频到R2存储
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必需的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// R2配置
const r2Config = {
  accountId: 'c6fc8bcf3bba37f2611b6f3d7aad25b9',
  accessKeyId: '57c7b53c14b7d962b9a2187e8764a835', 
  secretAccessKey: '69265850a7e9d5f18f5ebb6f2cf5b6b8ad48d54c2ae722611d1d281e401684a8',
  bucketName: 'ai-video-storage',
  publicDomain: 'cdn.veo3video.me'
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  },
})

const TEST_VIDEO_ID = '4de737c7-b661-4a60-a18d-a21283ca8176'

async function manualMigrateVideo() {
  console.log(`🔄 手动迁移测试视频: ${TEST_VIDEO_ID}\n`)
  
  try {
    // 1. 获取视频信息
    console.log('📹 获取视频信息...')
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', TEST_VIDEO_ID)
      .single()
    
    if (fetchError || !video) {
      console.error('❌ 获取视频失败:', fetchError)
      return
    }
    
    console.log(`✅ 视频信息获取成功`)
    console.log(`  🎬 标题: ${video.title}`)
    console.log(`  📹 原始URL: ${video.video_url}`)
    console.log(`  📊 迁移状态: ${video.migration_status}`)
    
    if (!video.video_url) {
      console.error('❌ 视频URL为空，无法迁移')
      return
    }
    
    if (video.migration_status === 'completed' && video.r2_url) {
      console.log('✅ 视频已完成迁移，无需重复操作')
      return
    }
    
    // 2. 更新迁移状态
    console.log('\n📊 更新迁移状态为downloading...')
    await supabase
      .from('videos')
      .update({ migration_status: 'downloading' })
      .eq('id', TEST_VIDEO_ID)
    
    // 3. 下载视频
    console.log('\n⬇️ 下载视频文件...')
    const response = await fetch(video.video_url)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`)
    }
    
    const videoBuffer = await response.arrayBuffer()
    const videoSize = videoBuffer.byteLength
    console.log(`✅ 视频下载完成: ${(videoSize / 1024 / 1024).toFixed(2)} MB`)
    
    // 4. 上传到R2
    console.log('\n☁️ 上传到R2存储...')
    const key = `videos/${TEST_VIDEO_ID}.mp4`
    
    const uploadCommand = new PutObjectCommand({
      Bucket: r2Config.bucketName,
      Key: key,
      Body: new Uint8Array(videoBuffer),
      ContentType: 'video/mp4',
      CacheControl: 'public, max-age=31536000',
    })
    
    await r2Client.send(uploadCommand)
    console.log(`✅ R2上传完成`)
    
    // 5. 构造R2 URL
    const r2Url = `https://${r2Config.publicDomain}/${key}`
    console.log(`🔗 R2 URL: ${r2Url}`)
    
    // 6. 更新数据库
    console.log('\n📝 更新数据库记录...')
    const updateTimestamp = new Date().toISOString()
    
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        video_url: r2Url, // 直接更新为R2 URL
        r2_url: r2Url,
        r2_key: key,
        migration_status: 'completed',
        r2_uploaded_at: updateTimestamp,
        original_video_url: video.video_url
      })
      .eq('id', TEST_VIDEO_ID)
    
    if (updateError) {
      console.error('❌ 数据库更新失败:', updateError)
      return
    }
    
    console.log('✅ 数据库更新完成')
    
    // 7. 最终验证
    console.log('\n🔍 验证迁移结果...')
    const { data: updatedVideo } = await supabase
      .from('videos')
      .select('video_url, r2_url, migration_status, r2_uploaded_at')
      .eq('id', TEST_VIDEO_ID)
      .single()
    
    console.log('\n🎉 迁移完成！最终状态:')
    console.log(`  📹 video_url: ${updatedVideo.video_url}`)
    console.log(`  🔗 r2_url: ${updatedVideo.r2_url}`)
    console.log(`  📊 migration_status: ${updatedVideo.migration_status}`)
    console.log(`  📤 r2_uploaded_at: ${updatedVideo.r2_uploaded_at}`)
    console.log(`  ✅ URL一致性: ${updatedVideo.video_url === updatedVideo.r2_url ? '一致' : '不一致'}`)
    
    if (updatedVideo.video_url?.includes('cdn.veo3video.me')) {
      console.log('\n🎯 测试成功：新视频已成功使用R2存储！')
    }
    
  } catch (error) {
    console.error('🚨 迁移过程中出错:', error)
    
    // 更新失败状态
    await supabase
      .from('videos')
      .update({ migration_status: 'failed' })
      .eq('id', TEST_VIDEO_ID)
  }
}

manualMigrateVideo().catch(error => {
  console.error('🚨 手动迁移脚本出错:', error)
})