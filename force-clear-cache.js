/**
 * 强制清除本地IndexedDB缓存
 * 清理所有低质量图片缓存，让系统重新生成高质量版本
 */

console.log('🧹 开始强制清除IndexedDB缓存...')

async function clearIndexedDBCache() {
  try {
    // 1. 清除所有可能的IndexedDB数据库
    const databases = ['UnifiedCache', 'ImageCache', 'TemplateCache', 'VideoCache', 'ai-video-cache', 'template-cache']
    
    for (const dbName of databases) {
      try {
        console.log(`🗑️ 正在删除数据库: ${dbName}`)
        
        // 删除IndexedDB数据库
        const deleteRequest = indexedDB.deleteDatabase(dbName)
        
        await new Promise((resolve, reject) => {
          deleteRequest.onsuccess = () => {
            console.log(`✅ 数据库 ${dbName} 删除成功`)
            resolve(true)
          }
          
          deleteRequest.onerror = () => {
            console.log(`⚠️ 数据库 ${dbName} 删除失败或不存在`)
            resolve(false) // 不存在的数据库不算错误
          }
          
          deleteRequest.onblocked = () => {
            console.log(`🔒 数据库 ${dbName} 删除被阻塞，请关闭其他标签页`)
            reject(new Error('数据库删除被阻塞'))
          }
        })
        
        // 等待一下让删除操作完成
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.warn(`⚠️ 删除数据库 ${dbName} 时出错:`, error.message)
      }
    }

    // 2. 清除LocalStorage中的缓存相关数据
    console.log('🗑️ 清除LocalStorage缓存...')
    const keysToRemove = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (
        key.startsWith('cached_img_') ||
        key.startsWith('template_') ||
        key.startsWith('video_') ||
        key.startsWith('img_') ||
        key.includes('cache') ||
        key.includes('thumbnail')
      )) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`✅ 已删除LocalStorage键: ${key.substring(0, 50)}...`)
    })
    
    // 3. 清除SessionStorage
    console.log('🗑️ 清除SessionStorage缓存...')
    const sessionKeysToRemove = []
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (
        key.includes('cache') ||
        key.includes('thumbnail') ||
        key.includes('image')
      )) {
        sessionKeysToRemove.push(key)
      }
    }
    
    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key)
      console.log(`✅ 已删除SessionStorage键: ${key.substring(0, 50)}...`)
    })

    // 4. 清除缓存API (如果支持)
    if ('caches' in window) {
      console.log('🗑️ 清除Cache API...')
      const cacheNames = await caches.keys()
      
      for (const cacheName of cacheNames) {
        if (cacheName.includes('image') || cacheName.includes('template') || cacheName.includes('thumbnail')) {
          await caches.delete(cacheName)
          console.log(`✅ 已删除Cache: ${cacheName}`)
        }
      }
    }

    console.log('')
    console.log('🎉 IndexedDB缓存清除完成!')
    console.log('📊 清除统计:')
    console.log(`  - IndexedDB数据库: ${databases.length}个`)
    console.log(`  - LocalStorage键: ${keysToRemove.length}个`)
    console.log(`  - SessionStorage键: ${sessionKeysToRemove.length}个`)
    console.log('')
    console.log('💡 建议操作:')
    console.log('  1. 刷新页面重新加载缓存系统')
    console.log('  2. 新的图片将使用高质量设置缓存')
    console.log('  3. 观察播放器缩略图质量是否改善')

  } catch (error) {
    console.error('❌ 缓存清除过程中出错:', error)
  }
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  clearIndexedDBCache()
} else {
  console.log('⚠️ 此脚本需要在浏览器环境中运行')
  console.log('💡 请在浏览器控制台中运行，或在开发工具中执行')
}