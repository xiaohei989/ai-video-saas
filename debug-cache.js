/**
 * 缓存诊断脚本
 * 在浏览器控制台运行此脚本来检查缓存状态
 */

(async function debugCache() {
  console.log('🔍 开始缓存诊断...\n')

  // 1. 检查 IndexedDB
  console.log('===== IndexedDB 检查 =====')
  try {
    const dbRequest = indexedDB.open('ai-video-saas-cache', 3)

    dbRequest.onsuccess = function(event) {
      const db = event.target.result
      console.log('✅ IndexedDB 已打开:', db.name, 'v' + db.version)
      console.log('📦 Object Stores:', Array.from(db.objectStoreNames))

      // 检查缓存数据
      const transaction = db.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const getAllRequest = store.getAll()

      getAllRequest.onsuccess = function() {
        const allData = getAllRequest.result
        console.log(`\n📊 总缓存条目数: ${allData.length}`)

        // 分析缓存数据
        const imageCache = allData.filter(item => item.key?.startsWith('img_'))
        const videoCache = allData.filter(item => item.key?.startsWith('video_'))

        console.log(`🖼️  图片缓存: ${imageCache.length} 条`)
        console.log(`🎥 视频缓存: ${videoCache.length} 条`)

        // 检查图片缓存的数据类型
        if (imageCache.length > 0) {
          console.log('\n🔍 图片缓存详情:')
          imageCache.slice(0, 5).forEach((item, index) => {
            const dataType = typeof item.data
            const isBase64 = typeof item.data === 'string' && item.data.startsWith('data:image/')
            const isSVG = typeof item.data === 'string' && item.data.startsWith('data:image/svg+xml')
            const isURL = typeof item.data === 'string' && (item.data.startsWith('http') || item.data.startsWith('https'))
            const size = typeof item.data === 'string' ? (item.data.length / 1024).toFixed(2) + ' KB' : 'N/A'

            console.log(`\n  [${index + 1}] Key: ${item.key.substring(0, 60)}...`)
            console.log(`      类型: ${dataType}`)
            console.log(`      Base64: ${isBase64}`)
            console.log(`      SVG: ${isSVG}`)
            console.log(`      URL: ${isURL}`)
            console.log(`      大小: ${size}`)
            console.log(`      时间戳: ${new Date(item.timestamp).toLocaleString()}`)
            console.log(`      TTL: ${item.ttl}秒`)
          })
        }

        // 检查过期数据
        const now = Date.now()
        const expired = allData.filter(item => {
          return (item.timestamp + item.ttl * 1000) < now
        })
        console.log(`\n⏰ 过期缓存: ${expired.length} 条`)

        // 检查问题数据
        const svgPlaceholders = allData.filter(item => {
          return typeof item.data === 'string' && item.data.startsWith('data:image/svg+xml')
        })
        const urlCache = allData.filter(item => {
          return typeof item.data === 'string' && (item.data.startsWith('http') || item.data.startsWith('https'))
        })

        console.log(`\n⚠️  SVG占位符: ${svgPlaceholders.length} 条`)
        console.log(`⚠️  URL缓存: ${urlCache.length} 条`)

        // 总结
        console.log('\n===== 诊断总结 =====')
        if (svgPlaceholders.length > 0 || urlCache.length > 0) {
          console.log('❌ 发现问题:')
          if (svgPlaceholders.length > 0) {
            console.log(`   - ${svgPlaceholders.length} 个SVG占位符需要清理`)
          }
          if (urlCache.length > 0) {
            console.log(`   - ${urlCache.length} 个URL缓存(应该是Base64数据)`)
          }
        } else {
          console.log('✅ 缓存数据健康')
        }
      }

      getAllRequest.onerror = function() {
        console.error('❌ 读取缓存数据失败')
      }
    }

    dbRequest.onerror = function(event) {
      console.error('❌ 打开 IndexedDB 失败:', event.target.error)
    }
  } catch (error) {
    console.error('❌ IndexedDB 检查失败:', error)
  }

  // 2. 检查 UnifiedCache 统计
  console.log('\n===== UnifiedCache 统计 =====')
  try {
    // 尝试访问全局的 unifiedCache
    if (window.unifiedCache) {
      const stats = window.unifiedCache.getGlobalStats()
      console.log('📊 全局统计:', stats)
    } else {
      console.log('⚠️  unifiedCache 未挂载到 window 对象')
    }
  } catch (error) {
    console.log('⚠️  无法访问 UnifiedCache 统计')
  }

  // 3. 检查内存缓存
  console.log('\n===== 内存缓存检查 =====')
  console.log('⚠️  内存缓存无法直接访问(私有变量)')
  console.log('💡 建议: 刷新页面后观察日志中的"✅ L1内存命中"消息')

  console.log('\n✅ 诊断完成!')
  console.log('\n📋 下一步建议:')
  console.log('1. 检查日志中是否有 SVG占位符 或 URL缓存')
  console.log('2. 如果有问题数据,运行: clearImageCache() 清理缓存')
  console.log('3. 刷新页面后观察是否还在重复写入缓存')
})()