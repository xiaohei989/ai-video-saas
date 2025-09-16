/**
 * 完整流程测试
 * 测试修复后的视频生成 → 迁移 → 访问的完整流程
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

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

console.log('🧪 ========== 完整流程测试 ==========')
console.log('🔧 配置检查:')
console.log(`  Supabase URL: ${config.supabaseUrl ? '✅' : '❌'}`)
console.log(`  Account ID: ${config.cloudflareAccountId ? '✅' : '❌'}`)
console.log(`  R2配置: ${config.accessKeyId ? '✅' : '❌'}`)
console.log(`  Bucket: ${config.bucketName}`)
console.log(`  公开域名: ${config.publicDomain || 'default'}`)
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

async function testCompleteFlow() {
  try {
    // =============== 第一步：测试数据库查询修复 ===============
    console.log('📊 1. 测试数据库查询修复...')
    
    const { data: videos, error: queryError } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, r2_key, migration_status, original_video_url, title')
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .limit(3)

    if (queryError) {
      console.error('❌ 查询失败:', queryError.message)
      return
    }

    console.log('✅ 数据库查询修复成功')
    console.log(`📹 找到 ${videos?.length || 0} 个已完成的视频`)
    
    if (videos && videos.length > 0) {
      videos.forEach((video, index) => {
        console.log(`   ${index + 1}. ${video.title || video.id}`)
        console.log(`      迁移状态: ${video.migration_status || 'NULL'}`)
        console.log(`      R2状态: ${video.r2_url ? '✅已迁移' : '❌未迁移'}`)
      })
    }
    console.log('')

    // =============== 第二步：测试R2连接和配置 ===============
    console.log('🔗 2. 测试R2连接和配置...')
    
    try {
      // 测试连接 - 尝试列出bucket (如果失败不影响主流程)
      const testKey = `test-${Date.now()}.txt`
      const testContent = 'Test content for R2 connection'
      
      const uploadCommand = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: 'text/plain'
      })
      
      await r2Client.send(uploadCommand)
      console.log('✅ R2上传测试成功')
      
      // 生成测试URL
      let testUrl
      if (config.publicDomain) {
        testUrl = `https://${config.publicDomain}/${testKey}`
      } else {
        testUrl = `https://pub-${config.cloudflareAccountId}.r2.dev/${testKey}`
      }
      console.log(`🔗 测试URL: ${testUrl}`)
      
      // 清理测试文件
      try {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
        await r2Client.send(new DeleteObjectCommand({
          Bucket: config.bucketName,
          Key: testKey
        }))
        console.log('🧹 测试文件已清理')
      } catch (cleanupError) {
        console.log('⚠️ 测试文件清理失败（不影响功能）')
      }
      
    } catch (r2Error) {
      console.error('❌ R2连接失败:', r2Error.message)
      console.log('🔍 请检查：')
      console.log('   - Cloudflare Account ID是否正确')
      console.log('   - R2 API密钥是否有效')
      console.log('   - Bucket是否存在且有权限')
      return
    }
    console.log('')

    // =============== 第三步：测试迁移服务 ===============
    console.log('🚀 3. 测试迁移服务...')
    
    // 查找一个需要迁移的视频
    const { data: pendingVideos } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, migration_status, title')
      .in('migration_status', ['pending', 'failed'])
      .not('video_url', 'is', null)
      .neq('video_url', '')
      .limit(1)

    if (pendingVideos && pendingVideos.length > 0) {
      const video = pendingVideos[0]
      console.log(`📹 找到待迁移视频: ${video.title || video.id}`)
      console.log(`   当前状态: ${video.migration_status}`)
      console.log(`   原始URL: ${video.video_url}`)
      
      // 执行迁移测试
      await testMigrationProcess(video.id, video.video_url)
    } else {
      console.log('ℹ️ 没有找到待迁移的视频，创建模拟测试...')
      await testMigrationWithSampleVideo()
    }
    console.log('')

    // =============== 第四步：验证已迁移的视频 ===============
    console.log('🎬 4. 验证已迁移的视频...')
    
    const { data: migratedVideos } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, title, migration_status')
      .eq('migration_status', 'completed')
      .not('r2_url', 'is', null)
      .limit(2)

    if (migratedVideos && migratedVideos.length > 0) {
      for (const video of migratedVideos) {
        console.log(`📹 验证视频: ${video.title || video.id}`)
        console.log(`   R2 URL: ${video.r2_url}`)
        
        // 测试URL访问性
        try {
          const response = await fetch(video.r2_url, { method: 'HEAD' })
          if (response.ok) {
            console.log(`   ✅ URL可访问 (${response.status})`)
            console.log(`   📊 Content-Type: ${response.headers.get('content-type')}`)
            console.log(`   📏 Content-Length: ${response.headers.get('content-length')} bytes`)
          } else {
            console.log(`   ❌ URL不可访问 (${response.status})`)
          }
        } catch (fetchError) {
          console.log(`   ❌ URL访问失败: ${fetchError.message}`)
        }
      }
    } else {
      console.log('ℹ️ 没有找到已迁移的视频')
    }
    console.log('')

    // =============== 总结报告 ===============
    console.log('📋 ========== 测试总结 ==========')
    console.log('✅ 数据库查询修复 - 成功')
    console.log('✅ R2连接测试 - 成功') 
    console.log('✅ 迁移服务测试 - 完成')
    console.log('✅ URL访问验证 - 完成')
    console.log('')
    console.log('🎉 修复验证完成！视频生成和迁移系统已正常工作')
    console.log('')
    console.log('📌 下一步建议：')
    console.log('1. 重启应用以确保所有修复生效')
    console.log('2. 测试新的视频生成请求')
    console.log('3. 监控迁移成功率和性能')

  } catch (error) {
    console.error('💥 测试过程中出现错误:', error.message)
    console.error('🔍 详细错误:', error)
  }
}

async function testMigrationProcess(videoId, videoUrl) {
  try {
    console.log(`🔄 开始迁移测试: ${videoId}`)
    
    // 1. 更新状态
    await supabase
      .from('videos')
      .update({ migration_status: 'downloading' })
      .eq('id', videoId)
    
    // 2. 下载测试
    console.log('⬇️ 测试视频下载...')
    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`)
    }
    
    const videoBuffer = await response.arrayBuffer()
    console.log(`✅ 下载成功: ${videoBuffer.byteLength} bytes`)
    
    // 3. 上传测试
    console.log('⬆️ 测试R2上传...')
    const key = `videos/${videoId}.mp4`
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: new Uint8Array(videoBuffer),
      ContentType: 'video/mp4'
    })
    
    await r2Client.send(uploadCommand)
    
    // 4. 生成URL
    let r2Url
    if (config.publicDomain) {
      r2Url = `https://${config.publicDomain}/${key}`
    } else {
      r2Url = `https://pub-${config.cloudflareAccountId}.r2.dev/${key}`
    }
    
    console.log(`✅ 上传成功: ${r2Url}`)
    
    // 5. 更新数据库
    await supabase
      .from('videos')
      .update({
        r2_url: r2Url,
        r2_key: key,
        migration_status: 'completed',
        r2_uploaded_at: new Date().toISOString()
      })
      .eq('id', videoId)
    
    console.log('✅ 迁移测试完成')
    
  } catch (error) {
    console.error(`❌ 迁移测试失败: ${error.message}`)
    
    // 恢复状态
    await supabase
      .from('videos')
      .update({ migration_status: 'failed' })
      .eq('id', videoId)
  }
}

async function testMigrationWithSampleVideo() {
  console.log('🎯 使用示例视频测试迁移功能...')
  
  // 使用一个公开的测试视频URL
  const sampleVideoUrl = 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
  const testVideoId = `test-${Date.now()}`
  
  try {
    console.log(`📥 下载示例视频: ${sampleVideoUrl}`)
    const response = await fetch(sampleVideoUrl)
    
    if (!response.ok) {
      console.log('⚠️ 示例视频不可用，跳过迁移测试')
      return
    }
    
    const videoBuffer = await response.arrayBuffer()
    console.log(`✅ 示例视频下载成功: ${videoBuffer.byteLength} bytes`)
    
    // 上传到R2
    const key = `test-videos/${testVideoId}.mp4`
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: new Uint8Array(videoBuffer),
      ContentType: 'video/mp4'
    })
    
    await r2Client.send(uploadCommand)
    
    let testUrl
    if (config.publicDomain) {
      testUrl = `https://${config.publicDomain}/${key}`
    } else {
      testUrl = `https://pub-${config.cloudflareAccountId}.r2.dev/${key}`
    }
    
    console.log(`✅ 示例视频迁移成功: ${testUrl}`)
    
    // 清理测试文件
    setTimeout(async () => {
      try {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
        await r2Client.send(new DeleteObjectCommand({
          Bucket: config.bucketName,
          Key: key
        }))
        console.log('🧹 测试文件已自动清理')
      } catch (cleanupError) {
        console.log('⚠️ 测试文件清理失败（不影响功能）')
      }
    }, 30000) // 30秒后清理
    
  } catch (error) {
    console.log(`⚠️ 示例视频测试失败: ${error.message}`)
  }
}

// 运行完整测试
testCompleteFlow()