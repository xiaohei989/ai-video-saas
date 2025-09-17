/**
 * 视频URL代理工具
 * 解决第三方域名的CORS问题
 */

/**
 * 将第三方视频URL转换为代理URL，解决CORS问题
 * @param originalUrl 原始视频URL
 * @returns 代理后的URL或原始URL
 */
export function getProxyVideoUrl(originalUrl: string): string {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return originalUrl;
  }

  // 开发环境使用代理
  if (import.meta.env.DEV) {
    // 代理filesystem.site域名
    if (originalUrl.includes('filesystem.site')) {
      const path = originalUrl.replace('https://filesystem.site', '');
      return `/api/filesystem${path}`;
    }
    
    // 代理heyoo.oss域名  
    if (originalUrl.includes('heyoo.oss-ap-southeast-1.aliyuncs.com')) {
      const path = originalUrl.replace('https://heyoo.oss-ap-southeast-1.aliyuncs.com', '');
      return `/api/heyoo${path}`;
    }
    
    // 代理R2存储域名，解决CORS问题
    if (originalUrl.includes('cdn.veo3video.me')) {
      const path = originalUrl.replace('https://cdn.veo3video.me', '');
      return `/api/r2${path}`;
    }
  }
  
  // 生产环境直接返回原始URL，CORS问题已通过Cloudflare Transform Rules解决
  return originalUrl;
}

/**
 * 检查URL是否需要CORS处理
 * 所有CDN域名的视频都需要设置crossOrigin属性
 */
export function needsCorsProxy(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // 开发环境：需要代理的域名
  if (import.meta.env.DEV) {
    return url.includes('filesystem.site') || 
           url.includes('heyoo.oss-ap-southeast-1.aliyuncs.com') ||
           url.includes('cdn.veo3video.me');
  }
  
  // 生产环境：CDN域名需要CORS处理（设置crossOrigin属性）
  return url.includes('cdn.veo3video.me') ||
         url.includes('filesystem.site') ||
         url.includes('heyoo.oss-ap-southeast-1.aliyuncs.com');
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