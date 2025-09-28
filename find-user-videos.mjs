/**
 * 查找用户视频列表并准备批量清除CDN缓存
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 查找用户视频列表以清除CDN缓存...')

try {
  // 查找所有用户视频（包括没有缩略图的）
  const { data: allVideos, error: allError } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, user_id, status, created_at')
    .order('created_at', { ascending: false })

  if (allError) {
    console.error('❌ 查询所有视频失败:', allError)
    process.exit(1)
  }

  console.log('📊 总视频数量:', allVideos?.length || 0)

  // 分离有缩略图和无缩略图的视频
  const videosWithThumbnails = []
  const videosWithoutThumbnails = []

  for (const video of allVideos || []) {
    if (video.thumbnail_url) {
      videosWithThumbnails.push(video)
    } else {
      videosWithoutThumbnails.push(video)
    }
  }

  // 现在使用有缩略图的视频列表
  const { data: videos, error } = { data: videosWithThumbnails, error: null }

  if (error) {
    console.error('❌ 查询失败:', error)
    process.exit(1)
  }

  console.log('📊 找到', videos?.length || 0, '个有缩略图的用户视频')

  if (!videos || videos.length === 0) {
    console.log('✅ 没有需要清除缓存的用户视频')
    process.exit(0)
  }

  // 按用户分组统计
  const userGroups = {}
  let r2Count = 0
  let base64Count = 0

  for (const video of videos) {
    if (!userGroups[video.user_id]) {
      userGroups[video.user_id] = []
    }
    userGroups[video.user_id].push(video)

    // 统计缩略图类型
    const url = video.thumbnail_url
    if (url.includes('cdn.veo3video.me') || url.includes('supabase')) {
      r2Count++
    } else if (url.startsWith('data:image')) {
      base64Count++
    }
  }

  console.log('\n👥 用户统计:')
  for (const [userId, userVideos] of Object.entries(userGroups)) {
    console.log(`  用户 ${userId}: ${userVideos.length} 个有缩略图视频`)
  }

  console.log('\n📈 详细统计:')
  console.log(`  有缩略图视频: ${videosWithThumbnails.length} 个`)
  console.log(`  无缩略图视频: ${videosWithoutThumbnails.length} 个`)
  console.log(`  总计: ${allVideos.length} 个`)

  if (videosWithoutThumbnails.length > 0) {
    console.log('\n⚠️ 无缩略图的视频（需要重新生成）:')
    videosWithoutThumbnails.slice(0, 10).forEach(video => {
      console.log(`  - ${video.title} (${video.id}) - 状态: ${video.status}`)
    })
    if (videosWithoutThumbnails.length > 10) {
      console.log(`  ... 还有 ${videosWithoutThumbnails.length - 10} 个无缩略图视频`)
    }
  }

  console.log('\n📊 缩略图类型统计:')
  console.log(`  R2/CDN存储: ${r2Count} 个`)
  console.log(`  Base64缓存: ${base64Count} 个`)

  // 只清除R2/CDN存储的缩略图缓存
  const r2Videos = videos.filter(v => 
    v.thumbnail_url.includes('cdn.veo3video.me') || 
    v.thumbnail_url.includes('supabase')
  )

  if (r2Videos.length === 0) {
    console.log('\n✅ 没有需要清除CDN缓存的R2存储视频')
    process.exit(0)
  }

  console.log(`\n🎯 需要清除CDN缓存的视频 (${r2Videos.length}个):`)
  r2Videos.forEach(video => {
    console.log(`  ${video.title} (${video.id})`)
  })

  // 输出批量清除命令
  const videoIds = r2Videos.map(v => v.id)
  console.log('\n💡 批量清除CDN缓存命令:')
  
  // 分批处理，每批最多20个
  const batchSize = 20
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize)
    console.log(`CLOUDFLARE_ZONE_ID=4e7fa31d1bcbdd4f553f9e270d258802 CLOUDFLARE_API_TOKEN=UfEmMBSxiCKgUFPicCG3qcBgzm6ox92g1P283zgU node clear-cdn-cache.mjs batch "${batch.join(',')}"`)
  }

} catch (error) {
  console.error('❌ 执行失败:', error)
  process.exit(1)
}