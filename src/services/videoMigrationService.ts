/**
 * 视频迁移服务
 * 负责将视频从第三方存储迁移到Cloudflare R2
 */

import { createClient } from '@supabase/supabase-js'
import cloudflareR2Service from './cloudflareR2Service'

interface VideoRecord {
  id: string
  video_url: string | null
  r2_url: string | null
  r2_key: string | null
  migration_status: string
  original_video_url: string | null
  title?: string
}

interface MigrationResult {
  success: boolean
  videoId: string
  r2Url?: string
  r2Key?: string
  error?: string
  skipped?: boolean
  reason?: string
}

interface MigrationStats {
  total: number
  success: number
  failed: number
  skipped: number
  errors: string[]
}

class VideoMigrationService {
  private supabase

  constructor() {
    this.supabase = createClient(
      this.getEnv('VITE_SUPABASE_URL') || '',
      this.getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || this.getEnv('VITE_SUPABASE_ANON_KEY') || ''
    )
  }

  /**
   * 获取环境变量的辅助方法
   * 支持两种环境变量访问方式：浏览器环境使用 import.meta.env，Node.js环境使用 process.env
   */
  private getEnv(key: string): string | undefined {
    if (typeof window === 'undefined') {
      // Node.js环境 (如服务端执行的代码)
      return process.env[key]
    } else {
      // 浏览器环境
      return import.meta.env[key]
    }
  }

