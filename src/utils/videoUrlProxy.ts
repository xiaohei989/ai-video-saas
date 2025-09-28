/**
 * 视频URL代理工具
 * 解决第三方域名的CORS问题，集成智能回退机制
 */

import { getOptimalVideoUrl, generateFallbackUrl } from './cdnConnectivityTest'
import { getR2PublicDomain } from '@/config/cdnConfig'

/**
 * 检测移动设备
 */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const userAgent = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return isMobile || isTablet || isTouchDevice;
}

/**
 * 检测是否为特殊移动浏览器（需要代理处理）
 */
function needsMobileProxy(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isIOSChrome = isIOS && /CriOS/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isWechat = /MicroMessenger/.test(userAgent);
  const isQQ = /QQ\//.test(userAgent);
  
  // iOS Chrome、微信、QQ浏览器等特殊环境需要代理
  return isIOSChrome || isWechat || isQQ || (isAndroid && userAgent.includes('Chrome'));
}

/**
 * 检测URL是否为模板视频
 */
function isTemplateVideo(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // 检测模板视频的路径特征
  return url.includes('/templates/videos/') || 
         url.includes('/api/r2/templates/videos/');
}

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

  const isTemplate = isTemplateVideo(originalUrl);
  const r2Domain = getR2PublicDomain()

  // 🎯 优先策略：模板视频直接使用CDN，除非确实需要代理
  if (isTemplate) {
    // 模板视频优先使用直接CDN访问
    
    // 只有在特殊移动环境下才使用代理
    const shouldForceProxy = isMobileDevice() && needsMobileProxy();
    
    if (shouldForceProxy) {
      console.log('[VideoProxy] 📱 模板视频：移动端特殊浏览器，使用代理:', navigator.userAgent);
      
      if (originalUrl.includes(r2Domain)) {
        const path = originalUrl.replace(`https://${r2Domain}`, '');
        return `/api/r2${path}`;
      }
      
      if (originalUrl.includes('.r2.dev')) {
        const urlObj = new URL(originalUrl);
        const path = urlObj.pathname;
        return `/api/r2${path}`;
      }
    }
    
    // 模板视频默认使用直接CDN访问
    if (originalUrl.includes(r2Domain)) {
      return originalUrl; // 已经是CDN地址，直接返回
    }
    
    // 如果是旧的代理URL，转换为CDN地址
    if (originalUrl.startsWith('/api/r2/')) {
      const path = originalUrl.replace('/api/r2', '');
      return `https://${r2Domain}${path}`;
    }
    
    return originalUrl;
  }

  // 🚀 用户视频：保持原有逻辑
  // 开发环境使用代理
  if (import.meta.env.DEV) {
    if (originalUrl.includes(r2Domain)) {
      const path = originalUrl.replace(`https://${r2Domain}`, '');
      return `/api/r2${path}`;
    }
    
    // 🚀 代理原始R2域名（pub-*.r2.dev）
    if (originalUrl.includes('.r2.dev')) {
      const urlObj = new URL(originalUrl);
      const path = urlObj.pathname;
      return `/api/r2${path}`;
    }
  }
  
  // 🚀 生产环境：移动端特殊处理
  const shouldUseProxy = isMobileDevice() && needsMobileProxy();
  
  if (shouldUseProxy) {
    console.log('[VideoProxy] 📱 用户视频：移动端检测到特殊浏览器，启用CORS代理:', navigator.userAgent);
    
    if (originalUrl.includes(r2Domain)) {
      const path = originalUrl.replace(`https://${r2Domain}`, '');
      return `/api/r2${path}`;
    }
    
    if (originalUrl.includes('.r2.dev')) {
      const urlObj = new URL(originalUrl);
      const path = urlObj.pathname;
      return `/api/r2${path}`;
    }
  }
  
  // 默认返回原始URL
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
    const r2Domain = getR2PublicDomain()
    const directUrl = `https://${r2Domain}${failedUrl.replace('/api/r2', '')}`
    console.log(`🔄 [Video Fallback] 代理失败，尝试直接CDN: ${directUrl}`)
    return directUrl
  }
  
  // 如果失败的是直接CDN访问，尝试生成缓存破坏URL
  const r2Domain = getR2PublicDomain()
  if (failedUrl.includes(r2Domain)) {
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
  
  const isTemplate = isTemplateVideo(url);
  const r2Domain = getR2PublicDomain()
  
  // 🎯 模板视频CORS策略：更严格的安全设置
  if (isTemplate) {
    // 开发环境：模板视频使用代理，不需要CORS
    if (import.meta.env.DEV) {
      // 如果是代理URL，不需要CORS设置
      if (url.startsWith('/api/r2/')) {
        return false;
      }
      // 直接CDN访问需要CORS设置
      return url.includes(r2Domain) || url.includes('.r2.dev');
    }
    
    // 生产环境：模板视频直接CDN访问，根据浏览器类型决定CORS策略
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isIOSChrome = isIOS && /CriOS/.test(userAgent);
      const isWechat = /MicroMessenger/.test(userAgent);
      const isQQ = /QQ\//.test(userAgent);
      
      // 特殊移动环境下，如果使用代理则不需要CORS
      if ((isIOSChrome || isWechat || isQQ) && url.startsWith('/api/r2/')) {
        return false;
      }
      
      // 直接CDN访问：桌面端浏览器启用CORS，移动端保守策略
      const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      if (!isMobile && (url.includes(r2Domain) || url.includes('.r2.dev'))) {
        console.log('[CORS] 🎨 模板视频桌面端启用CORS:', url.substring(0, 50) + '...');
        return true;
      }
    }
    
    return false;
  }
  
  // 🚀 用户视频CORS策略：保持原有逻辑
  // 开发环境：R2域名需要代理
  if (import.meta.env.DEV) {
    return url.includes(r2Domain) || url.includes('.r2.dev');
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
 * @param url 视频URL
 * @param forThumbnail 是否用于缩略图生成（需要更严格的CORS设置）
 */
export function createCorsVideo(url: string, forThumbnail: boolean = false): HTMLVideoElement {
  const video = document.createElement('video');
  const proxyUrl = getProxyVideoUrl(url);
  
  // 缩略图生成场景需要强制设置CORS，避免Canvas污染
  if (forThumbnail) {
    console.log('[CORS Video] 缩略图生成模式：强制启用CORS设置');
    video.crossOrigin = 'anonymous';
    video.setAttribute('crossorigin', 'anonymous');
    // 缩略图生成的其他必要设置
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
  } else {
    // 普通播放场景使用标准CORS处理
    applyVideoCorsFix(video, proxyUrl);
  }
  
  video.src = proxyUrl;
  
  return video;
}