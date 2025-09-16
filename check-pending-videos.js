import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkPendingVideos() {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, title, video_url, migration_status, status, r2_url')
      .eq('status', 'completed')
      .in('migration_status', ['pending', 'failed'])
      .not('video_url', 'is', null)
    
    if (error) {
      console.error('查询失败:', error.message)
      return
    }
    
    console.log('📊 待迁移的视频:')
    data.forEach(video => {
      console.log(`  - ID: ${video.id}`)
      console.log(`    标题: ${video.title || '无标题'}`)
      console.log(`    原始URL: ${video.video_url}`)
      console.log(`    迁移状态: ${video.migration_status || 'null'}`)
      console.log(`    R2 URL: ${video.r2_url || '未设置'}`)
      console.log('')
    })
    
    console.log(`总计: ${data.length} 个待迁移视频`)
  } catch (error) {
    console.error('检查失败:', error.message)
  }
}

checkPendingVideos()