/**
 * 图片缓存工具函数
 * 从 CachedImage 组件提取的核心缓存逻辑
 */

import { getProxyVideoUrl, needsCorsProxy } from '@/utils/videoUrlProxy'

// 移动端检测
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// 缓存禁用检查
const isCacheDisabled = import.meta.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE === 'true'

// 🔍 调试日志：缓存配置
console.log('[ImageCache] 📋 缓存配置状态:')
console.log('[ImageCache]   VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE:', import.meta.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE)
console.log('[ImageCache]   isCacheDisabled:', isCacheDisabled)
console.log('[ImageCache]   isMobile:', isMobile)

// 移动端优化配置
const config = {
  imageQuality: isMobile ? 0.4 : 0.7,
  maxFileSize: isMobile ? 250 : 500,
  maxCacheItems: isMobile ? 50 : 100
}

console.log('[ImageCache] ⚙️ 设备配置:', config)

/**
 * 生成缓存键
 */
export const getCacheKey = (url: string, cacheKey?: string) => {
  if (cacheKey) {
    return cacheKey
  }

  const encodedUrl = (() => {
    try {
      return encodeURIComponent(url)
    } catch {
      return encodeURIComponent(String(url ?? ''))
    }
  })()

  return `cached_img_${encodedUrl}`
}

/**
 * 生成两级质量的URL：模糊图 → 最终缩略图
 */
export const generateImageUrls = (originalUrl: string, enableFastPreview = true) => {
  if (!enableFastPreview) {
    return { final: originalUrl }
  }
  
  // CDN检测逻辑
  const urlChecks = {
    hasTemplatesPath: originalUrl.includes('/templates/thumbnails/'),
    hasCDNDomain: originalUrl.includes('cdn.veo3video.me'),
    hasApiPath: originalUrl.includes('/api/'),
    hasSupabaseDomain: originalUrl.includes('supabase.co'),
    hasCloudflare: originalUrl.includes('cloudflare'),
    hasHttpProtocol: originalUrl.startsWith('http'),
    hasRelativePath: originalUrl.startsWith('/'),
    isValidImageUrl: /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(originalUrl)
  }
  
  const isCDNUrl = urlChecks.hasTemplatesPath || 
                   urlChecks.hasCDNDomain || 
                   urlChecks.hasSupabaseDomain ||
                   urlChecks.isValidImageUrl ||
                   true // 强制启用用于测试
  
  if (!isCDNUrl) {
    return { final: originalUrl }
  }
  
  try {
    // 生成两级质量的URL
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
      blur: `/cdn-cgi/image/w=150,q=20,blur=1,f=auto${path}`,
      final: `/cdn-cgi/image/w=400,q=75,f=auto${path}`
    }
    
    return result
  } catch (error) {
    return { final: originalUrl }
  }
}

/**
 * 检测localStorage是否可用
 */
export const isLocalStorageAvailable = () => {
  try {
    console.log('[ImageCache] 🔍 检测localStorage可用性...')
    const testKey = '__localStorage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    console.log('[ImageCache] ✅ localStorage可用')
    return true
  } catch (error) {
    console.warn('[ImageCache] ❌ localStorage不可用:', error)
    return false
  }
}

/**
 * 获取缓存的图片
 */
export const getCachedImage = (url: string, cacheKey?: string) => {
  console.log('[ImageCache] 🔍 getCachedImage 调用:', url.substring(0, 80) + '...')
  
  try {
    if (isCacheDisabled) {
      console.log('[ImageCache] ⚠️ 缓存被禁用，跳过缓存检查')
      return null
    }
    
    if (!isLocalStorageAvailable()) {
      console.log('[ImageCache] ⚠️ localStorage不可用，跳过缓存检查')
      return null
    }
    
    const key = getCacheKey(url, cacheKey)
    console.log('[ImageCache] 🔑 使用缓存键:', key.substring(0, 50) + '...')
    
    const cached = localStorage.getItem(key)
    if (!cached) {
      console.log('[ImageCache] 🔍 缓存未命中')
      return null
    }
    
    console.log('[ImageCache] ✅ 发现缓存数据，长度:', cached.length)

    const data = JSON.parse(cached)
    const now = Date.now()
    
    // 缓存有效期：24小时
    const cacheMaxAge = 24 * 60 * 60 * 1000
    const age = now - data.timestamp
    const remainingHours = Math.floor((cacheMaxAge - age) / (60 * 60 * 1000))
    
    console.log('[ImageCache] ⏰ 缓存时间检查:')
    console.log('[ImageCache]   缓存创建时间:', new Date(data.timestamp).toLocaleString())
    console.log('[ImageCache]   当前时间:', new Date(now).toLocaleString()) 
    console.log('[ImageCache]   缓存年龄:', Math.floor(age / (60 * 60 * 1000)), '小时')
    console.log('[ImageCache]   剩余有效时间:', remainingHours, '小时')
    
    if (now - data.timestamp > cacheMaxAge) {
      console.log('[ImageCache] ❌ 缓存已过期，清理')
      localStorage.removeItem(key)
      return null
    }
    
    console.log('[ImageCache] ✅ 缓存命中，返回Base64数据，长度:', data.base64.length)
    return data.base64
  } catch (error) {
    console.error('[ImageCache] ❌ getCachedImage 异常:', error)
    return null
  }
}

