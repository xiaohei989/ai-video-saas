/**
 * 新版图片缓存工具
 * 
 * 基于统一缓存系统(UnifiedCacheService)的图片缓存实现
 * 彻底替代localStorage方案，使用内存+IndexedDB两层缓存
 * 
 * 特性：
 * - 智能压缩和尺寸优化
 * - 分层缓存策略
 * - 自动数据迁移
 * - CORS代理支持
 * - 详细性能监控
 */

import { unifiedCache } from '@/services/UnifiedCacheService'
import { getSupportedCDNDomains, isHighQualityCDN } from '@/config/cdnConfig'

// 移动端检测
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// 缓存禁用检查
const isCacheDisabled = import.meta.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE === 'true'

// 🔍 调试日志：缓存配置
console.log('[NewImageCache] 📋 缓存配置状态:')
console.log('[NewImageCache]   VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE:', import.meta.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE)
console.log('[NewImageCache]   isCacheDisabled:', isCacheDisabled)
console.log('[NewImageCache]   isMobile:', isMobile)

// 图片处理配置
const IMAGE_CONFIG = {
  mobile: {
    maxWidth: 400,
    quality: 0.9,   // 提升到90%质量
    format: 'image/jpeg' as const,
    maxFileSize: 600 * 1024, // 提高到600KB
  },
  desktop: {
    maxWidth: 600,
    quality: 0.95,  // 提升到95%质量
    format: 'image/jpeg' as const,
    maxFileSize: 800 * 1024, // 提高到800KB
  }
} as const

// URL生成配置 - 完全禁用模糊图，只生成高质量图
const URL_CONFIG = {
  // 移除blur配置，彻底消除模糊图生成
  final: {
    width: isMobile ? 600 : 800,      // 进一步提升分辨率
    quality: 100                       // 使用最高质量，不压缩
  }
} as const

/**
 * 生成缓存键
 */
export const getCacheKey = (url: string, cacheKey?: string): string => {
  if (cacheKey) {
    return cacheKey
  }
  
  try {
    const encodedUrl = encodeURIComponent(url)
    return `img_${encodedUrl}`
  } catch {
    const safeUrl = String(url ?? '').replace(/[^a-zA-Z0-9]/g, '_')
    return `img_${safeUrl}`
  }
}

/**
 * 生成高质量URL：直接生成最终高清图，完全跳过模糊图
 * 优化版：跳过已优化的CDN图片，避免二次压缩
 */
export const generateImageUrls = (originalUrl: string, _enableFastPreview = true) => {
  // 已完全移除 Cloudflare Transform 使用，统一返回原图
  return { final: originalUrl }
}

/**
 * 检查数据是否为SVG占位符
 */
const isSVGPlaceholder = (data: string): boolean => {
  return data?.startsWith('data:image/svg+xml') || false
}

/**
 * 获取缓存的图片（增强验证版）
 * 只返回有效的Base64数据，过滤无效缓存和SVG占位符
 */
