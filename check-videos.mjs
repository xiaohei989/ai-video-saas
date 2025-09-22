import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查数据库中的视频状态...')

const { data: videos, error } = await supabase
  .from('videos')
  .select('id, title, status, video_url, thumbnail_url, thumbnail_generation_status, created_at')
  .order('created_at', { ascending: false })
  .limit(10)

if (error) {
  console.error('❌ 查询失败:', error)
  process.exit(1)
}

console.log(`📊 找到 ${videos?.length || 0} 个视频`)
console.log('')

if (videos && videos.length > 0) {
  console.log('🎬 最近10个视频状态:')
  videos.forEach((video, index) => {
    const hasVideo = video.video_url ? '✅' : '❌'
    const hasThumbnail = video.thumbnail_url ? '✅' : '❌'
    const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
    
    console.log(`${index + 1}. ${video.title}`)
    console.log(`   状态: ${video.status}`)
    console.log(`   视频URL: ${hasVideo} ${video.video_url ? '有' : '无'}`)
    console.log(`   缩略图: ${hasThumbnail} ${video.thumbnail_url ? '有' : '无'}`)
    console.log(`   创建时间: ${createdAt}`)
    console.log('')
  })

  // 统计信息
  const statusCounts = videos.reduce((acc, video) => {
    acc[video.status] = (acc[video.status] || 0) + 1
    return acc
  }, {})

  console.log('📈 状态统计:')
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`)
  })

  const videosWithUrls = videos.filter(v => v.video_url)
  const videosWithThumbnails = videos.filter(v => v.thumbnail_url)
  
  console.log('')
  console.log(`🔗 有视频URL的: ${videosWithUrls.length}/${videos.length}`)
  console.log(`🖼️ 有缩略图的: ${videosWithThumbnails.length}/${videos.length}`)
  
} else {
  console.log('❌ 数据库中没有视频记录')
}