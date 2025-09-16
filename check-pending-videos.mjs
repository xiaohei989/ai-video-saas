/**
 * 检查pending状态的视频
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必需的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPendingVideos() {
  console.log('🔍 查看pending状态的视频详情...\n')
  
  const { data: pendingVideos, error } = await supabase
    .from('videos')
    .select('id, title, status, video_url, migration_status, created_at, processing_completed_at')
    .eq('status', 'completed')
    .eq('migration_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  console.log(`📹 找到 ${pendingVideos.length} 个pending状态的视频:\n`)
  
  for (const video of pendingVideos) {
    const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
    const completedAt = video.processing_completed_at ? new Date(video.processing_completed_at).toLocaleString('zh-CN') : 'NULL'
    
    console.log(`🎬 ${video.title || video.id}`)
    console.log(`   📅 创建时间: ${createdAt}`)
    console.log(`   ✅ 完成时间: ${completedAt}`)
    console.log(`   🔗 视频URL: ${video.video_url?.substring(0, 80)}...`)
    console.log(`   📊 迁移状态: ${video.migration_status}`)
    
    // 检查这些视频是否是今天生成的（应该使用新的立即迁移逻辑）
    const today = new Date()
    const videoDate = new Date(video.created_at)
    const isToday = today.toDateString() === videoDate.toDateString()
    
    console.log(`   📆 是否今日生成: ${isToday ? '✅ 是' : '❌ 否'}`)
    if (isToday) {
      console.log(`   ⚠️ 注意：今日生成的视频应该自动迁移，可能需要检查代码`)
    }
    console.log('')
  }

  return pendingVideos
}

checkPendingVideos().catch(error => {
  console.error('🚨 处理过程中出错:', error)
})