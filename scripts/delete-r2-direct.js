#!/usr/bin/env node

/**
 * 直接使用Cloudflare R2 API删除损坏的缩略图文件
 */

import { config } from 'dotenv'

// 读取环境变量
config()

async function deleteFileFromR2() {
  const fileKey = "thumbnails/02870e46-5fb0-4392-81fb-dcc2c1928b58.webp"
  const fileUrl = "https://cdn.veo3video.me/thumbnails/02870e46-5fb0-4392-81fb-dcc2c1928b58.webp"

  // 获取R2配置
  const accountId = process.env.VITE_CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID
  const accessKeyId = process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY
  const bucketName = process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME

  console.log('🚀 开始直接删除R2文件...')
  console.log('📁 文件Key:', fileKey)
  console.log('🪣 存储桶:', bucketName)
  console.log('')

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error('❌ 缺少R2配置:')
    console.error('   CLOUDFLARE_ACCOUNT_ID:', accountId ? '✓' : '✗')
    console.error('   R2_ACCESS_KEY_ID:', accessKeyId ? '✓' : '✗')
    console.error('   R2_SECRET_ACCESS_KEY:', secretAccessKey ? '✓' : '✗')
    console.error('   R2_BUCKET_NAME:', bucketName ? '✓' : '✗')
    process.exit(1)
  }

  try {
    // 尝试使用S3兼容API删除文件
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${fileKey}`

    console.log('🎯 删除端点:', endpoint)

    // 先尝试简单的DELETE请求
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessKeyId}`,
        'X-Auth-Key': accessKeyId,
        'Content-Type': 'application/json'
      }
    })

    console.log('📡 响应状态:', response.status, response.statusText)

    if (response.ok || response.status === 404) {
      console.log('✅ 文件删除成功 (或文件不存在)')

      // 清理CDN缓存
      console.log('')
      console.log('🧹 清理CDN缓存...')

      // 执行CDN缓存清理
      const { spawn } = await import('child_process')

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
            console.log('🎉 操作完成! 文件已删除并清理缓存')
            console.log('')
            console.log('📋 建议接下来执行以下操作:')
            console.log('   1. 重新生成正确的缩略图')
            console.log('   2. 验证新缩略图的文件大小是否正常')
            console.log('   3. 清理浏览器本地缓存 (localStorage + IndexedDB)')
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

    } else {
      const responseText = await response.text()
      console.error('❌ 删除失败:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      })

      // 尝试另一种端点格式
      console.log('')
      console.log('🔄 尝试备用删除方法...')

      const altEndpoint = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${fileKey}`
      console.log('🎯 备用端点:', altEndpoint)

      const altResponse = await fetch(altEndpoint, {
        method: 'DELETE',
        headers: {
          'X-Custom-Auth-Key': accessKeyId,
        }
      })

      console.log('📡 备用响应状态:', altResponse.status, altResponse.statusText)

      if (altResponse.ok || altResponse.status === 404) {
        console.log('✅ 使用备用方法删除成功!')
      } else {
        const altResponseText = await altResponse.text()
        console.error('❌ 备用方法也失败了:', {
          status: altResponse.status,
          statusText: altResponse.statusText,
          body: altResponseText
        })

        console.log('')
        console.log('💡 可能的解决方案:')
        console.log('   1. 检查R2访问密钥权限')
        console.log('   2. 使用Cloudflare Dashboard手动删除')
        console.log('   3. 使用aws-cli工具删除')

        process.exit(1)
      }
    }

  } catch (error) {
    console.error('❌ 删除过程中出错:', error)
    process.exit(1)
  }
}

// 执行删除操作
deleteFileFromR2().catch(console.error)