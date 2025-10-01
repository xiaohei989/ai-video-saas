// 共享的 CORS 配置

// 允许的域名列表
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://veo3video.me',
  'https://www.veo3video.me',
  'https://ai-video-saas.pages.dev'
]

/**
 * 获取 CORS 头
 * @param origin 请求来源
 * @returns CORS 头对象
 */
export function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.some(allowed =>
    origin === allowed || origin.endsWith('.ai-video-saas.pages.dev')
  ) ? origin : allowedOrigins[2] // 默认使用主域名

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Allow-Credentials': 'true',
  }
}

/**
 * 处理 OPTIONS 预检请求
 * @param req 请求对象
 * @returns 如果是 OPTIONS 请求则返回响应，否则返回 null
 */
export function handleCors(req: Request): Response | null {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return null
}
