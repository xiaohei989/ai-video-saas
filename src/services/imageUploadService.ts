/**
 * 图片上传服务
 * 负责将base64图片上传到Supabase Storage并获取公开URL
 */

import { supabase } from '@/lib/supabase'

export interface ImageUploadResult {
  url: string
  path: string
  size: number
}

class ImageUploadService {
  private bucketName = 'user-images'
  private tempFolder = 'temp'

  /**
   * 上传base64图片到Supabase Storage
   * @param base64Data base64格式的图片数据
   * @returns 返回公开访问URL
   */
  async uploadBase64Image(base64Data: string): Promise<string> {
    console.log('[IMAGE UPLOAD] Starting base64 image upload to Supabase Storage')
    
    try {
      // 解析base64数据
      const base64Content = base64Data.split(',')[1]
      const mimeTypeMatch = base64Data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/)
      const mimeType = mimeTypeMatch?.[1] || 'image/jpeg'
      
      if (!base64Content) {
        throw new Error('Invalid base64 data format')
      }
      
      console.log('[IMAGE UPLOAD] MIME type:', mimeType)
      
      // 转换base64为Blob
      const byteCharacters = atob(base64Content)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })
      
      console.log('[IMAGE UPLOAD] Blob size:', Math.round(blob.size / 1024), 'KB')
      
      // 检查文件大小（50MB限制）
      if (blob.size > 50 * 1024 * 1024) {
        throw new Error('Image size exceeds 50MB limit')
      }
      
      // 生成唯一文件名
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 15)
      const extension = this.getExtensionFromMimeType(mimeType)
      const fileName = `${this.tempFolder}/${timestamp}-${randomId}.${extension}`
      
      console.log('[IMAGE UPLOAD] Generated filename:', fileName)
      
      // 上传到Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(fileName, blob, {
          cacheControl: '3600', // 1小时缓存
          upsert: false
        })
      
      if (error) {
        console.error('[IMAGE UPLOAD] Supabase upload error:', error)
        throw new Error(`Upload failed: ${error.message}`)
      }
      
      console.log('[IMAGE UPLOAD] Upload successful:', data.path)
      
      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(fileName)
      
      const publicUrl = urlData.publicUrl
      console.log('[IMAGE UPLOAD] Generated public URL:', publicUrl)
      
      return publicUrl
    } catch (error) {
      console.error('[IMAGE UPLOAD] Failed to upload image:', error)
      throw error
    }
  }

  /**
   * 上传并压缩图片（可选功能）
   * @param base64Data base64格式的图片数据
   * @param maxWidth 最大宽度，默认1024px
   * @returns 返回公开访问URL
   */
  async uploadWithCompression(base64Data: string, maxWidth: number = 1024): Promise<string> {
    console.log('[IMAGE UPLOAD] Compressing image before upload, max width:', maxWidth)
    
    try {
      const compressedBase64 = await this.compressImage(base64Data, maxWidth)
      return await this.uploadBase64Image(compressedBase64)
    } catch (error) {
      console.warn('[IMAGE UPLOAD] Compression failed, uploading original:', error)
      return await this.uploadBase64Image(base64Data)
    }
  }

  /**
   * 压缩图片
   * @param base64Data base64格式的图片数据
   * @param maxWidth 最大宽度
   * @returns 压缩后的base64数据
   */
  private async compressImage(base64Data: string, maxWidth: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // 计算新尺寸
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        
        const { width, height } = img
        let newWidth = width
        let newHeight = height
        
        if (width > maxWidth) {
          newWidth = maxWidth
          newHeight = (height * maxWidth) / width
        }
        
        canvas.width = newWidth
        canvas.height = newHeight
        
        // 绘制并压缩
        ctx.drawImage(img, 0, 0, newWidth, newHeight)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
        
        console.log('[IMAGE UPLOAD] Compressed from', width, 'x', height, 'to', newWidth, 'x', newHeight)
        resolve(compressedBase64)
      }
      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = base64Data
    })
  }

  /**
   * 清理过期的临时图片文件
   * @param hoursOld 多少小时前的文件被认为是过期的，默认24小时
   */
  async cleanupExpiredImages(hoursOld: number = 24): Promise<number> {
    console.log('[IMAGE UPLOAD] Cleaning up expired images older than', hoursOld, 'hours')
    
    try {
      const { data: files, error } = await supabase.storage
        .from(this.bucketName)
        .list(this.tempFolder)
      
      if (error) {
        console.error('[IMAGE UPLOAD] Failed to list files for cleanup:', error)
        return 0
      }
      
      if (!files || files.length === 0) {
        console.log('[IMAGE UPLOAD] No files to cleanup')
        return 0
      }
      
      const now = Date.now()
      const expiredFiles = files.filter(file => {
        if (!file.created_at) return false
        
        const fileTime = new Date(file.created_at).getTime()
        const ageHours = (now - fileTime) / (1000 * 60 * 60)
        return ageHours > hoursOld
      })
      
      console.log('[IMAGE UPLOAD] Found', expiredFiles.length, 'expired files')
      
      if (expiredFiles.length === 0) return 0
      
      // 删除过期文件
      const filesToDelete = expiredFiles.map(file => `${this.tempFolder}/${file.name}`)
      const { error: deleteError } = await supabase.storage
        .from(this.bucketName)
        .remove(filesToDelete)
      
      if (deleteError) {
        console.error('[IMAGE UPLOAD] Failed to delete expired files:', deleteError)
        return 0
      }
      
      console.log('[IMAGE UPLOAD] Successfully deleted', expiredFiles.length, 'expired files')
      return expiredFiles.length
    } catch (error) {
      console.error('[IMAGE UPLOAD] Cleanup failed:', error)
      return 0
    }
  }

  /**
   * 根据MIME类型获取文件扩展名
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
      'image/svg+xml': 'svg'
    }
    
    return extensionMap[mimeType] || 'jpg'
  }

  /**
   * 验证图片格式是否支持
   */
  isSupportedImageFormat(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp'
    ]
    
    return supportedTypes.includes(mimeType)
  }

  /**
   * 获取bucket信息
   */
  async getBucketInfo() {
    try {
      const { data, error } = await supabase.storage.getBucket(this.bucketName)
      if (error) throw error
      return data
    } catch (error) {
      console.error('[IMAGE UPLOAD] Failed to get bucket info:', error)
      throw error
    }
  }
}

// 导出单例
export const imageUploadService = new ImageUploadService()
export default imageUploadService