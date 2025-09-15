/**
 * Cloudflare R2存储服务
 * 用于视频文件的上传、下载和管理
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicDomain?: string // 自定义域名（可选）
}

interface UploadResult {
  success: boolean
  key: string
  url: string
  size?: number
  error?: string
}

class CloudflareR2Service {
  private client: S3Client
  private config: R2Config

  constructor() {
    this.config = {
      accountId: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || '',
      accessKeyId: import.meta.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: import.meta.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
      bucketName: import.meta.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage',
      publicDomain: import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN
    }

    if (!this.config.accountId || !this.config.accessKeyId || !this.config.secretAccessKey) {
      console.warn('[R2Service] Cloudflare R2配置不完整，请检查环境变量')
    }

    // 配置R2客户端（使用S3兼容API）
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    })

    console.log(`[R2Service] 初始化完成，bucket: ${this.config.bucketName}`)
  }

  /**
   * 从URL下载视频并上传到R2
   */
  async uploadVideoFromURL(videoUrl: string, videoId: string): Promise<UploadResult> {
    try {
      console.log(`[R2Service] 开始下载并上传视频: ${videoId}`)
      
      // 1. 下载视频文件
      const response = await fetch(videoUrl)
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`)
      }

      const videoBuffer = await response.arrayBuffer()
      const videoSize = videoBuffer.byteLength
      
      console.log(`[R2Service] 视频下载完成: ${videoSize} bytes`)

      // 2. 生成R2存储的key
      const key = `videos/${videoId}.mp4`
      
      // 3. 上传到R2
      const uploadCommand = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: new Uint8Array(videoBuffer),
        ContentType: 'video/mp4',
        CacheControl: 'public, max-age=31536000', // 1年缓存
        Metadata: {
          originalUrl: videoUrl,
          uploadedAt: new Date().toISOString(),
          videoId: videoId
        }
      })

      await this.client.send(uploadCommand)
      
      // 4. 生成公开访问URL
      const publicUrl = this.getPublicUrl(key)
      
      console.log(`[R2Service] 视频上传成功: ${publicUrl}`)

      return {
        success: true,
        key,
        url: publicUrl,
        size: videoSize
      }

    } catch (error) {
      console.error(`[R2Service] 视频上传失败: ${videoId}`, error)
      return {
        success: false,
        key: '',
        url: '',
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 直接上传文件到R2
   */
  async uploadFile(
    fileBuffer: ArrayBuffer, 
    key: string, 
    contentType: string = 'video/mp4'
  ): Promise<UploadResult> {
    try {
      const uploadCommand = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: new Uint8Array(fileBuffer),
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000'
      })

      await this.client.send(uploadCommand)
      
      const publicUrl = this.getPublicUrl(key)
      
      return {
        success: true,
        key,
        url: publicUrl,
        size: fileBuffer.byteLength
      }

    } catch (error) {
      console.error(`[R2Service] 文件上传失败: ${key}`, error)
      return {
        success: false,
        key: '',
        url: '',
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      })
      
      await this.client.send(command)
      return true
    } catch {
      return false
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      })
      
      await this.client.send(command)
      console.log(`[R2Service] 文件删除成功: ${key}`)
      return true
    } catch (error) {
      console.error(`[R2Service] 文件删除失败: ${key}`, error)
      return false
    }
  }

  /**
   * 生成公开访问URL
   */
  private getPublicUrl(key: string): string {
    if (this.config.publicDomain) {
      return `https://${this.config.publicDomain}/${key}`
    }
    
    // 使用默认的R2公开URL格式
    return `https://pub-${this.config.accountId}.r2.dev/${key}`
  }

  /**
   * 生成带Media Fragments的视频URL
   */
  getVideoUrlWithTime(key: string, timeSeconds: number = 2.0): string {
    const baseUrl = this.getPublicUrl(key)
    return `${baseUrl}#t=${timeSeconds}`
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return {
      bucketName: this.config.bucketName,
      hasCredentials: !!(this.config.accessKeyId && this.config.secretAccessKey),
      publicDomain: this.config.publicDomain
    }
  }
}

// 导出单例实例
export const cloudflareR2Service = new CloudflareR2Service()
export default cloudflareR2Service