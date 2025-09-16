import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function handleTestVideo() {
  try {
    console.log('🔍 处理测试视频...')
    
    // 查找测试视频
    const { data: videos, error: queryError } = await supabase
      .from('videos')
      .select('id, title, video_url, migration_status')
      .eq('video_url', 'https://filesystem.site/cdn/sample/video.mp4')
    
    if (queryError) {
      console.error('查询失败:', queryError.message)
      return
    }
    
    if (!videos || videos.length === 0) {
      console.log('✅ 没有找到测试视频')
      return
    }
    
    console.log(`📊 找到 ${videos.length} 个测试视频`)
    
    // 将测试视频标记为失败状态
    for (const video of videos) {
      console.log(`📹 处理视频: ${video.title} (${video.id})`)
      
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          migration_status: 'failed',
          r2_url: null,
          r2_key: null
        })
        .eq('id', video.id)
      
      if (updateError) {
        console.error(`❌ 更新失败 ${video.id}:`, updateError.message)
      } else {
        console.log(`✅ 已标记为失败: ${video.title}`)
      }
    }
    
    console.log('🎉 测试视频处理完成！')
    
  } catch (error) {
    console.error('💥 处理异常:', error.message)
  }
}

handleTestVideo()