/**
 * 缓存图片（简化版）
 */
export const cacheImage = async (url: string, cacheKey?: string): Promise<string> => {
  console.log('[ImageCache] 🚀 cacheImage 开始处理:', url.substring(0, 80) + '...')
  
  return new Promise((resolve) => {
    if (isCacheDisabled) {
      console.log('[ImageCache] ⚠️ 缓存被禁用，直接返回原URL')
      resolve(url)
      return
    }
    
    if (!isLocalStorageAvailable()) {
      console.log('[ImageCache] ⚠️ localStorage不可用，直接返回原URL')
      resolve(url)
      return
    }
    
    console.log('[ImageCache] ✅ 缓存条件检查通过，开始处理图片')
    
    const proxyUrl = getProxyVideoUrl(url)
    console.log('[ImageCache] 🌐 代理URL:', proxyUrl.substring(0, 80) + '...')
    
    const img = new Image()
    
    const shouldSetCors = needsCorsProxy(proxyUrl)
    console.log('[ImageCache] 🔒 CORS设置:', shouldSetCors ? '需要' : '不需要')
    if (shouldSetCors) {
      img.crossOrigin = 'anonymous'
    }
    
    img.onload = () => {
      console.log('[ImageCache] 📷 图片加载成功')
      console.log('[ImageCache] 📏 图片尺寸:', img.naturalWidth, 'x', img.naturalHeight)
      
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          console.error('[ImageCache] ❌ 无法获取Canvas上下文')
          resolve(url)
          return
        }
        
        console.log('[ImageCache] 🖼️ Canvas创建成功，开始绘制')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
        
        // Canvas taint检测
        try {
          ctx.getImageData(0, 0, 1, 1)
          console.log('[ImageCache] ✅ Canvas taint检测通过')
        } catch (taintError) {
          console.error('[ImageCache] ❌ Canvas被污染，无法缓存:', taintError)
          resolve(url)
          return
        }
        
        const base64 = canvas.toDataURL('image/jpeg', config.imageQuality)
        const estimatedSize = (base64.length * 0.75) / 1024
        
        console.log('[ImageCache] 📊 Base64转换完成:')
        console.log('[ImageCache]   Base64长度:', base64.length)
        console.log('[ImageCache]   预估大小:', estimatedSize.toFixed(2), 'KB')
        console.log('[ImageCache]   最大允许:', config.maxFileSize, 'KB')
        console.log('[ImageCache]   图片质量:', config.imageQuality)
        
        if (estimatedSize > config.maxFileSize) {
          console.warn('[ImageCache] ⚠️ 文件大小超限，不缓存')
          resolve(url)
          return
        }
        
        try {
          const key = getCacheKey(url, cacheKey)
          const data = {
            base64,
            timestamp: Date.now(),
            size: estimatedSize,
            deviceType: isMobile ? 'Mobile' : 'Desktop',
            quality: config.imageQuality,
            dimensions: `${img.naturalWidth}x${img.naturalHeight}`
          }
          
          console.log('[ImageCache] 💾 准备写入localStorage:')
          console.log('[ImageCache]   缓存键:', key.substring(0, 50) + '...')
          console.log('[ImageCache]   数据大小:', JSON.stringify(data).length, 'bytes')
          
          localStorage.setItem(key, JSON.stringify(data))
          
          // 验证写入是否成功
          const verification = localStorage.getItem(key)
          if (verification) {
            console.log('[ImageCache] ✅ 缓存写入成功！验证长度:', verification.length)
          } else {
            console.error('[ImageCache] ❌ 缓存写入失败，无法验证')
          }
          
          resolve(base64)
        } catch (storageError) {
          console.error('[ImageCache] ❌ localStorage写入异常:', storageError)
          
          // 尝试清理一些缓存空间
          if (storageError.name === 'QuotaExceededError') {
            console.log('[ImageCache] 🧹 存储配额不足，尝试清理旧缓存')
            try {
              // 简单的LRU清理：删除一些旧缓存
              const keys = Object.keys(localStorage).filter(k => k.startsWith('cached_img_'))
              if (keys.length > 5) {
                keys.slice(0, 5).forEach(k => localStorage.removeItem(k))
                console.log('[ImageCache] 🧹 已清理5个旧缓存条目')
              }
            } catch (cleanupError) {
              console.error('[ImageCache] 🧹 清理缓存失败:', cleanupError)
            }
          }
          
          resolve(url)
        }
      } catch (canvasError) {
        console.error('[ImageCache] ❌ Canvas处理异常:', canvasError)
        resolve(url)
      }
    }
    
    img.onerror = (error) => {
      console.error('[ImageCache] ❌ 图片加载失败:', error)
      console.error('[ImageCache] ❌ 失败的URL:', proxyUrl)
      resolve(url)
    }
    
    console.log('[ImageCache] 📡 开始加载图片:', proxyUrl.substring(0, 80) + '...')
    img.src = proxyUrl
  })
}