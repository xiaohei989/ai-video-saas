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
  }
  
  // 生产环境或其他域名直接返回原始URL
  return originalUrl;
}

/**
 * 检查URL是否需要CORS代理
 */
export function needsCorsProxy(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  return url.includes('filesystem.site') || 
         url.includes('heyoo.oss-ap-southeast-1.aliyuncs.com');
}

/**
 * 为video元素设置合适的属性来处理CORS
 */
export function applyVideoCorsFix(video: HTMLVideoElement, url: string): void {
  if (needsCorsProxy(url)) {
    // 对需要代理的URL设置crossOrigin
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