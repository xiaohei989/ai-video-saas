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
import { getProxyVideoUrl, needsCorsProxy } from '@/utils/videoUrlProxy'

// 移动端检测
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

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

// URL生成配置 - 提升质量设置
const URL_CONFIG = {
  blur: {
    width: 120,
    quality: 15,  // 模糊图保持低质量
    blur: 2
  },
  final: {
    width: isMobile ? 400 : 600,      // 提升分辨率
    quality: isMobile ? 90 : 95       // 大幅提升质量到90-95%
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
 * 生成两级质量的URL：模糊图 → 最终缩略图
 */
export const generateImageUrls = (originalUrl: string, enableFastPreview = true) => {
  if (!enableFastPreview) {
    return { final: originalUrl }
  }
  
  // URL检测逻辑
  const urlChecks = {
    hasTemplatesPath: originalUrl.includes('/templates/thumbnails/'),
    hasCDNDomain: originalUrl.includes('cdn.veo3video.me'),
    hasSupabaseDomain: originalUrl.includes('supabase.co'),
    isValidImageUrl: /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(originalUrl),
    hasHttpProtocol: originalUrl.startsWith('http'),
    hasRelativePath: originalUrl.startsWith('/')
  }
  
  const isCDNUrl = urlChecks.hasTemplatesPath || 
                   urlChecks.hasCDNDomain || 
                   urlChecks.hasSupabaseDomain ||
                   urlChecks.isValidImageUrl ||
                   true // 强制启用CDN处理
  
  if (!isCDNUrl) {
    return { final: originalUrl }
  }
  
  try {
    const cleanUrl = originalUrl.split('?')[0]
    
    let path: string
    
    if (cleanUrl.startsWith('/')) {
      path = cleanUrl
    } else if (cleanUrl.startsWith('http')) {
      try {
        const url = new URL(cleanUrl)
        path = url.pathname
      } catch (urlError) {
        return { final: originalUrl }
      }
    } else {
      path = '/' + cleanUrl
    }
    
    if (!path.startsWith('/')) {
      path = '/' + path
    }
    
    const result = {
      blur: `/cdn-cgi/image/w=${URL_CONFIG.blur.width},q=${URL_CONFIG.blur.quality},blur=${URL_CONFIG.blur.blur},f=auto${path}`,
      final: `/cdn-cgi/image/w=${URL_CONFIG.final.width},q=${URL_CONFIG.final.quality},f=auto${path}`
    }
    
    console.log('[NewImageCache] 🔗 URL转换详情:', {
      原始URL: originalUrl,
      提取路径: path,
      模糊图URL: result.blur,
      高清图URL: result.final,
      配置: {
        blur: `${URL_CONFIG.blur.width}px, 质量${URL_CONFIG.blur.quality}%, 模糊${URL_CONFIG.blur.blur}px`,
        final: `${URL_CONFIG.final.width}px, 质量${URL_CONFIG.final.quality}%`
      }
    })
    
    return result
  } catch (error) {
    console.error('[NewImageCache] URL生成失败:', error)
    return { final: originalUrl }
  }
}

/**
 * 获取缓存的图片
 */
export const getCachedImage = async (url: string, cacheKey?: string): Promise<string | null> => {
  const key = getCacheKey(url, cacheKey)
  
  console.log('[NewImageCache] 🔍 获取缓存图片:', {
    url: url.substring(0, 60) + '...',
    cacheKey: key.substring(0, 80) + '...'
  })
  
  try {
    const cached = await unifiedCache.get<string>(key, {
      category: 'image'
    })
    
    if (cached) {
      const isBase64 = cached.startsWith('data:')
      const size = cached.length
      
      console.log('[NewImageCache] ✅ 缓存命中:', {
        type: typeof cached,
        format: isBase64 ? 'Base64' : 'URL',
        size: `${(size / 1024).toFixed(2)}KB`,
        preview: cached.substring(0, 50) + '...',
        qualityHint: isBase64 && size > 100000 ? '可能是高清' : isBase64 && size < 50000 ? '可能是低质量/模糊' : '未知'
      })
      return cached
    }
    
    console.log('[NewImageCache] ❌ 缓存未命中')
    return null
  } catch (error) {
    console.error('[NewImageCache] ❌ 获取缓存失败:', error)
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
 * 直接缓存高清图片数据，无压缩处理
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
      // 缓存完整的Base64图片数据
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
    return imageUrl
  }
}

/**
 * 获取图片的Base64数据（无压缩）
 * 直接从原始图片URL获取完整图片数据用于缓存
 */
async function getImageAsBase64(url: string): Promise<string> {
  try {
    console.log('[NewImageCache] 📡 直接获取图片数据（无压缩）:', url.substring(0, 60) + '...')
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const blob = await response.blob()
    const base64 = await blobToBase64(blob)
    
    console.log('[NewImageCache] ✅ 高清图片数据获取完成:', {
      size: `${(blob.size / 1024).toFixed(2)}KB`,
      type: blob.type,
      base64Length: `${(base64.length / 1024).toFixed(2)}KB`
    })
    
    return base64
  } catch (error) {
    console.error('[NewImageCache] ❌ 获取图片数据失败:', error)
    return ''
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
 * 获取缓存统计信息
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
    globalStats: stats.summary
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
 * 优化版本：优先使用本地缓存，避免不必要的模糊图显示
 */
export const smartLoadImage = async (originalUrl: string, options: {
  enableFastPreview?: boolean
  onBlurLoad?: (blurUrl: string) => void
  onFinalLoad?: (finalUrl: string) => void
} = {}): Promise<string> => {
  console.log('[NewImageCache] 🧠 智能图片加载:', originalUrl.substring(0, 60) + '...')
  
  const { enableFastPreview = true, onBlurLoad, onFinalLoad } = options
  
  // 生成URL层级
  const urls = generateImageUrls(originalUrl, enableFastPreview)
  
  // 1. 最高优先级：检查高清图片缓存
  console.log('[NewImageCache] 🔍 检查高清图片缓存优先级...')
  console.log('[NewImageCache] 📋 URL生成结果:', {
    original: originalUrl,
    blur: urls.blur,
    final: urls.final,
    enableFastPreview
  })
  
  // 1.1 首先检查高清图缓存（最高优先级）
  const finalCached = await getCachedImage(urls.final || originalUrl)
  if (finalCached && finalCached.startsWith('data:')) {
    console.log('[NewImageCache] ⚡ 智能加载：高清缓存命中！直接使用无压缩图片')
    console.log('[NewImageCache] 📊 高清缓存分析:', {
      type: 'Base64高清图片',
      size: `${(finalCached.length / 1024).toFixed(2)}KB`,
      preview: finalCached.substring(0, 50) + '...',
      quality: '原图质量，无压缩损失'
    })
    
    // 高清缓存存在时，直接返回，不触发任何模糊图回调
    onFinalLoad?.(finalCached)
    return finalCached
  }
  
  // 1.2 检查原始URL缓存
  const originalCached = await getCachedImage(originalUrl)
  if (originalCached && originalCached.startsWith('data:')) {
    console.log('[NewImageCache] ⚡ 智能加载：原图缓存命中！使用高清数据')
    console.log('[NewImageCache] 📊 原图缓存分析:', {
      type: 'Base64原图数据',
      size: `${(originalCached.length / 1024).toFixed(2)}KB`,
      quality: '原图质量'
    })
    onFinalLoad?.(originalCached)
    return originalCached
  }
  
  // 2. 无缓存时：渐进式加载策略
  if (urls.blur && enableFastPreview) {
    console.log('[NewImageCache] 🔄 渐进式加载：先显示模糊图，后台缓存高清图')
    
    // 立即显示模糊图作为过渡
    onBlurLoad?.(urls.blur)
    
    // 后台异步缓存高清图
    setTimeout(async () => {
      try {
        console.log('[NewImageCache] 📡 后台开始缓存高清图片...')
        const cachedFinal = await cacheImage(urls.final || originalUrl, { compress: false })
        
        if (cachedFinal && cachedFinal.startsWith('data:')) {
          console.log('[NewImageCache] ✅ 渐进式加载：高清图缓存完成，无压缩损失')
          console.log('[NewImageCache] 📊 新缓存图片:', {
            size: `${(cachedFinal.length / 1024).toFixed(2)}KB`,
            quality: '原图高质量'
          })
          onFinalLoad?.(cachedFinal)
        } else {
          console.log('[NewImageCache] ⚠️ 缓存失败，使用CDN优化URL')
          onFinalLoad?.(urls.final || originalUrl)
        }
      } catch (error) {
        console.error('[NewImageCache] ❌ 高清图后台缓存失败:', error)
        onFinalLoad?.(urls.final || originalUrl)
      }
    }, 0)
    
    // 返回模糊图作为初始显示
    return urls.blur
  } else {
    // 没有模糊图或禁用快速预览，直接处理原图
    console.log('[NewImageCache] 🔄 直接模式：缓存高清原图')
    try {
      const cached = await cacheImage(originalUrl, { compress: false })
      if (cached && cached.startsWith('data:')) {
        console.log('[NewImageCache] ✅ 高清原图缓存完成')
      }
      onFinalLoad?.(cached)
      return cached
    } catch (error) {
      console.error('[NewImageCache] ❌ 原图处理失败:', error)
      onFinalLoad?.(originalUrl)
      return originalUrl
    }
  }
}


console.log('[NewImageCache] 🚀 简化版图片缓存系统已加载 - 无压缩高清缓存:', {
  device: isMobile ? 'Mobile' : 'Desktop',
  strategy: '直接缓存原图质量，无压缩损失',
  features: [
    '✅ 高清图片直接缓存',
    '✅ 渐进式加载（模糊→高清）',
    '✅ 优先使用本地缓存',
    '❌ 已移除复杂压缩逻辑',
    '❌ 已移除循环质量降级'
  ],
  cacheAvailable: isCacheAvailable()
})