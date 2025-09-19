import React, { useState, useEffect } from 'react'
import { cn } from '@/utils/cn'
import { getProxyVideoUrl, needsCorsProxy } from '@/utils/videoUrlProxy'
import { cacheHealthChecker } from '@/utils/cacheHealthChecker'
import { cacheHitTracker } from '@/utils/cacheHitTracker'

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  className?: string
  cacheKey?: string
  maxAge?: number // 缓存有效期（毫秒），开发环境1小时，生产环境24小时
}

export default function CachedImage({ 
  src, 
  alt, 
  className, 
  cacheKey, 
  maxAge = import.meta.env.DEV ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 开发环境1小时，生产环境24小时
  ...props 
}: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // 移动端检测
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  // 移动端优化配置 - 压缩优化后调整
  const config = {
    imageQuality: isMobile ? 0.4 : 0.7,  // 提升压缩后的缓存质量
    maxFileSize: isMobile ? 250 : 500,    // 🚀 适应压缩后的图片大小，放宽限制
    maxCacheItems: isMobile ? 50 : 100    // 🚀 移动端从10增加到50，桌面端从20增加到100
  }

  const getCacheKey = (url: string) => {
    return cacheKey || `cached_img_${btoa(url).slice(0, 20)}`
  }

  // 管理存储配额，防止localStorage溢出
  const manageStorageQuota = () => {
    try {
      // 获取所有缓存键
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cached_img_'))
      
      // 如果缓存项目过多，清理最旧的
      if (cacheKeys.length > config.maxCacheItems) { // 根据设备类型动态限制
        const cacheItems = cacheKeys.map(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}')
            return { key, timestamp: data.timestamp || 0 }
          } catch {
            return { key, timestamp: 0 }
          }
        }).sort((a, b) => a.timestamp - b.timestamp)
        
        // 删除最旧的缓存项
        const toDelete = cacheItems.slice(0, 5) // 一次删除5个最旧的
        toDelete.forEach(item => {
          localStorage.removeItem(item.key)
          console.log('清理旧缓存:', item.key)
        })
      }
    } catch (error) {
      console.warn('清理缓存失败:', error)
    }
  }

  // 检测localStorage是否可用（私人浏览模式可能禁用）
  const isLocalStorageAvailable = () => {
    try {
      const testKey = '__localStorage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  const getCachedImage = (url: string) => {
    try {
      if (!isLocalStorageAvailable()) {
        console.warn(`[CachedImage] localStorage不可用(${isMobile ? 'Mobile' : 'Desktop'})，可能在私人浏览模式`)
        return null
      }
      
      const key = getCacheKey(url)
      const cached = localStorage.getItem(key)
      if (!cached) return null

      const data = JSON.parse(cached)
      const now = Date.now()
      
      // 检查是否过期
      if (now - data.timestamp > maxAge) {
        localStorage.removeItem(key)
        return null
      }
      
      return data.base64
    } catch (error) {
      console.warn(`[CachedImage] 读取缓存失败(${isMobile ? 'Mobile' : 'Desktop'}):`, error)
      return null
    }
  }

  const cacheImage = async (url: string): Promise<string> => {
    return new Promise((resolve) => {
      // 📊 缓存诊断开始
      const startTime = performance.now()
      const deviceType = isMobile ? 'Mobile' : 'Desktop'
      const debugPrefix = `[CachedImage:${deviceType}]`
      
      console.log(`${debugPrefix} 🚀 开始缓存图片:`, url)
      
      // 🔍 记录缓存尝试
      cacheHealthChecker.recordCacheAttempt()
      
      // 检查localStorage是否可用
      if (!isLocalStorageAvailable()) {
        console.warn(`${debugPrefix} ❌ localStorage不可用，跳过缓存 (可能在私人浏览模式)`)
        resolve(url)
        return
      }
      
      // 使用代理URL避免CORS问题
      const proxyUrl = getProxyVideoUrl(url)
      const isUsingProxy = proxyUrl !== url
      
      console.log(`${debugPrefix} 🔄 代理状态:`, {
        original: url,
        proxy: proxyUrl,
        isUsingProxy,
        needsCors: needsCorsProxy(proxyUrl)
      })
      
      // 创建临时img元素来加载图片
      const img = new Image()
      
      // CORS设置优化：尝试设置crossOrigin以支持缓存
      // 必须在设置src之前设置crossOrigin（移动Safari要求）
      const shouldSetCors = needsCorsProxy(proxyUrl)
      if (shouldSetCors) {
        img.crossOrigin = 'anonymous'
        console.log(`${debugPrefix} 🔒 设置CORS: anonymous`)
      }
      
      img.onload = () => {
        try {
          const loadTime = performance.now() - startTime
          console.log(`${debugPrefix} ✅ 图片加载成功 (${loadTime.toFixed(1)}ms):`, {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            src: img.src.substring(0, 80) + '...'
          })
          
          // 创建canvas来转换图片为Base64
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            console.warn(`${debugPrefix} ❌ 无法创建canvas context，使用原始URL`)
            resolve(url)
            return
          }
          
          // 设置canvas尺寸与图片一致
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          
          // 将图片绘制到canvas上
          ctx.drawImage(img, 0, 0)
          
          // Canvas taint检测：尝试获取一个像素来测试是否污染
          try {
            ctx.getImageData(0, 0, 1, 1)
            console.log(`${debugPrefix} ✅ Canvas taint检测通过`)
          } catch (taintError) {
            // 🔍 记录Canvas污染错误
            cacheHealthChecker.recordCanvasTaintError(url)
            
            console.error(`${debugPrefix} ❌ Canvas被污染，无法缓存:`, {
              url,
              proxyUrl,
              isUsingProxy,
              shouldSetCors,
              error: taintError.message,
              errorType: taintError.constructor.name
            })
            
            // 如果使用了代理且Canvas被污染，尝试不使用CORS的方式
            if (isUsingProxy && shouldSetCors) {
              console.log(`${debugPrefix} 🔄 尝试无CORS模式重新加载...`)
              const noCorsImg = new Image()
              noCorsImg.onload = () => {
                console.log(`${debugPrefix} ✅ 无CORS模式加载成功，但无法缓存`)
                resolve(url)
              }
              noCorsImg.onerror = () => {
                console.warn(`${debugPrefix} ❌ 无CORS模式也失败`)
                resolve(url)
              }
              noCorsImg.src = proxyUrl
              return
            }
            
            resolve(url)
            return
          }
          
          // 获取Base64数据 - 根据设备类型使用不同压缩比
          const canvasStartTime = performance.now()
          const base64 = canvas.toDataURL('image/jpeg', config.imageQuality)
          const canvasTime = performance.now() - canvasStartTime
          
          // 检查大小并实施设备相关的限制
          const estimatedSize = (base64.length * 0.75) / 1024 // 估算KB大小
          
          console.log(`${debugPrefix} 📊 Canvas转换完成:`, {
            canvasTime: `${canvasTime.toFixed(1)}ms`,
            quality: config.imageQuality,
            estimatedSize: `${estimatedSize.toFixed(1)}KB`,
            maxAllowed: `${config.maxFileSize}KB`,
            base64Length: base64.length
          })
          
          if (estimatedSize > config.maxFileSize) {
            console.warn(`${debugPrefix} ⚠️ 图片过大，跳过缓存:`, {
              url,
              size: `${estimatedSize.toFixed(1)}KB`,
              limit: `${config.maxFileSize}KB`,
              ratio: `${(estimatedSize / config.maxFileSize).toFixed(2)}x`
            })
            resolve(url)
            return
          }
          
          // 检查总缓存大小，如果接近限制则清理旧缓存
          manageStorageQuota()
          
          try {
            const key = getCacheKey(url)
            const data = {
              base64,
              timestamp: Date.now(),
              size: estimatedSize,
              deviceType,
              quality: config.imageQuality,
              dimensions: `${img.naturalWidth}x${img.naturalHeight}`,
              processTime: performance.now() - startTime
            }
            
            const storageStartTime = performance.now()
            localStorage.setItem(key, JSON.stringify(data))
            const storageTime = performance.now() - storageStartTime
            
            console.log(`${debugPrefix} 🎉 图片缓存成功:`, {
              url: url.substring(0, 60) + '...',
              key: key.substring(0, 30) + '...',
              size: `${estimatedSize.toFixed(1)}KB`,
              totalTime: `${(performance.now() - startTime).toFixed(1)}ms`,
              storageTime: `${storageTime.toFixed(1)}ms`,
              dimensions: data.dimensions
            })
            
            // 🔍 记录缓存成功
            cacheHealthChecker.recordCacheSuccess(estimatedSize, performance.now() - startTime)
            
            resolve(base64)
          } catch (storageError) {
            if (storageError instanceof DOMException && storageError.name === 'QuotaExceededError') {
              // 🔍 记录配额超限错误
              cacheHealthChecker.recordQuotaError()
              
              console.warn(`${debugPrefix} ⚠️ 存储空间不足，尝试清理缓存后重试...`)
              
              // 强制清理更多缓存
              try {
                const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cached_img_'))
                const beforeCount = cacheKeys.length
                const toDelete = Math.min(10, cacheKeys.length) // 清理10个或全部
                
                for (let i = 0; i < toDelete; i++) {
                  localStorage.removeItem(cacheKeys[i])
                }
                
                console.log(`${debugPrefix} 🧹 清理缓存: ${toDelete}/${beforeCount}项`)
                
                // 重试存储
                const key = getCacheKey(url)
                const data = {
                  base64,
                  timestamp: Date.now(),
                  size: estimatedSize,
                  deviceType,
                  retried: true
                }
                localStorage.setItem(key, JSON.stringify(data))
                console.log(`${debugPrefix} ✅ 清理后缓存成功:`, `${estimatedSize.toFixed(1)}KB`)
                resolve(base64)
              } catch (retryError) {
                console.error(`${debugPrefix} ❌ 清理后仍然存储失败:`, {
                  error: retryError.message,
                  type: retryError.constructor.name
                })
                resolve(url)
              }
            } else {
              console.error(`${debugPrefix} ❌ localStorage存储失败:`, {
                error: storageError.message,
                type: storageError.constructor.name,
                estimatedSize: `${estimatedSize.toFixed(1)}KB`
              })
              resolve(url)
            }
          }
        } catch (canvasError) {
          console.error(`${debugPrefix} ❌ Canvas转换失败:`, {
            error: canvasError.message,
            type: canvasError.constructor.name,
            url,
            dimensions: `${img.naturalWidth}x${img.naturalHeight}`
          })
          resolve(url)
        }
      }
      
      img.onerror = (errorEvent) => {
        const loadTime = performance.now() - startTime
        
        // 🔍 记录加载失败
        cacheHealthChecker.recordLoadFailure(url)
        
        console.error(`${debugPrefix} ❌ 图片加载失败 (${loadTime.toFixed(1)}ms):`, {
          url,
          proxyUrl,
          isUsingProxy,
          shouldSetCors,
          error: errorEvent,
          errorType: 'LoadError'
        })
        
        // 🔧 改进的CORS处理和回退策略
        if (isUsingProxy && shouldSetCors) {
          console.log(`${debugPrefix} 🔄 CORS错误，尝试多级回退策略...`)
          
          // 第一级回退：尝试不使用CORS的代理URL
          const fallbackImg1 = new Image()
          fallbackImg1.onload = () => {
            console.log(`${debugPrefix} ✅ 无CORS代理URL加载成功`)
            resolve(proxyUrl)
          }
          fallbackImg1.onerror = () => {
            // 第二级回退：尝试原始URL + CORS
            console.log(`${debugPrefix} 🔄 尝试原始URL + CORS...`)
            const fallbackImg2 = new Image()
            fallbackImg2.crossOrigin = 'anonymous'
            fallbackImg2.onload = () => {
              console.log(`${debugPrefix} ✅ 原始URL + CORS加载成功`)
              resolve(url)
            }
            fallbackImg2.onerror = () => {
              // 第三级回退：直接使用原始URL
              console.log(`${debugPrefix} 🔄 最终回退到原始URL...`)
              const fallbackImg3 = new Image()
              fallbackImg3.onload = () => {
                console.log(`${debugPrefix} ✅ 原始URL加载成功（无缓存）`)
                resolve(url)
              }
              fallbackImg3.onerror = (finalError) => {
                console.error(`${debugPrefix} ❌ 所有回退策略失败:`, finalError)
                resolve(url) // 即使失败也返回URL，让浏览器处理
              }
              fallbackImg3.src = url
            }
            fallbackImg2.src = url
          }
          fallbackImg1.src = proxyUrl
          return
        }
        
        // 其他错误情况，直接回退到原始URL
        console.warn(`${debugPrefix} ⚠️ 直接回退到原始URL`)
        resolve(url)
      }
      
      // 开始加载图片 - 使用代理URL
      console.log(`${debugPrefix} 📡 开始加载:`, proxyUrl.substring(0, 80) + '...')
      img.src = proxyUrl
    })
  }

  useEffect(() => {
    const loadImage = async () => {
      setIsLoading(true)
      setHasError(false)
      
      // 🚀 双重缓存策略优化
      // 第一层：检查localStorage缓存（优先级最高）
      const cached = getCachedImage(src)
      if (cached) {
        cacheHitTracker.recordImageHit(src, 'localStorage')
        setImageSrc(cached)
        setIsLoading(false)
        return
      }
      
      // 第二层：使用代理URL作为备用缓存机制
      const proxyUrl = getProxyVideoUrl(src)
      const isUsingProxy = proxyUrl !== src
      
      if (isUsingProxy) {
        console.log(`[CachedImage] 🔄 使用代理URL缓存: ${proxyUrl.substring(0, 60)}...`)
        cacheHitTracker.recordImageHit(src, 'proxy')
      } else {
        // 没有缓存，记录未命中
        cacheHitTracker.recordImageMiss(src)
      }
      
      // 立即显示代理URL（或原始URL）
      setImageSrc(proxyUrl)
      setIsLoading(false)
      
      // 🎯 智能后台缓存策略
      // 只有在代理URL成功的情况下才尝试Base64缓存
      if (isUsingProxy || needsCorsProxy(src)) {
        try {
          // 静默Base64缓存，为下次访问做准备
          console.log(`[CachedImage] 🔄 开始后台Base64缓存: ${src.substring(0, 60)}...`)
          const cachedBase64 = await cacheImage(src)
          
          // 仅在成功获取Base64时才更新显示（可选优化）
          if (cachedBase64 !== src && cachedBase64.startsWith('data:image/')) {
            console.log(`[CachedImage] ✅ Base64缓存完成，下次访问将更快`)
            // 不立即切换，避免闪烁，让下次访问直接使用Base64
          }
        } catch (error) {
          // 缓存失败不影响显示，静默处理
          console.warn('[CachedImage] ⚠️ 后台缓存失败，静默处理:', error)
        }
      } else {
        console.log(`[CachedImage] ✅ 直接使用原始URL，无需额外缓存`)
      }
    }

    loadImage()
  }, [src])

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = () => {
    // 如果是CORS错误，尝试不带crossOrigin重新加载
    if (needsCorsProxy(imageSrc)) {
      // 创建一个新的img元素测试不带crossOrigin的加载
      const testImg = new Image()
      testImg.onload = () => {
        setImageSrc(imageSrc + '?fallback=' + Date.now()) // 添加时间戳强制刷新
        setIsLoading(false)
        setHasError(false)
      }
      testImg.onerror = () => {
        setIsLoading(false)
        setHasError(true)
      }
      testImg.src = imageSrc
      return
    }
    
    setIsLoading(false)
    setHasError(true)
  }

  if (isLoading) {
    return (
      <div className={cn("bg-muted animate-pulse", className)} {...props}>
        <div className="w-full h-full bg-muted-foreground/10 flex items-center justify-center">
          <div className="text-xs text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className={cn("bg-muted", className)} {...props}>
        <div className="w-full h-full bg-muted-foreground/10 flex items-center justify-center">
          <div className="text-xs text-muted-foreground">加载失败</div>
        </div>
      </div>
    )
  }

  // 智能决定是否需要设置crossOrigin属性
  const needsCors = needsCorsProxy(imageSrc)
  
  // 如果URL包含fallback参数，说明是重试加载，不设置crossOrigin
  const isFallbackLoad = imageSrc.includes('?fallback=')
  const shouldSetCors = needsCors && !isFallbackLoad
  
  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      crossOrigin={shouldSetCors ? 'anonymous' : undefined}
      {...props}
    />
  )
}