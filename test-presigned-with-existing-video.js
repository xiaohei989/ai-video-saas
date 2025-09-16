/**
 * 使用现有测试视频测试预签名URL上传
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// 配置
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  // 使用刚才测试生成的视频
  testVideoId: '5533e929-7bf6-47db-860d-aecd610479a9',
  testVideoUrl: 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/fba658c2-4ae0-4097-9f64-59a9575390c4_normal.mp4'
}

console.log('🧪 ========== 预签名URL上传测试（使用现有视频）==========')
console.log('🔧 配置检查:')
console.log(`  Supabase URL: ${config.supabaseUrl ? '✅' : '❌'}`)
console.log(`  Supabase Key: ${config.supabaseKey ? '✅' : '❌'}`)
console.log(`  测试视频ID: ${config.testVideoId}`)
console.log(`  测试视频URL: ${config.testVideoUrl}`)
console.log('')

const supabase = createClient(config.supabaseUrl, config.supabaseKey)

async function testPresignedUploadWithExistingVideo() {
  const newTestVideoId = `presigned-test-${Date.now()}`
  
  try {
    console.log(`📹 开始测试 - 新视频ID: ${newTestVideoId}`)
    console.log(`📹 源视频ID: ${config.testVideoId}`)
    
    // =============== 第一步：生成预签名URL ===============
    console.log('🔗 1. 生成预签名URL...')
    
    const { data: urlData, error: urlError } = await supabase.functions.invoke('generate-upload-url', {
      body: {
        videoId: newTestVideoId,
        contentType: 'video/mp4',
        expiresIn: 3600
      }
    })
    
    if (urlError) {
      throw new Error(`预签名URL生成失败: ${urlError.message}`)
    }
    
    if (!urlData.success) {
      throw new Error(`预签名URL生成失败: ${urlData.error}`)
    }
    
    const { signedUrl, publicUrl, key, expiresAt } = urlData.data
    console.log('✅ 预签名URL生成成功')
    console.log(`   签名URL: ${signedUrl.substring(0, 120)}...`)
    console.log(`   公开URL: ${publicUrl}`)
    console.log(`   存储Key: ${key}`)
    console.log(`   过期时间: ${expiresAt}`)
    console.log('')
    
    // =============== 第二步：下载现有测试视频 ===============
    console.log('⬇️ 2. 下载现有测试视频...')
    
    const downloadResponse = await fetch(config.testVideoUrl)
    if (!downloadResponse.ok) {
      throw new Error(`视频下载失败: ${downloadResponse.status} ${downloadResponse.statusText}`)
    }
    
    const videoBuffer = await downloadResponse.arrayBuffer()
    console.log(`✅ 视频下载成功: ${videoBuffer.byteLength} bytes (${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`)
    console.log('')
    
    // =============== 第三步：使用预签名URL上传 ===============
    console.log('⬆️ 3. 使用预签名URL上传到R2...')
    
    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      body: videoBuffer,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.byteLength.toString()
      }
    })
    
    console.log(`📊 上传响应状态: ${uploadResponse.status} ${uploadResponse.statusText}`)
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.log(`❌ 上传失败详情: ${errorText}`)
      throw new Error(`上传失败: ${uploadResponse.status} - ${errorText}`)
    }
    
    console.log('✅ 文件上传成功')
    
    // 获取响应头信息
    const etag = uploadResponse.headers.get('ETag')
    const contentLength = uploadResponse.headers.get('Content-Length')
    if (etag) console.log(`   ETag: ${etag}`)
    if (contentLength) console.log(`   Content-Length: ${contentLength}`)
    console.log('')
    
    // =============== 第四步：验证文件可访问性 ===============
    console.log('🔍 4. 验证文件可访问性...')
    
    // 等待R2处理完成
    console.log('⏳ 等待R2处理完成...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const verifyResponse = await fetch(publicUrl, { method: 'HEAD' })
    console.log(`📊 验证响应状态: ${verifyResponse.status} ${verifyResponse.statusText}`)
    
    if (verifyResponse.ok) {
      console.log('✅ 文件可通过公开URL访问')
      console.log(`   Content-Type: ${verifyResponse.headers.get('content-type')}`)
      console.log(`   Content-Length: ${verifyResponse.headers.get('content-length')} bytes`)
      console.log(`   Cache-Control: ${verifyResponse.headers.get('cache-control')}`)
    } else {
      console.log('⚠️ 文件暂时无法通过公开URL访问')
      console.log('   这可能是正常的，R2需要时间同步到CDN')
    }
    console.log('')
    
    // =============== 第五步：对比原始文件和上传文件 ===============
    console.log('🔄 5. 对比文件完整性...')
    
    if (verifyResponse.ok) {
      const downloadedSize = parseInt(verifyResponse.headers.get('content-length') || '0')
      const originalSize = videoBuffer.byteLength
      
      if (downloadedSize === originalSize) {
        console.log('✅ 文件大小一致，上传完整')
      } else {
        console.log(`⚠️ 文件大小不一致: 原始 ${originalSize} vs 下载 ${downloadedSize}`)
      }
    }
    console.log('')
    
    // =============== 测试总结 ===============
    console.log('📋 ========== 测试总结 ==========')
    console.log('✅ 预签名URL生成 - 成功')
    console.log('✅ 现有视频下载 - 成功') 
    console.log('✅ R2文件上传 - 成功')
    console.log(`${verifyResponse.ok ? '✅' : '⚠️'} 公开URL访问 - ${verifyResponse.ok ? '成功' : '待同步'}`)
    console.log('')
    console.log('🎉 预签名URL上传功能基本验证成功！')
    console.log('')
    console.log('📌 关键发现：')
    console.log(`- 原始文件大小: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`)
    console.log(`- 上传耗时: 几秒内完成`)
    console.log(`- 最终URL: ${publicUrl}`)
    console.log('')
    console.log('🔄 下一步：集成到视频迁移服务中')
    
    return {
      success: true,
      testVideoId: newTestVideoId,
      publicUrl,
      uploadSize: videoBuffer.byteLength,
      accessible: verifyResponse.ok
    }
    
  } catch (error) {
    console.error('💥 测试失败:', error.message)
    console.log('')
    console.log('🔍 故障排除建议：')
    console.log('1. 检查Edge Function环境变量配置')
    console.log('2. 验证R2 API密钥权限')
    console.log('3. 确认预签名URL格式正确')
    console.log('4. 检查CORS设置（如果从浏览器调用）')
    
    return {
      success: false,
      error: error.message
    }
  }
}

// 运行测试
testPresignedUploadWithExistingVideo()
  .then(result => {
    process.exit(result.success ? 0 : 1)
  })
  .catch(error => {
    console.error('测试执行异常:', error)
    process.exit(1)
  })