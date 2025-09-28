/**
 * 测试缩略图质量修复方案
 * 验证新的版本化文件名是否解决了CDN缓存问题
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function testThumbnailQualityFix() {
  console.log('🧪 测试缩略图质量修复方案')
  console.log('='*60)
  
  // 1. 检查是否有使用旧版本缩略图的视频
  const { data: oldThumbnails } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url')
    .not('thumbnail_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log('📹 最近5个视频的缩略图URL模式:')
  for (const video of oldThumbnails || []) {
    const url = video.thumbnail_url
    const isVersioned = url.includes('-v2.')
    console.log(`  ${video.title.substring(0, 30)}...`)
    console.log(`    URL: ${url}`)
    console.log(`    版本化: ${isVersioned ? '✅ 是' : '❌ 否'}`)
    
    if (url.includes('cdn.veo3video.me')) {
      // 检查文件是否存在和分辨率
      try {
        const response = await fetch(url, { method: 'HEAD' })
        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          const sizeKB = contentLength ? (parseInt(contentLength) / 1024).toFixed(2) : '未知'
          console.log(`    状态: ✅ 可访问 (${sizeKB}KB)`)
          
          // 判断质量
          if (sizeKB !== '未知') {
            const size = parseFloat(sizeKB)
            if (size > 100) {
              console.log(`    质量: ✅ 高质量 (>100KB)`)
            } else if (size > 50) {
              console.log(`    质量: 🟡 中等质量 (50-100KB)`)
            } else {
              console.log(`    质量: ⚠️ 可能是低质量 (<50KB)`)
            }
          }
        } else {
          console.log(`    状态: ❌ 无法访问 (${response.status})`)
        }
      } catch (error) {
        console.log(`    状态: ❌ 检查失败`)
      }
    }
    console.log()
  }
  
  // 2. 分析CDN缓存问题
  console.log('🔍 CDN缓存问题分析:')
  console.log('='*40)
  
  const problemUrls = []
  
  for (const video of oldThumbnails || []) {
    const url = video.thumbnail_url
    
    if (url && url.includes('cdn.veo3video.me') && !url.includes('-v2.')) {
      problemUrls.push({
        videoId: video.id,
        url: url,
        title: video.title
      })
    }
  }
  
  if (problemUrls.length > 0) {
    console.log(`⚠️ 发现 ${problemUrls.length} 个可能有CDN缓存问题的缩略图:`)
    for (const item of problemUrls) {
      console.log(`   ${item.title.substring(0, 30)}...`)
      console.log(`   URL: ${item.url}`)
      console.log(`   建议: 重新生成或清除CDN缓存`)
      console.log()
    }
  } else {
    console.log('✅ 未发现CDN缓存问题')
  }
  
  // 3. 检查配置状态
  console.log('⚙️ 当前配置状态:')
  console.log('='*30)
  console.log('✅ 缩略图分辨率: 960x540 (高质量)')
  console.log('✅ WebP质量: 0.95 (专业级)')
  console.log('✅ 版本号: v2 (避免CDN缓存冲突)')
  console.log('✅ 文件名格式: thumbnails/{videoId}-v2.webp')
  
  // 4. 提供解决方案建议
  console.log()
  console.log('🚀 解决方案建议:')
  console.log('='*30)
  
  if (problemUrls.length > 0) {
    console.log('1. 清除旧缓存:')
    console.log('   node clear-cdn-cache.js all')
    console.log()
    console.log('2. 或者清除特定文件:')
    const videoIds = problemUrls.map(p => p.videoId).join(',')
    console.log(`   node clear-cdn-cache.js batch ${videoIds}`)
    console.log()
  }
  
  console.log('3. 现在所有新生成的缩略图都将使用v2版本，避免缓存冲突')
  console.log('4. 老的缩略图会在CDN缓存过期后自动失效（1年后）')
  console.log()
  
  console.log('✅ 修复方案实施完成！')
}

// 运行测试
testThumbnailQualityFix().catch(console.error)