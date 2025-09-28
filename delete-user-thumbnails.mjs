#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 缺少必要的环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function analyzeUserThumbnails() {
  console.log('🔍 分析用户视频缩略图存储情况...')

  // 查询有缩略图的用户视频
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, user_id, created_at')
    .not('thumbnail_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('❌ 查询失败:', error)
    return []
  }

  console.log('📹 有缩略图的视频概况:')
  console.log('总数:', videos?.length || 0)

  let r2Count = 0
  let base64Count = 0
  let externalCount = 0
  const userStats = new Map()

  for (const video of videos || []) {
    const url = video.thumbnail_url
    const userId = video.user_id
    
    if (!userStats.has(userId)) {
      userStats.set(userId, { r2: 0, base64: 0, external: 0, total: 0 })
    }
    const userStat = userStats.get(userId)
    userStat.total++
    
    if (url.startsWith('data:image')) {
      base64Count++
      userStat.base64++
      console.log('📊 Base64:', video.title, '(用户:', userId, ')')
    } else if (url.includes('cdn.veo3video.me') || url.includes('supabase')) {
      r2Count++
      userStat.r2++
      console.log('☁️ R2/CDN:', video.title, '(用户:', userId, ')')
    } else {
      externalCount++
      userStat.external++
      console.log('🌐 外部链接:', video.title, '(用户:', userId, ')')
    }
  }

  console.log('\n📊 总统计结果:')
  console.log('R2/CDN存储:', r2Count, '个')
  console.log('Base64缓存:', base64Count, '个') 
  console.log('外部链接:', externalCount, '个')
  console.log('总计:', r2Count + base64Count + externalCount, '个')

  console.log('\n👥 按用户统计:')
  for (const [userId, stats] of userStats.entries()) {
    console.log(`用户 ${userId.substring(0, 8)}...: R2=${stats.r2}, Base64=${stats.base64}, 外部=${stats.external}, 总计=${stats.total}`)
  }

  return videos || []
}

async function deleteUserThumbnails(userId, options = {}) {
  console.log(`\n🗑️ 开始删除用户 ${userId.substring(0, 8)}... 的缩略图...`)
  
  const { dryRun = false, thumbnailType = 'all' } = options
  
  // 查询该用户的所有有缩略图的视频
  let query = supabase
    .from('videos')
    .select('id, title, thumbnail_url, user_id')
    .eq('user_id', userId)
    .not('thumbnail_url', 'is', null)

  const { data: userVideos, error } = await query

  if (error) {
    console.error('❌ 查询用户视频失败:', error)
    return
  }

  if (!userVideos || userVideos.length === 0) {
    console.log('✅ 该用户没有需要删除的缩略图')
    return
  }

  console.log(`📋 找到 ${userVideos.length} 个有缩略图的视频`)

  let deletedCount = 0
  let skippedCount = 0

  for (const video of userVideos) {
    const url = video.thumbnail_url
    let shouldDelete = false
    let thumbnailTypeStr = ''

    // 判断缩略图类型
    if (thumbnailType === 'all') {
      shouldDelete = true
      if (url.startsWith('data:image')) {
        thumbnailTypeStr = 'Base64'
      } else if (url.includes('cdn.veo3video.me') || url.includes('supabase')) {
        thumbnailTypeStr = 'R2/CDN'
      } else {
        thumbnailTypeStr = '外部链接'
      }
    } else if (thumbnailType === 'base64' && url.startsWith('data:image')) {
      shouldDelete = true
      thumbnailTypeStr = 'Base64'
    } else if (thumbnailType === 'r2' && (url.includes('cdn.veo3video.me') || url.includes('supabase'))) {
      shouldDelete = true
      thumbnailTypeStr = 'R2/CDN'
    } else if (thumbnailType === 'external' && !url.startsWith('data:image') && !url.includes('cdn.veo3video.me') && !url.includes('supabase')) {
      shouldDelete = true
      thumbnailTypeStr = '外部链接'
    }

    if (!shouldDelete) {
      skippedCount++
      continue
    }

    if (dryRun) {
      console.log(`🔍 [DRY RUN] 将删除: ${video.title} (${thumbnailTypeStr})`)
      deletedCount++
    } else {
      console.log(`🗑️ 删除缩略图: ${video.title} (${thumbnailTypeStr})`)
      
      const { error: updateError } = await supabase
        .from('videos')
        .update({ 
          thumbnail_url: null
        })
        .eq('id', video.id)

      if (updateError) {
        console.error(`❌ 删除失败 ${video.id}:`, updateError)
      } else {
        deletedCount++
        console.log(`✅ 已删除: ${video.title}`)
      }
    }
  }

  console.log(`\n📊 删除结果:`)
  console.log(`删除数量: ${deletedCount}`)
  console.log(`跳过数量: ${skippedCount}`)
  console.log(`处理模式: ${dryRun ? 'DRY RUN (模拟)' : '实际删除'}`)
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node delete-user-thumbnails.mjs [选项]

选项:
  --analyze              仅分析缩略图分布，不删除
  --user <user_id>       指定要删除缩略图的用户ID
  --type <type>          缩略图类型: all|base64|r2|external (默认: all)
  --dry-run             模拟删除，不实际执行
  --help, -h            显示帮助信息

示例:
  node delete-user-thumbnails.mjs --analyze
  node delete-user-thumbnails.mjs --user abc123... --type base64 --dry-run
  node delete-user-thumbnails.mjs --user abc123... --type all
    `)
    return
  }

  // 分析模式
  if (args.includes('--analyze')) {
    await analyzeUserThumbnails()
    return
  }

  // 删除模式
  const userIndex = args.indexOf('--user')
  if (userIndex === -1 || userIndex + 1 >= args.length) {
    console.error('❌ 请指定用户ID: --user <user_id>')
    console.log('使用 --analyze 先分析用户情况')
    return
  }

  const userId = args[userIndex + 1]
  
  const typeIndex = args.indexOf('--type')
  const thumbnailType = typeIndex !== -1 && typeIndex + 1 < args.length ? args[typeIndex + 1] : 'all'
  
  const dryRun = args.includes('--dry-run')

  if (!['all', 'base64', 'r2', 'external'].includes(thumbnailType)) {
    console.error('❌ 无效的缩略图类型，支持: all, base64, r2, external')
    return
  }

  await deleteUserThumbnails(userId, { dryRun, thumbnailType })
}

main().catch(console.error)