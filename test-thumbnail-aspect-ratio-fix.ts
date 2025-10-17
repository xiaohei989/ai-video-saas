/**
 * 测试缩略图 aspectRatio 修复
 * 验证前端和后端是否正确传递和处理宽高比参数
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

const supabase = createClient(supabaseUrl, supabaseKey)

interface TestVideo {
  id: string
  title: string
  video_url: string | null
  thumbnail_url: string | null
  parameters: any
  aspectRatio?: '16:9' | '9:16'
}

async function testThumbnailAspectRatio() {
  console.log('========================================')
  console.log('🧪 测试缩略图 AspectRatio 修复')
  console.log('========================================\n')

  // 1. 查询一些16:9和9:16的视频
  console.log('📋 步骤1: 查询测试视频...')
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, video_url, thumbnail_url, parameters')
    .eq('status', 'completed')
    .not('video_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ 查询失败:', error)
    return
  }

  if (!videos || videos.length === 0) {
    console.log('⚠️  没有找到已完成的视频')
    return
  }

  // 分类视频
  const videos16_9: TestVideo[] = []
  const videos9_16: TestVideo[] = []

  videos.forEach(video => {
    const aspectRatio = video.parameters?.aspectRatio || '16:9'
    const testVideo: TestVideo = { ...video, aspectRatio }

    if (aspectRatio === '9:16') {
      videos9_16.push(testVideo)
    } else {
      videos16_9.push(testVideo)
    }
  })

  console.log(`✅ 找到 ${videos16_9.length} 个 16:9 视频`)
  console.log(`✅ 找到 ${videos9_16.length} 个 9:16 视频\n`)

  // 2. 显示视频信息
  console.log('📊 视频详情:')
  console.log('─'.repeat(80))

  if (videos16_9.length > 0) {
    console.log('\n🖼️  16:9 视频 (应生成 960x540 缩略图):')
    videos16_9.slice(0, 3).forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.title || v.id}`)
      console.log(`     - ID: ${v.id}`)
      console.log(`     - Video URL: ${v.video_url?.substring(0, 60)}...`)
      console.log(`     - Thumbnail: ${v.thumbnail_url ? '✅ 已有' : '❌ 缺失'}`)
      console.log(`     - Parameters aspectRatio: ${v.parameters?.aspectRatio || '未设置(默认16:9)'}`)
    })
  }

  if (videos9_16.length > 0) {
    console.log('\n📱 9:16 视频 (应生成 540x960 缩略图):')
    videos9_16.slice(0, 3).forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.title || v.id}`)
      console.log(`     - ID: ${v.id}`)
      console.log(`     - Video URL: ${v.video_url?.substring(0, 60)}...`)
      console.log(`     - Thumbnail: ${v.thumbnail_url ? '✅ 已有' : '❌ 缺失'}`)
      console.log(`     - Parameters aspectRatio: ${v.parameters?.aspectRatio || '未设置(默认16:9)'}`)
    })
  }

  // 3. 提示如何测试
  console.log('\n' + '─'.repeat(80))
  console.log('\n📝 测试步骤:')
  console.log('1. 执行数据库迁移脚本:')
  console.log('   npx supabase db push')
  console.log('   # 或手动执行: supabase/migrations/031_fix_thumbnail_trigger_with_aspect_ratio.sql')

  console.log('\n2. 前端测试 - 手动触发缩略图生成:')
  if (videos9_16.length > 0) {
    const testVideo = videos9_16[0]
    console.log(`   - 在浏览器控制台执行:`)
    console.log(`   - 导入: import { supabaseVideoService } from '@/services/supabaseVideoService'`)
    console.log(`   - 测试: await supabaseVideoService.regenerateThumbnail('${testVideo.id}')`)
    console.log(`   - 检查控制台日志中的 aspectRatio 输出`)
  }

  console.log('\n3. 后端测试 - 触发数据库触发器:')
  console.log('   - 创建一个新的 9:16 视频')
  console.log('   - 观察 Edge Function 日志: supabase functions logs auto-generate-thumbnail')
  console.log('   - 检查日志中是否包含 "宽高比: 9:16" 和 "dimensions: 540x960"')

  console.log('\n4. 验证缩略图尺寸:')
  console.log('   - 下载生成的缩略图')
  console.log('   - 使用图片工具检查实际尺寸')
  console.log('   - 16:9 视频应为 960x540')
  console.log('   - 9:16 视频应为 540x960')

  console.log('\n5. 检查CORS错误:')
  console.log('   - 打开浏览器控制台')
  console.log('   - 查看是否有详细的 [ThumbnailUpload] CORS诊断日志')
  console.log('   - 如果有 networkState: 3，说明是CORS配置问题')

  console.log('\n' + '='.repeat(80))
  console.log('✅ 测试准备完成！')
  console.log('='.repeat(80))
}

// 运行测试
testThumbnailAspectRatio().catch(console.error)
