/**
 * 测试Cloudflare R2视频迁移功能
 * 这个脚本会测试R2配置、视频迁移和Media Fragments
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'
)

async function testR2Migration() {
  console.log('🧪 开始测试Cloudflare R2迁移功能...\n')

  try {
    // 1. 检查数据库字段
    console.log('📊 检查数据库字段...')
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, r2_key, migration_status, title')
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .limit(5)

    if (videosError) {
      console.error('❌ 数据库查询失败:', videosError.message)
      return
    }

    if (!videos || videos.length === 0) {
      console.log('⚠️  没有找到已完成的视频')
      return
    }

    console.log(`✅ 找到 ${videos.length} 个视频记录`)
    console.log('前5个视频状态:')
    videos.forEach(video => {
      console.log(`  - ${video.id}: ${video.title || '无标题'}`)
      console.log(`    原始URL: ${video.video_url ? '✅' : '❌'}`)
      console.log(`    R2 URL: ${video.r2_url ? '✅' : '❌'}`)
      console.log(`    迁移状态: ${video.migration_status || 'pending'}`)
      console.log('')
    })

    // 2. 检查R2配置
    console.log('🔧 检查R2配置...')
    const r2Config = {
      hasAccountId: !!(process.env.VITE_CLOUDFLARE_ACCOUNT_ID),
      hasAccessKey: !!(process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID),
      hasSecretKey: !!(process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY),
      bucketName: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage',
      publicDomain: process.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN
    }

    console.log('R2配置状态:')
    console.log(`  Account ID: ${r2Config.hasAccountId ? '✅' : '❌ 缺失'}`)
    console.log(`  Access Key: ${r2Config.hasAccessKey ? '✅' : '❌ 缺失'}`)
    console.log(`  Secret Key: ${r2Config.hasSecretKey ? '✅' : '❌ 缺失'}`)
    console.log(`  Bucket Name: ${r2Config.bucketName}`)
    console.log(`  Public Domain: ${r2Config.publicDomain || '未配置（使用默认域名）'}`)

    if (!r2Config.hasAccountId || !r2Config.hasAccessKey || !r2Config.hasSecretKey) {
      console.log('\n⚠️  R2配置不完整，需要设置以下环境变量:')
      console.log('  - VITE_CLOUDFLARE_ACCOUNT_ID')
      console.log('  - VITE_CLOUDFLARE_R2_ACCESS_KEY_ID')
      console.log('  - VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY')
      console.log('  - VITE_CLOUDFLARE_R2_BUCKET_NAME (可选)')
      console.log('  - VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN (可选)')
      console.log('\n💡 配置完成后，R2迁移功能将自动生效')
    } else {
      console.log('✅ R2配置完整，可以进行迁移')
    }

    // 3. 生成迁移统计
    const migrationStats = videos.reduce((stats, video) => {
      const status = video.migration_status || 'pending'
      stats[status] = (stats[status] || 0) + 1
      return stats
    }, {})

    console.log('\n📈 迁移状态统计:')
    Object.entries(migrationStats).forEach(([status, count]) => {
      const statusEmoji = {
        pending: '⏳',
        downloading: '⬇️',
        uploading: '⬆️',
        completed: '✅',
        failed: '❌'
      }
      console.log(`  ${statusEmoji[status] || '❓'} ${status}: ${count}`)
    })

    // 4. Media Fragments测试URL生成
    console.log('\n🎬 Media Fragments测试URL:')
    const testVideo = videos.find(v => v.r2_url) || videos[0]
    
    if (testVideo.r2_url) {
      console.log(`✅ R2视频 (支持Media Fragments):`)
      console.log(`  基础URL: ${testVideo.r2_url}`)
      console.log(`  2秒预览: ${testVideo.r2_url}#t=2.0`)
      console.log(`  5秒预览: ${testVideo.r2_url}#t=5.0`)
    } else {
      console.log(`⏳ 原始视频 (可能不支持Media Fragments):`)
      console.log(`  基础URL: ${testVideo.video_url}`)
      console.log(`  建议进行R2迁移以获得更好的兼容性`)
    }

    // 5. 下一步建议
    console.log('\n🚀 下一步操作建议:')
    
    if (!r2Config.hasAccountId || !r2Config.hasAccessKey || !r2Config.hasSecretKey) {
      console.log('1. 配置Cloudflare R2环境变量')
      console.log('2. 创建R2 bucket')
      console.log('3. 运行迁移测试')
    } else {
      console.log('1. 在iPhone Chrome中测试Media Fragments:')
      console.log(`   http://192.168.122.104:3001/templates`)
      console.log('2. 运行视频迁移 (如果需要):')
      console.log('   // videoMigrationService.migrateBatch(5)')
      console.log('3. 查看VideoCard中的R2标识')
    }

  } catch (error) {
    console.error('💥 测试过程中出现异常:', error)
  }
}

// 运行测试
testR2Migration()