/**
 * Cloudflare Worker to handle CORS for Image Resizing
 * 
 * 这个Worker为Cloudflare Transform API添加CORS头，
 * 解决浏览器跨域访问优化图片的问题
 * 
 * 部署方法：
 * 1. 在Cloudflare Dashboard创建新的Worker
 * 2. 复制此代码到Worker编辑器
 * 3. 配置路由规则：cdn.veo3video.me/cdn-cgi/image/*
 * 4. 发布Worker
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 只处理Image Transform API请求
    if (!url.pathname.startsWith('/cdn-cgi/image/')) {
      // 直接代理到原始请求
      return fetch(request);
    }

    // 处理预检请求 (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
          'Access-Control-Max-Age': '86400', // 24小时
        },
      });
    }

    try {
      // 获取原始响应
      const response = await fetch(request);
      
      // 创建新的响应，添加CORS头
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          // CORS headers
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
          // 缓存控制
          'Cache-Control': 'public, max-age=31536000, immutable',
          // 安全头
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      });

      return newResponse;
    } catch (error) {
      console.error('Worker error:', error);
      
      // 返回错误响应，也要包含CORS头
      return new Response('Internal Server Error', {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain',
        },
      });
    }
  },
};