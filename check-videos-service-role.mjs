import { createClient } from '@supabase/supabase-js'

async function checkVideosWithServiceRole() {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔍 使用Service Role检查视频缩略图状态...')

    // 查询最近20个视频记录
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, thumbnail_generation_status, video_url, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('❌ 查询失败:', error)
      return
    }

    console.log('📹 最近20个视频的缩略图状态:')
    console.log('=====================================')

    let hasStaticThumbnails = 0
    const totalVideos = videos?.length || 0

    for (const video of videos || []) {
      const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
      const hasThumbUrl = !!video.thumbnail_url
      const thumbStatus = video.thumbnail_generation_status || 'NULL'
      
      if (hasThumbUrl) hasStaticThumbnails++
      
      console.log('📱', video.title)
      console.log('   ID:', video.id)
      console.log('   缩略图URL:', hasThumbUrl ? '✅ 有' : '❌ 无')
      if (hasThumbUrl) {
        console.log('   缩略图地址:', video.thumbnail_url)
      }
      console.log('   生成状态:', thumbStatus)
      console.log('   创建时间:', createdAt)
      console.log('   ---')
    }

    console.log()
    console.log('📊 统计结果:')
    console.log('总视频数:', totalVideos)
    console.log('有静态缩略图:', hasStaticThumbnails)
    console.log('无静态缩略图:', totalVideos - hasStaticThumbnails)
    console.log('静态缩略图比例:', totalVideos > 0 ? ((hasStaticThumbnails / totalVideos) * 100).toFixed(1) + '%' : '0%')

    // 检查字段结构
    if (videos && videos.length > 0) {
      console.log()
      console.log('🔧 数据库字段结构:')
      const fields = Object.keys(videos[0])
      const thumbnailFields = fields.filter(field => 
        field.toLowerCase().includes('thumbnail') || field.toLowerCase().includes('thumb')
      )
      console.log('缩略图相关字段:', thumbnailFields)
    }

  } catch (err) {
    console.error('❌ 执行失败:', err)
  }
}

checkVideosWithServiceRole()