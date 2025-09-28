// 测试CDN域名识别问题
import { isHighQualityCDN, getR2PublicDomain } from './src/config/cdnConfig.js'

console.log('🔍 调试CDN域名识别问题...')

const testUrl = 'https://cdn.veo3video.me/thumbnails/56717878-bb2e-4d67-a3d3-e9a5bf00f79a-v2.png'
console.log('测试URL:', testUrl)

const currentR2Domain = getR2PublicDomain()
console.log('当前R2域名配置:', currentR2Domain)

const isRecognizedAsHighQuality = isHighQualityCDN(testUrl)
console.log('是否被识别为高质量CDN:', isRecognizedAsHighQuality)

// 检查具体的域名匹配逻辑
const highQualityDomains = [
  currentR2Domain,
  'supabase.co',
  'amazonaws.com',
  'cloudfront.net'
]

console.log('高质量域名列表:', highQualityDomains)

highQualityDomains.forEach(domain => {
  const matches = testUrl.includes(domain)
  console.log(`  ${domain}: ${matches ? '✅ 匹配' : '❌ 不匹配'}`)
})

// 检查环境变量
console.log('环境变量:')
console.log('  VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN:', import.meta.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN)
console.log('  VITE_CLOUDFLARE_ACCOUNT_ID:', import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID)