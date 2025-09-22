// 分析模板缩略图URL格式
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 分析模板缩略图URL格式...')

const { data: templates } = await supabase
  .from('templates')
  .select('id, name, thumbnailUrl')
  .limit(3)

console.log('📋 详细URL分析:')
for (const template of templates || []) {
  const url = template.thumbnailUrl
  console.log(`\n模板: ${template.name}`)
  console.log(`URL: ${url}`)
  
  if (url) {
    // 模拟 CachedImage 中的 CDN 检测逻辑
    const includesTemplates = url.includes('/templates/thumbnails/')
    const includesCDN = url.includes('cdn.veo3video.me')
    const isCDNUrl = includesTemplates || includesCDN
    
    console.log(`CDN检测结果:`)
    console.log(`  包含 '/templates/thumbnails/': ${includesTemplates}`)
    console.log(`  包含 'cdn.veo3video.me': ${includesCDN}`)
    console.log(`  是CDN URL: ${isCDNUrl}`)
    
    if (isCDNUrl) {
      console.log(`  ✅ 应该生成模糊图`)
    } else {
      console.log(`  ❌ 不会生成模糊图，会跳过fastPreview逻辑`)
    }
    
    // 分析URL结构
    if (url.startsWith('http')) {
      try {
        const urlObj = new URL(url)
        console.log(`  域名: ${urlObj.hostname}`)
        console.log(`  路径: ${urlObj.pathname}`)
      } catch (e) {
        console.log(`  ❌ URL解析失败`)
      }
    } else {
      console.log(`  相对路径: ${url}`)
    }
  }
}