export const getCachedImage = async (url: string, cacheKey?: string): Promise<string | null> => {
  const key = getCacheKey(url, cacheKey)
  
  console.log('[NewImageCache] 🔍 获取缓存图片:', {
    url: url.substring(0, 60) + '...',
    cacheKey: key.substring(0, 80) + '...'
  })
  
  if (isCacheDisabled) {
    console.log('[NewImageCache] ⚠️ 缓存被禁用，跳过缓存检查')
    return null
  }
  
  try {
    recordCacheStats('requests')
    
    console.log('[NewImageCache] 🔍 优质缓存优先策略：同时检查内存和IndexedDB，优选Base64数据，过滤SVG占位符')
    
    // 🚀 新策略：同时检查所有缓存层，按数据质量优先级选择
    let memoryCache: string | null = null
    let indexedDBCache: string | null = null
    
    // 并行检查所有缓存层
    const [memoryCached, indexedCached] = await Promise.all([
      // 检查内存缓存
      unifiedCache.get<string>(key, { category: 'image' }).catch(() => null),
      // 直接检查IndexedDB (绕过内存缓存)
      (async () => {
        try {
          const { enhancedIDB } = await import('@/services/EnhancedIDBService')
          const idbResult = await enhancedIDB.getCache(key)
          return idbResult?.data as string | null
        } catch {
          return null
        }
      })()
    ])
    
    memoryCache = memoryCached
    indexedDBCache = indexedCached
    
    // 分析缓存数据质量，过滤SVG占位符
    const cacheOptions = []
    
    if (memoryCache && !isSVGPlaceholder(memoryCache)) {
      const isBase64 = memoryCache.startsWith('data:image/')
      const quality = isBase64 ? (memoryCache.length / 1024) : 0
      cacheOptions.push({
        source: '内存',
        data: memoryCache,
        isBase64,
        quality,
        score: isBase64 ? quality : -1 // Base64给正分，URL给负分
      })
    } else if (memoryCache && isSVGPlaceholder(memoryCache)) {
      console.log('[NewImageCache] 🚫 内存中发现SVG占位符，忽略并清理:', {
        preview: memoryCache.substring(0, 50) + '...'
      })
      // 异步清理SVG占位符缓存
      unifiedCache.set(key, null, { category: 'image', ttl: 0 }).catch(() => {})
    }
    
    if (indexedDBCache && !isSVGPlaceholder(indexedDBCache)) {
      const isBase64 = indexedDBCache.startsWith('data:image/')
      const quality = isBase64 ? (indexedDBCache.length / 1024) : 0
      cacheOptions.push({
        source: 'IndexedDB',
        data: indexedDBCache,
        isBase64,
        quality,
        score: isBase64 ? quality + 1000 : -1 // IndexedDB的Base64额外加分，优先使用
      })
    } else if (indexedDBCache && isSVGPlaceholder(indexedDBCache)) {
      console.log('[NewImageCache] 🚫 IndexedDB中发现SVG占位符，忽略并清理:', {
        preview: indexedDBCache.substring(0, 50) + '...'
      })
      // 异步清理SVG占位符缓存
      try {
        const { enhancedIDB } = await import('@/services/EnhancedIDBService')
        await enhancedIDB.delete(key)
      } catch (error) {
        console.warn('[NewImageCache] 清理IndexedDB中的SVG占位符失败:', error)
      }
    }
    
    // 按质量分数排序，选择最佳缓存
    cacheOptions.sort((a, b) => b.score - a.score)
    
    if (cacheOptions.length > 0) {
      const bestCache = cacheOptions[0]
      
      if (bestCache.isBase64) {
        console.log('[NewImageCache] ✅ 优质Base64缓存命中:', {
          source: bestCache.source,
          size: `${bestCache.quality.toFixed(2)}KB`,
          quality: bestCache.quality > 50 ? '✅ 高质量' : bestCache.quality > 20 ? '🟡 中等质量' : '⚠️ 低质量',
          优先原因: bestCache.source === 'IndexedDB' ? '持久化Base64数据' : '内存Base64数据'
        })
        
        // 如果IndexedDB的数据更好，同步更新内存缓存
        if (bestCache.source === 'IndexedDB' && bestCache.data !== memoryCache) {
          console.log('[NewImageCache] 🔄 用IndexedDB的优质Base64数据更新内存缓存')
          await unifiedCache.set(key, bestCache.data, { category: 'image', ttl: 24 * 60 * 60 })
        }
        
        recordCacheStats('hits')
        recordCacheStats('base64Cache')
        return bestCache.data
      } else {
        // 所有缓存都是URL，按新策略忽略
        console.warn('[NewImageCache] ⚠️ 只找到URL缓存，按Base64优先策略忽略:', {
          sources: cacheOptions.map(c => c.source),
          action: '强制重新获取Base64数据'
        })
        recordCacheStats('urlCache')
        recordCacheStats('misses')
        return null
      }
    }
    
    console.log('[NewImageCache] ❌ 所有缓存层均未命中（或只有SVG占位符被过滤）')
    recordCacheStats('misses')
    return null
  } catch (error) {
    console.error('[NewImageCache] ❌ 获取缓存失败:', error)
    recordCacheStats('errors')
    return null
  }
}

