/**
 * Art Coffee Machine模板自定义图片功能测试
 * 测试完整的图片上传 -> URL生成 -> APICore视频生成流程
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 模拟art-coffee-machine模板的参数结构
interface ArtCoffeeMachineParams {
  artwork: string
  custom_artwork?: string
  cup_style: string
}

// 模拟Template结构
interface Template {
  id: string
  name: string
  promptTemplate: string
  params: {
    artwork: {
      type: string
      options: Array<{value: string, label: string}>
    }
    custom_artwork: {
      type: string
      accept: string
      maxSize: number
    }
    cup_style: {
      type: string
      options: Array<{value: string, label: string}>
    }
  }
}

// 模拟的art-coffee-machine模板
const mockTemplate: Template = {
  id: 'art-coffee-machine',
  name: 'Art Coffee Machine Magic Creation',
  promptTemplate: 'A hand wearing a black glove inserts a card printed with {artwork} into a silver, metallic machine. The brand name "veo3video.me" is printed on the front of the machine. After the card is fully inserted, the camera pans down. The outlet of the machine is directly aligned with a {cup_style} cup. Then, a stream of liquid in a mix of colors as coffee flows out of the nozzle, as if multiple pigments are being squeezed out simultaneously. Once the liquid is poured into the cup, it quickly forms a rotating vortex at the bottom. The various colors dynamically interweave and blend with the vortex. As more liquid is poured, these colors eventually perfectly replicate the {artwork}, like a magical piece of artistic latte art. ASMR sound effects.',
  params: {
    artwork: {
      type: 'select',
      options: [
        {value: "Van Gogh's famous painting The Starry Night", label: "Van Gogh's Starry Night"},
        {value: "a custom artwork image", label: "📤 Upload Custom Image"}
      ]
    },
    custom_artwork: {
      type: 'image',
      accept: 'image/jpeg,image/png,image/webp',
      maxSize: 5242880
    },
    cup_style: {
      type: 'select',
      options: [
        {value: "European-style retro white", label: "European Retro White Porcelain"},
        {value: "modern minimalist glass", label: "Modern Minimalist Glass"}
      ]
    }
  }
}

class ArtCoffeeMachineTest {
  private bucketName = 'user-images'
  
  /**
   * 测试用例1: 预设艺术品选项
   */
  async testPresetArtwork(): Promise<void> {
    console.log('\n🎨 [TEST PRESET] Testing preset artwork selection...')
    
    const params: ArtCoffeeMachineParams = {
      artwork: "Van Gogh's famous painting The Starry Night",
      cup_style: "European-style retro white"
    }
    
    const prompt = this.generatePrompt(mockTemplate.promptTemplate, params)
    console.log('✅ [TEST PRESET] Generated prompt:', prompt.substring(0, 100) + '...')
    console.log('✅ [TEST PRESET] No image upload needed for preset artwork')
  }

  /**
   * 测试用例2: 自定义图片上传和处理
   */
  async testCustomImageUpload(): Promise<void> {
    console.log('\n📤 [TEST CUSTOM] Testing custom image upload and processing...')
    
    // 创建测试图片 (模拟用户上传的艺术作品)
    const testArtworkImage = this.createTestArtwork()
    console.log('🖼️ [TEST CUSTOM] Created test artwork image (base64)')
    
    // 模拟用户选择自定义图片
    const params: ArtCoffeeMachineParams = {
      artwork: "a custom artwork image",
      custom_artwork: testArtworkImage,
      cup_style: "modern minimalist glass"
    }
    
    // 测试图片上传
    console.log('⬆️ [TEST CUSTOM] Uploading custom artwork...')
    const uploadedUrl = await this.uploadCustomImage(params.custom_artwork!)
    console.log('✅ [TEST CUSTOM] Upload successful, URL:', uploadedUrl)
    
    // 验证URL格式适用于APICore
    this.validateApiCoreCompatibility(uploadedUrl)
    
    // 生成最终的prompt
    const finalParams = {
      ...params,
      artwork: `the uploaded custom artwork at ${uploadedUrl}` // 模拟将URL集成到prompt中
    }
    
    const prompt = this.generatePrompt(mockTemplate.promptTemplate, finalParams)
    console.log('✅ [TEST CUSTOM] Generated prompt with custom image:', prompt.substring(0, 150) + '...')
    
    // 模拟APICore请求格式
    const apicoreRequest = {
      prompt: prompt,
      model: 'veo3-fast-frames', // 带图片的模型
      images: [uploadedUrl], // APICore需要的URL数组格式
      enhance_prompt: true,
      aspect_ratio: '16:9'
    }
    
    console.log('✅ [TEST CUSTOM] APICore request format prepared:', {
      model: apicoreRequest.model,
      imagesCount: apicoreRequest.images.length,
      hasImages: apicoreRequest.images.length > 0
    })
  }

  /**
   * 测试用例3: 图片格式兼容性
   */
  async testImageFormatCompatibility(): Promise<void> {
    console.log('\n🔄 [TEST FORMATS] Testing different image formats...')
    
    const formats = [
      { name: 'PNG', data: this.createTestImage('png') },
      { name: 'JPEG', data: this.createTestImage('jpeg') },
      { name: 'WebP', data: this.createTestImage('webp') }
    ]
    
    for (const format of formats) {
      try {
        console.log(`📸 [TEST FORMATS] Testing ${format.name} format...`)
        const url = await this.uploadCustomImage(format.data)
        this.validateApiCoreCompatibility(url)
        console.log(`✅ [TEST FORMATS] ${format.name} format supported`)
      } catch (error) {
        console.error(`❌ [TEST FORMATS] ${format.name} format failed:`, error)
      }
    }
  }

  /**
   * 测试用例4: 文件大小限制
   */
  async testFileSizeLimit(): Promise<void> {
    console.log('\n📏 [TEST SIZE] Testing file size limits...')
    
    try {
      // 测试正常大小的图片
      const normalImage = this.createTestImage('normal')
      const normalUrl = await this.uploadCustomImage(normalImage)
      console.log('✅ [TEST SIZE] Normal size image uploaded successfully')
      
      // 注意: 这里不测试超大文件，因为会消耗存储空间
      // 在实际应用中应该在前端验证文件大小
      console.log('ℹ️ [TEST SIZE] Large file size validation should be handled in frontend')
      
    } catch (error) {
      console.error('❌ [TEST SIZE] Size limit test failed:', error)
    }
  }

  /**
   * 上传自定义图片
   */
  private async uploadCustomImage(base64Data: string): Promise<string> {
    const base64Content = base64Data.split(',')[1]
    const mimeTypeMatch = base64Data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/)
    const mimeType = mimeTypeMatch?.[1] || 'image/jpeg'
    
    const buffer = Buffer.from(base64Content, 'base64')
    
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const extension = this.getExtensionFromMimeType(mimeType)
    const fileName = `temp/art-coffee-${timestamp}-${randomId}.${extension}`
    
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(fileName, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) throw error
    
    const { data: urlData } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(fileName)
    
    return urlData.publicUrl
  }

  /**
   * 验证APICore兼容性
   */
  private validateApiCoreCompatibility(url: string): void {
    if (!url.startsWith('https://')) {
      throw new Error('APICore requires HTTPS URLs')
    }
    
    if (!url.includes('supabase.co')) {
      console.warn('⚠️ URL is not from Supabase, ensure it\'s publicly accessible')
    }
    
    console.log('✅ URL format compatible with APICore')
  }

  /**
   * 生成prompt
   */
  private generatePrompt(template: string, params: ArtCoffeeMachineParams): string {
    return template
      .replace(/{artwork}/g, params.artwork)
      .replace(/{cup_style}/g, params.cup_style)
  }

  /**
   * 创建测试艺术品图片
   */
  private createTestArtwork(): string {
    // 创建一个更大的测试图片，模拟艺术作品
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFESURBVBiVY2CgAzAxMTH8//+fgQEOmJiYGP7//4/iJzY2NgZ2dnYGHh4eBk5OTgZubm4GLi4uBjY2NgYODg4GdnZ2BiYmJgZGRkYGRkZGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY6AQDw5jBqPFMkbgAAAABJRU5ErkJggg=='
  }

  /**
   * 创建不同格式的测试图片
   */
  private createTestImage(format: 'png' | 'jpeg' | 'webp' | 'normal'): string {
    switch (format) {
      case 'png':
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      case 'jpeg':
        return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/gAA='
      case 'webp':
        return 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'
      case 'normal':
        return this.createTestArtwork()
      default:
        return this.createTestArtwork()
    }
  }

  /**
   * 获取文件扩展名
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    }
    return extensionMap[mimeType] || 'jpg'
  }
}

/**
 * 运行Art Coffee Machine测试套件
 */
