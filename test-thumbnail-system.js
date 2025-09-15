/**
 * 测试移动端缩略图生成系统
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function testThumbnailGeneration() {
  try {
    console.log('🔍 查找测试视频...')
    
    // 查找一个已完成但没有缩略图的视频
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, video_url, thumbnail_url, thumbnail_generation_status, status')
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .limit(1)

    if (error) {
      console.error('❌ 查询视频失败:', error)
      return
    }

    if (!videos || videos.length === 0) {
      console.log('⚠️ 未找到可测试的已完成视频')
      return
    }

    const testVideo = videos[0]
    console.log(`📹 找到测试视频: ${testVideo.title} (${testVideo.id})`)
    console.log(`🎬 视频URL: ${testVideo.video_url}`)
    console.log(`🖼️ 当前缩略图: ${testVideo.thumbnail_url || '无'}`)

    console.log('\n🚀 调用服务端缩略图生成...')
    
    const { data, error: funcError } = await supabase.functions.invoke('generate-thumbnail', {
      body: {
        videoUrl: testVideo.video_url,
        videoId: testVideo.id
      }
    })

    if (funcError) {
      console.error('❌ Edge Function调用失败:', funcError)
      return
    }

    console.log('📊 Edge Function响应:', data)

    if (data.success) {
      console.log(`✅ 缩略图生成成功!`)
      console.log(`🖼️ 缩略图URL: ${data.thumbnailUrl}`)
      
      // 验证数据库是否更新
      console.log('\n🔍 验证数据库更新...')
      const { data: updatedVideo, error: queryError } = await supabase
        .from('videos')
        .select('thumbnail_url, thumbnail_source, thumbnail_generation_status')
        .eq('id', testVideo.id)
        .single()

      if (queryError) {
        console.error('❌ 查询更新后的视频失败:', queryError)
        return
      }

      console.log('📊 更新后的视频信息:', updatedVideo)
      
      if (updatedVideo.thumbnail_url && updatedVideo.thumbnail_source === 'server') {
        console.log('🎉 测试成功! 移动端缩略图系统工作正常')
      } else {
        console.log('⚠️ 数据库更新可能不完整')
      }
      
    } else {
      console.error('❌ 缩略图生成失败:', data.error)
    }

  } catch (error) {
    console.error('💥 测试过程中出现异常:', error)
  }
}

// 运行测试
testThumbnailGeneration()