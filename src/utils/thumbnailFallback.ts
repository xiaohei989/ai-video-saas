/**
 * 缩略图渐进式回退机制
 * 为了向后兼容和浏览器兼容性，提供多层回退策略
 */

/**
 * 获取视频缩略图的最佳策略 - R2优化版
 * @param video_url 视频URL
 * @param thumbnail_url 现有的缩略图URL（向后兼容）
 * @returns 最佳的缩略图源
 */
export function getOptimalThumbnailSource(video_url: string | null, thumbnail_url?: string | null): string | undefined {
  // 🚀 策略优化：优先使用R2存储的真实缩略图（约15-30KB，极速加载）
  if (thumbnail_url && isR2Thumbnail(thumbnail_url)) {
    return thumbnail_url
  }
  
  // 1. 次选：其他真实缩略图（非SVG占位符）
  if (thumbnail_url && !isSVGPlaceholder(thumbnail_url)) {
    return thumbnail_url
  }
  
  // 2. 最后的回退：undefined，让组件显示占位符
  // 移除Media Fragments回退机制以避免加载大量视频元数据
  return undefined
}

/**
 * 检查是否为R2存储的缩略图
 * @param thumbnailUrl 缩略图URL
 * @returns 是否为R2缩略图
 */
export function isR2Thumbnail(thumbnailUrl: string): boolean {
  if (!thumbnailUrl) return false
  
  // 检查是否为R2 CDN域名
  const r2Patterns = [
    /cdn\.veo3video\.me\/thumbnails\//,  // 自定义CDN域名
    /pub-[^.]+\.r2\.dev\/thumbnails\//,  // R2默认域名
    /[^.]+\.r2\.cloudflarestorage\.com\/[^/]+\/thumbnails\//, // R2直接访问
  ]
  
  return r2Patterns.some(pattern => pattern.test(thumbnailUrl))
}

/**
 * 获取缩略图质量评级
 * @param thumbnailUrl 缩略图URL
 * @returns 质量评级和说明
 */
export function getThumbnailQuality(thumbnailUrl?: string | null): {
  level: 'optimal' | 'good' | 'fallback' | 'placeholder'
  description: string
  estimatedSize: string
} {
  if (!thumbnailUrl) {
    return {
      level: 'placeholder',
      description: '占位符图像',
      estimatedSize: '~2KB'
    }
  }
  
  if (isR2Thumbnail(thumbnailUrl)) {
    return {
      level: 'optimal',
      description: 'R2优化缩略图',
      estimatedSize: '15-30KB'
    }
  }
  
  if (isSVGPlaceholder(thumbnailUrl)) {
    return {
      level: 'placeholder',
      description: 'SVG占位符',
      estimatedSize: '~1KB'
    }
  }
  
  if (thumbnailUrl.startsWith('http')) {
    return {
      level: 'good',
      description: '外部缩略图',
      estimatedSize: '30-100KB'
    }
  }
  
  return {
    level: 'fallback',
    description: 'Media Fragments',
    estimatedSize: '500KB+'
  }
}

/**
 * 检查浏览器是否支持 Media Fragments
 */
export function supportsMediaFragments(): boolean {
  // 大部分现代浏览器都支持 Media Fragments
  // 这里可以根据需要添加更精确的检测
  if (typeof window === 'undefined') return false
  
  // 基本检测：检查是否支持 video 元素
  const video = document.createElement('video')
  const canPlayMP4 = video.canPlayType('video/mp4') !== ''
  
  // 简单的用户代理检测，排除已知的有问题的浏览器
  const userAgent = navigator.userAgent.toLowerCase()
  const isVeryOldBrowser = userAgent.includes('msie') || 
                          (userAgent.includes('chrome') && parseInt(userAgent.match(/chrome\/(\d+)/)?.[1] || '0') < 30)
  
  return canPlayMP4 && !isVeryOldBrowser
}

/**
 * 检查是否为 SVG 占位符
 */
export function isSVGPlaceholder(thumbnailUrl: string): boolean {
  return thumbnailUrl?.startsWith('data:image/svg+xml') || false
}

/**
 * 浏览器兼容性信息
 */
export function getBrowserInfo() {
  if (typeof window === 'undefined') return { name: 'unknown', supportsMediaFragments: false }
  
  const userAgent = navigator.userAgent.toLowerCase()
  const supportsFragments = supportsMediaFragments()
  
  let browserName = 'unknown'
  if (userAgent.includes('chrome')) browserName = 'chrome'
  else if (userAgent.includes('firefox')) browserName = 'firefox'
  else if (userAgent.includes('safari')) browserName = 'safari'
  else if (userAgent.includes('edge')) browserName = 'edge'
  
  return {
    name: browserName,
    supportsMediaFragments: supportsFragments,
    userAgent: navigator.userAgent
  }
}