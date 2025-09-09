// Cloudflare 相关工具函数
// 用于检测和优化Cloudflare环境下的性能

/**
 * 检测是否在Cloudflare Pages环境中运行
 */
export const isCloudflarePages = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // 检查Cloudflare特有的头部或环境
  return (
    // @ts-ignore
    window.__CF_PAGES__ === true ||
    document.querySelector('meta[name="cf-2fa-verify"]') !== null ||
    // 检查CF-Ray头部（需要从服务端传递）
    document.querySelector('meta[name="cf-ray"]') !== null
  );
};

/**
 * 获取Cloudflare的边缘节点信息
 */
export const getCloudflareNodeInfo = () => {
  if (typeof window === 'undefined') return null;
  
  // 从meta标签获取CF信息
  const cfRay = document.querySelector('meta[name="cf-ray"]')?.getAttribute('content');
  const cfCountry = document.querySelector('meta[name="cf-visitor-country"]')?.getAttribute('content');
  
  return {
    ray: cfRay,
    country: cfCountry,
    isCloudflare: !!cfRay
  };
};

/**
 * 预加载关键资源（利用Cloudflare的边缘缓存）
 * 注意：现在我们使用更智能的预加载策略，不再自动预加载
 */
export const preloadCriticalResources = () => {
  if (typeof window === 'undefined') return;
  
  // 禁用自动预加载，改用智能预加载策略
  console.log('[CLOUDFLARE] 智能预加载策略已启用，跳过自动预加载')
  
  // 注释掉原有的预加载逻辑
  /*
  const criticalResources = [
    // 关键CSS - 现在已内联
    // '/assets/index.css',
    // 关键JS - 现在按需加载
    // '/assets/vendor.js',
    // 字体文件 - 现在异步加载
    // 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
  ];
  */
};

/**
 * 优化视频加载（利用Cloudflare的视频优化）
 */
export const optimizeVideoLoading = (videoElement: HTMLVideoElement, videoUrl: string) => {
  if (!videoElement || !videoUrl) return;
  
  // 如果是Cloudflare环境，使用优化参数
  if (isCloudflarePages()) {
    // Cloudflare支持视频优化参数
    const optimizedUrl = new URL(videoUrl);
    
    // 添加质量优化参数（如果URL支持）
    if (optimizedUrl.hostname.includes('cloudflare') || 
        optimizedUrl.hostname.includes('supabase')) {
      optimizedUrl.searchParams.set('format', 'auto');
      optimizedUrl.searchParams.set('quality', '80');
    }
    
    videoElement.src = optimizedUrl.toString();
  } else {
    videoElement.src = videoUrl;
  }
  
  // 设置预加载策略
  videoElement.preload = 'metadata';
  videoElement.playsInline = true;
};

/**
 * 图片优化加载
 */
export const optimizeImageLoading = (imgElement: HTMLImageElement, imageUrl: string) => {
  if (!imgElement || !imageUrl) return;
  
  // 如果是Cloudflare环境，使用Polish优化
  if (isCloudflarePages()) {
    const optimizedUrl = new URL(imageUrl);
    
    // Cloudflare Polish会自动优化图片
    // 我们可以添加一些优化参数
    if (optimizedUrl.hostname.includes('supabase') ||
        optimizedUrl.hostname.includes('cloudflare')) {
      optimizedUrl.searchParams.set('width', '800');
      optimizedUrl.searchParams.set('quality', '85');
      optimizedUrl.searchParams.set('format', 'auto');
    }
    
    imgElement.src = optimizedUrl.toString();
  } else {
    imgElement.src = imageUrl;
  }
  
  // 设置懒加载
  imgElement.loading = 'lazy';
  imgElement.decoding = 'async';
};

/**
 * 获取最佳的API端点（基于地理位置）
 */
export const getBestApiEndpoint = (defaultEndpoint: string): string => {
  const nodeInfo = getCloudflareNodeInfo();
  
  if (!nodeInfo?.country) {
    return defaultEndpoint;
  }
  
  // 根据用户所在地区选择最佳API端点
  const regionEndpoints: Record<string, string> = {
    // 亚洲地区
    'CN': 'https://api-asia.qingyuntop.top',
    'JP': 'https://api-asia.qingyuntop.top',
    'KR': 'https://api-asia.qingyuntop.top',
    'SG': 'https://api-asia.qingyuntop.top',
    
    // 欧洲地区  
    'GB': 'https://api-eu.qingyuntop.top',
    'DE': 'https://api-eu.qingyuntop.top',
    'FR': 'https://api-eu.qingyuntop.top',
    
    // 美洲地区
    'US': 'https://api-us.qingyuntop.top',
    'CA': 'https://api-us.qingyuntop.top',
    'BR': 'https://api-us.qingyuntop.top'
  };
  
  return regionEndpoints[nodeInfo.country] || defaultEndpoint;
};

/**
 * 缓存策略优化
 */
export const setCacheStrategy = (resourceType: 'static' | 'api' | 'media') => {
  if (typeof window === 'undefined') return;
  
  const strategies = {
    static: {
      maxAge: 31536000, // 1年
      staleWhileRevalidate: 86400 // 1天
    },
    api: {
      maxAge: 0,
      staleWhileRevalidate: 0
    },
    media: {
      maxAge: 604800, // 1周
      staleWhileRevalidate: 86400 // 1天
    }
  };
  
  const strategy = strategies[resourceType];
  
  // 如果支持Service Worker，设置缓存策略
  if ('serviceWorker' in navigator && window.workbox) {
    // 使用Workbox设置缓存策略
    console.log(`Setting cache strategy for ${resourceType}:`, strategy);
  }
};

/**
 * 性能监控（Cloudflare Analytics集成）
 */
export const trackPerformance = (eventName: string, timing: number) => {
  if (typeof window === 'undefined') return;
  
  // 发送到Cloudflare Web Analytics
  if (window.gtag) {
    window.gtag('event', 'performance', {
      event_category: 'Performance',
      event_label: eventName,
      value: Math.round(timing),
      custom_map: {
        cf_ray: getCloudflareNodeInfo()?.ray
      }
    });
  }
  
  // 也可以发送到自定义分析端点
  if (isCloudflarePages()) {
    fetch('/api/analytics/performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: eventName,
        timing: timing,
        timestamp: Date.now(),
        cf_info: getCloudflareNodeInfo()
      })
    }).catch(() => {
      // 静默处理分析错误
    });
  }
};

/**
 * 初始化Cloudflare优化
 */
export const initCloudflareOptimizations = () => {
  if (typeof window === 'undefined') return;
  
  // 预加载关键资源
  preloadCriticalResources();
  
  // 设置缓存策略
  setCacheStrategy('static');
  
  // 监控页面加载性能
  if (window.performance && window.performance.timing) {
    const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
    trackPerformance('page_load', loadTime);
  }
  
  // Web Vitals监控
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        trackPerformance(entry.name, entry.duration);
      }
    });
    
    observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
  }
};