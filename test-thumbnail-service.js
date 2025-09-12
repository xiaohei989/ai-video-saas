#!/usr/bin/env node

// 模拟缩略图生成器服务测试
class ThumbnailGeneratorService {
  generateThumbnailPath(videoSrc) {
    const videoName = videoSrc.split('/').pop()?.replace('.mp4', '') || 'video'
    return {
      normal: `/templates/thumbnails/${videoName}-thumbnail.jpg`,
      blur: `/templates/thumbnails/${videoName}-thumbnail-blur.jpg`
    }
  }

  async checkThumbnailExists(thumbnailPath) {
    try {
      const response = await fetch(`http://localhost:3001${thumbnailPath}`, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  async getBestThumbnail(videoSrc, fallbackImage) {
    const thumbnailPaths = this.generateThumbnailPath(videoSrc)
    
    console.log(`[ThumbnailGenerator] 检查缩略图路径:`, thumbnailPaths)
    
    const normalExists = await this.checkThumbnailExists(thumbnailPaths.normal)
    const blurExists = await this.checkThumbnailExists(thumbnailPaths.blur)
    
    console.log(`[ThumbnailGenerator] 缩略图存在状态: normal=${normalExists}, blur=${blurExists}`)
    
    if (normalExists && blurExists) {
      console.log(`[ThumbnailGenerator] ✅ 使用生成的缩略图: ${thumbnailPaths.normal}`)
      return thumbnailPaths
    }
    
    const fallback = fallbackImage || '/logo.png'
    console.log(`[ThumbnailGenerator] ⚠️ 缩略图不存在，使用fallback: ${fallback}`)
    return {
      normal: fallback,
      blur: fallback
    }
  }
}

async function testThumbnailService() {
  console.log('🧪 开始测试缩略图服务...\n')
  
  const thumbnailGenerator = new ThumbnailGeneratorService()
  
  // 测试视频列表
  const testVideos = [
    '/templates/videos/animal-skateboarding-street.mp4',
    '/templates/videos/art-coffee-machine.mp4',
    '/templates/videos/asmr-surreal-toast-spread.mp4'
  ]
  
  let successCount = 0
  
  for (const video of testVideos) {
    console.log(`\n📹 测试视频: ${video}`)
    console.log('='.repeat(50))
    
    try {
      const result = await thumbnailGenerator.getBestThumbnail(video)
      
      if (result.normal.includes('templates/thumbnails')) {
        successCount++
        console.log(`✅ 成功获取缩略图: ${result.normal}`)
      } else {
        console.log(`⚠️ 使用fallback: ${result.normal}`)
      }
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log(`📊 测试结果: ${successCount}/${testVideos.length} 个视频成功获取到缩略图`)
  
  if (successCount === testVideos.length) {
    console.log('🎉 所有测试通过！缩略图服务工作正常。')
    return true
  } else {
    console.log('⚠️ 部分测试失败，可能需要进一步检查。')
    return false
  }
}

// 直接运行测试
testThumbnailService().then(success => {
  process.exit(success ? 0 : 1)
}).catch(error => {
  console.error('❌ 测试过程中发生错误:', error)
  process.exit(1)
})