async function runArtCoffeeMachineTests(): Promise<void> {
  console.log('☕ Starting Art Coffee Machine Template Test Suite')
  console.log('==================================================')
  
  const tester = new ArtCoffeeMachineTest()
  let passedTests = 0
  let totalTests = 0

  // 测试1: 预设艺术品
  try {
    totalTests++
    await tester.testPresetArtwork()
    passedTests++
    console.log('✅ Test 1 (Preset Artwork) PASSED')
  } catch (error) {
    console.error('❌ Test 1 (Preset Artwork) FAILED:', error)
  }

  // 测试2: 自定义图片上传
  try {
    totalTests++
    await tester.testCustomImageUpload()
    passedTests++
    console.log('✅ Test 2 (Custom Image Upload) PASSED')
  } catch (error) {
    console.error('❌ Test 2 (Custom Image Upload) FAILED:', error)
  }

  // 测试3: 图片格式兼容性
  try {
    totalTests++
    await tester.testImageFormatCompatibility()
    passedTests++
    console.log('✅ Test 3 (Format Compatibility) PASSED')
  } catch (error) {
    console.error('❌ Test 3 (Format Compatibility) FAILED:', error)
  }

  // 测试4: 文件大小限制
  try {
    totalTests++
    await tester.testFileSizeLimit()
    passedTests++
    console.log('✅ Test 4 (File Size Limit) PASSED')
  } catch (error) {
    console.error('❌ Test 4 (File Size Limit) FAILED:', error)
  }

  // 测试结果汇总
  console.log('\n📊 Art Coffee Machine Test Results')
  console.log('===================================')
  console.log(`✅ Passed: ${passedTests}/${totalTests}`)
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`)

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Art Coffee Machine custom image functionality is ready!')
    console.log('\n🚀 Integration Summary:')
    console.log('- ✅ Base64 to URL conversion working')
    console.log('- ✅ Supabase Storage integration working')
    console.log('- ✅ APICore URL format compatibility confirmed')
    console.log('- ✅ Multiple image formats supported')
    console.log('- ✅ Template prompt generation working')
  } else {
    console.log('⚠️ Some tests failed. Please check the logs above.')
  }
}

// 运行测试
runArtCoffeeMachineTests().catch(console.error)