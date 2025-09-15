/**
 * 缩略图生成策略工具
 * 决定何时使用服务端 vs 客户端生成
 */

import { VideoRecord } from '@/services/videoHistoryService'
import { needsCorsProxy } from '@/utils/videoUrlProxy'

/**
 * 检测是否为移动端设备（需要Media Fragments支持）
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  
  // 移动端设备模式匹配
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /IEMobile/i,
    /Opera Mini/i,
    /Mobile/i
  ]
  
  const isMobileUA = mobilePatterns.some(pattern => pattern.test(userAgent))
  
  // 检测触摸屏支持
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  // 检测小屏幕
  const isSmallScreen = window.innerWidth <= 768
  
  return isMobileUA || (isTouchDevice && isSmallScreen)
}

/**
 * 检测是否为iOS设备
 */
export function isiOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/**
 * 检测是否为iOS Chrome
 */
export function isiOSChrome(): boolean {
  return isiOS() && /CriOS/.test(navigator.userAgent)
}

/**
 * 检测是否支持Media Fragments技术
 */
export function supportsMediaFragments(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  
  // 检测浏览器是否支持Media Fragments
  const video = document.createElement('video')
  return 'currentTime' in video && 'canPlayType' in video
}

/**
 * 检测是否应该使用Media Fragments作为缩略图方案
 */
export function shouldUseMediaFragments(): boolean {
  return isMobile() && supportsMediaFragments()
}

/**
 * 检测视频URL是否兼容iOS播放
 */
export function isVideoURLCompatibleWithiOS(videoUrl: string): boolean {
  if (typeof videoUrl !== 'string') return false
  
  // 已知不兼容的域名/路径
  const incompatiblePatterns = [
    /filesystem\.site/i,
    /sample\/video\.mp4/i
  ]
  
  const isIncompatible = incompatiblePatterns.some(pattern => pattern.test(videoUrl))
  
  console.log(`[VideoStrategy] URL兼容性检查: ${videoUrl} -> ${!isIncompatible ? '兼容' : '不兼容'}`)
  
  return !isIncompatible
}

/**
 * 为iOS获取兼容的备用视频URL（如果需要）
 */
export function getCompatibleVideoURL(originalUrl: string): string {
  if (!isiOS() || isVideoURLCompatibleWithiOS(originalUrl)) {
    return originalUrl
  }
  
  // 如果原URL不兼容iOS，返回一个兼容的测试视频
  console.log(`[VideoStrategy] 为iOS使用兼容的备用视频URL`)
  return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
}

/**
 * iOS专用：创建一个增强的视频预览元素
 */
export function createIOSVideoPreview(videoUrl: string): HTMLVideoElement | null {
  if (typeof document === 'undefined' || !isiOS()) {
    return null
  }
  
  const video = document.createElement('video')
  video.src = `${videoUrl}#t=1.0`
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.setAttribute('poster', '')  // 清空poster避免默认图片
  
  // 监听元数据加载完成
  video.addEventListener('loadedmetadata', () => {
    if (video.duration > 1) {
      video.currentTime = 1.0  // 跳到1秒位置
    }
  })
  
  return video
}

/**
 * 检查客户端生成是否曾经失败过
 */
function hasClientGenerationFailed(videoId: string): boolean {
  try {
    const failedVideos = JSON.parse(localStorage.getItem('failed_thumbnail_videos') || '[]')
    return failedVideos.includes(videoId)
  } catch {
    return false
  }
}

/**
 * 记录客户端生成失败
 */
export function markClientGenerationFailed(videoId: string): void {
  try {
    const failedVideos = JSON.parse(localStorage.getItem('failed_thumbnail_videos') || '[]')
    if (!failedVideos.includes(videoId)) {
      failedVideos.push(videoId)
      // 只保留最近100个失败记录
      if (failedVideos.length > 100) {
        failedVideos.splice(0, failedVideos.length - 100)
      }
      localStorage.setItem('failed_thumbnail_videos', JSON.stringify(failedVideos))
    }
  } catch (error) {
    console.warn('无法记录缩略图生成失败状态:', error)
  }
}

/**
 * 检查视频是否已有有效的缩略图
 */
function hasValidThumbnail(video: VideoRecord): boolean {
  if (!video.thumbnailUrl) return false
  
  // 检查是否为SVG占位符
  if (video.thumbnailUrl.startsWith('data:image/svg+xml')) return false
  
  // 检查是否为有效的图片URL
  return video.thumbnailUrl.startsWith('http') || video.thumbnailUrl.startsWith('data:image/')
}

/**
 * 主策略函数：决定是否应该使用服务端缩略图生成
 */
export function shouldUseServerThumbnail(video: VideoRecord): boolean {
  // 如果已有有效缩略图，不需要重新生成
  if (hasValidThumbnail(video)) {
    console.log(`[THUMBNAIL STRATEGY] 已有有效缩略图，跳过: ${video.id}`)
    return false
  }

  // 视频未完成，不生成缩略图
  if (video.status !== 'completed' || !video.videoUrl) {
    return false
  }

  // 🚀 移动端优先使用服务端生成（解决兼容性问题）
  if (isMobile()) {
    console.log(`[THUMBNAIL STRATEGY] 移动端检测，使用服务端生成: ${video.id}`)
    return true
  }

  // 🚀 iOS Chrome特殊处理（已知问题）
  if (isiOSChrome()) {
    console.log(`[THUMBNAIL STRATEGY] iOS Chrome检测，使用服务端生成: ${video.id}`)
    return true
  }

  // 🚀 跨域视频使用服务端生成（避免CORS问题）
  if (needsCorsProxy(video.videoUrl)) {
    console.log(`[THUMBNAIL STRATEGY] CORS域名检测，使用服务端生成: ${video.id}`)
    return true
  }

  // 🚀 客户端生成失败过的视频使用服务端生成
  if (hasClientGenerationFailed(video.id)) {
    console.log(`[THUMBNAIL STRATEGY] 客户端生成曾失败，使用服务端生成: ${video.id}`)
    return true
  }

  // 🚀 缩略图生成状态检查
  if (video.thumbnail_generation_status === 'failed') {
    console.log(`[THUMBNAIL STRATEGY] 缩略图生成曾失败，重试服务端生成: ${video.id}`)
    return true
  }

  // 默认尝试客户端生成（性能更好）
  console.log(`[THUMBNAIL STRATEGY] 使用客户端生成: ${video.id}`)
  return false
}

/**
 * 获取策略解释（用于调试）
 */
export function getThumbnailStrategyReason(video: VideoRecord): string {
  if (hasValidThumbnail(video)) return '已有有效缩略图'
  if (video.status !== 'completed') return '视频未完成'
  if (isMobile()) return '移动端设备'
  if (isiOSChrome()) return 'iOS Chrome浏览器'
  if (needsCorsProxy(video.videoUrl)) return 'CORS跨域视频'
  if (hasClientGenerationFailed(video.id)) return '客户端生成曾失败'
  if (video.thumbnail_generation_status === 'failed') return '服务端生成曾失败'
  return '默认客户端生成'
}