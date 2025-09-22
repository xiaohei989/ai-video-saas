import { createClient } from '@supabase/supabase-js'

async function checkDatabase() {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )

    console.log('🔍 检查数据库连接和视频表...')

    // 首先检查总记录数
    const { count, error: countError } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('❌ 数据库连接失败:', countError)
      return
    }

    console.log('📊 视频总数:', count)
    
    if (count && count > 0) {
      // 如果有数据，查询一些记录
      const { data: videos } = await supabase
        .from('videos')
        .select('id, title, thumbnail_url, video_url, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      
      console.log('📹 最近5个视频记录:')
      videos?.forEach((video, index) => {
        console.log(`${index + 1}. ${video.title}`)
        console.log(`   ID: ${video.id}`)
        console.log(`   缩略图: ${video.thumbnail_url ? '✅ 有' : '❌ 无'}`)
        if (video.thumbnail_url) {
          console.log(`   缩略图URL: ${video.thumbnail_url}`)
        }
        console.log(`   视频URL: ${video.video_url?.substring(0, 50)}...`)
        console.log(`   创建时间: ${new Date(video.created_at).toLocaleString('zh-CN')}`)
        console.log('   ---')
      })

      // 统计缩略图情况
      const withThumbnails = videos?.filter(v => v.thumbnail_url).length || 0
      console.log()
      console.log('📊 缩略图统计:')
      console.log(`有缩略图: ${withThumbnails}/${videos?.length}`)
      console.log(`比例: ${videos?.length ? ((withThumbnails / videos.length) * 100).toFixed(1) : 0}%`)
    } else {
      console.log('📝 数据库中暂无视频记录')
    }

    // 检查数据库表结构
    const { data: sample } = await supabase
      .from('videos')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (sample) {
      const thumbnailFields = Object.keys(sample).filter(key => 
        key.toLowerCase().includes('thumbnail') || key.toLowerCase().includes('thumb')
      )
      console.log()
      console.log('🔧 缩略图相关字段:', thumbnailFields)
    }

  } catch (err) {
    console.error('❌ 执行失败:', err)
  }
}

checkDatabase()