/**
 * WebP 缩略图优化器
 * 支持 WebP 格式生成，显著减少文件大小
 */

// 🌟 导入统一的超高质量缩略图配置，确保回退方案也使用专业级参数
const OPTIMAL_THUMBNAIL_CONFIG = {
  width: 960,           // 🚀 升级分辨率：640 -> 960
  height: 540,          // 🚀 升级分辨率：360 -> 540  
  quality: 0.95,        // 🌟 提高质量：0.90 -> 0.95 (专业级质量)
  format: 'auto' as const
}

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
 * 检测Canvas是否被污染（跨域图像导致的安全限制）
 */
function isCanvasTainted(canvas: HTMLCanvasElement): boolean {
  try {
    // 🔧 修复：明确指定JPEG格式，避免默认PNG输出
    // 这个函数只是检测Canvas污染状态，不需要实际使用数据，指定格式可以避免PNG生成
    canvas.toDataURL('image/jpeg', 0.8)
    return false
  } catch (error) {
    if (error instanceof Error && error.name === 'SecurityError') {
      console.warn('[WebPOptimizer] Canvas被污染，无法导出:', error.message)
      return true
    }
    // 其他错误重新抛出
    throw error
  }
}

/**
 * 生成安全的回退缩略图
 */
function generateFallbackThumbnail(
  targetWidth: number,
  targetHeight: number,
  format: 'webp' | 'jpeg',
  quality: number
): string {
  console.log('[WebPOptimizer] 🔄 生成回退缩略图')
  
  const fallbackCanvas = document.createElement('canvas')
  const fallbackContext = fallbackCanvas.getContext('2d')!
  
  fallbackCanvas.width = targetWidth
  fallbackCanvas.height = targetHeight
  
  // 创建渐变背景
  const gradient = fallbackContext.createLinearGradient(0, 0, targetWidth, targetHeight)
  gradient.addColorStop(0, '#667eea')
  gradient.addColorStop(1, '#764ba2')
  
  fallbackContext.fillStyle = gradient
  fallbackContext.fillRect(0, 0, targetWidth, targetHeight)
  
  // 添加播放图标
  const centerX = targetWidth / 2
  const centerY = targetHeight / 2
  const radius = Math.min(targetWidth, targetHeight) / 6
  
  // 绘制半透明白色圆形背景
  fallbackContext.fillStyle = 'rgba(255,255,255,0.9)'
  fallbackContext.beginPath()
  fallbackContext.arc(centerX, centerY, radius, 0, Math.PI * 2)
  fallbackContext.fill()
  
  // 绘制播放按钮三角形
  fallbackContext.fillStyle = '#667eea'
  fallbackContext.beginPath()
  const triangleSize = radius * 0.6
  fallbackContext.moveTo(centerX - triangleSize * 0.3, centerY - triangleSize * 0.5)
  fallbackContext.lineTo(centerX - triangleSize * 0.3, centerY + triangleSize * 0.5)
  fallbackContext.lineTo(centerX + triangleSize * 0.7, centerY)
  fallbackContext.fill()
  
  // 添加"Video"文字
  fallbackContext.fillStyle = 'rgba(255,255,255,0.9)'
  fallbackContext.font = `${Math.max(12, targetHeight / 15)}px Arial, sans-serif`
  fallbackContext.textAlign = 'center'
  fallbackContext.fillText('Video', centerX, centerY + radius + 20)
  
  // 🔧 修复：使用WebP格式作为首选，避免PNG生成
  const outputFormat = format === 'webp' ? 'image/webp' : `image/${format}`
  return fallbackCanvas.toDataURL(outputFormat, quality)
}

