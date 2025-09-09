/**
 * Video Share Service
 * 处理视频下载和分享功能
 */

import supabaseVideoService from './supabaseVideoService'
import i18n from '@/i18n/config'

export interface ShareOptions {
  platform?: 'twitter' | 'facebook' | 'linkedin' | 'whatsapp' | 'telegram' | 'copy'
  title?: string
  description?: string
  hashtags?: string[]
}

export interface DownloadOptions {
  filename?: string
  quality?: 'original' | 'compressed'
  watermark?: boolean
}

class VideoShareService {
  private shareBaseUrl: string = ''

  constructor() {
    // 设置分享基础URL
    this.shareBaseUrl = process.env.APP_URL || window.location.origin
  }

  /**
   * 生成分享链接
   */
  generateShareLink(videoId: string): string {
    return `${this.shareBaseUrl}/video/${videoId}`
  }

  /**
   * 生成短链接（可以集成短链接服务）
   */
  async generateShortLink(videoId: string): Promise<string> {
    const longUrl = this.generateShareLink(videoId)
    
    // TODO: 集成短链接服务（如bit.ly, tinyurl等）
    // 暂时返回原链接
    return longUrl
  }

  /**
   * 分享到社交平台
   */
  async shareVideo(videoId: string, options: ShareOptions = {}): Promise<boolean> {
    const video = await supabaseVideoService.getVideo(videoId)
    if (!video) {
      throw new Error('Video not found')
    }

    const shareUrl = await this.generateShortLink(videoId)
    const title = options.title || video.title || 'AI Generated Video'
    const description = options.description || video.prompt || ''
    const hashtags = options.hashtags?.join(',') || 'AIVideo,VideoGeneration'

    // 分享计数在调用方处理

    switch (options.platform) {
      case 'twitter':
        return this.shareToTwitter(shareUrl, title, hashtags)
      
      case 'facebook':
        return this.shareToFacebook(shareUrl)
      
      case 'linkedin':
        return this.shareToLinkedIn(shareUrl, title, description)
      
      case 'whatsapp':
        return this.shareToWhatsApp(shareUrl, title)
      
      case 'telegram':
        return this.shareToTelegram(shareUrl, title)
      
      case 'copy':
      default:
        return this.copyToClipboard(shareUrl)
    }
  }

