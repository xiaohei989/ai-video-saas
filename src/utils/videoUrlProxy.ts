/**
 * 视频URL代理工具
 * 解决第三方域名的CORS问题，集成智能回退机制
 */

import { getOptimalVideoUrl, generateFallbackUrl } from './cdnConnectivityTest'

/**
 * 将R2视频URL转换为代理URL，解决CORS问题
 * @param originalUrl 原始视频URL
 * @param enableSmartFallback 是否启用智能回退
 * @returns 代理后的URL或原始URL
 */
export function getProxyVideoUrl(originalUrl: string, enableSmartFallback: boolean = false): string {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return originalUrl;
  }

  // 开发环境使用代理
  if (import.meta.env.DEV) {
    // 代理R2存储域名，解决CORS问题
    if (originalUrl.includes('cdn.veo3video.me')) {
      const path = originalUrl.replace('https://cdn.veo3video.me', '');
      return `/api/r2${path}`;
    }
    
    // 🚀 代理原始R2域名（pub-*.r2.dev），确保所有R2视频都通过本地代理
    if (originalUrl.includes('.r2.dev')) {
      // 提取视频文件路径（通常是 /videos/xxx.mp4）
      const urlObj = new URL(originalUrl);
      const path = urlObj.pathname;
      return `/api/r2${path}`;
    }
  }
  
  // 生产环境直接返回原始URL，CORS问题已通过Cloudflare Transform Rules解决
  return originalUrl;
}

/**
 * 智能视频URL获取器
 * 自动选择最佳的视频URL（代理或直接访问）
 * @param originalUrl 原始视频URL
 * @returns Promise<string> 最佳的视频URL
 */
export async function getSmartVideoUrl(originalUrl: string): Promise<string> {
  try {
    return await getOptimalVideoUrl(originalUrl, true)
  } catch (error) {
    console.warn(`⚠️ [Smart URL] 智能URL选择失败，使用默认代理:`, error)
    return getProxyVideoUrl(originalUrl)
  }
}

/**
 * 视频URL错误处理器
 * 当视频加载失败时提供回退URL
 * @param failedUrl 失败的URL
 * @param originalUrl 原始URL
 * @returns 回退URL
 */
export function getVideoFallbackUrl(failedUrl: string, originalUrl: string): string {
  console.log(`🔄 [Video Fallback] 生成回退URL，失败URL: ${failedUrl}`)
  
  // 如果失败的是代理URL，尝试直接CDN访问
  if (failedUrl.startsWith('/api/r2/')) {
    const directUrl = `https://cdn.veo3video.me${failedUrl.replace('/api/r2', '')}`
    console.log(`🔄 [Video Fallback] 代理失败，尝试直接CDN: ${directUrl}`)
    return directUrl
  }
  
  // 如果失败的是直接CDN访问，尝试生成缓存破坏URL
  if (failedUrl.includes('cdn.veo3video.me')) {
    const fallbackUrl = generateFallbackUrl(failedUrl)
    console.log(`🔄 [Video Fallback] CDN失败，尝试缓存破坏: ${fallbackUrl}`)
    return fallbackUrl
  }
  
  // 最后的回退：返回原始URL
  console.log(`🔄 [Video Fallback] 使用原始URL: ${originalUrl}`)
  return originalUrl
}

/**
 * 检查URL是否需要CORS处理
 * 用于Canvas操作的跨域图片需要设置crossOrigin='anonymous'
 */
export function needsCorsProxy(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // 开发环境：R2域名需要代理
  if (import.meta.env.DEV) {
    return url.includes('cdn.veo3video.me') || url.includes('.r2.dev');
  }
  
  // 生产环境：暂时禁用CORS设置，避免浏览器CORS错误日志
  // 虽然服务端CORS配置正确，但浏览器可能因为缓存或时序问题仍然报错
  // 使用简单请求策略，避免触发CORS预检，确保用户体验
  return false;
}

/**
 * 为video元素设置合适的属性来处理CORS
 */
export function applyVideoCorsFix(video: HTMLVideoElement, url: string): void {
  if (needsCorsProxy(url)) {
    // 对需要CORS处理的URL设置crossOrigin
    video.crossOrigin = 'anonymous';
    video.setAttribute('crossorigin', 'anonymous');
  }
  
  // 其他通用设置
  video.setAttribute('preload', 'metadata');
  video.playsInline = true;
}

/**
 * 创建CORS安全的视频元素
 */
export function createCorsVideo(url: string): HTMLVideoElement {
  const video = document.createElement('video');
  const proxyUrl = getProxyVideoUrl(url);
  
  applyVideoCorsFix(video, proxyUrl);
  video.src = proxyUrl;
  
  return video;
}