/**
 * 优化的缩略图生成 - 支持 WebP 和 Canvas污染检测
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
  // 🚀 使用统一的高质量配置作为默认值
  const {
    quality = OPTIMAL_THUMBNAIL_CONFIG.quality,
    format = OPTIMAL_THUMBNAIL_CONFIG.format,
    maxWidth = OPTIMAL_THUMBNAIL_CONFIG.width,
    maxHeight = OPTIMAL_THUMBNAIL_CONFIG.height
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

  // 🔧 绘制视频帧前先记录视频CORS状态
  const videoCrossOrigin = video.crossOrigin
  console.log(`[WebPOptimizer] 视频CORS设置: ${videoCrossOrigin || 'null'}, 视频源: ${video.src.substring(0, 50)}...`)

  try {
    // 绘制视频帧
    context.drawImage(video, 0, 0, targetWidth, targetHeight)
    
    // 🚨 关键检查：在尝试导出前检测Canvas是否被污染
    if (isCanvasTainted(canvas)) {
      console.error('[WebPOptimizer] ❌ Canvas被污染，无法导出。使用回退方案')
      // 决定输出格式
      let outputFormat = format
      if (format === 'auto') {
        const webpSupported = await supportsWebP()
        outputFormat = webpSupported ? 'webp' : 'jpeg'
      }
      return generateFallbackThumbnail(targetWidth, targetHeight, outputFormat, quality)
    }

    // Canvas未被污染，正常处理
    console.log(`[WebPOptimizer] ✅ Canvas状态正常，开始生成缩略图`)

  } catch (error) {
    console.error('[WebPOptimizer] ❌ 绘制视频帧失败:', error)
    // 决定输出格式
    let outputFormat = format
    if (format === 'auto') {
      const webpSupported = await supportsWebP()
      outputFormat = webpSupported ? 'webp' : 'jpeg'
    }
    return generateFallbackThumbnail(targetWidth, targetHeight, outputFormat, quality)
  }

  // 决定输出格式
  let outputFormat = format
  if (format === 'auto') {
    const webpSupported = await supportsWebP()
    outputFormat = webpSupported ? 'webp' : 'jpeg'
  }

  // 生成缩略图（带完整错误处理）
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
          reader.onerror = (readerError) => {
            console.error('[WebPOptimizer] ❌ FileReader读取失败:', readerError)
            // FileReader失败也使用回退方案
            const fallback = generateFallbackThumbnail(targetWidth, targetHeight, outputFormat, quality)
            resolve(fallback)
          }
          reader.readAsDataURL(blob)
        } else {
          // WebP Blob生成失败，回退到 JPEG
          console.warn('[WebPOptimizer] ⚠️ WebP Blob生成失败，尝试JPEG回退')
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', quality)
            const endTime = performance.now()
            const generationTime = Math.round(endTime - startTime)
            const estimatedSize = Math.round((dataUrl.length * 0.75) / 1024) // KB
            console.log(`[WebPOptimizer] ⚠️ WebP失败，JPEG回退成功: ${targetWidth}x${targetHeight}, ${estimatedSize}KB, 耗时${generationTime}ms`)
            resolve(dataUrl)
          } catch (jpegError) {
            console.error('[WebPOptimizer] ❌ JPEG回退也失败:', jpegError)
            // 最后的回退方案
            const fallback = generateFallbackThumbnail(targetWidth, targetHeight, 'jpeg', quality)
            resolve(fallback)
          }
        }
      }, 'image/webp', quality)
    } else {
      // 使用 JPEG
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const endTime = performance.now()
        const generationTime = Math.round(endTime - startTime)
        const estimatedSize = Math.round((dataUrl.length * 0.75) / 1024) // KB
        console.log(`[WebPOptimizer] 📄 JPEG缩略图生成: ${targetWidth}x${targetHeight}, ${estimatedSize}KB, 耗时${generationTime}ms`)
        resolve(dataUrl)
      } catch (jpegError) {
        console.error('[WebPOptimizer] ❌ JPEG生成失败:', jpegError)
        // JPEG失败也使用回退方案
        const fallback = generateFallbackThumbnail(targetWidth, targetHeight, 'jpeg', quality)
        resolve(fallback)
      }
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