  /**
   * 分享到Twitter
   */
  private shareToTwitter(url: string, text: string, hashtags: string): boolean {
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}&hashtags=${hashtags}`
    window.open(twitterUrl, '_blank', 'width=600,height=400')
    return true
  }

  /**
   * 分享到Facebook
   */
  private shareToFacebook(url: string): boolean {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(facebookUrl, '_blank', 'width=600,height=400')
    return true
  }

  /**
   * 分享到LinkedIn
   */
  private shareToLinkedIn(url: string, title: string, summary: string): boolean {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(summary)}`
    window.open(linkedinUrl, '_blank', 'width=600,height=400')
    return true
  }

  /**
   * 分享到WhatsApp
   */
  private shareToWhatsApp(url: string, text: string): boolean {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
    window.open(whatsappUrl, '_blank')
    return true
  }

  /**
   * 分享到Telegram
   */
  private shareToTelegram(url: string, text: string): boolean {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
    window.open(telegramUrl, '_blank')
    return true
  }

  /**
   * 复制到剪贴板
   */
  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // 降级方案
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }

  /**
   * 使用Web Share API（如果支持）
   */
  async shareWithWebAPI(videoId: string, options: ShareOptions = {}): Promise<boolean> {
    if (!navigator.share) {
      return false
    }

    const video = await supabaseVideoService.getVideo(videoId)
    if (!video) {
      throw new Error('Video not found')
    }

    const shareUrl = await this.generateShortLink(videoId)
    const title = options.title || video.title || 'AI Generated Video'
    const text = options.description || video.prompt || ''

    try {
      await navigator.share({
        title,
        text,
        url: shareUrl
      })
      
      // 分享计数在调用方处理
      
      return true
    } catch (error) {
      console.error('Web Share API failed:', error)
      return false
    }
  }

  /**
   * 下载视频
   */
  async downloadVideo(
    videoId: string,
    videoUrl: string,
    options: DownloadOptions = {}
  ): Promise<void> {
    console.log('[VideoShareService] downloadVideo 开始下载:', {
      videoId,
      videoUrl,
      options
    })
    
    const video = await supabaseVideoService.getVideo(videoId)
    if (!video) {
      console.error('[VideoShareService] Video not found:', videoId)
      throw new Error('Video not found')
    }

    console.log('[VideoShareService] 视频信息获取成功:', {
      id: video.id,
      title: video.title,
      video_url: video.video_url,
      status: video.status
    })

    // 下载计数在调用方处理

    const filename = options.filename || `${video.title || 'video'}-${videoId}.mp4`
    console.log('[VideoShareService] 生成文件名:', filename)

    try {
      // 如果需要添加水印或压缩，这里可以调用后端API处理
      if (options.watermark || options.quality === 'compressed') {
        console.log('[VideoShareService] 需要处理视频（水印/压缩）')
        // TODO: 调用后端处理API
        const processedUrl = await this.processVideoForDownload(videoUrl, options)
        await this.performDownload(processedUrl, filename)
      } else {
        console.log('[VideoShareService] 直接下载原始视频')
        // 直接下载原始视频
        await this.performDownload(videoUrl, filename)
      }
      
      console.log('[VideoShareService] 下载完成')
    } catch (error) {
      console.error('[VideoShareService] Download failed:', error)
      throw error
    }
  }

  /**
   * 执行下载 - 使用Fetch + Blob强制下载（零服务器流量）
   */
  private async performDownload(url: string, filename: string): Promise<void> {
    console.log('[VideoShareService] 开始强制下载:', { url, filename })
    
    try {
      // 显示下载开始提示
      const { toast } = await import('sonner')
      toast.loading(i18n.t('video.fetchingData'), { 
        id: 'download-' + filename,
        duration: Infinity 
      })
      
      console.log('[VideoShareService] 开始fetch请求')
      // 使用fetch获取视频数据
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      console.log('[VideoShareService] fetch请求成功，开始读取数据流')
      // 获取文件大小
      const contentLength = response.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : 0
      console.log('[VideoShareService] 视频文件大小:', total, 'bytes')
      
      // 读取响应流并显示进度
      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')
      
      const chunks: Uint8Array[] = []
      let received = 0
      
      // 读取数据流
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        chunks.push(value)
        received += value.length
        
        // 更新下载进度
        if (total > 0) {
          const progress = Math.round((received / total) * 100)
          toast.loading(i18n.t('video.downloadingProgress', { progress }), { 
            id: 'download-' + filename,
            duration: Infinity 
          })
          console.log(`[VideoShareService] 下载进度: ${progress}% (${received}/${total} bytes)`)
        } else {
          // 如果没有Content-Length，显示已下载的字节数
          const receivedMB = (received / 1024 / 1024).toFixed(1)
          toast.loading(i18n.t('video.downloadingSize', { size: receivedMB }), { 
            id: 'download-' + filename,
            duration: Infinity 
          })
        }
      }
      
      console.log('[VideoShareService] 数据流读取完成，创建Blob')
      // 合并所有数据块为Blob
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' })
      console.log('[VideoShareService] Blob创建完成，大小:', blob.size, 'bytes')
      
      // 创建临时下载URL
      const blobUrl = window.URL.createObjectURL(blob)
      console.log('[VideoShareService] Blob URL创建完成')
      
      // 创建隐藏的a标签触发下载
      const link = document.createElement('a')
      link.href = blobUrl
      
      // 优化文件名处理 - 移除特殊字符并确保正确编码
      const sanitizedFilename = this.sanitizeFilename(filename)
      link.download = sanitizedFilename
      
      // 设置其他属性确保下载
      link.setAttribute('download', sanitizedFilename)
      link.style.display = 'none'
      document.body.appendChild(link)
      
      // 触发点击下载
      link.click()
      console.log('[VideoShareService] 下载链接已点击')
      
      // 清理DOM和内存
      document.body.removeChild(link)
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl)
        console.log('[VideoShareService] Blob URL已清理')
      }, 100)
      
      // 显示成功提示
      toast.success(i18n.t('video.downloadComplete'), { 
        id: 'download-' + filename,
        duration: 3000 
      })
      
      console.log('[VideoShareService] Blob下载成功完成')
      
    } catch (error) {
      console.error('[VideoShareService] Fetch下载失败:', error)
      
      // 动态导入toast以避免循环引用
      const { toast } = await import('sonner')
      
      // CORS错误或网络错误时的降级方案
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('CORS') || 
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('TypeError')) {
        console.log('[VideoShareService] 检测到网络限制，使用降级方案')
        
        // 清除之前的加载提示
        toast.dismiss('download-' + filename)
        
        // 更友好的用户提示
        toast.info('由于跨域限制，将在新窗口中打开视频', { 
          id: 'download-' + filename,
          duration: 4000
        })
        
        // 直接打开新窗口（最可靠的方式）
        try {
          window.open(url, '_blank', 'noopener,noreferrer')
          console.log('[VideoShareService] 新窗口已打开')
          
          // 延迟显示保存指引
          setTimeout(() => {
            toast.info('请在新窗口中右键点击视频，选择"另存为"进行下载', { 
              id: 'save-instruction-' + filename,
              duration: 6000
            })
          }, 1000)
          
        } catch (windowError) {
          console.error('[VideoShareService] 打开新窗口失败:', windowError)
          
          // 如果新窗口被阻塞，尝试创建下载链接
          try {
            const a = document.createElement('a')
            a.href = url
            a.target = '_blank'
            a.rel = 'noopener noreferrer'
            a.download = filename
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            
            toast.success('下载链接已创建', { 
              id: 'download-' + filename,
              duration: 3000
            })
            
          } catch (linkError) {
            console.error('[VideoShareService] 创建下载链接失败:', linkError)
            
            // 最后的降级：显示链接让用户手动复制
            toast.error('无法自动下载，请复制链接手动下载：' + url.substring(0, 50) + '...', { 
              id: 'download-' + filename,
              duration: 8000
            })
          }
        }
        
        // 不再使用iframe，因为它通常不能绕过CORS
        
      } else {
        // 其他错误
        toast.dismiss('download-' + filename)
        toast.error(`下载失败: ${errorMessage}`, { 
          id: 'download-' + filename,
          duration: 5000
        })
      }
    }
    
    console.log('[VideoShareService] performDownload 执行完成')
  }

  /**
   * 优化文件名 - 最小化处理，尽量保持原文件名
   */
  private sanitizeFilename(filename: string): string {
    // 只处理真正危险的字符，保留空格和其他安全字符
    const sanitized = filename
      // 只移除真正危险的路径字符和控制字符
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      // 移除开头和结尾的点和空格（防止隐藏文件或系统问题）
      .replace(/^[.\s]+|[.\s]+$/g, '')
      // 限制长度
      .substring(0, 200)
    
    // 如果文件名为空，使用默认名称
    if (!sanitized.trim()) {
      return 'video.mp4'
    }
    
    // 确保有 .mp4 扩展名
    if (!sanitized.toLowerCase().endsWith('.mp4')) {
      const nameWithoutExt = sanitized.replace(/\.[^.]*$/, '')
      return nameWithoutExt + '.mp4'
    }
    
    console.log('[VideoShareService] 文件名优化:', {
      original: filename,
      sanitized: sanitized,
      保留空格: sanitized.includes(' '),
      byteLength: new Blob([sanitized]).size
    })
    
    return sanitized
  }

  /**
   * 处理视频（添加水印、压缩等）
   */
  private async processVideoForDownload(
    videoUrl: string,
    options: DownloadOptions
  ): Promise<string> {
    // TODO: 实现视频处理API调用
    // 这里应该调用后端API来处理视频
    console.log('Processing video with options:', options)
    
    // 暂时返回原始URL
    return videoUrl
  }

  /**
   * 生成嵌入代码
   */
  generateEmbedCode(videoId: string, width: number = 640, height: number = 360): string {
    const embedUrl = `${this.shareBaseUrl}/embed/${videoId}`
    
    return `<iframe 
      width="${width}" 
      height="${height}" 
      src="${embedUrl}" 
      frameborder="0" 
      allowfullscreen
      title="AI Generated Video">
    </iframe>`
  }

  /**
   * 生成分享元数据（用于社交媒体预览）
   */
  async generateShareMetadata(videoId: string): Promise<{
    title: string
    description: string
    image: string
    url: string
    type: string
  }> {
    const video = await supabaseVideoService.getVideo(videoId)
    if (!video) {
      throw new Error('Video not found')
    }

    return {
      title: video.title || 'AI Generated Video',
      description: video.prompt || '',
      image: video.thumbnail_url || `${this.shareBaseUrl}/default-thumbnail.jpg`,
      url: this.generateShareLink(videoId),
      type: 'video.other'
    }
  }

  /**
   * 批量下载视频
   */
  async batchDownload(videoIds: string[]): Promise<void> {
    for (const videoId of videoIds) {
      const video = await supabaseVideoService.getVideo(videoId)
      if (video?.video_url) {
        await this.downloadVideo(videoId, video.video_url)
        // 添加延迟避免同时下载太多文件
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  /**
   * 生成视频分享报告
   */
  async generateShareReport(videoId: string): Promise<{
    totalShares: number
    totalDownloads: number
    totalViews: number
    shareLinks: string[]
    embedCode: string
  }> {
    const video = await supabaseVideoService.getVideo(videoId)
    if (!video) {
      throw new Error('Video not found')
    }

    return {
      totalShares: video.share_count || 0,
      totalDownloads: video.download_count || 0,
      totalViews: video.view_count || 0,
      shareLinks: [
        this.generateShareLink(videoId),
        `Twitter: https://twitter.com/intent/tweet?url=${encodeURIComponent(this.generateShareLink(videoId))}`,
        `Facebook: https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.generateShareLink(videoId))}`
      ],
      embedCode: this.generateEmbedCode(videoId)
    }
  }
}

// 导出单例
export const videoShareService = new VideoShareService()
export default videoShareService