  /**
   * 使用预签名URL迁移视频到R2
   */
  async migrateVideoWithPresignedUrl(videoId: string): Promise<MigrationResult> {
    try {
      console.log(`[VideoMigration] 开始预签名URL迁移: ${videoId}`)

      // 1. 获取视频信息
      const { data: video, error: fetchError } = await this.supabase
        .from('videos')
        .select('id, video_url, r2_url, r2_key, migration_status, original_video_url, title')
        .eq('id', videoId)
        .single()

      if (fetchError || !video) {
        return {
          success: false,
          videoId,
          error: `视频不存在: ${fetchError?.message}`
        }
      }

      // 2. 检查是否需要迁移
      if (video.migration_status === 'completed' && video.r2_url) {
        return {
          success: true,
          videoId,
          r2Url: video.r2_url,
          skipped: true,
          reason: '已完成迁移'
        }
      }

      if (!video.video_url) {
        return {
          success: false,
          videoId,
          error: '视频URL为空',
          skipped: true
        }
      }

      // 3. 更新状态为下载中
      await this.updateMigrationStatus(videoId, 'downloading')

      // 4. 生成预签名URL
      console.log(`[VideoMigration] 生成预签名URL: ${videoId}`)
      const { data: urlData, error: urlError } = await this.supabase.functions.invoke('generate-upload-url', {
        body: {
          videoId,
          contentType: 'video/mp4',
          expiresIn: 3600
        }
      })

      if (urlError || !urlData.success) {
        await this.updateMigrationStatus(videoId, 'failed')
        return {
          success: false,
          videoId,
          error: `预签名URL生成失败: ${urlError?.message || urlData.error}`
        }
      }

      const { signedUrl, publicUrl, key } = urlData.data

      // 5. 下载原始视频
      console.log(`[VideoMigration] 下载原始视频: ${videoId}`)
      const response = await fetch(video.video_url)
      if (!response.ok) {
        await this.updateMigrationStatus(videoId, 'failed')
        return {
          success: false,
          videoId,
          error: `下载失败: ${response.status} ${response.statusText}`
        }
      }

      const videoBuffer = await response.arrayBuffer()
      console.log(`[VideoMigration] 下载完成: ${videoBuffer.byteLength} bytes`)

      // 6. 更新状态为上传中
      await this.updateMigrationStatus(videoId, 'uploading')

      // 7. 使用预签名URL上传到R2
      console.log(`[VideoMigration] 上传到R2: ${videoId}`)
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: videoBuffer,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': videoBuffer.byteLength.toString()
        }
      })

      if (!uploadResponse.ok) {
        await this.updateMigrationStatus(videoId, 'failed')
        const errorText = await uploadResponse.text()
        return {
          success: false,
          videoId,
          error: `R2上传失败: ${uploadResponse.status} - ${errorText}`
        }
      }

      // 8. 更新数据库记录
      const { error: updateError } = await this.supabase
        .from('videos')
        .update({
          r2_url: publicUrl,
          r2_key: key,
          migration_status: 'completed',
          r2_uploaded_at: new Date().toISOString(),
          original_video_url: video.original_video_url || video.video_url
        })
        .eq('id', videoId)

      if (updateError) {
        console.error(`[VideoMigration] 数据库更新失败: ${videoId}`, updateError)
        return {
          success: false,
          videoId,
          error: `数据库更新失败: ${updateError.message}`
        }
      }

      console.log(`[VideoMigration] 预签名URL迁移成功: ${videoId} -> ${publicUrl}`)

      return {
        success: true,
        videoId,
        r2Url: publicUrl,
        r2Key: key
      }

    } catch (error) {
      console.error(`[VideoMigration] 预签名URL迁移异常: ${videoId}`, error)
      
      await this.updateMigrationStatus(videoId, 'failed').catch(() => {})
      
      return {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 迁移单个视频到R2（原始方法，使用直接上传）
   */
  async migrateVideo(videoId: string): Promise<MigrationResult> {
    try {
      console.log(`[VideoMigration] 开始迁移视频: ${videoId}`)

      // 1. 获取视频信息
      const { data: video, error: fetchError } = await this.supabase
        .from('videos')
        .select('id, video_url, r2_url, r2_key, migration_status, original_video_url, title')
        .eq('id', videoId)
        .single()

      if (fetchError || !video) {
        return {
          success: false,
          videoId,
          error: `视频不存在: ${fetchError?.message}`
        }
      }

      // 2. 检查是否需要迁移
      if (video.migration_status === 'completed' && video.r2_url) {
        return {
          success: true,
          videoId,
          r2Url: video.r2_url,
          skipped: true,
          reason: '已完成迁移'
        }
      }

      if (!video.video_url) {
        return {
          success: false,
          videoId,
          error: '视频URL为空',
          skipped: true
        }
      }

      // 3. 更新状态为下载中
      await this.updateMigrationStatus(videoId, 'downloading')

      // 4. 使用R2服务上传视频
      const uploadResult = await cloudflareR2Service.uploadVideoFromURL(
        video.video_url,
        videoId
      )

      if (!uploadResult.success) {
        await this.updateMigrationStatus(videoId, 'failed')
        return {
          success: false,
          videoId,
          error: uploadResult.error
        }
      }

      // 5. 更新数据库记录
      const { error: updateError } = await this.supabase
        .from('videos')
        .update({
          r2_url: uploadResult.url,
          r2_key: uploadResult.key,
          migration_status: 'completed',
          r2_uploaded_at: new Date().toISOString(),
          // 备份原始URL（如果还没有）
          original_video_url: video.original_video_url || video.video_url
        })
        .eq('id', videoId)

      if (updateError) {
        console.error(`[VideoMigration] 数据库更新失败: ${videoId}`, updateError)
        return {
          success: false,
          videoId,
          error: `数据库更新失败: ${updateError.message}`
        }
      }

      console.log(`[VideoMigration] 视频迁移成功: ${videoId} -> ${uploadResult.url}`)
      
      return {
        success: true,
        videoId,
        r2Url: uploadResult.url,
        r2Key: uploadResult.key
      }

    } catch (error) {
      console.error(`[VideoMigration] 迁移异常: ${videoId}`, error)
      
      // 更新状态为失败
      await this.updateMigrationStatus(videoId, 'failed').catch(() => {})
      
      return {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 批量迁移视频
   */
  async migrateBatch(limit: number = 10): Promise<MigrationStats> {
    console.log(`[VideoMigration] 开始批量迁移，限制: ${limit}`)

    const stats: MigrationStats = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    try {
      // 获取需要迁移的视频列表
      const { data: videos, error } = await this.supabase
        .from('videos')
        .select('id, video_url, r2_url, migration_status')
        .in('migration_status', ['pending', 'failed'])
        .not('video_url', 'is', null)
        .neq('video_url', '')
        .limit(limit)

      if (error) {
        stats.errors.push(`查询失败: ${error.message}`)
        return stats
      }

      if (!videos || videos.length === 0) {
        console.log('[VideoMigration] 没有需要迁移的视频')
        return stats
      }

      stats.total = videos.length
      console.log(`[VideoMigration] 找到 ${videos.length} 个视频需要迁移`)

      // 并发迁移（控制并发数避免压力过大）
      const concurrency = 3
      const results: MigrationResult[] = []

      for (let i = 0; i < videos.length; i += concurrency) {
        const batch = videos.slice(i, i + concurrency)
        const batchPromises = batch.map(video => this.migrateVideo(video.id))
        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value)
          } else {
            results.push({
              success: false,
              videoId: 'unknown',
              error: result.reason?.message || '迁移异常'
            })
          }
        })

        // 批次间稍作休息
        if (i + concurrency < videos.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // 统计结果
      results.forEach(result => {
        if (result.success) {
          if (result.skipped) {
            stats.skipped++
          } else {
            stats.success++
          }
        } else {
          stats.failed++
          if (result.error) {
            stats.errors.push(`${result.videoId}: ${result.error}`)
          }
        }
      })

      console.log(`[VideoMigration] 批量迁移完成:`, stats)
      return stats

    } catch (error) {
      console.error('[VideoMigration] 批量迁移异常:', error)
      stats.errors.push(error instanceof Error ? error.message : '未知错误')
      return stats
    }
  }

  /**
   * 使用服务端Edge Function迁移视频（推荐方法）
   */
  async migrateVideoServerSide(videoId: string, forceRemigrate: boolean = false): Promise<MigrationResult> {
    try {
      console.log(`[VideoMigration] 开始服务端迁移: ${videoId}`)

      const supabaseUrl = this.getEnv('VITE_SUPABASE_URL')
      const anonKey = this.getEnv('VITE_SUPABASE_ANON_KEY')

      if (!supabaseUrl || !anonKey) {
        return {
          success: false,
          videoId,
          error: 'Supabase配置缺失'
        }
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/migrate-video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          forceRemigrate
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        
        return {
          success: false,
          videoId,
          error: `服务端迁移失败: ${response.status} - ${errorData.error || 'Unknown error'}`
        }
      }

      const result = await response.json()
      
      if (result.success) {
        console.log(`[VideoMigration] 服务端迁移成功: ${videoId} -> ${result.r2Url}`)
      } else {
        console.error(`[VideoMigration] 服务端迁移失败: ${videoId} - ${result.error}`)
      }

      return result

    } catch (error) {
      console.error(`[VideoMigration] 服务端迁移异常: ${videoId}`, error)
      return {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 迁移新完成的视频（集成到视频完成流程）
   * 现在使用服务端迁移方法
   */
  async migrateNewVideo(videoId: string): Promise<boolean> {
    console.log(`[VideoMigration] 自动迁移新视频: ${videoId}`)
    
    // 优先使用服务端迁移
    const result = await this.migrateVideoServerSide(videoId)
    
    if (result.success && !result.skipped) {
      console.log(`[VideoMigration] 新视频自动迁移成功: ${videoId}`)
      return true
    } else if (result.skipped) {
      console.log(`[VideoMigration] 新视频跳过迁移: ${videoId} - ${result.reason}`)
      return true
    } else {
      console.error(`[VideoMigration] 新视频迁移失败: ${videoId} - ${result.error}`)
      // 如果服务端迁移失败，可以fallback到客户端迁移
      console.log(`[VideoMigration] 尝试fallback到客户端迁移...`)
      const fallbackResult = await this.migrateVideoWithPresignedUrl(videoId)
      return fallbackResult.success
    }
  }

  /**
   * 更新视频迁移状态
   */
  private async updateMigrationStatus(videoId: string, status: string): Promise<void> {
    try {
      await this.supabase
        .from('videos')
        .update({ migration_status: status })
        .eq('id', videoId)
    } catch (error) {
      console.error(`[VideoMigration] 状态更新失败: ${videoId}`, error)
    }
  }

  /**
   * 获取迁移统计信息
   */
  async getMigrationStats(): Promise<{
    total: number
    pending: number
    completed: number
    failed: number
    downloading: number
    uploading: number
  }> {
    try {
      const { data, error } = await this.supabase
        .from('videos')
        .select('migration_status')
        .not('video_url', 'is', null)

      if (error || !data) {
        return { total: 0, pending: 0, completed: 0, failed: 0, downloading: 0, uploading: 0 }
      }

      const stats = data.reduce((acc, video) => {
        acc.total++
        const status = video.migration_status || 'pending'
        acc[status as keyof typeof acc] = (acc[status as keyof typeof acc] || 0) + 1
        return acc
      }, { total: 0, pending: 0, completed: 0, failed: 0, downloading: 0, uploading: 0 })

      return stats
    } catch (error) {
      console.error('[VideoMigration] 统计查询失败:', error)
      return { total: 0, pending: 0, completed: 0, failed: 0, downloading: 0, uploading: 0 }
    }
  }
}

// 导出单例实例
export const videoMigrationService = new VideoMigrationService()
export default videoMigrationService