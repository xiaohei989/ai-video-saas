/**
 * 监控测试视频的完成状态和R2迁移结果
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

async function monitorTestVideo() {
  console.log(`🔍 监控测试视频: ${TEST_VIDEO_ID}`)
  console.log('⏰ 开始监控...\n')
  
  let attempts = 0
  const maxAttempts = 60 // 最多监控10分钟（每10秒一次）
  
  while (attempts < maxAttempts) {
    attempts++
    
    try {
      const { data: video, error } = await supabase
        .from('videos')
        .select('id, title, status, video_url, r2_url, migration_status, created_at, processing_completed_at, veo3_job_id')
        .eq('id', TEST_VIDEO_ID)
        .single()
      
      if (error) {
        console.error(`❌ 查询失败 (${attempts}/${maxAttempts}):`, error)
        await sleep(10000)
        continue
      }
      
      const currentTime = new Date().toLocaleTimeString('zh-CN')
      console.log(`[${currentTime}] 尝试 ${attempts}/${maxAttempts}:`)
      console.log(`  📊 状态: ${video.status}`)
      console.log(`  🎯 任务ID: ${video.veo3_job_id}`)
      console.log(`  📹 video_url: ${video.video_url ? (video.video_url.substring(0, 60) + '...') : 'NULL'}`)
      console.log(`  🔗 r2_url: ${video.r2_url ? (video.r2_url.substring(0, 60) + '...') : 'NULL'}`)
      console.log(`  📊 migration_status: ${video.migration_status || 'NULL'}`)
      
      if (video.video_url) {
        const isR2Url = video.video_url.includes('cdn.veo3video.me')
        console.log(`  🏪 存储类型: ${isR2Url ? '✅ R2存储' : '❌ 第三方存储'}`)
        
        if (isR2Url) {
          const isImmediateMigration = video.video_url === video.r2_url
          console.log(`  🔄 立即迁移: ${isImmediateMigration ? '✅ 成功' : '❌ 失败'}`)
        }
      }
      
      if (video.status === 'completed') {
        console.log('\n🎉 视频生成完成！')
        
        // 最终检查
        if (video.video_url?.includes('cdn.veo3video.me')) {
          console.log('✅ 测试成功: 新视频直接使用R2存储！')
          console.log(`📊 最终结果:`)
          console.log(`  - video_url: ${video.video_url}`)
          console.log(`  - r2_url: ${video.r2_url}`)
          console.log(`  - migration_status: ${video.migration_status}`)
          console.log(`  - URL一致性: ${video.video_url === video.r2_url ? '✅ 一致' : '❌ 不一致'}`)
        } else {
          console.log('❌ 测试失败: 新视频仍使用第三方存储')
          console.log(`  可能需要检查立即迁移逻辑`)
        }
        break
      } else if (video.status === 'failed') {
        console.log('\n💀 视频生成失败')
        break
      } else {
        console.log('  ⏳ 仍在处理中...\n')
      }
      
    } catch (error) {
      console.error(`💥 监控过程中出错:`, error)
    }
    
    // 等待10秒
    await sleep(10000)
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⏰ 监控超时，停止监控')
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

monitorTestVideo().catch(error => {
  console.error('🚨 监控脚本出错:', error)
})