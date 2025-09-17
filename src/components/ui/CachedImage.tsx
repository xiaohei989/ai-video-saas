import React, { useState, useEffect } from 'react'
import { cn } from '@/utils/cn'
import { getProxyVideoUrl, needsCorsProxy } from '@/utils/videoUrlProxy'

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  className?: string
  cacheKey?: string
  maxAge?: number // 缓存有效期（毫秒），默认24小时
}

export default function CachedImage({ 
  src, 
  alt, 
  className, 
  cacheKey, 
  maxAge = 24 * 60 * 60 * 1000, // 24小时
  ...props 
}: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const getCacheKey = (url: string) => {
    return cacheKey || `cached_img_${btoa(url).slice(0, 20)}`
  }

  // 管理存储配额，防止localStorage溢出
  const manageStorageQuota = () => {
    try {
      // 获取所有缓存键
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cached_img_'))
      
      // 如果缓存项目过多，清理最旧的
      if (cacheKeys.length > 20) { // 限制最多20个缓存项
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

  const getCachedImage = (url: string) => {
    try {
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
      console.warn('读取缓存图片失败:', error)
      return null
    }
  }

  const cacheImage = async (url: string): Promise<string> => {
    return new Promise((resolve) => {
      // 使用代理URL避免CORS问题
      const proxyUrl = getProxyVideoUrl(url)
      
      // 创建临时img元素来加载图片
      const img = new Image()
      
      // 使用统一的CORS处理逻辑
      if (needsCorsProxy(proxyUrl)) {
        img.crossOrigin = 'anonymous'
      }
      
      img.onload = () => {
        try {
          // 创建canvas来转换图片为Base64
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            console.warn('无法创建canvas context，使用原始URL')
            resolve(url)
            return
          }
          
          // 设置canvas尺寸与图片一致
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          
          // 将图片绘制到canvas上
          ctx.drawImage(img, 0, 0)
          
          // 获取Base64数据 - 使用更高压缩比
          const base64 = canvas.toDataURL('image/jpeg', 0.6) // 降低质量以减小大小
          
          // 检查大小并实施更严格的限制
          const estimatedSize = (base64.length * 0.75) / 1024 // 估算KB大小
          if (estimatedSize > 200) { // 降低单个文件大小限制到200KB
            console.log('[CachedImage] 图片过大，跳过缓存:', url, `约${estimatedSize.toFixed(1)}KB`)
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
              size: estimatedSize
            }
            localStorage.setItem(key, JSON.stringify(data))
            console.log('[CachedImage] 图片缓存成功:', url, `大小约${estimatedSize.toFixed(1)}KB`)
            resolve(base64)
          } catch (storageError) {
            if (storageError instanceof DOMException && storageError.name === 'QuotaExceededError') {
              console.log('存储空间不足，尝试清理缓存后重试...')
              // 强制清理更多缓存
              try {
                const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cached_img_'))
                const toDelete = Math.min(10, cacheKeys.length) // 清理10个或全部
                for (let i = 0; i < toDelete; i++) {
                  localStorage.removeItem(cacheKeys[i])
                }
                
                // 重试存储
                const key = getCacheKey(url)
                const data = {
                  base64,
                  timestamp: Date.now(),
                  size: estimatedSize
                }
                localStorage.setItem(key, JSON.stringify(data))
                console.log('[CachedImage] 清理后缓存成功:', url, `大小约${estimatedSize.toFixed(1)}KB`)
                resolve(base64)
              } catch (retryError) {
                console.warn('清理后仍然存储失败，使用原始URL:', retryError)
                resolve(url)
              }
            } else {
              console.warn('localStorage存储失败:', storageError)
              resolve(url)
            }
          }
        } catch (canvasError) {
          console.warn('Canvas转换失败:', canvasError)
          resolve(url)
        }
      }
      
      img.onerror = () => {
        // 如果是CORS错误且使用了代理URL，尝试使用原始URL
        if (proxyUrl !== url && needsCorsProxy(proxyUrl)) {
          // 创建新的img元素，不设置crossOrigin
          const fallbackImg = new Image()
          fallbackImg.onload = () => {
            resolve(url)
          }
          fallbackImg.onerror = () => {
            resolve(url)
          }
          fallbackImg.src = url
          return
        }
        
        // 其他错误情况，直接回退到原始URL
        resolve(url)
      }
      
      // 开始加载图片 - 使用代理URL
      img.src = proxyUrl
    })
  }

  useEffect(() => {
    const loadImage = async () => {
      setIsLoading(true)
      setHasError(false)
      
      // 先检查缓存
      const cached = getCachedImage(src)
      if (cached) {
        setImageSrc(cached)
        setIsLoading(false)
        return
      }
      
      // 缓存中没有，先显示代理URL，然后异步缓存
      const proxyUrl = getProxyVideoUrl(src)
      setImageSrc(proxyUrl)
      setIsLoading(false)
      
      // 异步缓存图片（只在生产环境且支持CORS的情况下缓存）
      if (!import.meta.env.DEV && needsCorsProxy(src)) {
        try {
          const finalSrc = await cacheImage(src)
          if (finalSrc !== src && finalSrc !== proxyUrl) {
            setImageSrc(finalSrc)
          }
        } catch (error) {
          // 缓存失败不影响显示，静默处理
        }
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