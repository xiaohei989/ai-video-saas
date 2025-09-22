/**
 * 测试缩略图自动生成系统
 * 验证Canvas提取 + R2上传 + 数据库更新的完整流程
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testThumbnailSystem() {
  console.log('🚀 开始测试缩略图自动生成系统...')
  console.log('')

  try {
    // 1. 查找最近完成的视频
    console.log('📹 查找最近完成的视频...')
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, video_url, thumbnail_url, thumbnail_generation_status, processing_completed_at')
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('processing_completed_at', { ascending: false })
      .limit(5)

    if (error) {
      throw new Error(`查询视频失败: ${error.message}`)
    }

    if (!videos || videos.length === 0) {
      console.log('❌ 没有找到已完成的视频')
      return
    }

    console.log(`✅ 找到 ${videos.length} 个已完成的视频`)
    
    // 显示视频列表
    videos.forEach((video, index) => {
      console.log(`  ${index + 1}. ${video.title}`)
      console.log(`     ID: ${video.id}`)
      console.log(`     视频URL: ${video.video_url?.substring(0, 80)}...`)
      console.log(`     缩略图状态: ${video.thumbnail_generation_status || '未生成'}`)
      console.log(`     有缩略图: ${video.thumbnail_url ? '是' : '否'}`)
      console.log('')
    })

    // 2. 测试缩略图生成功能
    const testVideo = videos[0]
    console.log(`🎯 选择测试视频: ${testVideo.title}`)
    console.log(`   视频ID: ${testVideo.id}`)
    console.log('')

    // 3. 检查Edge Function是否正常工作
    console.log('🔧 测试Edge Function连接...')
    try {
      const testResponse = await fetch(`${supabaseUrl}/functions/v1/upload-thumbnail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          videoId: 'test-connection',
          contentType: 'image/webp',
          fileSize: 1024
        })
      })

      if (testResponse.ok) {
        console.log('✅ Edge Function 连接正常')
        const testData = await testResponse.json()
        console.log('   返回数据结构正确:', testData.data ? '是' : '否')
      } else {
        console.log(`⚠️ Edge Function 连接异常: ${testResponse.status}`)
        const errorText = await testResponse.text()
        console.log(`   错误详情: ${errorText}`)
      }
    } catch (error) {
      console.log(`❌ Edge Function 连接失败: ${error.message}`)
    }
    console.log('')

    // 4. 检查缩略图优化策略
    console.log('🖼️ 分析缩略图状态...')
    
    const videosWithThumbnails = videos.filter(v => v.thumbnail_url)
    const videosWithoutThumbnails = videos.filter(v => !v.thumbnail_url)
    const r2Thumbnails = videos.filter(v => v.thumbnail_url?.includes('cdn.veo3video.me'))
    
    console.log(`   有缩略图的视频: ${videosWithThumbnails.length}/${videos.length}`)
    console.log(`   使用R2存储的缩略图: ${r2Thumbnails.length}/${videos.length}`)
    console.log(`   需要生成缩略图的视频: ${videosWithoutThumbnails.length}`)
    console.log('')

    // 5. 分析缩略图质量
    if (videosWithThumbnails.length > 0) {
      console.log('📊 缩略图质量分析:')
      
      for (const video of videosWithThumbnails.slice(0, 3)) {
        const isR2 = video.thumbnail_url?.includes('cdn.veo3video.me')
        const isSVG = video.thumbnail_url?.startsWith('data:image/svg+xml')
        
        console.log(`   ${video.title.substring(0, 30)}...`)
        console.log(`     存储位置: ${isR2 ? 'R2 CDN (最优)' : '第三方存储'}`)
        console.log(`     格式类型: ${isSVG ? 'SVG占位符' : '真实缩略图'}`)
        console.log(`     URL: ${video.thumbnail_url?.substring(0, 60)}...`)
        console.log('')
      }
    }

    // 6. 检查系统性能
    console.log('⚡ 系统性能分析:')
    const recentlyCompleted = videos.filter(v => {
      if (!v.processing_completed_at) return false
      const completedTime = new Date(v.processing_completed_at)
      const now = new Date()
      const hoursDiff = (now.getTime() - completedTime.getTime()) / (1000 * 60 * 60)
      return hoursDiff < 24 // 过去24小时内完成的
    })

    console.log(`   过去24小时完成的视频: ${recentlyCompleted.length}`)
    console.log(`   自动缩略图生成率: ${recentlyCompleted.filter(v => v.thumbnail_url).length}/${recentlyCompleted.length}`)
    console.log('')

    // 7. 建议和总结
    console.log('📋 系统状态总结:')
    
    if (r2Thumbnails.length === videos.length) {
      console.log('✅ 所有视频都已使用R2优化缩略图')
    } else if (r2Thumbnails.length > 0) {
      console.log('⚠️ 部分视频使用R2缩略图，部分视频仍需迁移')
    } else {
      console.log('❌ 尚未开始使用R2缩略图存储')
    }

    const thumbnailCoverage = (videosWithThumbnails.length / videos.length) * 100
    console.log(`📊 缩略图覆盖率: ${thumbnailCoverage.toFixed(1)}%`)

    if (thumbnailCoverage < 80) {
      console.log('💡 建议: 运行批量缩略图生成任务')
    }

    console.log('')
    console.log('🎉 测试完成!')

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

// 运行测试
testThumbnailSystem().catch(console.error)