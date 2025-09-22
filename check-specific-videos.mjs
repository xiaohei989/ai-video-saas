import { createClient } from '@supabase/supabase-js'

async function checkSpecificVideos() {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )

    console.log('🔍 检查页面中显示的视频缩略图状态...')

    // 从页面中看到的视频ID列表
    const videoIds = [
      '58cc9e51-f3ef-4ca6-b397-bca3b80b8662', // Brazil's Vibrant Evolution
      'b842a594-699f-45eb-ab2a-f76a391b9855', // Crafting the Future Smartphone
      'f9f6c4c9-564e-435c-9332-a26cc2b356d5', // 温馨壁炉旁的魅力自拍
      '83fddfde-6706-44bf-885f-f490cc259687', // 小鸭子街头滑板秀
      '8db040fb-78d4-4405-83c8-cc9fcb4be7a2', // 艺术咖啡机的魔法时刻
      '0e19c1b2-2cfc-42e1-86c7-b84a74a8dd9b', // 温暖的火光与迷人微笑
      '1c25dbe6-ffa7-4518-b66f-1b5d903f235d', // Animal Skateboarding Street
      'b858cd53-e7a1-4037-a298-ac543c93f667', // 温暖火光下的西班牙魅力
      '2d016562-aeaf-428f-a504-2ed0c5a4cb0a', // 滑板小猪的城市冒险
      '9b8413ad-0831-4805-8159-12897b548f42'  // Animal Skateboarding Street (另一个)
    ]

    // 查询这些视频的详细信息
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, thumbnail_generation_status, video_url, status, created_at')
      .in('id', videoIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ 查询失败:', error)
      return
    }

    console.log('📹 视频缩略图详细状态:')
    console.log('=====================================')

    let hasStaticThumbnails = 0
    const totalVideos = videos?.length || 0

    for (const video of videos || []) {
      const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
      const hasThumbUrl = !!video.thumbnail_url
      const thumbStatus = video.thumbnail_generation_status || 'NULL'
      
      if (hasThumbUrl) hasStaticThumbnails++
      
      console.log(`📱 ${video.title}`)
      console.log(`   ID: ${video.id}`)
      console.log(`   状态: ${video.status}`)
      console.log(`   创建时间: ${createdAt}`)
      console.log(`   缩略图URL: ${hasThumbUrl ? '✅ 有' : '❌ 无'}`)
      if (hasThumbUrl) {
        console.log(`   缩略图地址: ${video.thumbnail_url}`)
      }
      console.log(`   生成状态: ${thumbStatus}`)
      console.log(`   视频URL: ${video.video_url?.includes('cdn.veo3video.me') ? 'R2存储' : '第三方存储'}`)
      console.log('   ---')
    }

    console.log()
    console.log('📊 统计结果:')
    console.log(`总视频数: ${totalVideos}`)
    console.log(`有静态缩略图: ${hasStaticThumbnails}`)
    console.log(`无静态缩略图: ${totalVideos - hasStaticThumbnails}`)
    console.log(`静态缩略图比例: ${totalVideos > 0 ? ((hasStaticThumbnails / totalVideos) * 100).toFixed(1) : 0}%`)

    // 检查数据库表的缩略图字段
    console.log()
    console.log('🔧 检查videos表结构中的缩略图字段:')
    if (videos && videos.length > 0) {
      const fields = Object.keys(videos[0])
      const thumbnailFields = fields.filter(field => 
        field.toLowerCase().includes('thumbnail') || field.toLowerCase().includes('thumb')
      )
      console.log('缩略图相关字段:', thumbnailFields)
      console.log('所有字段:', fields)
    }

    console.log()
    console.log('🎯 结论:')
    if (hasStaticThumbnails === 0) {
      console.log('❌ 数据库中没有视频记录包含静态缩略图')
      console.log('📺 当前使用动态视频预览 (#t=0.1) 作为缩略图')
      console.log('🔧 如需启用静态缩略图，可调用 extractAndUploadThumbnail() 函数')
    } else {
      console.log(`✅ 有 ${hasStaticThumbnails} 个视频包含静态缩略图`)
      console.log(`📊 ${((hasStaticThumbnails / totalVideos) * 100).toFixed(1)}% 的视频使用静态缩略图`)
    }

  } catch (err) {
    console.error('❌ 执行失败:', err)
  }
}

checkSpecificVideos()