/**
 * 视频URL代理工具
 * 解决第三方域名的CORS问题
 */

/**
 * 将R2视频URL转换为代理URL，解决CORS问题
 * @param originalUrl 原始视频URL
 * @returns 代理后的URL或原始URL
 */
export function getProxyVideoUrl(originalUrl: string): string {
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