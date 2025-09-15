/**
 * 检查用户视频迁移状态
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkMigrationStatus() {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('migration_status, status')
      .not('video_url', 'is', null)

    if (error) {
      console.error('查询失败:', error.message)
      return
    }

    const stats = data.reduce((acc, video) => {
      const migrationStatus = video.migration_status || 'pending'
      acc[migrationStatus] = (acc[migrationStatus] || 0) + 1
      return acc
    }, {})

    const videoStats = data.reduce((acc, video) => {
      acc[video.status] = (acc[video.status] || 0) + 1
      return acc
    }, {})

    console.log('📊 用户视频迁移状态统计:')
    Object.entries(stats).forEach(([status, count]) => {
      const emoji = {
        pending: '⏳',
        downloading: '⬇️',
        uploading: '⬆️', 
        completed: '✅',
        failed: '❌'
      }
      console.log(`  ${emoji[status] || '❓'} ${status}: ${count}`)
    })

    console.log('\n📊 视频状态统计:')
    Object.entries(videoStats).forEach(([status, count]) => {
      const emoji = {
        completed: '✅',
        processing: '🔄',
        failed: '❌',
        pending: '⏳'
      }
      console.log(`  ${emoji[status] || '❓'} ${status}: ${count}`)
    })

    console.log(`\n📈 总计: ${data.length} 个视频`)
    
    // 查找待迁移的已完成视频
    const pendingMigration = data.filter(v => 
      v.status === 'completed' && 
      (v.migration_status === 'pending' || v.migration_status === null || v.migration_status === 'failed')
    ).length

    console.log(`🚀 待迁移的已完成视频: ${pendingMigration} 个`)

  } catch (error) {
    console.error('检查失败:', error.message)
  }
}

checkMigrationStatus()