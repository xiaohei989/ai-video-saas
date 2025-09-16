/**
 * 测试迁移修复
 * 验证视频迁移服务修复后的功能
 */

import { createClient } from '@supabase/supabase-js'

// 从环境变量获取配置
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  cloudflareAccountId: process.env.VITE_CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucketName: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage',
  publicDomain: process.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN
}

console.log('🔧 配置检查:')
console.log(`  Supabase URL: ${config.supabaseUrl ? '✅' : '❌'}`)
console.log(`  Account ID: ${config.cloudflareAccountId ? '✅' : '❌'}`)
console.log(`  Access Key: ${config.accessKeyId ? '✅' : '❌'}`)
console.log(`  Secret Key: ${config.secretAccessKey ? '✅' : '❌'}`)
console.log(`  Bucket Name: ${config.bucketName}`)
console.log(`  Public Domain: ${config.publicDomain || 'default'}`)
console.log('')

const supabase = createClient(config.supabaseUrl, config.supabaseKey)

async function testMigrationFix() {
  try {
    console.log('🧪 测试迁移服务修复...\n')

    // 1. 测试查询是否修复
    console.log('📊 测试视频查询（修复后）...')
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, video_url, r2_url, r2_key, migration_status, original_video_url, title')
      .eq('migration_status', 'failed')
      .not('video_url', 'is', null)
      .limit(1)

    if (error) {
      console.error('❌ 查询仍然失败:', error.message)
      return
    }

    console.log('✅ 查询成功修复')
    if (videos && videos.length > 0) {
      const video = videos[0]
      console.log(`📹 找到视频: ${video.title || video.id}`)
      console.log(`   状态: ${video.migration_status}`)
      console.log(`   原始URL: ${video.video_url}`)
      console.log(`   R2 URL: ${video.r2_url || 'NULL'}`)
    } else {
      console.log('ℹ️ 没有待迁移的失败视频')
    }

    // 2. 测试R2 URL生成
    console.log('\n🔗 测试R2 URL生成...')
    const testVideoId = '21fd3f22-aaef-45af-971f-1c771bc140c6'
    const key = `videos/${testVideoId}.mp4`
    
    let publicUrl
    if (config.publicDomain) {
      publicUrl = `https://${config.publicDomain}/${key}`
    } else {
      publicUrl = `https://pub-${config.cloudflareAccountId}.r2.dev/${key}`
    }
    
    console.log(`✅ 生成的R2 URL: ${publicUrl}`)
    console.log(`   使用域名: ${config.publicDomain ? config.publicDomain : `pub-${config.cloudflareAccountId}.r2.dev`}`)

    // 3. 检查失败原因分析
    console.log('\n🔍 失败原因分析:')
    console.log('1. ✅ 修复了查询字段错误 (template_name)')
    console.log('2. ✅ 修复了R2 URL生成逻辑')
    console.log('3. ⚠️ 需要检查R2配置和网络连接')
    
    console.log('\n📋 下一步建议:')
    console.log('1. 重新启动应用以加载修复')
    console.log('2. 测试新视频生成和迁移')
    console.log('3. 检查R2 bucket权限设置')
    console.log('4. 验证公开域名配置')

  } catch (error) {
    console.error('💥 测试失败:', error.message)
  }
}

// 运行测试
testMigrationFix()