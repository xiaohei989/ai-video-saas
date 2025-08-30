/**
 * 受保护的下载服务
 * 统一管理所有视频下载，根据用户订阅状态决定是否添加水印
 */

import { SubscriptionService } from '@/services/subscriptionService'
import WatermarkService from '@/services/watermarkService'
import videoShareService from '@/services/videoShareService'
import { toast } from 'sonner'

export interface DownloadOptions {
  filename?: string
  showProgress?: boolean
  onProgress?: (progress: number) => void
  onComplete?: () => void
  onError?: (error: string) => void
}

export class ProtectedDownloadService {
  /**
   * 统一的视频下载方法
   * 自动检查用户订阅状态，为免费用户添加水印
   */
  static async downloadVideo(
    userId: string,
    videoId: string, 
    videoUrl: string,
    videoTitle: string = 'video',
    options: DownloadOptions = {}
  ): Promise<void> {
    const {
      filename,
      showProgress = true,
      onProgress,
      onComplete,
      onError
    } = options

    console.log('[ProtectedDownload] 开始下载视频:', {
      userId,
      videoId,
      videoUrl,
      videoTitle
    })

    if (!videoUrl) {
      const error = '视频URL为空，无法下载'
      console.warn('[ProtectedDownload]', error)
      onError?.(error)
      if (showProgress) toast.error(error)
      return
    }

    try {
      // 1. 检查用户订阅状态
      const subscription = await SubscriptionService.getCurrentSubscription(userId)
      const isPaidUser = subscription && subscription.status === 'active'
      
      console.log('[ProtectedDownload] 用户订阅状态:', { isPaidUser, subscription })

      const defaultFilename = filename || `${videoTitle}-${videoId}.mp4`
      
      if (isPaidUser) {
        // 付费用户：直接下载无水印原视频
        console.log('[ProtectedDownload] 付费用户，直接下载原视频')
        
        if (showProgress) {
          toast.info('开始下载高清无水印视频...', { 
            id: 'download-' + videoId,
            duration: 3000
          })
        }
        
        // 尝试使用 videoShareService，如果失败则使用直接下载
        try {
          await videoShareService.downloadVideo(videoId, videoUrl, {
            filename: defaultFilename
          })
        } catch (shareServiceError) {
          console.warn('[ProtectedDownload] videoShareService 失败，使用直接下载:', shareServiceError)
          // 直接下载备用方案
          const a = document.createElement('a')
          a.href = videoUrl
          a.download = defaultFilename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
        
        if (showProgress) {
          setTimeout(() => {
            toast.success('下载开始！', { 
              id: 'download-' + videoId,
              duration: 4000
            })
          }, 1000)
        }
        
      } else {
        // 免费用户：添加水印后下载
        console.log('[ProtectedDownload] 免费用户，添加水印后下载')
        
        // 检查浏览器支持
        if (!WatermarkService.isSupported()) {
          const error = '您的浏览器不支持水印功能，请使用最新版Chrome或Firefox'
          console.warn('[ProtectedDownload]', error)
          onError?.(error)
          if (showProgress) toast.error(error)
          return
        }

        // 显示处理中的提示
        if (showProgress) {
          toast.info('正在为视频添加水印，请稍候...', { 
            id: 'watermark-' + videoId,
            duration: 0 // 不自动关闭
          })
        }
        
        try {
          // 获取最佳输出格式
          const bestFormat = WatermarkService.getBestVideoFormat()
          console.log('[ProtectedDownload] 使用格式:', bestFormat)
          
          // 添加水印
          const watermarkedBlob = await WatermarkService.addWatermarkToVideo(
            videoUrl, 
            undefined, // 使用默认水印配置
          )
          
          const watermarkedFilename = `${videoTitle}-${videoId}-watermarked.${bestFormat.extension}`
          
          // 创建下载
          WatermarkService.createDownloadUrl(watermarkedBlob, watermarkedFilename)
          
          // 关闭处理提示，显示成功消息
          if (showProgress) {
            toast.dismiss('watermark-' + videoId)
            toast.success(`带水印视频已生成！格式：${bestFormat.format}`, {
              duration: 4000
            })
          }
          
          onComplete?.()
          
        } catch (watermarkError) {
          console.error('[ProtectedDownload] 水印处理失败，降级到原视频下载:', watermarkError)
          
          if (showProgress) {
            toast.dismiss('watermark-' + videoId)
            toast.warning('水印处理失败，下载原视频')
          }
          
          // 降级到原视频下载
          try {
            await videoShareService.downloadVideo(videoId, videoUrl, {
              filename: defaultFilename
            })
          } catch (shareServiceError) {
            console.warn('[ProtectedDownload] 降级下载时 videoShareService 失败，使用直接下载:', shareServiceError)
            // 直接下载备用方案
            const a = document.createElement('a')
            a.href = videoUrl
            a.download = defaultFilename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }
          
          onError?.(`水印处理失败: ${watermarkError instanceof Error ? watermarkError.message : '未知错误'}`)
        }
      }
      
    } catch (error) {
      console.error('[ProtectedDownload] 下载失败:', error)
      const errorMessage = `下载失败: ${error instanceof Error ? error.message : '未知错误'}`
      
      onError?.(errorMessage)
      if (showProgress) {
        toast.error(errorMessage, { 
          id: 'download-' + videoId,
          duration: 5000
        })
      }
    }
  }

  /**
   * 检查用户是否有下载权限
   */
  static async hasDownloadPermission(userId: string): Promise<boolean> {
    try {
      const subscription = await SubscriptionService.getCurrentSubscription(userId)
      return subscription?.status === 'active' || false
    } catch (error) {
      console.error('[ProtectedDownload] 检查下载权限失败:', error)
      return false
    }
  }

  /**
   * 获取下载类型（带水印或无水印）
   */
  static async getDownloadType(userId: string): Promise<'watermarked' | 'original'> {
    const isPaid = await this.hasDownloadPermission(userId)
    return isPaid ? 'original' : 'watermarked'
  }
}

export default ProtectedDownloadService