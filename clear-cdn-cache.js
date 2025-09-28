/**
 * CDN缓存清除工具
 * 用于清除低质量缩略图的CDN缓存
 */

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4'

// Cloudflare配置（需要从环境变量获取）
const CLOUDFLARE_CONFIG = {
  zoneId: process.env.CLOUDFLARE_ZONE_ID || 'your-zone-id',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || 'your-api-token',
  email: process.env.CLOUDFLARE_EMAIL || 'your-email@example.com'
}

/**
 * 清除单个文件的CDN缓存
 */
async function purgeFileCache(fileUrl) {
  console.log(`🧹 清除CDN缓存: ${fileUrl}`)
  
  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_CONFIG.zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_CONFIG.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [fileUrl]
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`✅ 缓存清除成功: ${fileUrl}`)
      return true
    } else {
      console.error(`❌ 缓存清除失败:`, result.errors)
      return false
    }
  } catch (error) {
    console.error(`❌ API调用失败:`, error)
    return false
  }
}

/**
 * 批量清除缩略图缓存
 */
async function purgeThumbnailCaches(videoIds) {
  console.log(`🚀 开始批量清除 ${videoIds.length} 个缩略图缓存...`)
  
  const results = []
  
  for (const videoId of videoIds) {
    const fileUrl = `https://cdn.veo3video.me/thumbnails/${videoId}.webp`
    const success = await purgeFileCache(fileUrl)
    results.push({ videoId, fileUrl, success })
    
    // 避免API限制，稍微延迟
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  const successful = results.filter(r => r.success).length
  console.log(`📊 清除完成: ${successful}/${videoIds.length} 成功`)
  
  return results
}

/**
 * 清除所有缩略图缓存（危险操作，慎用）
 */
async function purgeAllThumbnails() {
  console.log(`⚠️  清除所有缩略图缓存...`)
  
  try {
    const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_CONFIG.zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_CONFIG.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefixes: [
          'https://cdn.veo3video.me/thumbnails/'
        ]
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`✅ 所有缩略图缓存清除成功`)
      return true
    } else {
      console.error(`❌ 缓存清除失败:`, result.errors)
      return false
    }
  } catch (error) {
    console.error(`❌ API调用失败:`, error)
    return false
  }
}

// 检查是否提供了必要的环境变量
function checkConfig() {
  const missing = []
  
  if (!process.env.CLOUDFLARE_ZONE_ID) missing.push('CLOUDFLARE_ZONE_ID')
  if (!process.env.CLOUDFLARE_API_TOKEN) missing.push('CLOUDFLARE_API_TOKEN')
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的环境变量:')
    missing.forEach(env => console.error(`   - ${env}`))
    console.log('\n📋 请设置以下环境变量:')
    console.log('   export CLOUDFLARE_ZONE_ID="your-zone-id"')
    console.log('   export CLOUDFLARE_API_TOKEN="your-api-token"')
    return false
  }
  
  return true
}

// 主函数
async function main() {
  if (!checkConfig()) {
    process.exit(1)
  }
  
  const args = process.argv.slice(2)
  
  if (args[0] === 'single' && args[1]) {
    // 清除单个文件缓存
    const videoId = args[1]
    const fileUrl = `https://cdn.veo3video.me/thumbnails/${videoId}.webp`
    await purgeFileCache(fileUrl)
  } else if (args[0] === 'batch' && args[1]) {
    // 批量清除缓存
    const videoIds = args[1].split(',')
    await purgeThumbnailCaches(videoIds)
  } else if (args[0] === 'all') {
    // 清除所有缩略图缓存
    console.log('⚠️  这将清除所有缩略图缓存，确认吗？ (输入 yes 确认)')
    const confirm = await new Promise(resolve => {
      process.stdin.resume()
      process.stdin.on('data', data => {
        resolve(data.toString().trim().toLowerCase())
      })
    })
    
    if (confirm === 'yes') {
      await purgeAllThumbnails()
    } else {
      console.log('已取消操作')
    }
  } else {
    console.log('📋 CDN缓存清除工具使用说明:')
    console.log('   node clear-cdn-cache.js single <video-id>        # 清除单个文件缓存')
    console.log('   node clear-cdn-cache.js batch <id1,id2,id3>     # 批量清除缓存')
    console.log('   node clear-cdn-cache.js all                     # 清除所有缩略图缓存')
    console.log('')
    console.log('📋 示例:')
    console.log('   node clear-cdn-cache.js single 2786516b-b122-48ef-adae-16a5757dd10e')
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = {
  purgeFileCache,
  purgeThumbnailCaches,
  purgeAllThumbnails
}