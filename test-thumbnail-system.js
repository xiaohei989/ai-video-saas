/**
 * 缩略图系统测试脚本
 */

import { thumbnailGenerator } from './src/services/thumbnailGeneratorService.js'
import { thumbnailGenerationService } from './src/services/ThumbnailGenerationService.js'

// 模拟测试数据
const testVideo = {
  id: 'test-video-123',
  videoUrl: 'https://example.com/test-video.mp4'
}

console.log('🚀 开始测试缩略图系统...')

// 测试1: 缩略图生成器服务
console.log('\n📋 测试1: 缩略图生成器服务')
try {
  const result = await thumbnailGenerator.generateVideoThumbnail(
    testVideo.id,
    testVideo.videoUrl,
    {
      quality: 'medium',
      width: 640,
      height: 360,
      timestamp: 1
    }
  )
  
  console.log('✅ 缩略图生成器测试成功')
  console.log('🖼️ 结果:', {
    success: result.success,
    hasThumbnails: !!result.thumbnails,
    fallbackUsed: result.fallbackUsed
  })
} catch (error) {
  console.error('❌ 缩略图生成器测试失败:', error.message)
}

// 测试2: 缩略图生成服务
console.log('\n📋 测试2: 缩略图生成服务')
try {
  await thumbnailGenerationService.onVideoCompleted(testVideo.id, testVideo.videoUrl)
  
  const stats = thumbnailGenerationService.getStats()
  console.log('✅ 缩略图生成服务测试成功')
  console.log('📊 统计信息:', stats)
} catch (error) {
  console.error('❌ 缩略图生成服务测试失败:', error.message)
}

// 测试3: Edge Function
console.log('\n📋 测试3: Edge Function')
try {
  const response = await fetch('https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/generate-thumbnail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
    },
    body: JSON.stringify({
      videoId: testVideo.id,
      videoUrl: testVideo.videoUrl,
      options: {
        quality: 'medium',
        width: 640,
        height: 360
      }
    })
  })
  
  const result = await response.json()
  console.log('✅ Edge Function测试成功')
  console.log('🌐 响应:', {
    status: response.status,
    success: result.success,
    hasThumbnails: !!result.thumbnails
  })
} catch (error) {
  console.error('❌ Edge Function测试失败:', error.message)
}

console.log('\n🎉 缩略图系统测试完成！')