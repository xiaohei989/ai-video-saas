#!/usr/bin/env node
// 检查数据库最新视频的缩略图生成情况（高清 + 模糊）
// 使用: node scripts/check-latest-video.js [limit]

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('缺少环境变量：VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const limit = parseInt(process.argv[2] || '5', 10)

async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, status: 0, error: e?.message }
  }
}

function guessCdnUrl(videoId, variant) {
  // variant: 'v2' | 'blur' | 'plain'
  const base = process.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN
    ? `https://${process.env.VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN}`
    : 'https://cdn.veo3video.me'
  if (variant === 'blur') {
    return `${base}/thumbnails/${videoId}-blur.webp`
  }
  if (variant === 'v2') {
    return `${base}/thumbnails/${videoId}-v2.webp`
  }
  return `${base}/thumbnails/${videoId}.webp`
}

async function main() {
  console.log('🔎 查询最近视频（按 created_at desc）...')
  const { data, error } = await supabase
    .from('videos')
    .select('id, created_at, status, video_url, thumbnail_url, thumbnail_blur_url')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('查询失败:', error.message)
    process.exit(1)
  }

  if (!data?.length) {
    console.log('没有查询到视频记录')
    process.exit(0)
  }

  // 取第一条记录（或第一条 completed）
  const row = data.find(r => r.status === 'completed') || data[0]
  console.log('\n🆔 视频ID:', row.id)
  console.log('⏱️ 创建时间:', row.created_at)
  console.log('📌 状态:', row.status)
  console.log('🎬 视频URL:', row.video_url)
  console.log('🖼️ 高清缩略图 DB:', row.thumbnail_url || '(无)')
  console.log('🖼️ 模糊缩略图 DB:', row.thumbnail_blur_url || '(无)')

  // 检测高清缩略图可访问
  const candidatesFull = [
    row.thumbnail_url,
    guessCdnUrl(row.id, 'v2'),
    guessCdnUrl(row.id, 'plain')
  ].filter(Boolean)

  let fullCheck = null
  for (const url of candidatesFull) {
    const r = await head(url)
    if (r.ok) { fullCheck = { url, ...r }; break }
  }

  // 检测模糊缩略图可访问
  const candidatesBlur = [
    row.thumbnail_blur_url,
    guessCdnUrl(row.id, 'blur')
  ].filter(Boolean)

  let blurCheck = null
  for (const url of candidatesBlur) {
    const r = await head(url)
    if (r.ok) { blurCheck = { url, ...r }; break }
  }

  console.log('\n✅ 高清缩略图检测:')
  if (fullCheck) {
    console.log('  URL:', fullCheck.url)
    console.log('  状态:', fullCheck.status)
  } else {
    console.log('  未找到可访问的高清缩略图候选')
  }

  console.log('\n✅ 模糊缩略图检测:')
  if (blurCheck) {
    console.log('  URL:', blurCheck.url)
    console.log('  状态:', blurCheck.status)
  } else {
    console.log('  未找到可访问的模糊缩略图候选')
  }
}

main().catch(err => {
  console.error('执行失败:', err)
  process.exit(1)
})