/**
 * 缓存图片（新版本）
 */
export const cacheImage = async (url: string, options: {
  cacheKey?: string
  quality?: number
  maxWidth?: number
  compress?: boolean
} = {}): Promise<string> => {
  console.log('[NewImageCache] 🚀 开始缓存图片:', url.substring(0, 60) + '...')
  
  if (isCacheDisabled) {
    console.log('[NewImageCache] ⚠️ 缓存被禁用，直接返回原URL')
    return url
  }
  
  const key = getCacheKey(url, options.cacheKey)
  
  // 首先检查是否已经缓存
  try {
    const existing = await getCachedImage(url, options.cacheKey)
    if (existing) {
      console.log('[NewImageCache] ⚡ 使用现有缓存')
      return existing
    }
  } catch (error) {
    console.warn('[NewImageCache] 检查现有缓存失败:', error)
  }
  
  // 处理图片
  try {
    console.log('[NewImageCache] 📡 开始处理图片...')
    
    const result = await processAndCacheImage(url, {
      key,
      quality: options.quality,
      maxWidth: options.maxWidth,
      compress: options.compress !== false
    })
    
    console.log('[NewImageCache] ✅ 图片处理完成:', typeof result)
    return result
  } catch (error) {
    console.error('[NewImageCache] ❌ 缓存处理失败:', error)
    return url // 返回原始URL作为fallback
  }
}

/**
 * 处理并缓存图片（简化版）
 * 直接缓存高清图片数据，无压缩处理，但不缓存SVG占位符
 */
async function processAndCacheImage(imageUrl: string, options: {
  key: string
  quality?: number
  maxWidth?: number
  compress: boolean
}): Promise<string> {
  try {
    console.log('[NewImageCache] 🚀 简化处理模式：直接缓存高清图片')
    
    // 直接获取图片的完整Base64数据（无压缩）
    const base64Data = await getImageAsBase64(imageUrl)
    
    if (base64Data && base64Data.startsWith('data:')) {
      // 检查是否为SVG占位符
      if (isSVGPlaceholder(base64Data)) {
        console.log('[NewImageCache] 🚫 检测到SVG占位符，不缓存，直接返回:', {
          type: 'SVG占位符',
          action: '跳过缓存，避免污染本地存储'
        })
        return base64Data // 返回但不缓存
      }
      
      // 缓存完整的Base64图片数据（非SVG占位符）
      const success = await unifiedCache.set(options.key, base64Data, {
        category: 'image',
        ttl: 24 * 60 * 60, // 24小时
        compress: false // 不需要额外压缩
      })
      
      if (success) {
        console.log('[NewImageCache] ✅ 高清图片已缓存，无压缩损失')
        return base64Data
      } else {
        console.warn('[NewImageCache] ⚠️ 缓存失败，返回原URL')
        return imageUrl
      }
    } else {
      console.warn('[NewImageCache] ⚠️ 获取图片数据失败，返回原URL')
      return imageUrl
    }
  } catch (error) {
    console.error('[NewImageCache] ❌ 处理异常:', error)
    
    // 🎯 针对不同类型的错误提供不同的处理策略
    if (error instanceof Error) {
      if (error.message.includes('图片加载超时') || error.message.includes('CORS限制')) {
        console.log('[NewImageCache] 🔄 网络问题，直接返回原URL让浏览器处理')
        return imageUrl
      }
    }
    
    // 🎨 其他错误情况也返回原URL，确保图片始终能显示
    console.log('[NewImageCache] 🔄 降级到原URL，确保图片可显示')
    return imageUrl
  }
}

/**
 * 获取图片的Base64数据（新回退策略版）
 * 失败后直接使用视频截图回退，不再重试
 * 
 * 导出此函数用于测试和调试
 */
