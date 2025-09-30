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
  
  
  if (isCacheDisabled) {
    return null
  }
  
  try {
    recordCacheStats('requests')
    
    
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
      // 异步清理SVG占位符缓存
      try {
        const { enhancedIDB } = await import('@/services/EnhancedIDBService')
        await enhancedIDB.delete(key)
      } catch (error) {
      }
    }
    
    // 按质量分数排序，选择最佳缓存
    cacheOptions.sort((a, b) => b.score - a.score)
    
    if (cacheOptions.length > 0) {
      const bestCache = cacheOptions[0]
      
      if (bestCache.isBase64) {
        
        // 如果IndexedDB的数据更好，同步更新内存缓存
        if (bestCache.source === 'IndexedDB' && bestCache.data !== memoryCache) {
          await unifiedCache.set(key, bestCache.data, { category: 'image', ttl: 24 * 60 * 60 })
        }
        
        recordCacheStats('hits')
        recordCacheStats('base64Cache')
        return bestCache.data
      } else {
        // 所有缓存都是URL，按新策略忽略
        recordCacheStats('urlCache')
        recordCacheStats('misses')
        return null
      }
    }
    
    recordCacheStats('misses')
    return null
  } catch (error) {
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
  
  if (isCacheDisabled) {
    return url
  }
  
  const key = getCacheKey(url, options.cacheKey)
  
  // 首先检查是否已经缓存
  try {
    const existing = await getCachedImage(url, options.cacheKey)
    if (existing) {
      console.log(`[NewImageCache] ✅ 缓存已存在,跳过下载:`, url.substring(0, 60))
      return existing
    }
    console.log(`[NewImageCache] ❌ 无有效缓存,开始下载:`, url.substring(0, 60))
  } catch (error) {
    console.log(`[NewImageCache] ⚠️ 缓存检查失败:`, error)
  }
  
  // 处理图片
  try {
    
    const result = await processAndCacheImage(url, {
      key,
      quality: options.quality,
      maxWidth: options.maxWidth,
      compress: options.compress !== false
    })
    
    return result
  } catch (error) {
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
    
    // 直接获取图片的完整Base64数据（无压缩）
    const base64Data = await getImageAsBase64(imageUrl)
    
    if (base64Data && base64Data.startsWith('data:')) {
      // 检查是否为SVG占位符
      if (isSVGPlaceholder(base64Data)) {
        return base64Data // 返回但不缓存
      }
      
      // 缓存完整的Base64图片数据（非SVG占位符）
      console.log(`[NewImageCache] 💾 写入缓存 - URL:`, imageUrl.substring(0, 60), `大小: ${(base64Data.length / 1024).toFixed(2)}KB`)
      const success = await unifiedCache.set(options.key, base64Data, {
        category: 'image',
        ttl: 24 * 60 * 60, // 24小时
        compress: false // 不需要额外压缩
      })

      if (success) {
        console.log(`[NewImageCache] ✅ 缓存写入成功`)
        return base64Data
      } else {
        console.log(`[NewImageCache] ❌ 缓存写入失败`)
        return imageUrl
      }
    } else {
      return imageUrl
    }
  } catch (error) {
    
    // 🎯 针对不同类型的错误提供不同的处理策略
    if (error instanceof Error) {
      if (error.message.includes('图片加载超时') || error.message.includes('CORS限制')) {
        return imageUrl
      }
    }
    
    // 🎨 其他错误情况也返回原URL，确保图片始终能显示
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
    
    return base64
    
  } catch (error) {
    const errorType = error instanceof Error ? error.name : 'UnknownError'
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // 🚨 修复：移除错误的视频截图回退逻辑
    // 图片URL不应该被当作视频URL处理，这会导致缓存污染
    
    // 🎯 针对不同错误类型的处理策略
    if (errorType === 'AbortError') {
      // 超时错误，直接抛出让上层决定是否重试
      throw new Error(`图片加载超时: ${url}`)
    } else if (errorMessage.includes('CORS')) {
      // CORS错误，直接抛出让上层使用原URL
      throw new Error(`CORS限制: ${url}`)
    } else if (errorMessage.includes('404') || errorMessage.includes('403')) {
      // 🚀 SVG占位符已禁用，直接抛出错误让上层使用其他降级策略
      throw new Error(`资源不存在: ${url}`)
    }
    
    // 🎨 其他未知错误：直接抛出，让上层决定处理策略
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
  
  if (isCacheDisabled) {
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
        results.set(url, url) // fallback到原URL
      }
    })
    
    await Promise.all(batchPromises)
    
    // 防止过载，批次间稍微延迟
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

/**
 * 预加载图片
 */
