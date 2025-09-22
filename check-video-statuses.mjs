import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

console.log('🔍 检查视频状态详情...')

// 首先查看所有已完成的视频的缩略图状态分布
const { data: allCompletedVideos } = await supabase
  .from('videos')
  .select('id, title, thumbnail_generation_status, thumbnail_url')
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(30)

console.log(`📊 查询到 ${allCompletedVideos?.length || 0} 个已完成的视频`)

if (allCompletedVideos && allCompletedVideos.length > 0) {
  // 统计各种状态
  const statusCount = {}
  
  allCompletedVideos.forEach(video => {
    const status = video.thumbnail_generation_status || 'null'
    statusCount[status] = (statusCount[status] || 0) + 1
  })
  
  console.log('\n📈 缩略图状态分布:')
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}个`)
  })
  
  console.log('\n📋 前20个视频详情:')
  console.log('=====================================')
  
  for (let i = 0; i < Math.min(20, allCompletedVideos.length); i++) {
    const video = allCompletedVideos[i]
    const status = video.thumbnail_generation_status || 'null'
    const hasUrl = !!video.thumbnail_url
    
    const statusIcon = {
      'completed': '✅',
      'failed': '❌',
      'pending': '⏳',
      'processing': '🔄',
      'null': '❓'
    }[status] || '❓'
    
    console.log(`${i + 1}. ${statusIcon} ${video.title}`)
    console.log(`    状态: ${status}`)
    console.log(`    缩略图: ${hasUrl ? '有URL' : '无URL'}`)
    console.log(`    ID: ${video.id}`)
    console.log('    ---')
  }
}

// 专门查询失败状态的视频
console.log('\n\n🔍 专门查询失败状态的视频...')
const { data: explicitlyFailedVideos } = await supabase
  .from('videos')
  .select('id, title, thumbnail_generation_status, thumbnail_url, error_message')
  .eq('thumbnail_generation_status', 'failed')
  .limit(20)

console.log(`❌ 明确标记为failed的视频: ${explicitlyFailedVideos?.length || 0}个`)

if (explicitlyFailedVideos && explicitlyFailedVideos.length > 0) {
  explicitlyFailedVideos.forEach((video, index) => {
    console.log(`${index + 1}. ${video.title}`)
    console.log(`   错误信息: ${video.error_message || '无'}`)
  })
}

// 查询没有缩略图URL但状态不是failed的视频
console.log('\n\n🔍 查询没有缩略图但状态不明确的视频...')
const { data: noThumbnailVideos } = await supabase
  .from('videos')
  .select('id, title, thumbnail_generation_status, thumbnail_url')
  .eq('status', 'completed')
  .is('thumbnail_url', null)
  .limit(20)

console.log(`📸 没有缩略图URL的视频: ${noThumbnailVideos?.length || 0}个`)

if (noThumbnailVideos && noThumbnailVideos.length > 0) {
  const statusDistribution = {}
  noThumbnailVideos.forEach(video => {
    const status = video.thumbnail_generation_status || 'null'
    statusDistribution[status] = (statusDistribution[status] || 0) + 1
  })
  
  console.log('状态分布:')
  Object.entries(statusDistribution).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}个`)
  })
}