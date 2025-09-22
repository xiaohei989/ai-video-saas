/**
 * 测试缩略图上传功能
 * 直接调用Edge Function来验证上传流程
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 生成测试用的Base64图片数据（1x1像素的WebP图片）
const generateTestImageBase64 = () => {
  // 这是一个最小的1x1像素WebP图片的Base64数据
  return 'UklGRkYAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAABBVBYDwAAAAIAAQEAAQAAAQ=='
}

async function testThumbnailUpload() {
  console.log('🧪 开始测试缩略图上传功能...')
  
  try {
    const testVideoId = 'test-video-' + Date.now()
    const testBase64Data = generateTestImageBase64()
    
    console.log('📤 调用Edge Function: upload-thumbnail')
    console.log('  - videoId:', testVideoId)
    console.log('  - base64Data长度:', testBase64Data.length)
    
    const { data, error } = await supabase.functions.invoke('upload-thumbnail', {
      body: {
        videoId: testVideoId,
        base64Data: testBase64Data,
        contentType: 'image/webp',
        fileSize: 100,
        directUpload: true
      }
    })
    
    if (error) {
      console.error('❌ Edge Function调用失败:', error)
      return
    }
    
    if (data && data.success) {
      console.log('✅ 缩略图上传成功!')
      console.log('  - 公开URL:', data.data.publicUrl)
      console.log('  - 文件key:', data.data.key)
      console.log('  - 上传时间:', data.data.uploadedAt)
    } else {
      console.error('❌ 上传失败:', data)
    }
    
  } catch (error) {
    console.error('❌ 测试异常:', error)
  }
}

// 运行测试
testThumbnailUpload()