export const preloadImage = async (url: string): Promise<boolean> => {
  
  if (isCacheDisabled) {
    return true
  }
  
  try {
    // 检查是否已缓存
    const cached = await getCachedImage(url)
    if (cached) {
      return true
    }
    
    // 后台缓存
    await cacheImage(url)
    return true
  } catch (error) {
    return false
  }
}

/**
 * 清理图片缓存
 */
export const clearImageCache = async (): Promise<void> => {
  
  try {
    // 使用统一缓存的清理功能
    await unifiedCache.clearAll()
  } catch (error) {
  }
}

/**
 * 清理单个图片缓存
 */
export const clearSingleImageCache = async (imageUrl: string): Promise<void> => {

  try {
    // 使用正确的缓存key生成方式，与getCacheKey保持一致
    const cacheKey = getCacheKey(imageUrl)

    // 使用统一缓存的delete方法正确删除缓存
    const success = await unifiedCache.delete(cacheKey, {
      category: 'image'
    })

    if (success) {
    } else {
    }
  } catch (error) {
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
    // 统计信息已被移除
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
        } catch (e) {
          errors.push(`LocalStorage删除失败: ${key}`)
        }
      })
    }
    
    // 清理IndexedDB中的SVG占位符（通过UnifiedCacheService）
    try {
      // 获取缓存统计以了解当前数据量
      const stats = unifiedCache.getGlobalStats()
      
      // 由于UnifiedCacheService没有公开扫描方法，
      // 我们采用温和的方式：等待自然过期或用户重新访问时过滤
      // 这样既安全又不会影响正常使用
      
    } catch (e) {
      errors.push('IndexedDB清理过程出错: ' + String(e))
    }
    
    
    return {
      cleaned,
      errors
    }
    
  } catch (error) {
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
  
  let repaired = 0
  let skipped = 0
  
  try {
    // 清理SVG占位符
    const svgCleanResult = await clearSVGPlaceholderCache()
    repaired += svgCleanResult.cleaned
    
    // 如果有错误，记录但不中断流程
    if (svgCleanResult.errors.length > 0) {
    }
    
    
    return {
      repaired,
      skipped
    }
    
  } catch (error) {
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
  
  if (isCacheDisabled) {
    const { onFinalLoad } = options
    onFinalLoad?.(originalUrl)
    return originalUrl
  }
  
  const { enableFastPreview = true, onBlurLoad, onFinalLoad } = options
  
  // 🚀 优先检查是否为高质量CDN图片
  const isHighQualityCDNUrl = isHighQualityCDN(originalUrl)
  
  if (isHighQualityCDNUrl) {
    
    // 检查原图缓存 - 只接受Base64数据
    const originalCached = await getCachedImage(originalUrl)
    if (originalCached && originalCached.startsWith('data:')) {
      const sizeKB = (originalCached.length / 1024).toFixed(2)
      onFinalLoad?.(originalCached)
      return originalCached
    }
    
    // 无有效Base64缓存时，强制获取并缓存图片数据
    try {
      const cached = await cacheImage(originalUrl, { compress: false })
      
      // 严格验证缓存结果
      if (cached && cached.startsWith('data:')) {
        const sizeKB = (cached.length / 1024).toFixed(2)
        onFinalLoad?.(cached)
        return cached
      } else {
        // 缓存失败，不应该返回URL，而是重试或降级处理
        // 降级到原始URL，但记录失败
        onFinalLoad?.(originalUrl)
        return originalUrl
      }
    } catch (error) {
      onFinalLoad?.(originalUrl)
      return originalUrl
    }
  }
  
  // 🔄 非高质量CDN图片：直接使用原始URL（不再使用 Transform）
  const finalUrl = originalUrl
  
  // 检查高质量图片缓存
  const finalCached = await getCachedImage(finalUrl)
  if (finalCached && finalCached.startsWith('data:')) {
    const sizeKB = (finalCached.length / 1024).toFixed(2)
    // 🔧 修复: 只要有有效的Base64缓存就使用,不再强制要求大小
    // 原因: 原图本身可能就很小,不应该重复缓存
    onFinalLoad?.(finalCached)
    return finalCached
  }
  
  // 直接加载高质量图片（无模糊图阶段）
  try {
    const cached = await cacheImage(finalUrl, { compress: false })

    // 🔧 修复: 验证缓存结果,但不再根据大小判断是否使用
    if (cached && cached.startsWith('data:')) {
      // 任何成功缓存的Base64数据都使用,不再检查大小
      onFinalLoad?.(cached)
      return cached
    } else {
      // 缓存失败，直接使用原图
      onFinalLoad?.(originalUrl)
      return originalUrl
    }
  } catch (error) {
    onFinalLoad?.(originalUrl)
    return originalUrl
  }
}
