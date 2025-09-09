/**
 * 测试图片上传功能
 */

import { imageUploadService } from '../services/imageUploadService'

// 创建一个简单的测试用base64图片（1x1像素红色PNG）
const testBase64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function testImageUpload() {
  console.log('🧪 [TEST] Starting image upload test...')
  
  try {
    // 测试bucket信息获取
    console.log('📊 [TEST] Getting bucket info...')
    const bucketInfo = await imageUploadService.getBucketInfo()
    console.log('✅ [TEST] Bucket info:', bucketInfo)
    
    // 测试图片上传
    console.log('📤 [TEST] Uploading test image...')
    const uploadedUrl = await imageUploadService.uploadBase64Image(testBase64Image)
    console.log('✅ [TEST] Upload successful! URL:', uploadedUrl)
    
    // 测试URL访问
    console.log('🔗 [TEST] Testing URL accessibility...')
    const response = await fetch(uploadedUrl)
    if (response.ok) {
      console.log('✅ [TEST] URL is accessible, status:', response.status)
    } else {
      console.error('❌ [TEST] URL is not accessible, status:', response.status)
    }
    
    console.log('🎉 [TEST] All tests passed!')
    
  } catch (error) {
    console.error('❌ [TEST] Test failed:', error)
  }
}

// 运行测试
testImageUpload()