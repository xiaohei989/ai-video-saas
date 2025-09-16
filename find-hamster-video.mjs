/**
 * 查找刚才生成的hamster视频
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必需的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function findHamsterVideo() {
  console.log('🔍 查找hamster视频...\n')
  
  // 查找今天创建的包含hamster参数的视频
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()
  
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .gte('created_at', todayStr)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }
  
  console.log(`📹 今天创建的视频 (${data.length} 个):`)
  
  for (const video of data) {
    const animal = video.parameters?.animal || 'N/A'
    const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
    
    console.log(`\nID: ${video.id}`)
    console.log(`标题: ${video.title || '未设置'}`)
    console.log(`动物: ${animal}`)
    console.log(`状态: ${video.status}`)
    console.log(`任务ID: ${video.veo3_job_id || 'N/A'}`)
    console.log(`迁移状态: ${video.migration_status || 'N/A'}`)
    console.log(`video_url: ${video.video_url ? video.video_url.substring(0, 60) + '...' : 'N/A'}`)
    console.log(`r2_url: ${video.r2_url ? video.r2_url.substring(0, 60) + '...' : 'N/A'}`)
    console.log(`创建时间: ${createdAt}`)
    
    if (animal === 'hamster') {
      console.log('🎯 这是我们要监控的hamster视频！')
    }
  }
  
  // 查找hamster视频
  const hamsterVideo = data.find(v => v.parameters?.animal === 'hamster')
  if (hamsterVideo) {
    console.log(`\n🐹 找到hamster视频: ${hamsterVideo.id}`)
    console.log(`📊 状态: ${hamsterVideo.status}`)
    return hamsterVideo.id
  } else {
    console.log('\n❌ 没有找到hamster视频，可能还在创建中...')
  }
}

findHamsterVideo().catch(error => {
  console.error('🚨 查找hamster视频时出错:', error)
})