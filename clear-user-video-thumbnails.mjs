#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

console.log('🗑️ 清理用户视频缩略图 (保留模板缩略图)')
console.log('=' .repeat(50))

// 先统计需要清理的用户视频缩略图
const { data: userVideos, error: queryError } = await supabase
  .from('videos')
  .select('id, title, thumbnail_url, user_id, created_at')
  .not('thumbnail_url', 'is', null)
  .not('user_id', 'is', null)  // 确保是用户视频，不是模板
  .order('created_at', { ascending: false })

if (queryError) {
  console.error('❌ 查询用户视频失败:', queryError)
  process.exit(1)
}

const totalUserVideos = userVideos?.length || 0
console.log(`📊 发现 ${totalUserVideos} 个用户视频有缩略图`)

if (totalUserVideos === 0) {
  console.log('✅ 没有需要清理的用户视频缩略图')
  process.exit(0)
}

console.log()
console.log('📝 用户视频缩略图详情:')
for (const video of userVideos) {
  const createdAt = new Date(video.created_at).toLocaleString('zh-CN')
  const isR2 = video.thumbnail_url.includes('cdn.veo3video.me')
  const isBase64 = video.thumbnail_url.startsWith('data:image')
  
  console.log(`  - ${video.title}`)
  console.log(`    ID: ${video.id}`)
  console.log(`    用户: ${video.user_id}`)
  console.log(`    类型: ${isR2 ? '☁️ R2 CDN' : isBase64 ? '📊 Base64' : '🌐 其他'}`)
  console.log(`    创建: ${createdAt}`)
  console.log()
}

console.log('⚠️ 即将清理所有用户视频缩略图，系统将重新生成专业级质量缩略图')
console.log('🔒 模板缩略图不受影响')
console.log()

// 执行清理操作
console.log('🚀 开始清理用户视频缩略图...')

const { error: updateError } = await supabase
  .from('videos')
  .update({ 
    thumbnail_url: null,
    thumbnail_generated_at: null,
    updated_at: new Date().toISOString()
  })
  .not('thumbnail_url', 'is', null)
  .not('user_id', 'is', null)  // 只清理用户视频

if (updateError) {
  console.error('❌ 清理失败:', updateError)
  process.exit(1)
}

console.log(`✅ 成功清理 ${totalUserVideos} 个用户视频缩略图`)
console.log()
console.log('🎉 清理完成！')
console.log('💡 下次用户访问视频时，系统将自动使用新的专业级配置生成高质量缩略图:')
console.log('   - 分辨率: 960×540 (专业级)')
console.log('   - 质量: 0.95 (极致质量)')
console.log('   - 格式: WebP优先，JPEG回退')
console.log()
console.log('🔒 模板缩略图保持不变，不受影响')