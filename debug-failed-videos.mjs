import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 调查15个失败视频的错误原因...')

// 获取失败的视频
const { data: failedVideos } = await supabase
  .from('videos')
  .select('id, title, video_url, thumbnail_generation_status, thumbnail_url, error_message, created_at, processing_completed_at')
  .eq('status', 'completed')
  .eq('thumbnail_generation_status', 'failed')
  .order('created_at', { ascending: false })
  .limit(20)

if (failedVideos && failedVideos.length > 0) {
  console.log(`\n📊 找到 ${failedVideos.length} 个失败的视频:`)
  console.log('=====================================')
  
  for (let i = 0; i < failedVideos.length; i++) {
    const video = failedVideos[i]
    const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
    
    console.log(`\n${i + 1}. ${video.title}`)
    console.log(`   ID: ${video.id}`)
    console.log(`   创建时间: ${createdAt}`)
    console.log(`   视频URL: ${video.video_url ? (video.video_url.substring(0, 60) + '...') : '无'}`)
    console.log(`   缩略图URL: ${video.thumbnail_url || '无'}`)
    console.log(`   错误信息: ${video.error_message || '无错误信息记录'}`)
    console.log(`   完成时间: ${video.processing_completed_at ? new Date(video.processing_completed_at).toLocaleString('zh-CN') : '无'}`)
    
    // 检查视频URL的可访问性
    if (video.video_url) {
      try {
        console.log(`   🌐 测试视频URL可访问性...`)
        const response = await fetch(video.video_url, { method: 'HEAD', timeout: 5000 })
        console.log(`   📊 视频URL状态: ${response.status} ${response.ok ? '✅ 可访问' : '❌ 不可访问'}`)
        
        if (response.ok) {
          const contentType = response.headers.get('content-type')
          const contentLength = response.headers.get('content-length')
          console.log(`   📝 内容类型: ${contentType || '未知'}`)
          console.log(`   📏 文件大小: ${contentLength ? (Math.round(parseInt(contentLength) / 1024 / 1024 * 100) / 100) + 'MB' : '未知'}`)
        }
      } catch (error) {
        console.log(`   ❌ 视频URL访问错误: ${error.message}`)
      }
    }
  }
  
  // 分析失败原因
  console.log('\n\n📈 失败原因分析:')
  console.log('=====================================')
  
  const urlPatterns = {}
  const errorMessages = {}
  let hasVideoUrl = 0
  let noVideoUrl = 0
  
  failedVideos.forEach(video => {
    // 统计URL模式
    if (video.video_url) {
      hasVideoUrl++
      const domain = new URL(video.video_url).hostname
      urlPatterns[domain] = (urlPatterns[domain] || 0) + 1
    } else {
      noVideoUrl++
    }
    
    // 统计错误信息
    const errorMsg = video.error_message || '无错误信息'
    errorMessages[errorMsg] = (errorMessages[errorMsg] || 0) + 1
  })
  
  console.log('📊 视频URL统计:')
  console.log(`  有视频URL: ${hasVideoUrl}`)
  console.log(`  无视频URL: ${noVideoUrl}`)
  
  console.log('\n🌐 视频URL域名分布:')
  Object.entries(urlPatterns).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count}个视频`)
  })
  
  console.log('\n❌ 错误信息统计:')
  Object.entries(errorMessages).forEach(([error, count]) => {
    console.log(`  "${error}": ${count}次`)
  })
  
} else {
  console.log('✅ 没有找到失败的视频')
}

// 同时检查成功的视频，作为对比
console.log('\n\n🎯 对比：成功的视频信息')
console.log('=====================================')

const { data: successVideos } = await supabase
  .from('videos')
  .select('id, title, video_url, thumbnail_url, thumbnail_generation_status')
  .eq('status', 'completed')
  .eq('thumbnail_generation_status', 'completed')
  .limit(5)

if (successVideos && successVideos.length > 0) {
  successVideos.forEach((video, index) => {
    console.log(`\n${index + 1}. ${video.title}`)
    console.log(`   ID: ${video.id}`)
    const videoDomain = video.video_url ? new URL(video.video_url).hostname : '无'
    const thumbDomain = video.thumbnail_url ? new URL(video.thumbnail_url).hostname : '无'
    console.log(`   视频域名: ${videoDomain}`)
    console.log(`   缩略图域名: ${thumbDomain}`)
  })
}