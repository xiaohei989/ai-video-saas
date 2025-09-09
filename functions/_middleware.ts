// Cloudflare Pages Functions 中间件
// 处理缓存、安全头和性能优化

export async function onRequest(context: any): Promise<Response> {
  const { request, next, env } = context;
  const url = new URL(request.url);
  
  // 获取响应
  const response = await next();
  
  // 创建新的响应以修改头部
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers)
  });

  // 设置安全头
  setSecurityHeaders(newResponse.headers);
  
  // 设置缓存头
  setCacheHeaders(newResponse.headers, url.pathname);
  
  // 设置性能优化头
  setPerformanceHeaders(newResponse.headers, url.pathname);
  
  return newResponse;
}

function setSecurityHeaders(headers: Headers) {
  // 安全头配置
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' blob: https: http:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.qingyuntop.top https://api.apicore.ai",
    "frame-src https://js.stripe.com",
    "worker-src 'self' blob:"
  ].join('; ');
  
  headers.set('Content-Security-Policy', csp);
}

function setCacheHeaders(headers: Headers, pathname: string) {
  // 根据文件类型设置缓存策略
  if (pathname.startsWith('/assets/') || 
      pathname.match(/\.(js|css|woff|woff2)$/)) {
    // 静态资源：1年缓存 + immutable
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    // 图片：1周缓存
    headers.set('Cache-Control', 'public, max-age=604800');
  } else if (pathname.match(/\.(mp4|webm|mov)$/)) {
    // 视频：1周缓存 + 支持范围请求
    headers.set('Cache-Control', 'public, max-age=604800');
    headers.set('Accept-Ranges', 'bytes');
  } else if (pathname === '/' || pathname.match(/\.html$/)) {
    // HTML：短缓存
    headers.set('Cache-Control', 'public, max-age=300');
  } else if (pathname.startsWith('/api/')) {
    // API：不缓存
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }
}

function setPerformanceHeaders(headers: Headers, pathname: string) {
  // 启用Brotli压缩
  if (pathname.match(/\.(js|css|html|json|xml|txt)$/)) {
    headers.set('Content-Encoding', 'br');
  }
  
  // 预加载关键资源
  if (pathname === '/') {
    const preloadLinks = [
      '</assets/index.css>; rel=preload; as=style',
      '</assets/index.js>; rel=preload; as=script',
      '<https://fonts.googleapis.com>; rel=preconnect',
      '<https://fonts.gstatic.com>; rel=preconnect; crossorigin'
    ];
    headers.set('Link', preloadLinks.join(', '));
  }
  
  // Early Hints for critical resources
  if (pathname === '/create-video') {
    headers.set('Link', '</assets/video-creator.js>; rel=preload; as=script');
  }
}

// API路由的特殊处理
export async function onRequestGet(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  
  // 健康检查端点
  if (url.pathname === '/health' || url.pathname === '/ping') {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
  
  return context.next();
}

// OPTIONS请求处理（CORS预检）
export async function onRequestOptions(context: any): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      'Access-Control-Max-Age': '86400'
    }
  });
}