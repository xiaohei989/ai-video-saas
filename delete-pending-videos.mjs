/**
 * 删除pending状态的视频
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必需的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function deletePendingVideos() {
  console.log('🔍 查找pending状态的视频...\n')
  
  const { data: pendingVideos, error } = await supabase
    .from('videos')
    .select('id, title, status, video_url, migration_status, created_at')
    .eq('status', 'completed')
    .eq('migration_status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  console.log(`📹 找到 ${pendingVideos.length} 个pending状态的视频`)
  
  if (pendingVideos.length === 0) {
    console.log('✅ 没有需要删除的pending视频')
    return
  }

  console.log('\n准备删除以下视频:')
  for (const video of pendingVideos) {
    const createdAt = new Date(video.created_at).toLocaleDateString('zh-CN')
    console.log(`🎬 ${video.title || video.id} (${createdAt})`)
  }

  console.log(`\n🗑️ 开始删除 ${pendingVideos.length} 个pending视频...`)
  
  const { error: deleteError } = await supabase
    .from('videos')
    .delete()
    .eq('status', 'completed')
    .eq('migration_status', 'pending')

  if (deleteError) {
    console.error('❌ 删除失败:', deleteError)
    return
  }

  console.log(`✅ 成功删除 ${pendingVideos.length} 个pending视频`)
  console.log('🎉 清理完成！现在所有视频都应该使用R2存储')
}

deletePendingVideos().catch(error => {
  console.error('🚨 删除过程中出错:', error)
})