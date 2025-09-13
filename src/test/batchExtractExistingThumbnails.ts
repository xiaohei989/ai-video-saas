/**
 * 批量为现有视频提取真实缩略图
 * 运行方式：在浏览器控制台中执行
 */

import { createClient } from '@supabase/supabase-js'
import { localThumbnailExtractor } from '../services/LocalThumbnailExtractor'
import { thumbnailCacheService } from '../services/ThumbnailCacheService'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface VideoToProcess {
  id: string
  title: string | null
  video_url: string
  user_id: string
}

async function batchExtractExistingThumbnails() {
  console.log('🚀 开始批量提取现有视频的真实缩略图...')

  try {
    // 1. 查询所有已完成但缺少真实缩略图的视频
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, video_url, user_id')
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50) // 限制处理数量，避免过载

    if (error) {
      throw new Error(`查询视频失败: ${error.message}`)
    }

    if (!videos || videos.length === 0) {
      console.log('✅ 没有找到需要处理的视频')
      return
    }

    console.log(`📊 找到 ${videos.length} 个需要处理的视频`)

    // 2. 统计信息
    const stats = {
      total: videos.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    }

    // 3. 处理每个视频
    for (const video of videos as VideoToProcess[]) {
      console.log(`\n🎬 处理视频: ${video.title || video.id}`)

      try {
        // 检查是否已有真实缩略图
        const hasRealThumbnail = await thumbnailCacheService.hasRealThumbnail(video.id)
        if (hasRealThumbnail) {
          console.log(`⏭️ 跳过，已有真实缩略图: ${video.id}`)
          stats.skipped++
          continue
        }

        // 提取缩略图
        const thumbnailSet = await localThumbnailExtractor.extractFirstSecondFrame(
          video.id,
          video.video_url,
          {
            frameTime: 1.0,
            quality: 0.8,
            maxWidth: 640,
            maxHeight: 360,
            enableBlur: true
          }
        )

        if (thumbnailSet) {
          // 保存到缓存
          const result = await thumbnailCacheService.extractAndCacheRealThumbnail(
            video.id,
            video.video_url
          )

          if (result) {
            console.log(`✅ 成功: ${video.id}`)
            stats.succeeded++
          } else {
            console.log(`❌ 缓存失败: ${video.id}`)
            stats.failed++
          }
        } else {
          console.log(`❌ 提取失败: ${video.id}`)
          stats.failed++
        }
      } catch (error) {
        console.error(`❌ 处理视频失败: ${video.id}`, error)
        stats.failed++
      }

      stats.processed++

      // 添加延迟避免过载
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 输出进度
      console.log(`📈 进度: ${stats.processed}/${stats.total} (${Math.round(stats.processed/stats.total*100)}%)`)
    }

    // 4. 输出最终统计
    console.log('\n🎉 批量提取完成！')
    console.log('📊 最终统计:')
    console.log(`   总计: ${stats.total}`)
    console.log(`   成功: ${stats.succeeded}`)
    console.log(`   失败: ${stats.failed}`)
    console.log(`   跳过: ${stats.skipped}`)
    console.log(`   成功率: ${Math.round(stats.succeeded/stats.total*100)}%`)

    // 5. 验证缓存状态
    console.log('\n🔍 验证缓存状态...')
    let cachedCount = 0
    for (const video of videos as VideoToProcess[]) {
      const hasCache = await thumbnailCacheService.hasRealThumbnail(video.id)
      if (hasCache) cachedCount++
    }
    console.log(`✅ 已缓存真实缩略图的视频: ${cachedCount}/${videos.length}`)

  } catch (error) {
    console.error('❌ 批量提取失败:', error)
  }
}

// 导出函数用于控制台调用
(window as any).batchExtractExistingThumbnails = batchExtractExistingThumbnails

console.log('📌 批量提取工具已加载')
console.log('💡 在控制台中运行: batchExtractExistingThumbnails()')

export { batchExtractExistingThumbnails }