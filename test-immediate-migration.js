/**
 * 测试新的视频生成立即迁移到R2功能
 * 验证生成的视频是否直接保存为R2 URL而不是第三方URL
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必需的环境变量')
  console.error('需要: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testImmediateMigration() {
  console.log('🚀 测试新的立即R2迁移功能...\n')
  
  // 1. 查看最近生成的视频状态
  console.log('📊 1. 查看最近生成的视频...')
  const { data: recentVideos, error } = await supabase
    .from('videos')
    .select('id, title, status, video_url, r2_url, migration_status, original_video_url, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  console.log(`\n找到 ${recentVideos.length} 个已完成的视频:\n`)
  
  for (const video of recentVideos) {
    const createdDate = new Date(video.created_at).toLocaleDateString('zh-CN')
    const videoUrlType = video.video_url?.includes('cdn.veo3video.me') ? '✅ R2存储' : 
                        video.video_url?.includes('heyoo.oss') ? '❌ Heyoo第三方' :
                        video.video_url?.includes('filesystem.site') ? '❌ FileSystem第三方' :
                        '❓ 其他'
    
    const migrationStatus = video.migration_status || 'null'
    
    console.log(`📹 ${video.title || video.id}`)
    console.log(`   📅 创建时间: ${createdDate}`)
    console.log(`   🏪 存储类型: ${videoUrlType}`)
    console.log(`   📊 迁移状态: ${migrationStatus}`)
    console.log(`   🔗 video_url: ${video.video_url?.substring(0, 60)}...`)
    if (video.r2_url) {
      console.log(`   🎯 r2_url: ${video.r2_url.substring(0, 60)}...`)
    }
    console.log('')
  }

  // 2. 统计分析
  console.log('📈 2. 存储类型统计:')
  let r2Count = 0, thirdPartyCount = 0, unknownCount = 0

  for (const video of recentVideos) {
    if (video.video_url?.includes('cdn.veo3video.me')) {
      r2Count++
    } else if (video.video_url?.includes('heyoo.oss') || video.video_url?.includes('filesystem.site')) {
      thirdPartyCount++
    } else {
      unknownCount++
    }
  }

  console.log(`✅ R2存储: ${r2Count} 个`)
  console.log(`❌ 第三方存储: ${thirdPartyCount} 个`)
  console.log(`❓ 其他/未知: ${unknownCount} 个`)

  // 3. 迁移状态分析
  console.log('\n📊 3. 迁移状态统计:')
  const migrationStats = {}
  for (const video of recentVideos) {
    const status = video.migration_status || 'null'
    migrationStats[status] = (migrationStats[status] || 0) + 1
  }

  for (const [status, count] of Object.entries(migrationStats)) {
    console.log(`${status}: ${count} 个`)
  }

  // 4. 检查是否有新的立即迁移成功的视频
  console.log('\n🎯 4. 检查立即迁移成功的视频:')
  const { data: migratedVideos, error: migratedError } = await supabase
    .from('videos')
    .select('id, title, video_url, r2_url, migration_status, r2_uploaded_at, created_at, processing_completed_at')
    .eq('status', 'completed')
    .eq('migration_status', 'completed')
    .not('r2_uploaded_at', 'is', null)
    .order('r2_uploaded_at', { ascending: false })
    .limit(5)

  if (migratedError) {
    console.error('❌ 查询迁移视频失败:', migratedError)
    return
  }

  console.log(`\n找到 ${migratedVideos.length} 个成功迁移到R2的视频:\n`)
  
  for (const video of migratedVideos) {
    const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
    const completedAt = new Date(video.processing_completed_at).toLocaleString('zh-CN')
    const uploadedAt = new Date(video.r2_uploaded_at).toLocaleString('zh-CN')
    
    const isImmediateMigration = video.video_url === video.r2_url
    const videoUrlMatches = video.video_url?.includes('cdn.veo3video.me')
    
    console.log(`🎬 ${video.title || video.id}`)
    console.log(`   📅 创建时间: ${createdAt}`)
    console.log(`   ✅ 完成时间: ${completedAt}`)
    console.log(`   📤 R2上传时间: ${uploadedAt}`)
    console.log(`   🔄 立即迁移: ${isImmediateMigration ? '✅ 是' : '❌ 否'}`)
    console.log(`   🏪 video_url类型: ${videoUrlMatches ? '✅ R2' : '❌ 第三方'}`)
    console.log(`   🎯 URL一致性: ${video.video_url === video.r2_url ? '✅ 一致' : '❌ 不一致'}`)
    console.log('')
  }

  // 5. 总结和建议
  console.log('\n📝 5. 总结:')
  const totalR2Videos = recentVideos.filter(v => v.video_url?.includes('cdn.veo3video.me')).length
  const totalVideos = recentVideos.length
  const r2Percentage = totalVideos > 0 ? ((totalR2Videos / totalVideos) * 100).toFixed(1) : 0

  console.log(`📊 最近10个视频中，${totalR2Videos}个使用R2存储 (${r2Percentage}%)`)
  
  if (r2Percentage >= 80) {
    console.log('🎉 立即迁移功能运行良好！大部分新视频已直接使用R2存储')
  } else if (r2Percentage >= 50) {
    console.log('⚠️ 立即迁移功能部分有效，但仍有部分视频使用第三方存储')
  } else {
    console.log('❌ 立即迁移功能可能存在问题，大部分视频仍使用第三方存储')
    console.log('建议检查veo3Service.ts中的迁移逻辑')
  }

  const immediatelyMigratedCount = migratedVideos.filter(v => v.video_url === v.r2_url).length
  if (immediatelyMigratedCount > 0) {
    console.log(`✅ 发现${immediatelyMigratedCount}个立即迁移成功的视频`)
  }
}

testImmediateMigration().catch(error => {
  console.error('🚨 测试过程中出错:', error)
})