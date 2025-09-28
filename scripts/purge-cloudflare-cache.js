#!/usr/bin/env node
/**
 * Cloudflare CDN 精确清缓存脚本（单文件 Purge）
 * 使用前请设置以下环境变量：
 *   - CF_API_TOKEN: 具备 Zone.Cache Purge 权限的 API Token
 *   - CF_ZONE_ID: 目标站点的 Zone ID（cdn.veo3video.me 对应的 Zone）
 *
 * 用法示例：
 *   CF_API_TOKEN=xxxx CF_ZONE_ID=yyyy node scripts/purge-cloudflare-cache.js \
 *     https://cdn.veo3video.me/thumbnails/2786516b-b122-48ef-adae-16a5757dd10e.webp
 */

import https from 'https'

const CF_API_TOKEN = process.env.CF_API_TOKEN
const CF_ZONE_ID = process.env.CF_ZONE_ID
const files = process.argv.slice(2)

if (!CF_API_TOKEN || !CF_ZONE_ID) {
  console.error('❌ 缺少环境变量 CF_API_TOKEN 或 CF_ZONE_ID')
  process.exit(1)
}

if (!files.length) {
  console.error('❌ 请提供要清除缓存的完整文件URL，例如：')
  console.error('   node scripts/purge-cloudflare-cache.js https://cdn.veo3video.me/thumbnails/<id>.webp')
  process.exit(1)
}

function purge(files) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ files })
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${CF_ZONE_ID}/purge_cache`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.success) {
            console.log('✅ Purge 成功:', files)
            resolve(json)
          } else {
            console.error('❌ Purge 失败:', json)
            reject(new Error('Purge failed'))
          }
        } catch (e) {
          console.error('❌ 解析响应失败:', data)
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

(async () => {
  try {
    console.log('🧹 正在清理 Cloudflare 缓存:', files)
    await purge(files)
    console.log('🎉 完成')
  } catch (e) {
    console.error('❌ 执行失败:', e.message)
    process.exit(1)
  }
})()

