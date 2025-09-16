/**
 * 手动重试测试视频的R2迁移
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

async function retryMigration() {
  console.log(`🔄 手动重试测试视频的R2迁移: ${TEST_VIDEO_ID}\n`)
  
  try {
    console.log('📞 调用迁移API...')
    
    // 调用迁移函数
    const { data, error } = await supabase.rpc('migrate_video_to_r2', {
      video_id: TEST_VIDEO_ID
    })
    
    if (error) {
      console.error('❌ 调用迁移函数失败:', error)
      return
    }
    
    console.log('✅ 迁移函数调用成功:', data)
    
    // 等待几秒后检查结果
    console.log('\n⏳ 等待5秒后检查迁移结果...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // 检查迁移结果
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('id, title, video_url, r2_url, migration_status, r2_uploaded_at')
      .eq('id', TEST_VIDEO_ID)
      .single()
    
    if (fetchError) {
      console.error('❌ 获取视频信息失败:', fetchError)
      return
    }
    
    console.log('\n📊 迁移后的视频状态:')
    console.log(`  🎬 标题: ${video.title}`)
    console.log(`  📹 video_url: ${video.video_url}`)
    console.log(`  🔗 r2_url: ${video.r2_url || 'NULL'}`)
    console.log(`  📊 migration_status: ${video.migration_status}`)
    console.log(`  📤 r2_uploaded_at: ${video.r2_uploaded_at || 'NULL'}`)
    
    if (video.r2_url && video.video_url === video.r2_url) {
      console.log('\n🎉 迁移成功！视频已使用R2存储')
    } else if (video.r2_url) {
      console.log('\n⚠️ 迁移部分成功：r2_url已设置但video_url未更新')
    } else {
      console.log('\n❌ 迁移失败：r2_url仍为空')
    }
    
  } catch (error) {
    console.error('🚨 迁移过程中出错:', error)
    
    // 如果没有迁移函数，我们直接调用VideoMigrationService
    console.log('\n🔧 尝试直接调用迁移服务...')
    try {
      // 动态导入迁移服务
      const response = await fetch('http://localhost:3000/api/migrate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: TEST_VIDEO_ID
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('✅ 直接调用迁移服务成功:', result)
      } else {
        console.error('❌ 直接调用迁移服务失败:', await response.text())
      }
      
    } catch (directError) {
      console.error('❌ 直接调用迁移服务时出错:', directError)
      console.log('💡 建议：检查VideoMigrationService的配置和网络连接')
    }
  }
}

retryMigration().catch(error => {
  console.error('🚨 重试脚本出错:', error)
})