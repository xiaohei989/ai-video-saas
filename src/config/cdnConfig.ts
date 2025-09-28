/**
 * CDN配置服务
 * 统一管理所有CDN相关的域名和URL生成逻辑
 */

/**
 * 获取R2 CDN公共域名
 */
export const getR2PublicDomain = (): string => {
  const configuredDomain = import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN
  
  if (configuredDomain) {
    return configuredDomain
  }
  
  // 降级到默认的R2域名
  const accountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID
  if (accountId) {
    return `pub-${accountId}.r2.dev`
  }
  
  // 最后的fallback
  console.warn('[CDN Config] 未配置CDN域名，使用默认域名')
  return 'cdn.veo3video.me'
}

/**
 * 生成R2存储的完整URL
 */
export const generateR2Url = (path: string): string => {
  const domain = getR2PublicDomain()
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `https://${domain}/${cleanPath}`
}

/**
 * 检查URL是否为高质量CDN域名
 */
export const isHighQualityCDN = (url: string): boolean => {
  const highQualityDomains = [
    getR2PublicDomain(),
    'supabase.co',
    'amazonaws.com',
    'cloudfront.net'
  ]
  
  return highQualityDomains.some(domain => url.includes(domain))
}

/**
 * 转换硬编码的CDN URL为配置的域名
 * 将静态文件中的cdn.veo3video.me替换为当前配置的域名
 */
export const transformCDNUrl = (url: string): string => {
  if (!url) return url
  
  // 替换硬编码的CDN域名
  const hardcodedDomain = 'cdn.veo3video.me'
  const currentDomain = getR2PublicDomain()
  
  if (url.includes(hardcodedDomain)) {
    return url.replace(hardcodedDomain, currentDomain)
  }
  
  return url
}

/**
 * 获取所有支持的CDN域名列表
 */
export const getSupportedCDNDomains = (): string[] => {
  return [
    getR2PublicDomain(),
    'supabase.co',
    'amazonaws.com',
    'cloudfront.net'
  ]
}

/**
 * CDN配置信息
 */
export const CDN_CONFIG = {
  // R2存储配置
  r2: {
    domain: getR2PublicDomain(),
    bucketName: import.meta.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage',
    accountId: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID
  },
  
  // 支持的高质量域名
  highQualityDomains: getSupportedCDNDomains(),
  
  // URL生成器
  generateUrl: generateR2Url,
  
  // 质量检测
  isHighQuality: isHighQualityCDN,
  
  // URL转换
  transformUrl: transformCDNUrl
} as const

export default CDN_CONFIG