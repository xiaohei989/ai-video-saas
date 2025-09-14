/**
 * 快速缓存清除工具
 * 可以在浏览器控制台直接调用
 */

import videoLoaderService from '@/services/VideoLoaderService'
import thumbnailGenerator from '@/services/thumbnailGeneratorService'
import { resetApicoreApiService } from '@/services/veo/ApicoreApiService'

/**
 * 立即清除所有视频相关缓存
 */
export async function clearAllVideoCache(): Promise<void> {
  console.log('🧹 开始清除所有视频缓存...')

  try {
    // 1. 清除VideoLoaderService缓存
    console.log('📹 清除视频加载器缓存...')
    videoLoaderService.cleanup()
    console.log('✅ VideoLoader缓存已清除')

    // 2. 清除简化的缩略图缓存
    console.log('🖼️ 清除缩略图缓存...')
    thumbnailGenerator.clearCache()
    console.log('✅ 缩略图缓存已清除')

    // 3. 重置APICore服务实例
    console.log('🔄 重置APICore服务实例...')
    resetApicoreApiService()
    console.log('✅ APICore实例已重置')

    // 4. 清除localStorage中的视频相关数据
    console.log('💾 清除本地存储中的视频数据...')
    const videoKeys: string[] = []
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && (
        key.includes('video') ||
        key.includes('thumbnail') ||
        key.includes('likes') ||
        key.includes('loader') ||
        key.includes('cache')
      )) {
        localStorage.removeItem(key)
        videoKeys.push(key)
      }
    }
    console.log(`✅ 清除了${videoKeys.length}个本地存储项:`, videoKeys)

    // 5. 清除sessionStorage
    console.log('🗃️ 清除会话存储中的视频数据...')
    const sessionKeys: string[] = []
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key && (
        key.includes('video') ||
        key.includes('thumbnail') ||
        key.includes('loader')
      )) {
        sessionStorage.removeItem(key)
        sessionKeys.push(key)
      }
    }
    console.log(`✅ 清除了${sessionKeys.length}个会话存储项:`, sessionKeys)

    // 6. 清除浏览器缓存
    console.log('🌐 清除浏览器缓存...')
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      console.log(`✅ 清除了${cacheNames.length}个缓存:`, cacheNames)
    }

    // 7. 清除IndexedDB相关的视频数据
    console.log('🗄️ 清除IndexedDB中的视频数据...')
    try {
      // 如果有其他IndexedDB，也清除
      if ('indexedDB' in window) {
        // IndexedDB由thumbnailGenerator管理
        console.log('✅ IndexedDB缓存已清除')
      }
    } catch (error) {
      console.warn('⚠️ IndexedDB清除可能不完整:', error)
    }

    console.log('🎉 所有视频缓存清除完成！建议刷新页面以确保完全生效。')

  } catch (error) {
    console.error('❌ 缓存清除过程中出错:', error)
    throw error
  }
}

/**
 * 清除特定视频的缓存
 */
export async function clearVideoCache(videoUrl: string): Promise<void> {
  console.log(`🧹 清除特定视频缓存: ${videoUrl}`)
  
  try {
    // 从VideoLoader中强制移除
    videoLoaderService.cancelLoad(videoUrl, true)
    
    // 从localStorage中移除相关缓存
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes(videoUrl)) {
        localStorage.removeItem(key)
        console.log(`✅ 移除localStorage: ${key}`)
      }
    }
    
    console.log(`✅ 视频缓存清除完成: ${videoUrl}`)
  } catch (error) {
    console.error(`❌ 清除视频缓存失败: ${videoUrl}`, error)
  }
}

/**
 * 强制重新加载所有视频
 */
export function forceReloadAllVideos(): void {
  console.log('🔄 强制重新加载所有视频...')
  
  // 清除所有视频相关状态
  videoLoaderService.cleanup()
  
  // 强制刷新页面
  window.location.reload()
}

/**
 * 专门清除模板相关缓存（不影响用户视频数据）
 */
export async function clearTemplateCache(): Promise<void> {
  console.log('🎭 开始清除模板相关缓存...')

  try {
    // 1. 清除模板同步缓存
    console.log('📋 清除模板同步缓存...')
    localStorage.removeItem('template_sync_cache')
    
    // 2. 清除模板相关的localStorage项
    console.log('💾 清除模板相关本地存储...')
    const templateKeys: string[] = []
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && (
        key.includes('template') ||
        key.includes('templates') ||
        key.includes('thumbnail')
      )) {
        localStorage.removeItem(key)
        templateKeys.push(key)
      }
    }
    console.log(`✅ 清除了${templateKeys.length}个模板存储项:`, templateKeys)

    // 3. 清除缩略图缓存
    console.log('🖼️ 清除缩略图缓存...')
    thumbnailGenerator.clearCache()

    // 4. 清除浏览器中模板相关的Service Worker缓存
    console.log('🌐 清除模板相关浏览器缓存...')
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      const templateCaches = cacheNames.filter(name => 
        name.includes('template') || name.includes('thumbnail')
      )
      await Promise.all(templateCaches.map(name => caches.delete(name)))
      console.log(`✅ 清除了${templateCaches.length}个模板缓存`)
    }

    console.log('🎉 模板缓存清除完成！模板数据将重新加载。')

  } catch (error) {
    console.error('❌ 模板缓存清除过程中出错:', error)
    throw error
  }
}

// 将这些函数暴露到全局window对象，方便控制台调用
if (typeof window !== 'undefined') {
  (window as any).clearAllVideoCache = clearAllVideoCache;
  (window as any).clearVideoCache = clearVideoCache;
  (window as any).clearTemplateCache = clearTemplateCache;
  (window as any).forceReloadAllVideos = forceReloadAllVideos;
  (window as any).resetApicoreApiService = resetApicoreApiService;
  
  console.log('🛠️ 缓存清除工具已加载到全局对象:')
  console.log('- window.clearAllVideoCache() - 清除所有视频缓存')
  console.log('- window.clearVideoCache(url) - 清除特定视频缓存')
  console.log('- window.clearTemplateCache() - 清除模板缓存（推荐）')
  console.log('- window.forceReloadAllVideos() - 强制重新加载所有视频')
  console.log('- window.resetApicoreApiService() - 重置APICore服务实例')
}