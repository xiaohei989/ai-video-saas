#!/usr/bin/env node

/**
 * 删除损坏的缩略图文件
 * 使用Service Role Key直接调用delete-r2-file Edge Function
 */

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { config } from 'dotenv'

// 读取环境变量
config()

async function deleteCorruptedThumbnail() {
  const fileUrl = "https://cdn.veo3video.me/thumbnails/02870e46-5fb0-4392-81fb-dcc2c1928b58.webp"
  const videoId = "02870e46-5fb0-4392-81fb-dcc2c1928b58"

  // 获取必要的环境变量
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ 缺少必要的环境变量:')
    console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗')
    process.exit(1)
  }

  console.log('🚀 开始删除损坏的缩略图文件...')
  console.log('📁 文件URL:', fileUrl)
  console.log('🎬 视频ID:', videoId)
  console.log('')

  try {
    // 调用delete-r2-file Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/delete-r2-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        fileUrl: fileUrl,
        videoId: videoId,
        fileType: 'thumbnail',
        force: true  // 强制删除，因为数据库中没有此视频记录
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ 删除失败:', result)
      process.exit(1)
    }

    console.log('✅ 删除成功!')
    console.log('📊 响应结果:', JSON.stringify(result, null, 2))

    // 如果删除成功，清理Cloudflare CDN缓存
    if (result.success) {
      console.log('')
      console.log('🧹 正在清理Cloudflare CDN缓存...')

      // spawn 已在文件顶部导入

      return new Promise((resolve, reject) => {
        const purgeProcess = spawn('node', [
          'scripts/purge-cloudflare-cache.js',
          fileUrl
        ], {
          env: {
            ...process.env,
            CF_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
            CF_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID
          },
          stdio: 'inherit'
        })

        purgeProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ CDN缓存清理完成!')
            console.log('')
            console.log('🎉 所有操作完成! 损坏的缩略图文件已被删除并清理缓存')
            resolve()
          } else {
            console.error('❌ CDN缓存清理失败，退出码:', code)
            reject(new Error(`CDN purge failed with code ${code}`))
          }
        })

        purgeProcess.on('error', (error) => {
          console.error('❌ CDN缓存清理出错:', error)
          reject(error)
        })
      })
    }

  } catch (error) {
    console.error('❌ 删除过程中出错:', error)
    process.exit(1)
  }
}

// 执行删除操作
deleteCorruptedThumbnail().catch(console.error)