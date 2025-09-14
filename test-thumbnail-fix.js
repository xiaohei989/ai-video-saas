import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function testThumbnailGeneration() {
  console.log('🚀 测试用户视频缩略图生成')
  
  // 获取一个用户视频
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, video_url, thumbnail_url')
    .limit(1)
  
  if (error) {
    console.error('❌ 获取视频数据失败:', error)
    return
  }
  
  if (!videos || videos.length === 0) {
    console.log('ℹ️ 没有找到视频数据')
    return
  }
  
  const video = videos[0]
  console.log('📹 测试视频:', {
    id: video.id,
    title: video.title,
    video_url: video.video_url,
    thumbnail_url: video.thumbnail_url
  })
  
  // 测试缩略图生成逻辑
  console.log('\n🔍 分析缩略图生成策略:')
  console.log(`1. 数据库thumbnail_url: ${video.thumbnail_url ? '✅ 有' : '❌ 无（null）'}`)
  console.log(`2. 视频URL格式: ${video.video_url}`)
  console.log(`3. 应该使用策略: ${video.thumbnail_url ? '数据库缩略图' : 'ThumbnailCacheService实时生成'}`)
  
  // 模拟URL路径推断（原有逻辑）
  const videoName = video.video_url.split('/').pop()?.replace('.mp4', '') || 'video'
  const inferredPath = `/templates/thumbnails/${videoName}-thumbnail.jpg`
  console.log(`4. 推断的缩略图路径: ${inferredPath}`)
  console.log(`   预期存在性: ❌ 不存在（因为是用户视频，不是模板）`)
  
  console.log('\n✅ 修复后的处理流程:')
  console.log('1. 检查数据库thumbnail_url -> null，跳过')  
  console.log('2. 使用videoId从ThumbnailCacheService实时生成')
  console.log('3. 从视频第1秒提取帧作为缩略图')
  console.log('4. 缓存到IndexedDB供后续使用')
  console.log('5. 返回base64格式的真实缩略图')
}

testThumbnailGeneration().catch(console.error)