/**
 * 服务端缩略图生成服务
 * 调用Supabase Edge Function生成缩略图，并更新数据库
 */

import { createClient } from '@supabase/supabase-js'
import { VideoRecord } from '@/services/videoHistoryService'

interface ThumbnailResponse {
  success: boolean
  thumbnailUrl?: string
  error?: string
  message?: string
  videoId?: string
}

class ServerThumbnailService {
  private supabase
  private generatingVideos = new Set<string>()
  
  constructor() {
    this.supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL || '',
      import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    )
  }

  /**
   * 生成单个视频的缩略图（主要方法）
   */
  async generateThumbnail(videoId: string, videoUrl: string): Promise<string | null> {
    try {
      // 防止重复生成
      if (this.generatingVideos.has(videoId)) {
        console.log(`[ServerThumbnail] 正在生成中，跳过重复请求: ${videoId}`)
        return null
      }

      this.generatingVideos.add(videoId)
      console.log(`[ServerThumbnail] 开始服务端缩略图生成: ${videoId}`)

      const { data, error } = await this.supabase.functions.invoke('generate-thumbnail', {
        body: {
          videoUrl,
          videoId
        }
      })

      if (error) {
        console.error(`[ServerThumbnail] Edge Function调用失败:`, error)
        return null
      }

      const response = data as ThumbnailResponse
      if (response.success && response.thumbnailUrl) {
        console.log(`[ServerThumbnail] 缩略图生成成功: ${videoId} -> ${response.thumbnailUrl}`)
        return response.thumbnailUrl
      } else {
        console.error(`[ServerThumbnail] 缩略图生成失败: ${videoId}`, response.error)
        return null
      }

    } catch (error) {
      console.error(`[ServerThumbnail] 服务端缩略图生成异常: ${videoId}`, error)
      return null
    } finally {
      this.generatingVideos.delete(videoId)
    }
  }

  /**
   * 批量生成缩略图
   */
  async generateBatch(videos: VideoRecord[]): Promise<void> {
    console.log(`[ServerThumbnail] 开始批量生成缩略图: ${videos.length}个视频`)

    const promises = videos.map(video => 
      this.generateThumbnail(video.id, video.videoUrl)
        .catch(error => {
          console.error(`[ServerThumbnail] 批量生成失败 ${video.id}:`, error)
          return null
        })
    )

    const results = await Promise.allSettled(promises)
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length
    
    console.log(`[ServerThumbnail] 批量生成完成: ${successful}/${videos.length} 成功`)
  }

  /**
   * 检查视频是否正在生成缩略图
   */
  isGenerating(videoId: string): boolean {
    return this.generatingVideos.has(videoId)
  }

  /**
   * 获取生成状态统计
   */
  getStats() {
    return {
      generatingCount: this.generatingVideos.size,
      generatingVideos: Array.from(this.generatingVideos)
    }
  }

  /**
   * 取消所有正在进行的生成任务
   */
  cancelAll(): void {
    this.generatingVideos.clear()
    console.log('[ServerThumbnail] 已取消所有生成任务')
  }
}

// 创建单例实例
export const serverThumbnailService = new ServerThumbnailService()
export default serverThumbnailService