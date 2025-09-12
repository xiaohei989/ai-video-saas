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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http: https://www.google-analytics.com https://ssl.google-analytics.com",
    "media-src 'self' blob: https: http:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.qingyuntop.top https://api.apicore.ai https://www.google-analytics.com https://ssl.google-analytics.com https://region1.google-analytics.com https://region1.analytics.google.com https://analytics.google.com https://stats.g.doubleclick.net https://flagcdn.com https://flagpedia.net https://cloudflareinsights.com",
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
  // 设置正确的 Content-Type
  if (pathname.endsWith('.js')) {
    headers.set('Content-Type', 'application/javascript; charset=utf-8');
  } else if (pathname.endsWith('.css')) {
    headers.set('Content-Type', 'text/css; charset=utf-8');
  } else if (pathname.endsWith('.json')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  } else if (pathname.endsWith('.html') || pathname === '/') {
    headers.set('Content-Type', 'text/html; charset=utf-8');
  }
  
  // 预加载关键资源 - 使用实际的资源路径
  if (pathname === '/') {
    const preloadLinks = [
      '<https://fonts.googleapis.com>; rel=preconnect',
      '<https://fonts.gstatic.com>; rel=preconnect; crossorigin'
    ];
    headers.set('Link', preloadLinks.join(', '));
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