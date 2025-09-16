/**
 * 预签名URL上传测试脚本
 * 测试从生成预签名URL到成功上传文件的完整流程
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import fs from 'fs'

// 配置
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  testVideoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
}

console.log('🧪 ========== 预签名URL上传测试 ==========')
console.log('🔧 配置检查:')
console.log(`  Supabase URL: ${config.supabaseUrl ? '✅' : '❌'}`)
console.log(`  Supabase Key: ${config.supabaseKey ? '✅' : '❌'}`)
console.log(`  测试视频URL: ${config.testVideoUrl}`)
console.log('')

const supabase = createClient(config.supabaseUrl, config.supabaseKey)

async function testPresignedUpload() {
  const testVideoId = `test-presigned-${Date.now()}`
  
  try {
    console.log(`📹 开始测试 - 视频ID: ${testVideoId}`)
    
    // =============== 第一步：生成预签名URL ===============
    console.log('🔗 1. 生成预签名URL...')
    
    const { data: urlData, error: urlError } = await supabase.functions.invoke('generate-upload-url', {
      body: {
        videoId: testVideoId,
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
    console.log(`   签名URL: ${signedUrl.substring(0, 100)}...`)
    console.log(`   公开URL: ${publicUrl}`)
    console.log(`   存储Key: ${key}`)
    console.log(`   过期时间: ${expiresAt}`)
    console.log('')
    
    // =============== 第二步：下载测试视频 ===============
    console.log('⬇️ 2. 下载测试视频...')
    
    const downloadResponse = await fetch(config.testVideoUrl)
    if (!downloadResponse.ok) {
      throw new Error(`视频下载失败: ${downloadResponse.status} ${downloadResponse.statusText}`)
    }
    
    const videoBuffer = await downloadResponse.arrayBuffer()
    console.log(`✅ 视频下载成功: ${videoBuffer.byteLength} bytes`)
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
      throw new Error(`上传失败: ${uploadResponse.status} - ${errorText}`)
    }
    
    console.log('✅ 文件上传成功')
    
    // 获取ETag（如果有）
    const etag = uploadResponse.headers.get('ETag')
    if (etag) {
      console.log(`   ETag: ${etag}`)
    }
    console.log('')
    
    // =============== 第四步：验证文件可访问性 ===============
    console.log('🔍 4. 验证文件可访问性...')
    
    // 等待一下让R2处理完成
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const verifyResponse = await fetch(publicUrl, { method: 'HEAD' })
    console.log(`📊 验证响应状态: ${verifyResponse.status} ${verifyResponse.statusText}`)
    
    if (verifyResponse.ok) {
      console.log('✅ 文件可通过公开URL访问')
      console.log(`   Content-Type: ${verifyResponse.headers.get('content-type')}`)
      console.log(`   Content-Length: ${verifyResponse.headers.get('content-length')} bytes`)
    } else {
      console.log('⚠️ 文件暂时无法通过公开URL访问（可能需要等待CDN同步）')
    }
    console.log('')
    
    // =============== 测试总结 ===============
    console.log('📋 ========== 测试总结 ==========')
    console.log('✅ 预签名URL生成 - 成功')
    console.log('✅ 视频文件下载 - 成功') 
    console.log('✅ R2文件上传 - 成功')
    console.log(`${verifyResponse.ok ? '✅' : '⚠️'} 公开URL访问 - ${verifyResponse.ok ? '成功' : '待同步'}`)
    console.log('')
    console.log('🎉 预签名URL上传功能验证完成！')
    console.log('')
    console.log('📌 下一步测试建议：')
    console.log('1. 在浏览器中测试CORS配置')
    console.log('2. 测试不同大小的文件上传')
    console.log('3. 集成到现有的迁移服务中')
    
    return {
      success: true,
      testVideoId,
      publicUrl,
      uploadSize: videoBuffer.byteLength
    }
    
  } catch (error) {
    console.error('💥 测试失败:', error.message)
    console.log('')
    console.log('🔍 故障排除建议：')
    console.log('1. 检查Edge Function是否正确部署')
    console.log('2. 验证R2环境变量配置')
    console.log('3. 确认R2 CORS设置正确')
    console.log('4. 检查网络连接和防火墙设置')
    
    return {
      success: false,
      error: error.message
    }
  }
}

// 运行测试
testPresignedUpload()
  .then(result => {
    process.exit(result.success ? 0 : 1)
  })
  .catch(error => {
    console.error('测试执行异常:', error)
    process.exit(1)
  })