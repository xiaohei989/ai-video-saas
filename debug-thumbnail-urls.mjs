// 调试模板缩略图URL模式
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查模板缩略图URL模式...')

const { data: templates } = await supabase
  .from('templates')
  .select('id, name, thumbnailUrl')
  .limit(5)

console.log('📋 模板缩略图URL分析:')
for (const template of templates || []) {
  const url = template.thumbnailUrl
  console.log('模板:', template.name)
  console.log('  URL:', url)
  
  if (url) {
    console.log('  URL检查:')
    console.log('    包含/templates/thumbnails/:', url.includes('/templates/thumbnails/'))
    console.log('    包含cdn.veo3video.me:', url.includes('cdn.veo3video.me'))
    console.log('    是CDN URL:', url.includes('/templates/thumbnails/') || url.includes('cdn.veo3video.me'))
    
    // 模拟生成模糊图URL
    if (url.includes('/templates/thumbnails/') || url.includes('cdn.veo3video.me')) {
      const cleanUrl = url.split('?')[0]
      let path
      
      if (cleanUrl.startsWith('/')) {
        path = cleanUrl
      } else if (cleanUrl.startsWith('http')) {
        try {
          const urlObj = new URL(cleanUrl)
          path = urlObj.pathname
        } catch (e) {
          path = null
        }
      } else {
        path = '/' + cleanUrl
      }
      
      if (path) {
        const blurUrl = `/cdn-cgi/image/w=150,q=20,blur=1,f=auto${path}`
        const finalUrl = `/cdn-cgi/image/w=400,q=75,f=auto${path}`
        console.log('  生成的模糊图URL:', blurUrl)
        console.log('  生成的最终URL:', finalUrl)
      }
    }
  }
  console.log('---')
}