// Cloudflare Pages Functions: 生产环境 R2/CDN 视频代理
// 目的：为移动端（特别是 iOS Chrome/微信/QQ）提供同源代理，避免潜在的 CORS/网络限制

export const onRequest: PagesFunction = async (context) => {
  const { request, params } = context
  const incomingUrl = new URL(request.url)

  // 捕获路径与查询串
  const rawPath = Array.isArray(params.path)
    ? params.path.join('/')
    : (params.path as string | undefined) || ''

  // 目标 CDN 域名（与前端 getProxyVideoUrl 中保持一致）
  const originBase = 'https://cdn.veo3video.me'
  const targetUrl = `${originBase}/${rawPath}${incomingUrl.search || ''}`

  // 透传必要请求头（范围请求/缓存验证等）
  const hopByHopHeaders = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailers', 'transfer-encoding', 'upgrade'
  ])

  const forwardHeaders = new Headers()
  request.headers.forEach((value, key) => {
    if (hopByHopHeaders.has(key.toLowerCase())) return
    // 一些不需要或可能影响的头移除/替换
    if (key.toLowerCase() === 'host') return
    forwardHeaders.set(key, value)
  })

  // 确保视频相关头存在
  forwardHeaders.set('Accept', 'video/mp4,video/*,*/*')

  // 发起到 CDN 的请求（保留方法与关键头）
  const upstreamResp = await fetch(targetUrl, {
    method: request.method,
    headers: forwardHeaders,
    redirect: 'follow'
  })

  // 创建可修改头的新响应
  const respHeaders = new Headers(upstreamResp.headers)

  // 增强 CORS 与范围请求支持
  respHeaders.set('Access-Control-Allow-Origin', '*')
  respHeaders.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
  respHeaders.set('Access-Control-Allow-Headers', 'Content-Type,Range,Authorization')
  respHeaders.set('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges')
  respHeaders.set('Accept-Ranges', 'bytes')

  // 智能缓存：视频与静态资源设置较长缓存
  if (upstreamResp.status === 200 || upstreamResp.status === 206) {
    // 若上游未设置强缓存，则补充一份合理的缓存策略
    if (!respHeaders.has('Cache-Control')) {
      respHeaders.set('Cache-Control', 'public, max-age=7200, s-maxage=86400, immutable')
    }
  }

  // 返回透传/增强后的响应
  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers: respHeaders
  })
}

export const onRequestOptions: PagesFunction = async () => {
  // 处理 CORS 预检
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Range,Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}

