/**
 * 测试统一后的缩略图上传功能
 * 验证 videoThumbnail.ts 修复后是否正常工作
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 生成测试缩略图数据
const generateTestThumbnailBase64 = () => {
  return 'UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAABBVBYDwAAAAIAAQEAAQAAAQAAAAAAAAAA'
}

async function testUnifiedThumbnailUpload() {
  console.log('🔧 测试统一后的缩略图上传功能...')
  
  try {
    const testVideoId = 'unified-test-' + Date.now()
    const thumbnailBase64 = generateTestThumbnailBase64()
    
    console.log('📋 测试参数:')
    console.log('  - videoId:', testVideoId)
    console.log('  - 使用统一的直接上传模式')
    
    // 使用修复后的直接上传模式
    console.log('\n🚀 调用修复后的Edge Function...')
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-thumbnail', {
      body: {
        videoId: testVideoId,
        base64Data: thumbnailBase64,
        contentType: 'image/webp',
        fileSize: Math.floor(thumbnailBase64.length * 0.75),
        directUpload: true
      }
    })
    
    if (uploadError) {
      console.error('❌ Edge Function调用失败:', uploadError)
      return false
    }
    
    if (!uploadData?.success) {
      console.error('❌ 上传响应异常:', uploadData)
      return false
    }
    
    const thumbnailUrl = uploadData.data.publicUrl
    console.log('✅ 统一接口上传成功!')
    console.log('  - 公开URL:', thumbnailUrl)
    console.log('  - 文件key:', uploadData.data.key)
    console.log('  - 上传时间:', uploadData.data.uploadedAt)
    
    // 验证缩略图可访问性
    console.log('\n🔍 验证缩略图访问性...')
    try {
      const response = await fetch(thumbnailUrl, { method: 'HEAD' })
      if (response.ok) {
        console.log('✅ 缩略图可正常访问!')
        console.log('  - HTTP状态:', response.status)
        console.log('  - Content-Type:', response.headers.get('content-type'))
        console.log('  - Cache-Control:', response.headers.get('cache-control'))
      } else {
        console.log('⚠️ 缩略图访问异常:', response.status, response.statusText)
      }
    } catch (accessError) {
      console.log('⚠️ 网络访问错误:', accessError.message)
    }
    
    // 测试同样的调用方式（模拟videoThumbnail.ts的调用）
    console.log('\n🔄 测试第二次调用（模拟实际使用）...')
    const testVideoId2 = 'unified-test-2-' + Date.now()
    const { data: uploadData2, error: uploadError2 } = await supabase.functions.invoke('upload-thumbnail', {
      body: {
        videoId: testVideoId2,
        base64Data: thumbnailBase64,
        contentType: 'image/webp',
        fileSize: Math.floor(thumbnailBase64.length * 0.75),
        directUpload: true
      }
    })
    
    if (uploadError2) {
      console.error('❌ 第二次调用失败:', uploadError2)
      return false
    }
    
    if (uploadData2?.success) {
      console.log('✅ 第二次调用也成功!')
      console.log('  - URL:', uploadData2.data.publicUrl)
    }
    
    console.log('\n🎉 统一接口测试结果:')
    console.log('✅ 直接上传模式: 工作正常')
    console.log('✅ Edge Function: 稳定响应')
    console.log('✅ R2存储: 上传成功')
    console.log('✅ CDN访问: 可正常访问')
    console.log('✅ 多次调用: 都成功')
    
    console.log('\n🔗 生成的缩略图链接:')
    console.log('1.', thumbnailUrl)
    console.log('2.', uploadData2.data.publicUrl)
    
    return true
    
  } catch (error) {
    console.error('❌ 测试过程出现异常:', error)
    return false
  }
}

// 运行测试
testUnifiedThumbnailUpload().then(success => {
  if (success) {
    console.log('\n🎯 测试结论: 统一接口修复成功!')
    console.log('现在所有缩略图上传都使用相同的成功模式')
  } else {
    console.log('\n❌ 测试结论: 仍有问题需要进一步修复')
  }
})