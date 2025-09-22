/**
 * 动态缩略图生成和上传的 Hook
 * 当用户访问没有静态缩略图的视频时，自动生成并上传到R2存储
 */

import { useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface ThumbnailUploadOptions {
  videoId: string
  videoUrl: string
  frameTime?: number
  onSuccess?: (thumbnailUrl: string) => void
  onError?: (error: Error) => void
}

export function useThumbnailUpload() {
  const processingRef = useRef<Set<string>>(new Set())
  const successCacheRef = useRef<Map<string, string>>(new Map())

  /**
   * 提取视频缩略图（在0.1秒时间点）
   */
  const extractThumbnail = useCallback(async (videoUrl: string, frameTime = 0.1): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) {
        reject(new Error('无法获取Canvas上下文'))
        return
      }
      
      // CORS设置
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true
      
      // 监听视频加载元数据
      video.addEventListener('loadedmetadata', () => {
        // 设置画布尺寸（16:9比例，320x180）
        canvas.width = 320
        canvas.height = 180
        
        // 跳转到指定时间点
        video.currentTime = Math.min(frameTime, video.duration)
      })
      
      // 监听跳转完成
      video.addEventListener('seeked', async () => {
        try {
          // 计算视频在画布中的位置（保持宽高比）
          const videoAspect = video.videoWidth / video.videoHeight
          const canvasAspect = canvas.width / canvas.height
          
          let drawWidth, drawHeight, drawX, drawY
          
          if (videoAspect > canvasAspect) {
            // 视频更宽，以高度为准
            drawHeight = canvas.height
            drawWidth = drawHeight * videoAspect
            drawX = (canvas.width - drawWidth) / 2
            drawY = 0
          } else {
            // 视频更高，以宽度为准
            drawWidth = canvas.width
            drawHeight = drawWidth / videoAspect
            drawX = 0
            drawY = (canvas.height - drawHeight) / 2
          }
          
          // 填充背景色
          context.fillStyle = '#000000'
          context.fillRect(0, 0, canvas.width, canvas.height)
          
          // 绘制视频帧
          context.drawImage(video, drawX, drawY, drawWidth, drawHeight)
          
          // 转换为WebP格式（如果支持）或JPEG
          let dataUrl
          try {
            dataUrl = canvas.toDataURL('image/webp', 0.75)
            // 检查是否真的生成了WebP
            if (!dataUrl.startsWith('data:image/webp')) {
              throw new Error('WebP not supported')
            }
          } catch (webpError) {
            // 回退到JPEG
            dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          }
          
          // 清理资源
          video.remove()
          canvas.remove()
          
          resolve(dataUrl)
          
        } catch (error) {
          video.remove()
          canvas.remove()
          reject(error)
        }
      })
      
      // 错误处理
      video.addEventListener('error', (e) => {
        video.remove()
        canvas.remove()
        reject(new Error(`视频加载失败: ${e.type}`))
      })
      
      // 设置视频源并开始加载
      video.src = videoUrl
      video.load()
    })
  }, [])

  /**
   * 上传缩略图到R2存储
   */
  const uploadToR2 = useCallback(async (thumbnailDataUrl: string, videoId: string): Promise<string> => {
    try {
      // 将Base64转换为Blob
      const response = await fetch(thumbnailDataUrl)
      const blob = await response.blob()
      
      // 将Blob转换为Base64
      const reader = new FileReader()
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // 移除data:image/webp;base64,前缀
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      
      // 通过统一的supabase客户端调用Edge Function
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-thumbnail', {
        body: {
          videoId,
          base64Data,
          contentType: blob.type,
          fileSize: blob.size,
          directUpload: true // 标记为直接上传模式
        }
      })
      
      if (uploadError) {
        throw new Error(`上传失败: ${uploadError.message}`)
      }
      
      return uploadData.data.publicUrl
      
    } catch (error: any) {
      throw new Error(`R2上传失败: ${error.message}`)
    }
  }, [])

  /**
   * 更新数据库中的缩略图URL
   */
  const updateDatabase = useCallback(async (videoId: string, thumbnailUrl: string): Promise<void> => {
    const { error } = await supabase
      .from('videos')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', videoId)

    if (error) {
      throw new Error(`数据库更新失败: ${error.message}`)
    }
  }, [supabase])

  /**
   * 主要的缩略图生成和上传函数
   */
  const generateAndUploadThumbnail = useCallback(async (options: ThumbnailUploadOptions): Promise<string | null> => {
    const { videoId, videoUrl, frameTime = 0.1, onSuccess, onError } = options

    // 避免重复处理同一个视频
    if (processingRef.current.has(videoId)) {
      console.log(`[ThumbnailUpload] 视频 ${videoId} 已在处理中，跳过`)
      return null
    }

    // 检查是否已经成功生成过
    const cachedUrl = successCacheRef.current.get(videoId)
    if (cachedUrl) {
      console.log(`[ThumbnailUpload] 视频 ${videoId} 已有缓存缩略图: ${cachedUrl}`)
      onSuccess?.(cachedUrl)
      return cachedUrl
    }

    try {
      processingRef.current.add(videoId)
      console.log(`[ThumbnailUpload] 开始为视频 ${videoId} 生成缩略图`)

      // Step 1: 提取缩略图
      const thumbnailDataUrl = await extractThumbnail(videoUrl, frameTime)
      console.log(`[ThumbnailUpload] 缩略图提取成功: ${videoId}`)

      // Step 2: 上传到R2
      const r2Url = await uploadToR2(thumbnailDataUrl, videoId)
      console.log(`[ThumbnailUpload] R2上传成功: ${videoId} -> ${r2Url}`)

      // Step 3: 更新数据库
      await updateDatabase(videoId, r2Url)
      console.log(`[ThumbnailUpload] 数据库更新成功: ${videoId}`)

      // 缓存成功结果
      successCacheRef.current.set(videoId, r2Url)

      // 触发成功回调
      onSuccess?.(r2Url)

      return r2Url

    } catch (error) {
      console.error(`[ThumbnailUpload] 生成缩略图失败: ${videoId}`, error)
      onError?.(error as Error)
      return null
    } finally {
      processingRef.current.delete(videoId)
    }
  }, [extractThumbnail, uploadToR2, updateDatabase])

  /**
   * 检查是否正在处理
   */
  const isProcessing = useCallback((videoId: string): boolean => {
    return processingRef.current.has(videoId)
  }, [])

  /**
   * 获取缓存的缩略图URL
   */
  const getCachedThumbnail = useCallback((videoId: string): string | null => {
    return successCacheRef.current.get(videoId) || null
  }, [])

  /**
   * 清理缓存
   */
  const clearCache = useCallback(() => {
    successCacheRef.current.clear()
  }, [])

  return {
    generateAndUploadThumbnail,
    isProcessing,
    getCachedThumbnail,
    clearCache
  }
}