import { createClient } from '@supabase/supabase-js'

// 使用Service Role Key获取完整权限
const supabase = createClient(
  'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'
)

console.log('🔍 使用Service Role检查视频状态...')

// 查询所有视频，不限制用户
const { data: allVideos, error } = await supabase
  .from('videos')
  .select('id, title, user_id, status, thumbnail_generation_status, thumbnail_url, video_url, created_at')
  .order('created_at', { ascending: false })
  .limit(30)

if (error) {
  console.error('❌ 查询错误:', error)
  process.exit(1)
}

console.log(`📊 找到 ${allVideos?.length || 0} 个视频`)

if (allVideos && allVideos.length > 0) {
  // 按状态分组
  const byVideoStatus = {}
  const byThumbnailStatus = {}
  
  allVideos.forEach(video => {
    const videoStatus = video.status || 'null'
    const thumbStatus = video.thumbnail_generation_status || 'null'
    
    byVideoStatus[videoStatus] = (byVideoStatus[videoStatus] || 0) + 1
    byThumbnailStatus[thumbStatus] = (byThumbnailStatus[thumbStatus] || 0) + 1
  })
  
  console.log('\n📈 视频处理状态分布:')
  Object.entries(byVideoStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}个`)
  })
  
  console.log('\n🖼️ 缩略图生成状态分布:')
  Object.entries(byThumbnailStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}个`)
  })
  
  // 查看已完成视频的详情
  const completedVideos = allVideos.filter(v => v.status === 'completed')
  console.log(`\n🎬 已完成的视频: ${completedVideos.length}个`)
  
  if (completedVideos.length > 0) {
    console.log('\n📋 已完成视频的缩略图状态详情:')
    console.log('=====================================')
    
    completedVideos.slice(0, 20).forEach((video, index) => {
      const thumbStatus = video.thumbnail_generation_status || 'null'
      const hasUrl = !!video.thumbnail_url
      const hasVideoUrl = !!video.video_url
      
      const statusIcon = {
        'completed': '✅',
        'failed': '❌', 
        'pending': '⏳',
        'processing': '🔄',
        'null': '❓'
      }[thumbStatus] || '❓'
      
      console.log(`${index + 1}. ${statusIcon} ${video.title}`)
      console.log(`    缩略图状态: ${thumbStatus}`)
      console.log(`    有缩略图URL: ${hasUrl ? '✅' : '❌'}`)
      console.log(`    有视频URL: ${hasVideoUrl ? '✅' : '❌'}`)
      console.log(`    用户ID: ${video.user_id}`)
      console.log(`    创建时间: ${new Date(video.created_at).toLocaleString('zh-CN')}`)
      
      if (thumbStatus === 'failed' || (!hasUrl && thumbStatus !== 'completed')) {
        console.log(`    🔍 可能的失败原因: 缩略图生成失败`)
        if (!hasVideoUrl) {
          console.log(`    ⚠️  没有视频URL，无法生成缩略图`)
        }
      }
      console.log('    ---')
    })
    
    // 统计失败情况
    const failedCount = completedVideos.filter(v => 
      v.thumbnail_generation_status === 'failed' || 
      (!v.thumbnail_url && v.thumbnail_generation_status !== 'completed')
    ).length
    
    const successCount = completedVideos.filter(v => 
      v.thumbnail_generation_status === 'completed' && v.thumbnail_url
    ).length
    
    console.log(`\n📊 统计结果:`)
    console.log(`✅ 成功生成缩略图: ${successCount}个`)
    console.log(`❌ 缩略图生成失败: ${failedCount}个`)
    console.log(`❓ 待处理或未知状态: ${completedVideos.length - successCount - failedCount}个`)
  }
}