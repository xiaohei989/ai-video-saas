/**
 * 缩略图修复服务
 * 提供修复损坏缩略图的功能
 */

import { supabase } from '@/lib/supabase'
import { extractAndUploadThumbnail } from '@/utils/videoThumbnail'

export interface ThumbnailRepairResult {
  success: boolean
  message: string
  newUrl?: string
  fileSize?: number
  error?: string
}

/**
 * 修复指定视频的缩略图
 * @param videoId 视频ID
 * @param options 修复选项
 * @returns 修复结果
 */
export async function repairThumbnail(
  videoId: string,
  options: {
    frameTime?: number
    forceRegenerate?: boolean
  } = {}
): Promise<ThumbnailRepairResult> {
  try {
    console.log(`[ThumbnailRepair] 开始修复视频 ${videoId} 的缩略图`)

    const { frameTime = 1.5, forceRegenerate = true } = options

    // Step 1: 获取视频信息
    console.log('[ThumbnailRepair] 步骤1：获取视频信息')
    const { data: video, error: queryError } = await supabase
      .from('videos')
      .select('id, title, video_url, status')
      .eq('id', videoId)
      .single()

    if (queryError || !video) {
      console.warn('[ThumbnailRepair] 无法获取视频信息，使用占位图方案')
      return await uploadPlaceholderThumbnail(videoId)
    }

    if (!video.video_url) {
      console.warn('[ThumbnailRepair] 视频URL不存在，使用占位图方案')
      return await uploadPlaceholderThumbnail(videoId)
    }

    // Step 2: 尝试生成真正的视频缩略图
    console.log('[ThumbnailRepair] 步骤2：使用现有功能生成真正的视频缩略图')
    try {
      const thumbnailUrl = await extractAndUploadThumbnail(video.video_url, videoId, {
        frameTime: frameTime,
        quality: 0.9,
        format: 'webp'
      })

      console.log('[ThumbnailRepair] 真实缩略图生成成功:', thumbnailUrl)

      // Step 2.5: 更新数据库中的缩略图URL
      console.log('[ThumbnailRepair] 步骤2.5：更新数据库中的缩略图URL')
      try {
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            thumbnail_url: thumbnailUrl,
            thumbnail_generated_at: new Date().toISOString()
          })
          .eq('id', videoId)

        if (updateError) {
          console.warn('[ThumbnailRepair] 更新数据库失败，但缩略图已生成:', updateError)
        } else {
          console.log('[ThumbnailRepair] 数据库更新成功')
        }
      } catch (dbError) {
        console.warn('[ThumbnailRepair] 数据库更新异常，但缩略图已生成:', dbError)
      }

      return {
        success: true,
        message: '已生成真实视频缩略图',
        newUrl: thumbnailUrl,
        fileSize: undefined // extractAndUploadThumbnail 不返回文件大小
      }
    } catch (error) {
      console.warn('[ThumbnailRepair] 真实缩略图生成失败，回退到占位图:', error)
    }

    // Step 3: 备用方案 - 使用占位图
    console.log('[ThumbnailRepair] 步骤3：使用占位图备用方案')
    return await uploadPlaceholderThumbnail(videoId)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    console.error('[ThumbnailRepair] 修复过程失败:', error)

    return {
      success: false,
      message: '缩略图修复失败',
      error: errorMessage
    }
  }
}

/**
 * 上传高质量占位缩略图（备用方案）
 * @param videoId 视频ID
 * @returns 修复结果
 */
async function uploadPlaceholderThumbnail(videoId: string): Promise<ThumbnailRepairResult> {
  try {
    console.log('[ThumbnailRepair] 使用备用方案：上传高质量占位缩略图')

    // 生成一个高质量的占位缩略图
    const placeholderBase64 = generateHighQualityPlaceholder()

    const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-thumbnail', {
      body: {
        videoId,
        base64Data: placeholderBase64,
        contentType: 'image/webp',
        fileSize: Math.floor(placeholderBase64.length * 0.75),
        directUpload: true
      }
    })

    if (uploadError || !uploadData?.success) {
      throw new Error(uploadError?.message || uploadData?.error || '上传失败')
    }

    console.log('[ThumbnailRepair] 备用缩略图上传成功:', uploadData.data.publicUrl)

    return {
      success: true,
      message: '已上传高质量占位缩略图',
      newUrl: uploadData.data.publicUrl,
      fileSize: uploadData.data.size
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    console.error('[ThumbnailRepair] 备用方案也失败:', error)

    return {
      success: false,
      message: '备用方案失败',
      error: errorMessage
    }
  }
}

/**
 * 生成高质量占位缩略图的Base64数据
 * @returns Base64编码的WebP图片数据
 */
function generateHighQualityPlaceholder(): string {
  // 生成一个简单的占位图（SVG格式，小巧但有效）
  const svg = `
    <svg width="800" height="450" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#bg)"/>
      <circle cx="400" cy="225" r="60" fill="rgba(255,255,255,0.9)"/>
      <polygon points="370,195 370,255 430,225" fill="#667eea"/>
      <text x="400" y="320" font-family="Arial, sans-serif" font-size="28" fill="white" text-anchor="middle">视频缩略图</text>
    </svg>
  `

  const base64Data = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
  console.log('[ThumbnailRepair] 生成的占位图大小:', (base64Data.length / 1024).toFixed(2), 'KB')
  return base64Data
}

export default {
  repairThumbnail
}