/**
 * 修复R2视频URL - 更新为正确的公开域名
 */

import { createClient } from '@supabase/supabase-js'

const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
}

const supabase = createClient(config.supabaseUrl, config.supabaseKey)

// 旧域名和新域名映射
const OLD_DOMAIN = 'https://pub-c6fc8bcf3bba37f2611b6f3d7aad25b9.r2.dev'
const NEW_DOMAIN = 'https://pub-e0e4075257f3403f990bacc5d3282fc5.r2.dev'

async function fixR2URLs() {
  try {
    console.log('🔧 开始修复R2视频URL...\n')

    // 1. 查找所有使用旧域名的视频
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, r2_url, r2_key, title')
      .like('r2_url', `${OLD_DOMAIN}%`)

    if (error) {
      throw new Error(`查询失败: ${error.message}`)
    }

    if (!videos || videos.length === 0) {
      console.log('✅ 没有需要修复的视频URL')
      return
    }

    console.log(`📊 找到 ${videos.length} 个需要修复的视频URL:`)
    videos.forEach(video => {
      console.log(`  - ${video.title || video.id}`)
      console.log(`    旧URL: ${video.r2_url}`)
      const newUrl = video.r2_url.replace(OLD_DOMAIN, NEW_DOMAIN)
      console.log(`    新URL: ${newUrl}`)
      console.log('')
    })

    // 2. 批量更新URL
    console.log('⚡ 开始批量更新URL...')
    let successCount = 0
    let failCount = 0

    for (const video of videos) {
      const newUrl = video.r2_url.replace(OLD_DOMAIN, NEW_DOMAIN)
      
      const { error: updateError } = await supabase
        .from('videos')
        .update({ r2_url: newUrl })
        .eq('id', video.id)

      if (updateError) {
        console.error(`❌ 更新失败 ${video.id}: ${updateError.message}`)
        failCount++
      } else {
        console.log(`✅ 更新成功: ${video.title || video.id}`)
        successCount++
      }
    }

    console.log(`\n📈 更新完成:`)
    console.log(`  成功: ${successCount}`)
    console.log(`  失败: ${failCount}`)

    // 3. 验证更新结果
    console.log('\n🔍 验证更新结果...')
    const { data: updatedVideos, error: verifyError } = await supabase
      .from('videos')
      .select('id, r2_url, title')
      .like('r2_url', `${NEW_DOMAIN}%`)

    if (verifyError) {
      console.error('验证查询失败:', verifyError.message)
    } else {
      console.log(`✅ 验证完成: ${updatedVideos.length} 个视频使用新域名`)
    }

  } catch (error) {
    console.error('💥 修复过程异常:', error.message)
  }
}

// 运行修复
fixR2URLs()