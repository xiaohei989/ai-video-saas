import { createClient } from '@supabase/supabase-js'

// 使用service role key以确保有足够权限
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

async function finalMigrationCheck() {
  try {
    console.log('🔍 最终迁移状态检查...')
    
    // 1. 查看所有视频状态
    const { data: allVideos, error: queryError } = await supabase
      .from('videos')
      .select('id, title, video_url, migration_status, status, r2_url')
      .not('video_url', 'is', null)
    
    if (queryError) {
      console.error('查询失败:', queryError.message)
      return
    }
    
    // 统计
    const stats = allVideos.reduce((acc, video) => {
      const migrationStatus = video.migration_status || 'null'
      acc[migrationStatus] = (acc[migrationStatus] || 0) + 1
      return acc
    }, {})
    
    console.log('📊 详细迁移状态统计:')
    Object.entries(stats).forEach(([status, count]) => {
      const emoji = {
        pending: '⏳',
        downloading: '⬇️',
        uploading: '⬆️', 
        completed: '✅',
        failed: '❌',
        null: '❓'
      }
      console.log(`  ${emoji[status] || '❓'} ${status}: ${count}`)
    })
    
    // 2. 查看待迁移的视频
    const pendingVideos = allVideos.filter(v => 
      v.status === 'completed' && 
      (v.migration_status === 'pending' || v.migration_status === null)
    )
    
    if (pendingVideos.length > 0) {
      console.log('\n🚀 待迁移视频详情:')
      pendingVideos.forEach(video => {
        console.log(`  - ${video.title || video.id}`)
        console.log(`    URL: ${video.video_url}`)
        console.log(`    状态: ${video.migration_status || 'null'}`)
        console.log('')
      })
      
      // 3. 处理所有无法迁移的视频（如测试URL等）
      for (const video of pendingVideos) {
        if (video.video_url.includes('filesystem.site') || video.video_url.includes('sample')) {
          console.log(`🔄 标记测试视频为失败: ${video.title}`)
          await supabase
            .from('videos')
            .update({ migration_status: 'failed' })
            .eq('id', video.id)
        }
      }
    } else {
      console.log('\n✅ 所有已完成视频都已处理！')
    }
    
    // 4. 显示成功迁移的视频数量
    const completedMigrations = allVideos.filter(v => v.migration_status === 'completed')
    console.log(`\n🎉 成功迁移到R2的视频数量: ${completedMigrations.length}`)
    
    if (completedMigrations.length > 0) {
      console.log('\n✅ 已迁移的视频示例:')
      completedMigrations.slice(0, 5).forEach(video => {
        console.log(`  - ${video.title || video.id}`)
        console.log(`    R2 URL: ${video.r2_url}`)
        console.log('')
      })
    }
    
  } catch (error) {
    console.error('💥 检查异常:', error.message)
  }
}

finalMigrationCheck()