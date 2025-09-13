/**
 * 检查用户视频并生成缩略图
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

interface Video {
  id: string
  user_id: string
  status: string
  video_url: string | null
  thumbnail_url: string | null
  thumbnail_generation_status: string | null
  title: string | null
  created_at: string
}

async function checkUserVideos() {
  console.log('🔍 查询所有用户的已完成视频...')
  
  try {
    // 查询所有已完成的视频
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50) // 限制50个视频

    if (error) {
      console.error('❌ 查询视频失败:', error)
      return
    }

    console.log(`✅ 找到 ${videos?.length || 0} 个已完成的视频`)

    // 按用户分组显示
    const userGroups = videos?.reduce((acc, video) => {
      if (!acc[video.user_id]) {
        acc[video.user_id] = []
      }
      acc[video.user_id].push(video)
      return acc
    }, {} as Record<string, Video[]>)

    for (const [userId, userVideos] of Object.entries(userGroups || {})) {
      console.log(`\n👤 用户 ${userId} (${userVideos.length} 个视频):`)
      
      for (const video of userVideos) {
        const needsThumbnail = !video.thumbnail_url || video.thumbnail_generation_status === 'failed'
        console.log(`  📹 ${video.id}: ${video.title || '无标题'}`)
        console.log(`     状态: ${video.status}, 缩略图: ${video.thumbnail_url ? '✅' : '❌'}, 生成状态: ${video.thumbnail_generation_status || 'pending'}`)
        console.log(`     需要生成: ${needsThumbnail ? '是' : '否'}`)
        
        if (needsThumbnail) {
          await generateThumbnailForVideo(video)
        }
      }
    }

  } catch (error) {
    console.error('❌ 检查视频失败:', error)
  }
}

async function generateThumbnailForVideo(video: Video) {
  console.log(`🖼️ 开始为视频 ${video.id} 生成缩略图...`)
  
  try {
    // 首先更新状态为处理中
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        thumbnail_generation_status: 'processing'
      })
      .eq('id', video.id)

    if (updateError) {
      console.error(`❌ 更新状态失败: ${updateError.message}`)
      return
    }

    // 调用Edge Function生成缩略图
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-thumbnail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: video.id,
        videoUrl: video.video_url,
        options: {
          timestamp: 1,
          quality: 'medium',
          width: 640,
          height: 360,
          format: 'jpeg',
          blurRadius: 20
        }
      })
    })

    const result = await response.json()
    
    console.log('Edge Function响应状态:', response.status)
    console.log('Edge Function响应结果:', JSON.stringify(result, null, 2))
    
    if (response.ok && result.success && result.thumbnails) {
      console.log('准备保存缩略图到数据库...')
      
      // 保存缩略图URL到数据库
      const { data: updateData, error: saveError } = await supabase
        .from('videos')
        .update({
          thumbnail_url: result.thumbnails.normal,
          thumbnail_blur_url: result.thumbnails.blur,
          thumbnail_generation_status: 'completed',
          thumbnail_metadata: result.metadata || {}
        })
        .eq('id', video.id)
        .select()

      if (saveError) {
        console.error(`❌ 保存缩略图失败: ${saveError.message}`)
        console.error('错误详情:', saveError)
      } else {
        console.log(`✅ 缩略图生成成功: ${video.id}`)
        console.log('更新的数据:', updateData)
      }
    } else {
      console.error(`❌ 缩略图生成失败: ${result.error || '未知错误'}`)
      
      // 标记为失败
      await supabase
        .from('videos')
        .update({ 
          thumbnail_generation_status: 'failed',
          thumbnail_metadata: { error: result.error || '生成失败' }
        })
        .eq('id', video.id)
    }
    
    // 添加延迟避免过载
    await new Promise(resolve => setTimeout(resolve, 1000))
    
  } catch (error) {
    console.error(`❌ 处理视频 ${video.id} 失败:`, error)
    
    // 标记为失败
    await supabase
      .from('videos')
      .update({ 
        thumbnail_generation_status: 'failed',
        thumbnail_metadata: { error: error instanceof Error ? error.message : '处理失败' }
      })
      .eq('id', video.id)
  }
}

// 运行检查
checkUserVideos().then(() => {
  console.log('\n🎉 视频检查和缩略图生成完成！')
  process.exit(0)
}).catch(error => {
  console.error('❌ 程序执行失败:', error)
  process.exit(1)
})