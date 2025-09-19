/**
 * WebP 缩略图优化器
 * 支持 WebP 格式生成，显著减少文件大小
 */

/**
 * 检测浏览器是否支持 WebP
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    
    canvas.toBlob((blob) => {
      resolve(blob !== null)
    }, 'image/webp')
  })
}

/**
 * 优化的缩略图生成 - 支持 WebP
 */
export async function generateOptimizedThumbnail(
  video: HTMLVideoElement,
  options: {
    quality?: number
    format?: 'webp' | 'jpeg' | 'auto'
    maxWidth?: number
    maxHeight?: number
  } = {}
): Promise<string> {
  const {
    quality = 0.8,
    format = 'auto',
    maxWidth = 320,
    maxHeight = 180
  } = options

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  
  if (!context) {
    throw new Error('Failed to get canvas context')
  }

  // 计算缩略图尺寸（保持宽高比）
  const videoAspectRatio = video.videoWidth / video.videoHeight
  const targetAspectRatio = maxWidth / maxHeight

  let targetWidth, targetHeight

  if (videoAspectRatio > targetAspectRatio) {
    // 视频更宽，以宽度为准
    targetWidth = maxWidth
    targetHeight = Math.round(maxWidth / videoAspectRatio)
  } else {
    // 视频更高，以高度为准
    targetHeight = maxHeight
    targetWidth = Math.round(maxHeight * videoAspectRatio)
  }

  canvas.width = targetWidth
  canvas.height = targetHeight

  // 绘制视频帧
  context.drawImage(video, 0, 0, targetWidth, targetHeight)

  // 决定输出格式
  let outputFormat = format
  if (format === 'auto') {
    const webpSupported = await supportsWebP()
    outputFormat = webpSupported ? 'webp' : 'jpeg'
  }

  // 生成缩略图
  return new Promise((resolve, reject) => {
    const startTime = performance.now()
    
    if (outputFormat === 'webp') {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            const endTime = performance.now()
            const generationTime = Math.round(endTime - startTime)
            const estimatedSize = Math.round((result.length * 0.75) / 1024) // KB
            console.log(`[WebPOptimizer] ✅ WebP缩略图生成成功: ${targetWidth}x${targetHeight}, ${estimatedSize}KB, 耗时${generationTime}ms`)
            resolve(result)
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        } else {
          // WebP 失败，回退到 JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          const endTime = performance.now()
          const generationTime = Math.round(endTime - startTime)
          const estimatedSize = Math.round((dataUrl.length * 0.75) / 1024) // KB
          console.log(`[WebPOptimizer] ⚠️ WebP失败，回退到JPEG: ${targetWidth}x${targetHeight}, ${estimatedSize}KB, 耗时${generationTime}ms`)
          resolve(dataUrl)
        }
      }, 'image/webp', quality)
    } else {
      // 使用 JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const endTime = performance.now()
      const generationTime = Math.round(endTime - startTime)
      const estimatedSize = Math.round((dataUrl.length * 0.75) / 1024) // KB
      console.log(`[WebPOptimizer] 📄 JPEG缩略图生成: ${targetWidth}x${targetHeight}, ${estimatedSize}KB, 耗时${generationTime}ms`)
      resolve(dataUrl)
    }
  })
}

/**
 * 获取缩略图格式信息
 */
export function getThumbnailFormatInfo(dataUrl: string) {
  const format = dataUrl.startsWith('data:image/webp') ? 'webp' : 
                 dataUrl.startsWith('data:image/jpeg') ? 'jpeg' : 'png'
  
  // 估算文件大小（base64 编码大小约为原始大小的 1.33 倍）
  const base64Data = dataUrl.split(',')[1]
  const estimatedSize = Math.round((base64Data.length * 0.75) / 1024) // KB

  return {
    format,
    estimatedSize,
    dataUrl: dataUrl.substring(0, 50) + '...'
  }
}

/**
 * 批量格式检测和统计
 */
export function analyzeThumbnailFormats(thumbnails: string[]) {
  const stats = {
    webp: 0,
    jpeg: 0,
    png: 0,
    totalSize: 0,
    avgSize: 0
  }

  thumbnails.forEach(thumb => {
    const info = getThumbnailFormatInfo(thumb)
    stats[info.format as keyof typeof stats]++
    stats.totalSize += info.estimatedSize
  })

  stats.avgSize = Math.round(stats.totalSize / thumbnails.length)

  return stats
}