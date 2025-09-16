/**
 * 检查测试视频的详细信息
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必需的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 测试视频ID
const TEST_VIDEO_ID = '4de737c7-b661-4a60-a18d-a21283ca8176'

async function checkTestVideoDetail() {
  console.log(`🔍 检查测试视频详细信息: ${TEST_VIDEO_ID}\n`)
  
  const { data: video, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', TEST_VIDEO_ID)
    .single()
  
  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }
  
  console.log('📹 视频完整信息:')
  console.log(JSON.stringify(video, null, 2))
  
  console.log('\n📊 关键信息总结:')
  console.log(`  🎬 标题: ${video.title}`)
  console.log(`  📊 状态: ${video.status}`)
  console.log(`  🔄 迁移状态: ${video.migration_status || 'NULL'}`)
  console.log(`  📹 video_url: ${video.video_url}`)
  console.log(`  🔗 r2_url: ${video.r2_url || 'NULL'}`)
  console.log(`  📦 original_video_url: ${video.original_video_url || 'NULL'}`)
  console.log(`  🗝️ r2_key: ${video.r2_key || 'NULL'}`)
  console.log(`  📅 创建时间: ${video.created_at}`)
  console.log(`  ✅ 完成时间: ${video.processing_completed_at || 'NULL'}`)
  console.log(`  📤 R2上传时间: ${video.r2_uploaded_at || 'NULL'}`)
  console.log(`  🎯 veo3_job_id: ${video.veo3_job_id}`)
  
  // 分析问题
  console.log('\n🔍 问题分析:')
  
  if (video.migration_status === 'downloading') {
    console.log('❌ 迁移状态为"downloading"，说明迁移过程中出现问题')
    console.log('   可能的原因:')
    console.log('   1. 迁移服务出错')
    console.log('   2. 网络连接问题')
    console.log('   3. R2存储配置问题')
  }
  
  if (!video.r2_url) {
    console.log('❌ r2_url为空，迁移未成功完成')
  }
  
  if (video.video_url && video.video_url.includes('heyoo.oss')) {
    console.log('❌ video_url仍为第三方存储地址，立即迁移逻辑未生效')
  }
}

checkTestVideoDetail().catch(error => {
  console.error('🚨 检查过程中出错:', error)
})