/**
 * 图片上传功能测试用例
 * 测试上传图片并返回URL的完整流程
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

class ImageUploadTester {
  private bucketName = 'user-images'
  private tempFolder = 'temp'

  /**
   * 测试上传base64图片并返回URL
   */
  async testBase64Upload(base64Data: string, testName: string): Promise<void> {
    console.log(`\n🧪 [TEST ${testName}] Starting base64 image upload test`)
    console.log(`📊 [TEST ${testName}] Input size: ${Math.round(base64Data.length / 1024)} KB`)
    
    try {
      const startTime = Date.now()
      
      // 解析base64数据
      const base64Content = base64Data.split(',')[1]
      const mimeTypeMatch = base64Data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/)
      const mimeType = mimeTypeMatch?.[1] || 'image/jpeg'
      
      console.log(`📝 [TEST ${testName}] Detected MIME type: ${mimeType}`)
      
      // 转换为Buffer
      const buffer = Buffer.from(base64Content, 'base64')
      
      // 生成文件名
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 15)
      const extension = this.getExtensionFromMimeType(mimeType)
      const fileName = `${this.tempFolder}/${timestamp}-${randomId}.${extension}`
      
      console.log(`📁 [TEST ${testName}] Generated filename: ${fileName}`)
      
      // 上传到Supabase
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, buffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        throw new Error(`Upload failed: ${error.message}`)
      }
      
      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(fileName)
      
      const publicUrl = urlData.publicUrl
      const uploadTime = Date.now() - startTime
      
      console.log(`✅ [TEST ${testName}] Upload successful in ${uploadTime}ms`)
      console.log(`🔗 [TEST ${testName}] Public URL: ${publicUrl}`)
      
      // 验证URL可访问性
      await this.validateUrl(publicUrl, testName)
      
      // 验证URL格式
      this.validateUrlFormat(publicUrl, testName)
      
      console.log(`🎉 [TEST ${testName}] All validations passed!`)
      
    } catch (error) {
      console.error(`❌ [TEST ${testName}] Test failed:`, error)
      throw error
    }
  }

  /**
   * 验证URL可访问性
   */
  private async validateUrl(url: string, testName: string): Promise<void> {
    console.log(`🔍 [TEST ${testName}] Validating URL accessibility...`)
    
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`URL not accessible, status: ${response.status}`)
      }
      
      const contentType = response.headers.get('content-type')
      console.log(`✅ [TEST ${testName}] URL accessible, Content-Type: ${contentType}`)
      
      // 验证是否是图片类型
      if (!contentType || !contentType.startsWith('image/')) {
        console.warn(`⚠️ [TEST ${testName}] Warning: Content-Type is not image/*`)
      }
      
    } catch (error) {
      console.error(`❌ [TEST ${testName}] URL validation failed:`, error)
      throw error
    }
  }

  /**
   * 验证URL格式
   */
  private validateUrlFormat(url: string, testName: string): void {
    console.log(`📏 [TEST ${testName}] Validating URL format...`)
    
    // 基本URL格式验证
    if (!url.startsWith('https://')) {
      throw new Error('URL must start with https://')
    }
    
    if (!url.includes('supabase.co')) {
      throw new Error('URL must be from Supabase domain')
    }
    
    if (!url.includes('/storage/v1/object/public/')) {
      throw new Error('URL must be a public storage URL')
    }
    
    if (!url.includes('/user-images/temp/')) {
      throw new Error('URL must point to user-images/temp/ path')
    }
    
    console.log(`✅ [TEST ${testName}] URL format validation passed`)
  }

  /**
   * 获取文件扩展名
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp'
    }
    
    return extensionMap[mimeType] || 'jpg'
  }

  /**
   * 创建测试用的base64图片
   */
  createTestImage(type: 'small' | 'medium' | 'large'): string {
    switch (type) {
      case 'small':
        // 1x1像素红色PNG (最小)
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      
      case 'medium':
        // 2x2像素彩色PNG
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAE0lEQVR42mNk+M9Qz4AARhhhAABKrQGANJPKJwAAAABJRU5ErkJggg=='
      
      case 'large':
        // 较大的测试图片 (简单的10x10像素图案)
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFESURBVBiVY2CgAzAxMTH8//+fgQEOmJiYGP7//4/iJzY2NgZ2dnYGHh4eBk5OTgZubm4GLi4uBjY2NgYODg4GdnZ2BiYmJgZGRkYGRkZGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY6AQDw5jBqPFMkbgAAAABJRU5ErkJggg=='
      
      default:
        return this.createTestImage('small')
    }
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 Starting Image Upload Test Suite')
  console.log('=====================================')
  
  const tester = new ImageUploadTester()
  let passedTests = 0
  let totalTests = 0
  
  // 测试用例1: 小图片上传
  try {
    totalTests++
    const smallImage = tester.createTestImage('small')
    await tester.testBase64Upload(smallImage, '1-SMALL')
    passedTests++
  } catch (error) {
    console.error('Test 1 failed')
  }
  
  // 测试用例2: 中等图片上传
  try {
    totalTests++
    const mediumImage = tester.createTestImage('medium')
    await tester.testBase64Upload(mediumImage, '2-MEDIUM')
    passedTests++
  } catch (error) {
    console.error('Test 2 failed')
  }
  
  // 测试用例3: 较大图片上传
  try {
    totalTests++
    const largeImage = tester.createTestImage('large')
    await tester.testBase64Upload(largeImage, '3-LARGE')
    passedTests++
  } catch (error) {
    console.error('Test 3 failed')
  }
  
  // 测试用例4: JPEG格式图片
  try {
    totalTests++
    const jpegImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/gAA='
    await tester.testBase64Upload(jpegImage, '4-JPEG')
    passedTests++
  } catch (error) {
    console.error('Test 4 failed')
  }
  
  // 测试结果汇总
  console.log('\n📊 Test Results Summary')
  console.log('========================')
  console.log(`✅ Passed: ${passedTests}/${totalTests}`)
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`)
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Image upload functionality is working correctly.')
    return true
  } else {
    console.log('⚠️ Some tests failed. Please check the logs above.')
    return false
  }
}

// 运行测试
runAllTests().then(success => {
  process.exit(success ? 0 : 1)
}).catch(error => {
  console.error('Test suite crashed:', error)
  process.exit(1)
})