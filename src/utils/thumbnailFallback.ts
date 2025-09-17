/**
 * 缩略图渐进式回退机制
 * 为了向后兼容和浏览器兼容性，提供多层回退策略
 */

/**
 * 获取视频缩略图的最佳策略
 * @param video_url 视频URL
 * @param thumbnail_url 现有的缩略图URL（向后兼容）
 * @returns 最佳的缩略图源
 */
export function getOptimalThumbnailSource(video_url: string | null, thumbnail_url?: string | null): string | undefined {
  // 1. 优先使用预设缩略图（最快，约50KB）
  if (thumbnail_url && !isSVGPlaceholder(thumbnail_url)) {
    return thumbnail_url
  }
  
  // 2. 回退到 Media Fragments 截图（需要加载视频元数据，约500KB+）
  if (video_url && supportsMediaFragments()) {
    return video_url // SimpleVideoPlayer 会自动添加 #t=0.001
  }
  
  // 3. 如果视频URL存在但不支持Media Fragments，仍然尝试使用视频URL
  if (video_url) {
    return video_url
  }
  
  // 4. 最后的回退：undefined，让组件显示占位符
  return undefined
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