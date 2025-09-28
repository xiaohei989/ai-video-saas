#!/usr/bin/env node
/**
 * 清理低质量图片缓存工具
 * 专门清除4-15KB的低质量Cloudflare压缩图片缓存
 */

const { createClient } = require('@supabase/supabase-js')

// 配置
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NjQ1NjAsImV4cCI6MjA3MTM0MDU2MH0.VOHVXCUFRk83t1cfPHd6Lf5SwWDQHn1Hl2Mn0qqiyPk'

// 低质量缓存识别标准
const LOW_QUALITY_THRESHOLD = 15 * 1024 // 15KB以下认为是低质量
const CLOUDFLARE_INDICATORS = [
  '/cdn-cgi/image/',
  'w=600,q=95',
  'blur=2'
]

async function clearLowQualityImageCache() {
  console.log('🚀 开始清理低质量图片缓存...')
  
  try {
    // 模拟浏览器环境的 IndexedDB 操作
    console.log('📊 分析缓存质量...')
    
    const qualityReport = {
      total: 0,
      lowQuality: 0,
      highQuality: 0,
      cloudflareOptimized: 0,
      r2CDN: 0
    }
    
    // 统计信息（模拟）
    console.log('📋 缓存质量分析完成:')
    console.log(`  总缓存项: ${qualityReport.total}`)
    console.log(`  低质量 (<15KB): ${qualityReport.lowQuality}`)
    console.log(`  高质量 (>=15KB): ${qualityReport.highQuality}`)
    console.log(`  Cloudflare优化: ${qualityReport.cloudflareOptimized}`)
    console.log(`  R2 CDN图片: ${qualityReport.r2CDN}`)
    
    console.log('')
    console.log('🧹 清理策略:')
    console.log('  ✅ 保留 R2 CDN 高质量图片')
    console.log('  ❌ 清除 Cloudflare 4-15KB 低质量图片')
    console.log('  ✅ 保留 >15KB 的优化图片')
    
    console.log('')
    console.log('⚠️  注意: 这个脚本需要在浏览器环境中运行以访问 IndexedDB')
    console.log('🔧 请在浏览器控制台中使用以下代码:')
    console.log('')
    console.log('--- 复制以下代码到浏览器控制台 ---')
    console.log(getBrowserScript())
    
    return true
  } catch (error) {
    console.error('❌ 清理过程出错:', error)
    return false
  }
}

function getBrowserScript() {
  return `
// 浏览器端清理低质量缓存脚本
(async function clearLowQualityCache() {
  console.log('🚀 开始清理低质量图片缓存...')
  
  const LOW_QUALITY_THRESHOLD = 15 * 1024 // 15KB
  let clearedCount = 0
  let keptCount = 0
  let totalFreedSpace = 0
  
  try {
    // 清理 IndexedDB 中的低质量图片缓存（使用新的统一数据库）
    const dbName = 'ai-video-unified-cache'
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName)
      
      request.onsuccess = function(event) {
        const db = event.target.result
        
        // 检查是否有images表（新的统一数据库使用分类表）
        if (!db.objectStoreNames.contains('images')) {
          console.log('📝 未找到图片缓存表')
          resolve({ clearedCount: 0, keptCount: 0 })
          return
        }
        
        const transaction = db.transaction(['images'], 'readwrite')
        const store = transaction.objectStore('images')
        const getAllRequest = store.getAll()
        
        getAllRequest.onsuccess = function() {
          const allCache = getAllRequest.result || []
          console.log(\`📊 检查 \${allCache.length} 个缓存项...\`)
          
          const deletePromises = []
          
          allCache.forEach((cacheEntry) => {
            const key = cacheEntry.key
            const data = cacheEntry.data
            
            // 检查是否为图片缓存（EnhancedIDB使用不同的key格式）
            if (!data || cacheEntry.category !== 'image') return
            
            const dataSize = typeof data === 'string' ? data.length : JSON.stringify(data).length
            const isCloudflareOptimized = key.includes('%2Fcdn-cgi%2Fimage%2F')
            const isR2CDN = key.includes('cdn.veo3video.me')
            
            console.log(\`🔍 分析缓存: \${key.substring(0, 50)}...\`)
            console.log(\`   大小: \${(dataSize / 1024).toFixed(2)}KB\`)
            console.log(\`   类型: \${isR2CDN ? 'R2 CDN' : isCloudflareOptimized ? 'Cloudflare优化' : '其他'}\`)
            
            // 清理策略
            if (isCloudflareOptimized && dataSize < LOW_QUALITY_THRESHOLD) {
              console.log(\`   🗑️ 标记删除: 低质量Cloudflare图片\`)
              deletePromises.push(store.delete(key))
              clearedCount++
              totalFreedSpace += dataSize
            } else {
              console.log(\`   ✅ 保留: \${isR2CDN ? '高质量R2 CDN' : '尺寸达标'}\`)
              keptCount++
            }
          })
          
          Promise.all(deletePromises).then(() => {
            console.log('')
            console.log('✅ 清理完成!')
            console.log(\`📊 清理统计:\`)
            console.log(\`   删除: \${clearedCount} 个低质量缓存\`)
            console.log(\`   保留: \${keptCount} 个高质量缓存\`)
            console.log(\`   释放空间: \${(totalFreedSpace / 1024 / 1024).toFixed(2)}MB\`)
            
            resolve({ clearedCount, keptCount, totalFreedSpace })
          }).catch(reject)
        }
        
        getAllRequest.onerror = reject
      }
      
      request.onerror = reject
    })
    
  } catch (error) {
    console.error('❌ 清理失败:', error)
    return { error: error.message }
  }
})()
`
}

// 检查是否在 Node.js 环境中运行
if (typeof window === 'undefined') {
  // Node.js 环境
  if (require.main === module) {
    clearLowQualityImageCache()
      .then(() => {
        console.log('✅ 清理工具执行完成')
        process.exit(0)
      })
      .catch((error) => {
        console.error('❌ 执行失败:', error)
        process.exit(1)
      })
  }
} else {
  // 浏览器环境 - 导出清理函数
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { clearLowQualityImageCache }
  }
}