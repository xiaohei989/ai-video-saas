import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 检查服务器视频缩略图质量...')

const { data: videos, error } = await supabase
  .from('videos')
  .select('id, title, thumbnail_url, status, created_at, user_id')
  .not('thumbnail_url', 'is', null)
  .order('created_at', { ascending: false })
  .limit(15)

if (error) {
  console.error('❌ 查询失败:', error)
  process.exit(1)
}

console.log(`📊 最近${videos?.length || 0}个有缩略图的视频质量分析:`)
console.log('=' + '='.repeat(70))

let highQuality = 0
let mediumQuality = 0  
let lowQuality = 0
let r2Count = 0
let base64Count = 0
let externalCount = 0

for (let i = 0; i < (videos?.length || 0); i++) {
  const video = videos[i]
  const url = video.thumbnail_url
  
  console.log(`\n${i + 1}. 📹 ${video.title}`)
  console.log(`   ID: ${video.id}`)
  console.log(`   创建: ${new Date(video.created_at).toLocaleString('zh-CN')}`)
  console.log(`   状态: ${video.status}`)
  
  if (url.startsWith('data:image')) {
    base64Count++
    const base64Part = url.split(',')[1]
    if (base64Part) {
      const sizeKB = (base64Part.length * 0.75 / 1024)
      console.log(`   类型: 📊 Base64缓存`)
      console.log(`   大小: ${sizeKB.toFixed(2)}KB`)
      
      if (sizeKB > 50) {
        console.log(`   质量: ✅ 高质量`)
        highQuality++
      } else if (sizeKB > 20) {
        console.log(`   质量: 🟡 中等质量`)
        mediumQuality++
      } else {
        console.log(`   质量: ⚠️ 低质量 (<20KB)`)
        lowQuality++
      }
    }
  } else if (url.includes('cdn.veo3video.me') || url.includes('supabase')) {
    r2Count++
    console.log(`   类型: ☁️ R2/CDN存储`)
    console.log(`   URL: ${url.substring(0, 70)}...`)
    
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        if (contentLength) {
          const sizeKB = parseInt(contentLength) / 1024
          console.log(`   大小: ${sizeKB.toFixed(2)}KB`)
          console.log(`   HTTP: ${response.status} OK`)
          
          if (sizeKB > 50) {
            console.log(`   质量: ✅ 高质量`)
            highQuality++
          } else if (sizeKB > 20) {
            console.log(`   质量: 🟡 中等质量`)
            mediumQuality++
          } else {
            console.log(`   质量: ⚠️ 低质量 (<20KB)`)
            lowQuality++
          }
        } else {
          console.log(`   大小: 无法获取content-length`)
        }
      } else {
        console.log(`   HTTP: ❌ ${response.status} ${response.statusText}`)
      }
    } catch (e) {
      console.log(`   检测: ❌ ${e.message}`)
    }
  } else {
    externalCount++
    console.log(`   类型: 🌐 外部链接`)
    console.log(`   URL: ${url.substring(0, 70)}...`)
  }
}

console.log('\n' + '='.repeat(70))
console.log('📈 质量统计总结:')
console.log('='.repeat(30))
console.log(`总视频数: ${videos?.length || 0}`)
console.log(`R2/CDN存储: ${r2Count} 个`)
console.log(`Base64缓存: ${base64Count} 个`)
console.log(`外部链接: ${externalCount} 个`)
console.log()
console.log('📊 按质量分类:')
console.log(`✅ 高质量 (>50KB): ${highQuality} 个`)
console.log(`🟡 中等质量 (20-50KB): ${mediumQuality} 个`)
console.log(`⚠️ 低质量 (<20KB): ${lowQuality} 个`)
console.log()

const total = highQuality + mediumQuality + lowQuality
if (total > 0) {
  console.log('📈 质量占比:')
  console.log(`高质量: ${((highQuality / total) * 100).toFixed(1)}%`)
  console.log(`中等质量: ${((mediumQuality / total) * 100).toFixed(1)}%`)
  console.log(`低质量: ${((lowQuality / total) * 100).toFixed(1)}%`)
  
  if (lowQuality > total * 0.3) {
    console.log('\n🚨 警告: 超过30%的缩略图质量低于标准！')
    console.log('💡 建议: 需要优化缩略图生成配置')
  } else if (highQuality > total * 0.7) {
    console.log('\n🎉 优秀: 超过70%的缩略图达到高质量标准！')
  }
}