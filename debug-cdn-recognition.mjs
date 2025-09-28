// 简化的CDN域名识别测试
console.log('🔍 调试CDN域名识别问题...')

const testUrl = 'https://cdn.veo3video.me/thumbnails/56717878-bb2e-4d67-a3d3-e9a5bf00f79a-v2.png'
console.log('测试URL:', testUrl)

// 模拟当前的配置逻辑
const getR2PublicDomain = () => {
  // 假设没有配置环境变量的情况
  console.warn('[CDN Config] 未配置CDN域名，使用默认域名')
  return 'cdn.veo3video.me'
}

const currentR2Domain = getR2PublicDomain()
console.log('当前R2域名配置:', currentR2Domain)

// 高质量域名检查
const highQualityDomains = [
  currentR2Domain,
  'supabase.co', 
  'amazonaws.com',
  'cloudfront.net'
]

console.log('高质量域名列表:', highQualityDomains)

const isHighQualityCDN = (url) => {
  return highQualityDomains.some(domain => url.includes(domain))
}

const isRecognizedAsHighQuality = isHighQualityCDN(testUrl)
console.log('是否被识别为高质量CDN:', isRecognizedAsHighQuality)

highQualityDomains.forEach(domain => {
  const matches = testUrl.includes(domain)
  console.log(`  ${domain}: ${matches ? '✅ 匹配' : '❌ 不匹配'}`)
})

// 分析问题
console.log('\n🔧 问题分析:')
if (isRecognizedAsHighQuality) {
  console.log('✅ CDN识别正常，问题可能在缓存加载逻辑')
} else {
  console.log('❌ CDN识别失败，需要修复域名配置')
  console.log('💡 可能的原因:')
  console.log('  1. 环境变量VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN未配置') 
  console.log('  2. 实际的R2域名与硬编码的不匹配')
}