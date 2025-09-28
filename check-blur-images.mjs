import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'
)

console.log('🔍 检查模板和用户视频中的模糊图情况...\n')

// 检查模板
console.log('📋 模板缩略图分析:')
console.log('='.repeat(60))

const { data: templates } = await supabase
  .from('templates')
  .select('id, slug, name, thumbnail_url')
  .not('thumbnail_url', 'is', null)
  .limit(10)

let templateStats = {
  base64: 0,
  r2: 0,
  svg: 0,
  external: 0,
  potentialBlur: 0
}

for (const template of templates || []) {
  const url = template.thumbnail_url
  console.log(`📄 ${template.name || template.slug}`)
  console.log(`   URL: ${url.substring(0, 80)}...`)
  
  if (url.startsWith('data:image/svg+xml')) {
    console.log('   类型: 🔶 SVG占位符 (模糊图)')
    templateStats.svg++
    templateStats.potentialBlur++
  } else if (url.startsWith('data:image/')) {
    console.log('   类型: 📊 Base64缓存')
    const base64Part = url.split(',')[1]
    if (base64Part) {
      const sizeKB = (base64Part.length * 0.75 / 1024).toFixed(2)
      console.log(`   大小: ${sizeKB}KB`)
      if (parseFloat(sizeKB) < 15) {
        console.log('   质量: ⚠️ 可能是模糊图 (<15KB)')
        templateStats.potentialBlur++
      } else {
        console.log('   质量: ✅ 高质量')
      }
    }
    templateStats.base64++
  } else if (url.includes('cdn.veo3video.me')) {
    console.log('   类型: ☁️ R2 CDN')
    templateStats.r2++
    
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        if (contentLength) {
          const sizeKB = (parseInt(contentLength) / 1024).toFixed(2)
          console.log(`   大小: ${sizeKB}KB`)
          if (parseFloat(sizeKB) < 30) {
            console.log('   质量: ⚠️ 可能是模糊图 (<30KB)')
            templateStats.potentialBlur++
          } else {
            console.log('   质量: ✅ 高质量')
          }
        }
      }
    } catch (e) {
      console.log('   状态: ❓ 检测失败')
    }
  } else {
    console.log('   类型: 🌐 外部链接')
    templateStats.external++
  }
  console.log()
}

console.log('📊 模板缩略图统计:')
console.log(`SVG占位符: ${templateStats.svg}个`)
console.log(`Base64缓存: ${templateStats.base64}个`) 
console.log(`R2 CDN: ${templateStats.r2}个`)
console.log(`外部链接: ${templateStats.external}个`)
console.log(`潜在模糊图: ${templateStats.potentialBlur}个`)

// 检查用户视频
console.log('\n📹 用户视频缩略图分析:')
console.log('='.repeat(60))

const { data: videos } = await supabase
  .from('videos')
  .select('id, title, thumbnail_url')
  .not('thumbnail_url', 'is', null)
  .order('created_at', { ascending: false })
  .limit(10)

let videoStats = {
  base64: 0,
  r2: 0,
  svg: 0,
  external: 0,
  potentialBlur: 0
}

for (const video of videos || []) {
  const url = video.thumbnail_url
  console.log(`🎬 ${video.title || 'Untitled'}`)
  console.log(`   URL: ${url.substring(0, 80)}...`)
  
  if (url.startsWith('data:image/svg+xml')) {
    console.log('   类型: 🔶 SVG占位符 (模糊图)')
    videoStats.svg++
    videoStats.potentialBlur++
  } else if (url.startsWith('data:image/')) {
    console.log('   类型: 📊 Base64缓存')
    const base64Part = url.split(',')[1]
    if (base64Part) {
      const sizeKB = (base64Part.length * 0.75 / 1024).toFixed(2)
      console.log(`   大小: ${sizeKB}KB`)
      if (parseFloat(sizeKB) < 15) {
        console.log('   质量: ⚠️ 可能是模糊图 (<15KB)')
        videoStats.potentialBlur++
      } else {
        console.log('   质量: ✅ 高质量')
      }
    }
    videoStats.base64++
  } else if (url.includes('cdn.veo3video.me')) {
    console.log('   类型: ☁️ R2 CDN')
    videoStats.r2++
    
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        const contentLength = response.headers.get('content-length')
        if (contentLength) {
          const sizeKB = (parseInt(contentLength) / 1024).toFixed(2)
          console.log(`   大小: ${sizeKB}KB`)
          if (parseFloat(sizeKB) < 30) {
            console.log('   质量: ⚠️ 可能是模糊图 (<30KB)')
            videoStats.potentialBlur++
          } else {
            console.log('   质量: ✅ 高质量')
          }
        }
      }
    } catch (e) {
      console.log('   状态: ❓ 检测失败')
    }
  } else {
    console.log('   类型: 🌐 外部链接')
    videoStats.external++
  }
  console.log()
}

console.log('📊 用户视频缩略图统计:')
console.log(`SVG占位符: ${videoStats.svg}个`)
console.log(`Base64缓存: ${videoStats.base64}个`) 
console.log(`R2 CDN: ${videoStats.r2}个`)
console.log(`外部链接: ${videoStats.external}个`)
console.log(`潜在模糊图: ${videoStats.potentialBlur}个`)

console.log('\n🚨 总结分析:')
console.log('='.repeat(60))
console.log(`模板中的模糊图: ${templateStats.potentialBlur}/${templateStats.base64 + templateStats.r2 + templateStats.svg + templateStats.external}`)
console.log(`用户视频中的模糊图: ${videoStats.potentialBlur}/${videoStats.base64 + videoStats.r2 + videoStats.svg + videoStats.external}`)

if (templateStats.potentialBlur > 0 || videoStats.potentialBlur > 0) {
  console.log('\n💡 建议操作:')
  console.log('1. 清理SVG占位符，替换为高质量缩略图')
  console.log('2. 检查小文件缩略图是否为模糊图')
  console.log('3. 重新生成高质量缩略图')
}