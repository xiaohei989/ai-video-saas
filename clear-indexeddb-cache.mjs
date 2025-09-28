#!/usr/bin/env node

/**
 * 清除IndexedDB缓存脚本
 * 用于清理L2层缓存（IndexedDB）并测试视频页面加载性能
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: join(__dirname, '.env') })

console.log('🗂️ IndexedDB缓存清除工具')
console.log('=' + '='.repeat(50))

// 模拟浏览器环境中的IndexedDB清除功能
class IndexedDBCacheClearer {
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )
  }

  /**
   * 清除IndexedDB缓存（模拟浏览器环境）
   */
  async clearIndexedDBCache() {
    console.log('🔍 准备清除IndexedDB缓存...')
    
    // 定义需要清除的IndexedDB数据库名称
    const indexedDBNames = [
      'MultiLevelCache', // 主缓存数据库
      'VideoCache',      // 视频缓存
      'ThumbnailCache',  // 缩略图缓存  
      'LikesCache',      // 点赞状态缓存
      'TemplateCache',   // 模板缓存
      'UserDataCache'    // 用户数据缓存
    ]

    const clearResults = []

    for (const dbName of indexedDBNames) {
      try {
        console.log(`📤 清除 ${dbName} 数据库...`)
        
        // 在Node.js环境中，我们无法直接操作IndexedDB
        // 这里提供浏览器控制台代码，用户需要在浏览器中执行
        const browserCode = this.generateBrowserClearCode(dbName)
        
        clearResults.push({
          database: dbName,
          status: 'ready_for_browser',
          browserCode
        })
        
        console.log(`✅ ${dbName} 清除代码已生成`)
      } catch (error) {
        console.error(`❌ 清除 ${dbName} 失败:`, error.message)
        clearResults.push({
          database: dbName,
          status: 'error',
          error: error.message
        })
      }
    }

    return clearResults
  }

  /**
   * 生成浏览器中执行的IndexedDB清除代码
   */
  generateBrowserClearCode(dbName) {
    return `
// 清除 ${dbName} IndexedDB数据库
(async function clear${dbName}() {
  try {
    // 删除整个数据库
    const deleteResult = indexedDB.deleteDatabase('${dbName}')
    
    deleteResult.onsuccess = () => {
      console.log('✅ ${dbName} 数据库已清除')
    }
    
    deleteResult.onerror = (event) => {
      console.error('❌ 清除${dbName}失败:', event.target.error)
    }
    
    deleteResult.onblocked = () => {
      console.warn('⚠️ ${dbName}删除被阻止，请关闭其他使用该数据库的标签页')
    }
    
    // 或者清除特定存储对象（如果数据库仍在使用）
    const openRequest = indexedDB.open('${dbName}')
    openRequest.onsuccess = (event) => {
      const db = event.target.result
      const transaction = db.transaction(db.objectStoreNames, 'readwrite')
      
      // 清空所有对象存储
      for (const storeName of db.objectStoreNames) {
        const store = transaction.objectStore(storeName)
        store.clear()
        console.log(\`🧹 清空了 ${dbName}.\${storeName}\`)
      }
      
      db.close()
    }
  } catch (error) {
    console.error('清除${dbName}时出错:', error)
  }
})()
`
  }

  /**
   * 测试数据库连接和获取视频数据
   */
  async testDatabaseConnection() {
    console.log('\n🔗 测试数据库连接...')
    
    try {
      // 测试基本连接
      const { data: videos, error } = await this.supabase
        .from('videos')
        .select('id, title, thumbnail_url, video_url, created_at')
        .limit(5)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      console.log('✅ 数据库连接正常')
      console.log(`📊 找到 ${videos?.length || 0} 个最新视频`)
      
      if (videos && videos.length > 0) {
        console.log('\n📹 最新视频列表:')
        videos.forEach((video, index) => {
          console.log(`  ${index + 1}. ${video.title}`)
          console.log(`     ID: ${video.id}`)
          console.log(`     缩略图: ${video.thumbnail_url ? '有' : '无'}`)
          console.log(`     创建时间: ${new Date(video.created_at).toLocaleString('zh-CN')}`)
          console.log('     ---')
        })
      }

      return videos
    } catch (error) {
      console.error('❌ 数据库连接测试失败:', error.message)
      return null
    }
  }

  /**
   * 检查缓存配置状态
   */
  checkCacheConfig() {
    console.log('\n⚙️ 缓存配置检查:')
    console.log('=' + '='.repeat(30))
    
    const config = {
      VITE_ENABLE_CACHE: process.env.VITE_ENABLE_CACHE || 'true',
      VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE: process.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE || 'false',
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? '已配置' : '未配置',
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? '已配置' : '未配置'
    }

    Object.entries(config).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`)
    })

    const isCacheEnabled = config.VITE_ENABLE_CACHE !== 'false'
    const isL3Available = config.UPSTASH_REDIS_REST_URL !== '未配置'

    console.log('\n📋 缓存架构状态:')
    console.log(`  L1 (内存缓存): ✅ 始终可用`)
    console.log(`  L2 (IndexedDB): ${isCacheEnabled ? '✅ 启用' : '❌ 禁用'}`)
    console.log(`  L3 (Redis): ${isL3Available ? '✅ 可用' : '❌ 不可用'}`)
    console.log(`  L4 (数据库): ✅ 始终可用`)

    return {
      isCacheEnabled,
      isL3Available,
      config
    }
  }

  /**
   * 生成完整的浏览器缓存清除脚本
   */
  generateCompleteBrowserScript() {
    return `
// 🗂️ 完整的IndexedDB + 其他缓存清除脚本
// 在浏览器开发者工具控制台中执行此代码

(async function clearAllCaches() {
  console.log('🚀 开始清除所有缓存...')
  
  // 1. 清除IndexedDB数据库
  const indexedDBNames = [
    'MultiLevelCache',
    'VideoCache', 
    'ThumbnailCache',
    'LikesCache',
    'TemplateCache',
    'UserDataCache'
  ]
  
  for (const dbName of indexedDBNames) {
    try {
      const deleteRequest = indexedDB.deleteDatabase(dbName)
      deleteRequest.onsuccess = () => {
        console.log(\`✅ \${dbName} 已删除\`)
      }
      deleteRequest.onerror = (event) => {
        console.error(\`❌ 删除\${dbName}失败:\`, event.target.error)
      }
    } catch (error) {
      console.error(\`删除\${dbName}异常:\`, error)
    }
  }
  
  // 2. 清除localStorage
  console.log('🧹 清除localStorage...')
  const localStorageKeys = []
  for (let i = 0; i < localStorage.length; i++) {
    localStorageKeys.push(localStorage.key(i))
  }
  
  localStorageKeys.forEach(key => {
    if (key && (
      key.includes('cache') ||
      key.includes('video') ||
      key.includes('thumbnail') ||
      key.includes('likes') ||
      key.includes('template')
    )) {
      localStorage.removeItem(key)
      console.log(\`🗑️ 删除localStorage: \${key}\`)
    }
  })
  
  // 3. 清除sessionStorage
  console.log('🧹 清除sessionStorage...')
  const sessionStorageKeys = []
  for (let i = 0; i < sessionStorage.length; i++) {
    sessionStorageKeys.push(sessionStorage.key(i))
  }
  
  sessionStorageKeys.forEach(key => {
    if (key && (
      key.includes('cache') ||
      key.includes('video') ||
      key.includes('loader')
    )) {
      sessionStorage.removeItem(key)
      console.log(\`🗑️ 删除sessionStorage: \${key}\`)
    }
  })
  
  // 4. 清除Cache API
  if ('caches' in window) {
    console.log('🧹 清除Cache API...')
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames.map(async (cacheName) => {
        await caches.delete(cacheName)
        console.log(\`🗑️ 删除Cache: \${cacheName}\`)
      })
    )
  }
  
  // 5. 统计清除结果
  console.log('📊 缓存清除完成！')
  console.log(\`localStorage剩余项目: \${localStorage.length}\`)
  console.log(\`sessionStorage剩余项目: \${sessionStorage.length}\`)
  
  // 6. 建议刷新页面
  console.log('💡 建议刷新页面以完全清除内存缓存')
  console.log('执行: location.reload() 或者手动刷新页面')
  
  return {
    success: true,
    clearedIndexedDB: indexedDBNames.length,
    timestamp: new Date().toISOString()
  }
})()
`
  }
}

// 主函数
async function main() {
  const clearer = new IndexedDBCacheClearer()
  
  try {
    // 1. 检查缓存配置
    const config = clearer.checkCacheConfig()
    
    // 2. 测试数据库连接
    const videos = await clearer.testDatabaseConnection()
    
    // 3. 生成IndexedDB清除代码
    console.log('\n🔧 生成IndexedDB清除代码...')
    const clearResults = await clearer.clearIndexedDBCache()
    
    // 4. 输出完整的浏览器执行脚本
    console.log('\n📜 完整的浏览器缓存清除脚本:')
    console.log('=' + '='.repeat(50))
    console.log(clearer.generateCompleteBrowserScript())
    
    // 5. 输出使用说明
    console.log('\n📋 使用说明:')
    console.log('1. 复制上面的完整脚本代码')
    console.log('2. 打开浏览器，访问您的视频页面')
    console.log('3. 按F12打开开发者工具')
    console.log('4. 切换到Console控制台标签')
    console.log('5. 粘贴并执行上面的脚本代码')
    console.log('6. 等待清除完成后，刷新页面测试加载性能')
    
    // 6. 性能测试建议
    console.log('\n⚡ 性能测试建议:')
    console.log('- 清除缓存后，首次加载会较慢（冷启动）')
    console.log('- 观察视频和缩略图的加载速度')
    console.log('- 检查网络面板中的请求数量和大小') 
    console.log('- 后续访问应该利用新的缓存，加载更快')
    
    console.log('\n✅ IndexedDB缓存清除准备完成!')
    
  } catch (error) {
    console.error('❌ 执行失败:', error.message)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}