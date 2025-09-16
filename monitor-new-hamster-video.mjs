/**
 * 监控新生成的hamster视频的R2迁移状态
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必需的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function monitorNewHamsterVideo() {
  console.log('🐹 开始监控新的hamster视频生成和R2迁移...\n')
  console.log('⏰ 监控时间: 最多10分钟\n')
  
  let attempts = 0
  const maxAttempts = 120 // 10分钟，每5秒检查一次
  let foundVideoId = null
  
  while (attempts < maxAttempts) {
    attempts++
    const currentTime = new Date().toLocaleTimeString('zh-CN')
    
    try {
      // 查找今天创建的hamster视频
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString()
      
      const { data: videos, error } = await supabase
        .from('videos')
        .select('*')
        .gte('created_at', todayStr)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error(`❌ 查询失败 (${attempts}/${maxAttempts}):`, error)
        await sleep(5000)
        continue
      }
      
      // 查找hamster视频
      const hamsterVideo = videos.find(v => v.parameters?.animal === 'hamster')
      
      if (hamsterVideo && !foundVideoId) {
        foundVideoId = hamsterVideo.id
        console.log(`🎯 [${currentTime}] 找到hamster视频!`)
        console.log(`   📹 视频ID: ${foundVideoId}`)
        console.log(`   🎬 标题: ${hamsterVideo.title || '未设置'}`)
        console.log(`   📊 状态: ${hamsterVideo.status}`)
        console.log(`   🔄 迁移状态: ${hamsterVideo.migration_status || 'N/A'}`)
        console.log('')
      }
      
      if (foundVideoId) {
        // 监控已找到的视频
        const video = videos.find(v => v.id === foundVideoId)
        if (video) {
          console.log(`[${currentTime}] 尝试 ${attempts}/${maxAttempts}:`)
          console.log(`  📊 状态: ${video.status}`)
          console.log(`  🎯 任务ID: ${video.veo3_job_id || 'N/A'}`)
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
              console.log('✅ 测试成功: 新hamster视频直接使用R2存储！')
              console.log(`📊 最终结果:`)
              console.log(`  - video_url: ${video.video_url}`)
              console.log(`  - r2_url: ${video.r2_url}`)
              console.log(`  - migration_status: ${video.migration_status}`)
              console.log(`  - URL一致性: ${video.video_url === video.r2_url ? '✅ 一致' : '❌ 不一致'}`)
              
              // 检查立即迁移是否工作
              if (video.migration_status === 'completed' && video.video_url === video.r2_url) {
                console.log('\n🎯 立即R2迁移功能测试成功！')
                console.log('🚀 修复后的代码正常工作，新视频会立即迁移到R2存储')
              } else if (video.migration_status === 'downloading') {
                console.log('\n⚠️ 迁移仍在进行中，可能需要更多时间完成')
              } else {
                console.log('\n❌ 立即迁移功能仍有问题，需要进一步调试')
              }
            } else {
              console.log('❌ 测试失败: 新hamster视频仍使用第三方存储')
              console.log('  可能需要检查立即迁移逻辑')
            }
            break
          } else if (video.status === 'failed') {
            console.log('\n💀 视频生成失败')
            break
          } else {
            console.log('  ⏳ 仍在处理中...\n')
          }
        }
      } else {
        console.log(`[${currentTime}] 尝试 ${attempts}/${maxAttempts}: ⏳ 等待hamster视频创建...`)
      }
      
    } catch (error) {
      console.error(`💥 监控过程中出错:`, error)
    }
    
    // 等待5秒
    await sleep(5000)
  }
  
  if (attempts >= maxAttempts) {
    console.log('\n⏰ 监控超时，停止监控')
    if (foundVideoId) {
      console.log(`最后监控的视频ID: ${foundVideoId}`)
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

monitorNewHamsterVideo().catch(error => {
  console.error('🚨 监控脚本出错:', error)
})