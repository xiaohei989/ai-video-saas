/**
 * Node.js环境下的图片上传功能测试
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'

// 创建Node.js专用的Supabase客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey)

class NodeImageUploadService {
  private bucketName = 'user-images'
  private tempFolder = 'temp'

  async uploadBase64Image(base64Data: string): Promise<string> {
    console.log('[NODE TEST] Starting base64 image upload to Supabase Storage')
    
    try {
      // 解析base64数据
      const base64Content = base64Data.split(',')[1]
      const mimeTypeMatch = base64Data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/)
      const mimeType = mimeTypeMatch?.[1] || 'image/jpeg'
      
      if (!base64Content) {
        throw new Error('Invalid base64 data format')
      }
      
      console.log('[NODE TEST] MIME type:', mimeType)
      
      // 转换base64为Buffer (Node.js环境)
      const buffer = Buffer.from(base64Content, 'base64')
      
      console.log('[NODE TEST] Buffer size:', Math.round(buffer.length / 1024), 'KB')
      
      // 生成唯一文件名
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 15)
      const extension = this.getExtensionFromMimeType(mimeType)
      const fileName = `${this.tempFolder}/${timestamp}-${randomId}.${extension}`
      
      console.log('[NODE TEST] Generated filename:', fileName)
      
      // 上传到Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, buffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        console.error('[NODE TEST] Supabase upload error:', error)
        throw new Error(`Upload failed: ${error.message}`)
      }
      
      console.log('[NODE TEST] Upload successful:', data.path)
      
      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(fileName)
      
      const publicUrl = urlData.publicUrl
      console.log('[NODE TEST] Generated public URL:', publicUrl)
      
      return publicUrl
    } catch (error) {
      console.error('[NODE TEST] Failed to upload image:', error)
      throw error
    }
  }

  async getBucketInfo() {
    try {
      const { data, error } = await supabase.storage.getBucket(this.bucketName)
      if (error) throw error
      return data
    } catch (error) {
      console.error('[NODE TEST] Failed to get bucket info:', error)
      throw error
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff'
    }
    
    return extensionMap[mimeType] || 'jpg'
  }
}

// 创建一个简单的测试用base64图片（1x1像素红色PNG）
const testBase64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function testImageUpload() {
  console.log('🧪 [NODE TEST] Starting image upload test...')
  
  const uploadService = new NodeImageUploadService()
  
  try {
    // 跳过bucket信息获取，直接测试上传
    console.log('📊 [NODE TEST] Skipping bucket info, testing upload directly...')
    
    // 测试图片上传
    console.log('📤 [NODE TEST] Uploading test image...')
    const uploadedUrl = await uploadService.uploadBase64Image(testBase64Image)
    console.log('✅ [NODE TEST] Upload successful! URL:', uploadedUrl)
    
    // 测试URL访问
    console.log('🔗 [NODE TEST] Testing URL accessibility...')
    const fetch = (await import('node-fetch')).default
    const response = await fetch(uploadedUrl)
    if (response.ok) {
      console.log('✅ [NODE TEST] URL is accessible, status:', response.status)
    } else {
      console.error('❌ [NODE TEST] URL is not accessible, status:', response.status)
    }
    
    console.log('🎉 [NODE TEST] All tests passed!')
    
  } catch (error) {
    console.error('❌ [NODE TEST] Test failed:', error)
  }
}

// 运行测试
testImageUpload()