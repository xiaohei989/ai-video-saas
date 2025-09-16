/**
 * 获取最新生成的视频信息
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必需的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function getLatestVideo() {
  console.log('🔍 获取最新生成的视频...\n')
  
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, status, created_at, parameters, veo3_job_id')
    .order('created_at', { ascending: false })
    .limit(3)
  
  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }
  
  console.log('📹 最新视频:')
  for (const video of data) {
    const animal = video.parameters?.animal || 'N/A'
    const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
    console.log(`ID: ${video.id}`)
    console.log(`标题: ${video.title || '未设置'}`)
    console.log(`动物: ${animal}`)
    console.log(`状态: ${video.status}`)
    console.log(`任务ID: ${video.veo3_job_id || 'N/A'}`)
    console.log(`创建时间: ${createdAt}`)
    console.log('---')
  }
  
  // 返回最新的视频ID（用于监控）
  if (data && data.length > 0) {
    const latestVideo = data[0]
    console.log(`\n🎯 最新视频ID: ${latestVideo.id}`)
    console.log(`📊 当前状态: ${latestVideo.status}`)
    return latestVideo.id
  }
}

getLatestVideo().catch(error => {
  console.error('🚨 获取最新视频时出错:', error)
})