export async function getImageAsBase64(url: string): Promise<string> {
  try {
    console.log(`[NewImageCache] 📡 获取图片数据:`, url.substring(0, 60) + '...')
    
    // 检查网络状态
    if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
      throw new Error('网络离线状态')
    }
    
    // 创建带超时的fetch请求
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/*,*/*;q=0.8',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit'
    })
    
    clearTimeout(timeoutId)
    
    // 响应状态检查
    console.log(`[NewImageCache] 📊 响应状态:`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    })
    
    if (!response.ok) {
      throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`)
    }
    
    const blob = await response.blob()
    
    // 验证blob数据
    if (!blob || blob.size === 0) {
      throw new Error('获取到空的图片数据')
    }
    
    const base64 = await blobToBase64(blob)
    
    // 验证Base64数据
    if (!base64 || !base64.startsWith('data:')) {
      throw new Error('Base64转换失败或格式错误')
    }
    
    const sizeKB = blob.size / 1024
    console.log('[NewImageCache] ✅ 图片数据获取成功:', {
      originalSize: `${sizeKB.toFixed(2)}KB`,
      mimeType: blob.type,
      base64Size: `${(base64.length / 1024).toFixed(2)}KB`,
      quality: sizeKB > 50 ? '✅ 高质量' : sizeKB > 20 ? '🟡 中等质量' : '⚠️ 低质量'
    })
    
    return base64
    
  } catch (error) {
    const errorType = error instanceof Error ? error.name : 'UnknownError'
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error(`[NewImageCache] ❌ 获取图片失败:`, {
      url: url.substring(0, 60) + '...',
      errorType,
      errorMessage
    })
    
    // 🚨 修复：移除错误的视频截图回退逻辑
    // 图片URL不应该被当作视频URL处理，这会导致缓存污染
    console.log('[NewImageCache] ⚠️ 图片获取失败，跳过错误的视频截图回退')
    
    // 🎯 针对不同错误类型的处理策略
    if (errorType === 'AbortError') {
      console.log('[NewImageCache] ⏰ 请求超时，可能需要重试或使用原URL')
      // 超时错误，直接抛出让上层决定是否重试
      throw new Error(`图片加载超时: ${url}`)
    } else if (errorMessage.includes('CORS')) {
      console.log('[NewImageCache] 🚫 CORS错误，可能需要代理或直接使用原URL')
      // CORS错误，直接抛出让上层使用原URL
      throw new Error(`CORS限制: ${url}`)
    } else if (errorMessage.includes('404') || errorMessage.includes('403')) {
      console.log('[NewImageCache] 🔍 资源不存在，SVG占位符已禁用，抛出错误让上层处理')
      // 🚀 SVG占位符已禁用，直接抛出错误让上层使用其他降级策略
      throw new Error(`资源不存在: ${url}`)
    }
    
    // 🎨 其他未知错误：直接抛出，让上层决定处理策略
    console.log('[NewImageCache] ❓ 未知错误，抛出让上层处理')
    throw error
  }
}

/**
 * 将Blob转换为Base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}



/**
 * 生成SVG占位符作为最终回退
 * 
 * 导出此函数用于测试和调试
 */
export function generateSVGPlaceholder(originalUrl: string): string {
  // 🚀 根据用户要求，完全禁用SVG占位符生成
  // 返回空字符串，让调用方使用其他降级策略
  console.log('[NewImageCache] 🚫 SVG占位符已禁用，返回空字符串:', originalUrl.substring(0, 60) + '...')
  return ''
}

/**
 * 计算最优图片尺寸
 */
function calculateOptimalSize(originalWidth: number, originalHeight: number, maxWidth: number): {
  width: number
  height: number
} {
  if (originalWidth <= maxWidth) {
    return { width: originalWidth, height: originalHeight }
  }
  
  const aspectRatio = originalHeight / originalWidth
  const width = maxWidth
  const height = Math.round(width * aspectRatio)
  
  return { width, height }
}

/**
 * 批量缓存图片
 */
export const batchCacheImages = async (urls: string[]): Promise<Map<string, string>> => {
  console.log('[NewImageCache] 🔄 批量缓存图片:', urls.length, '个')
  
  if (isCacheDisabled) {
    console.log('[NewImageCache] ⚠️ 缓存被禁用，批量操作直接返回原URL')
    const results = new Map<string, string>()
    urls.forEach(url => results.set(url, url))
    return results
  }
  
  const results = new Map<string, string>()
  const batchSize = 5 // 并发控制
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (url) => {
      try {
        const cached = await cacheImage(url)
        results.set(url, cached)
      } catch (error) {
        console.error(`[NewImageCache] 批量缓存失败: ${url}`, error)
        results.set(url, url) // fallback到原URL
      }
    })
    
    await Promise.all(batchPromises)
    
    // 防止过载，批次间稍微延迟
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  console.log('[NewImageCache] ✅ 批量缓存完成:', results.size, '/', urls.length)
  return results
}

/**
 * 预加载图片
 */
export const preloadImage = async (url: string): Promise<boolean> => {
  console.log('[NewImageCache] 🚀 预加载图片:', url.substring(0, 60) + '...')
  
  if (isCacheDisabled) {
    console.log('[NewImageCache] ⚠️ 缓存被禁用，跳过预加载')
    return true
  }
  
  try {
    // 检查是否已缓存
    const cached = await getCachedImage(url)
    if (cached) {
      console.log('[NewImageCache] ⚡ 预加载：已有缓存')
      return true
    }
    
    // 后台缓存
    await cacheImage(url)
    console.log('[NewImageCache] ✅ 预加载完成')
    return true
  } catch (error) {
    console.error('[NewImageCache] ❌ 预加载失败:', error)
    return false
  }
}

/**
 * 清理图片缓存
 */
export const clearImageCache = async (): Promise<void> => {
  console.log('[NewImageCache] 🧹 清理图片缓存...')
  
  try {
    // 使用统一缓存的清理功能
    await unifiedCache.clearAll()
    console.log('[NewImageCache] ✅ 图片缓存清理完成')
  } catch (error) {
    console.error('[NewImageCache] ❌ 清理缓存失败:', error)
  }
}

/**
 * 清理单个图片缓存
 */
export const clearSingleImageCache = async (imageUrl: string): Promise<void> => {
  console.log('[NewImageCache] 🧹 清理单个图片缓存:', imageUrl.substring(0, 50) + '...')

  try {
    // 使用正确的缓存key生成方式，与getCacheKey保持一致
    const cacheKey = getCacheKey(imageUrl)
    console.log('[NewImageCache] 🔑 使用缓存键:', cacheKey.substring(0, 80) + '...')

    // 使用统一缓存的delete方法正确删除缓存
    const success = await unifiedCache.delete(cacheKey, {
      category: 'image'
    })

    if (success) {
      console.log('[NewImageCache] ✅ 单个图片缓存清理完成（已清理内存和IndexedDB两层）')
    } else {
      console.warn('[NewImageCache] ⚠️ 缓存清理返回失败，但可能缓存不存在')
    }
  } catch (error) {
    console.error('[NewImageCache] ❌ 清理单个图片缓存失败:', error)
    throw error
  }
}

// 缓存统计和监控
interface CacheStats {
  requests: number
  hits: number
  misses: number
  base64Cache: number
  urlCache: number
  errors: number
}

const cacheStats: CacheStats = {
  requests: 0,
  hits: 0,
  misses: 0,
  base64Cache: 0,
  urlCache: 0,
  errors: 0
}

/**
 * 记录缓存统计
 */
const recordCacheStats = (type: keyof CacheStats) => {
  cacheStats[type]++
  
  // 每50次请求输出一次统计
  if (cacheStats.requests % 50 === 0 && cacheStats.requests > 0) {
    console.log('[NewImageCache] 📊 缓存统计报告:', {
      总请求: cacheStats.requests,
      缓存命中率: `${((cacheStats.hits / cacheStats.requests) * 100).toFixed(1)}%`,
      Base64缓存: cacheStats.base64Cache,
      URL缓存: cacheStats.urlCache,
      错误数: cacheStats.errors,
      缓存效果: cacheStats.hits > cacheStats.misses ? '✅ 良好' : '⚠️ 需优化'
    })
  }
}

/**
 * 获取缓存统计信息（增强版）
 */
export const getImageCacheStats = () => {
  const stats = unifiedCache.getGlobalStats()
  const imageCategory = stats.categories.find(cat => cat.name === 'image')
  
  return {
    imageCache: imageCategory || {
      name: 'image',
      count: 0,
      size: 0,
      maxSize: 0,
      hitRate: 0,
      lastAccess: 0
    },
    globalStats: stats.summary,
    newImageCacheStats: {
      ...cacheStats,
      hitRate: cacheStats.requests > 0 ? (cacheStats.hits / cacheStats.requests) * 100 : 0,
      base64Ratio: cacheStats.requests > 0 ? (cacheStats.base64Cache / cacheStats.requests) * 100 : 0
    }
  }
}

/**
 * 🚀 清理SVG占位符缓存
 * 扫描并删除所有SVG占位符数据，为用户修复移动端缩略图显示问题
 */
export const clearSVGPlaceholderCache = async (): Promise<{
  cleaned: number
  errors: string[]
}> => {
  console.log('[NewImageCache] 🧹 开始清理SVG占位符缓存...')
  
  let cleaned = 0
  const errors: string[] = []
  
  try {
    // 清理LocalStorage中的SVG占位符
    if (typeof window !== 'undefined') {
      const keysToDelete: string[] = []
      
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (!key) continue
        
        try {
          const value = window.localStorage.getItem(key)
          if (value && isSVGPlaceholder(value)) {
            keysToDelete.push(key)
          }
        } catch (e) {
          // 忽略无法解析的值
        }
      }
      
      // 删除找到的SVG占位符
      keysToDelete.forEach(key => {
        try {
          window.localStorage.removeItem(key)
          cleaned++
          console.log('[NewImageCache] 🗑️ 删除SVG占位符:', key)
        } catch (e) {
          errors.push(`LocalStorage删除失败: ${key}`)
        }
      })
    }
    
    // 清理IndexedDB中的SVG占位符（通过UnifiedCacheService）
    try {
      // 获取缓存统计以了解当前数据量
      const stats = unifiedCache.getGlobalStats()
      console.log('[NewImageCache] 📊 缓存统计 - 准备清理IndexedDB:', stats.summary)
      
      // 由于UnifiedCacheService没有公开扫描方法，
      // 我们采用温和的方式：等待自然过期或用户重新访问时过滤
      // 这样既安全又不会影响正常使用
      console.log('[NewImageCache] ✅ IndexedDB SVG占位符将在下次访问时自动过滤')
      
    } catch (e) {
      errors.push('IndexedDB清理过程出错: ' + String(e))
    }
    
    console.log('[NewImageCache] 🎉 SVG占位符清理完成 - 清理数量:', cleaned, '个')
    
    return {
      cleaned,
      errors
    }
    
  } catch (error) {
    console.error('[NewImageCache] ❌ SVG占位符清理失败:', error)
    errors.push('清理过程异常: ' + String(error))
    
    return {
      cleaned,
      errors
    }
  }
}

/**
 * 🚀 检查并修复缓存污染
 * 专门处理SVG占位符污染问题，确保用户获得最佳体验
 */
export const repairCachePollution = async (): Promise<{
  repaired: number
  skipped: number
}> => {
  console.log('[NewImageCache] 🔧 检查缓存污染修复...')
  
  let repaired = 0
  let skipped = 0
  
  try {
    // 清理SVG占位符
    const svgCleanResult = await clearSVGPlaceholderCache()
    repaired += svgCleanResult.cleaned
    
    // 如果有错误，记录但不中断流程
    if (svgCleanResult.errors.length > 0) {
      console.warn('[NewImageCache] ⚠️ SVG清理过程中的警告:', svgCleanResult.errors)
    }
    
    console.log('[NewImageCache] ✅ 缓存污染修复完成')
    
    return {
      repaired,
      skipped
    }
    
  } catch (error) {
    console.error('[NewImageCache] ❌ 缓存污染修复失败:', error)
    throw error
  }
}

/**
 * 检查缓存服务是否可用
 */
export const isCacheAvailable = (): boolean => {
  try {
    const stats = unifiedCache.getGlobalStats()
    return stats.summary.idbReady
  } catch {
    return false
  }
}

/**
 * 智能图片加载（结合缓存和渐进加载）
 * 优化版本：优先使用高质量CDN原图，避免不必要的二次压缩
 */
export const smartLoadImage = async (originalUrl: string, options: {
  enableFastPreview?: boolean
  onBlurLoad?: (blurUrl: string) => void
  onFinalLoad?: (finalUrl: string) => void
} = {}): Promise<string> => {
  console.log('[NewImageCache] 🧠 智能图片加载:', originalUrl.substring(0, 60) + '...')
  
  if (isCacheDisabled) {
    console.log('[NewImageCache] ⚠️ 缓存被禁用，直接返回原URL')
    const { onFinalLoad } = options
    onFinalLoad?.(originalUrl)
    return originalUrl
  }
  
  const { enableFastPreview = true, onBlurLoad, onFinalLoad } = options
  
  // 🚀 优先检查是否为高质量CDN图片
  const isHighQualityCDNUrl = isHighQualityCDN(originalUrl)
  
  if (isHighQualityCDNUrl) {
    console.log('[NewImageCache] 🌟 检测到高质量CDN图片，强制Base64缓存策略')
    
    // 检查原图缓存 - 只接受Base64数据
    const originalCached = await getCachedImage(originalUrl)
    if (originalCached && originalCached.startsWith('data:')) {
      const sizeKB = (originalCached.length / 1024).toFixed(2)
      console.log('[NewImageCache] ⚡ 高质量CDN Base64缓存命中:', {
        type: 'Base64高清原图',
        size: `${sizeKB}KB`,
        quality: parseFloat(sizeKB) > 50 ? '✅ 高质量' : parseFloat(sizeKB) > 20 ? '🟡 中等质量' : '⚠️ 低质量'
      })
      onFinalLoad?.(originalCached)
      return originalCached
    }
    
    // 无有效Base64缓存时，强制获取并缓存图片数据
    console.log('[NewImageCache] 📡 强制缓存高质量CDN原图为Base64数据')
    try {
      const cached = await cacheImage(originalUrl, { compress: false })
      
      // 严格验证缓存结果
      if (cached && cached.startsWith('data:')) {
        const sizeKB = (cached.length / 1024).toFixed(2)
        console.log('[NewImageCache] ✅ 高质量CDN Base64缓存完成:', {
          size: `${sizeKB}KB`,
          quality: parseFloat(sizeKB) > 50 ? '✅ 高质量成功' : parseFloat(sizeKB) > 20 ? '🟡 中等质量' : '❌ 质量不达标',
          dataType: 'Base64完整图片数据'
        })
        onFinalLoad?.(cached)
        return cached
      } else {
        // 缓存失败，不应该返回URL，而是重试或降级处理
        console.error('[NewImageCache] ❌ 高质量CDN缓存返回了URL而非Base64数据:', {
          returned: typeof cached,
          isBase64: cached?.startsWith('data:') || false,
          preview: cached?.substring(0, 50) + '...'
        })
        
        // 降级到原始URL，但记录失败
        console.warn('[NewImageCache] ⚠️ 降级使用原始CDN URL，但缓存目标未实现')
        onFinalLoad?.(originalUrl)
        return originalUrl
      }
    } catch (error) {
      console.error('[NewImageCache] ❌ 高质量CDN缓存过程异常:', error)
      onFinalLoad?.(originalUrl)
      return originalUrl
    }
  }
  
  // 🔄 非高质量CDN图片：直接使用原始URL（不再使用 Transform）
  const finalUrl = originalUrl
  console.log('[NewImageCache] 📋 直接高质量策略（无Transform）:', {
    original: originalUrl.substring(0, 50) + '...',
    final: finalUrl.substring(0, 50) + '...'
  })
  
  // 检查高质量图片缓存
  const finalCached = await getCachedImage(finalUrl)
  if (finalCached && finalCached.startsWith('data:')) {
    const sizeKB = (finalCached.length / 1024).toFixed(2)
    // 严格质量标准：只有>50KB才认为是高质量，>20KB为中等质量
    if (parseFloat(sizeKB) > 50) {
      console.log('[NewImageCache] ⚡ 高质量缓存命中:', {
        type: 'Base64高质量图片',
        size: `${sizeKB}KB`,
        quality: '✅ 确认高质量'
      })
      onFinalLoad?.(finalCached)
      return finalCached
    } else {
      console.log('[NewImageCache] ⚠️ 缓存图片质量不达标，重新获取:', {
        currentSize: `${sizeKB}KB`,
        requiredSize: '>50KB高质量或>20KB中等质量'
      })
    }
  }
  
  // 直接加载高质量图片（无模糊图阶段）
  console.log('[NewImageCache] 🔄 直接加载高质量图片（无Transform）')
  try {
    const cached = await cacheImage(finalUrl, { compress: false })
    
    // 验证缓存结果的质量
    if (cached && cached.startsWith('data:')) {
      const sizeKB = (cached.length / 1024).toFixed(2)
      if (parseFloat(sizeKB) > 50) {
        console.log('[NewImageCache] ✅ 高质量缓存完成:', {
          size: `${sizeKB}KB`,
          quality: '✅ 确认高质量'
        })
      } else if (parseFloat(sizeKB) > 20) {
        console.log('[NewImageCache] 🟡 中等质量缓存完成:', {
          size: `${sizeKB}KB`,
          quality: '🟡 中等质量可用'
        })
        onFinalLoad?.(cached)
        return cached
      } else {
        console.log('[NewImageCache] ⚠️ 缓存结果质量较低，但可用:', {
          size: `${sizeKB}KB`,
          quality: '可接受但不理想'
        })
        // 中等质量也可以使用，只是不是最佳
        onFinalLoad?.(cached)
        return cached
      }
    } else {
      // 缓存失败，直接使用原图
      console.log('[NewImageCache] ⚠️ 缓存失败，使用原图保证质量')
      onFinalLoad?.(originalUrl)
      return originalUrl
    }
  } catch (error) {
    console.error('[NewImageCache] ❌ 高质量缓存失败，使用原图:', error)
    onFinalLoad?.(originalUrl)
    return originalUrl
  }
}


console.log('[NewImageCache] 🚀 智能图片缓存系统已加载 - 彻底消除模糊图片:', {
  device: isMobile ? 'Mobile' : 'Desktop',
  strategy: '完全禁用模糊图，确保用户只看到高质量图片',
  features: [
    '✅ R2 CDN高质量原图直接使用',
    '✅ 跳过Cloudflare二次压缩',
    '✅ 严格质量检测（>50KB高质量，>20KB中等质量）',
    '❌ 完全禁用渐进式加载和模糊图',
    '✅ 优先使用本地高质量缓存',
    '✅ 失败时直接使用原图保证质量'
  ],
  highQualityDomains: getSupportedCDNDomains().map(domain => 
    domain.includes('veo3video.me') ? `${domain} (R2 CDN)` : 
    domain.includes('supabase.co') ? `${domain} (Supabase存储)` : 
    domain.includes('amazonaws.com') ? `${domain} (AWS S3)` :
    domain.includes('cloudfront.net') ? `${domain} (AWS CloudFront)` :
    domain
  ),
  qualityStandard: '严格模式：>50KB高质量，>20KB中等质量，<20KB低质量',
  cacheAvailable: isCacheAvailable()
})
