/**
 * Supabase Video Admin Service
 * 通过 Edge Functions 进行系统级视频数据更新
 * 绕过 RLS 策略，用于后台操作
 */

import type { Database } from '@/lib/supabase'

type Video = Database['public']['Tables']['videos']['Row']
type VideoUpdate = {
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  video_url?: string
  thumbnail_url?: string
  duration?: number
  resolution?: string
  file_size?: number
  error_message?: string
  metadata?: Record<string, any>
  processing_started_at?: string
  processing_completed_at?: string
}

class SupabaseVideoAdminService {
  private readonly baseUrl: string

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is required')
    }
    this.baseUrl = `${supabaseUrl}/functions/v1`
  }

  /**
   * 系统级更新视频状态（通过 Edge Function）
   */
  async updateVideoAsSystem(videoId: string, updates: VideoUpdate): Promise<Video | null> {
    try {
      console.log('[ADMIN SERVICE] Updating video via Edge Function:', { videoId, updates })

      const response = await fetch(`${this.baseUrl}/update-video-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          updates
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[ADMIN SERVICE] HTTP error:', response.status, errorData)
        throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        console.error('[ADMIN SERVICE] Function error:', result.error)
        throw new Error(result.error || 'Edge function failed')
      }

      console.log('[ADMIN SERVICE] Video updated successfully:', {
        videoId,
        status: result.data?.status,
        hasVideoUrl: !!result.data?.video_url
      })

      return result.data
    } catch (error) {
      console.error('[ADMIN SERVICE] Failed to update video:', error)
      
      // 返回详细错误信息以便调试
      if (error instanceof Error) {
        throw new Error(`Admin update failed: ${error.message}`)
      }
      throw new Error('Admin update failed: Unknown error')
    }
  }

  /**
   * 批量更新视频状态
   */
  async batchUpdateVideos(updates: Array<{ videoId: string; updates: VideoUpdate }>): Promise<{
    successful: number
    failed: number
    errors: Array<{ videoId: string; error: string }>
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ videoId: string; error: string }>
    }

    // 并行处理所有更新
    const promises = updates.map(async ({ videoId, updates: videoUpdates }) => {
      try {
        await this.updateVideoAsSystem(videoId, videoUpdates)
        results.successful++
      } catch (error) {
        results.failed++
        results.errors.push({
          videoId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    await Promise.all(promises)
    return results
  }

  /**
   * 检查 Edge Function 是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/update-video-status`, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        }
      })
      return response.ok
    } catch (error) {
      console.error('[ADMIN SERVICE] Health check failed:', error)
      return false
    }
  }
}

// 导出单例实例
export const supabaseVideoAdminService = new SupabaseVideoAdminService()
export default supabaseVideoAdminService