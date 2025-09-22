import React, { useState, useEffect, useLayoutEffect } from 'react'
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
  
  // 两级加载功能
  fastPreview?: boolean // 启用两级加载模式（模糊图→最终图）
}

export default function CachedImage({ 
  src, 
  alt, 
  className, 
  cacheKey, 
  maxAge = import.meta.env.DEV ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 开发环境1小时，生产环境24小时
  
  // 两级加载参数
  fastPreview = false,
  
  ...props 
}: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  
  // 两级加载状态
  const [isShowingBlur, setIsShowingBlur] = useState(false)
  const [imageSrcToShow, setImageSrcToShow] = useState<string>('')

  // 移动端检测
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  
  // 缓存禁用检查 - 通过环境变量控制
  const isCacheDisabled = import.meta.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE === 'true'
  
  // 🔧 调试：组件创建和生命周期追踪
  const componentId = React.useMemo(() => Math.random().toString(36).substr(2, 5), [])
  
  // 调试信息（仅在开发环境显示）

  
  // 移动端优化配置 - 压缩优化后调整
  const config = {
    imageQuality: isMobile ? 0.4 : 0.7,  // 提升压缩后的缓存质量
    maxFileSize: isMobile ? 250 : 500,    // 🚀 适应压缩后的图片大小，放宽限制
    maxCacheItems: isMobile ? 50 : 100    // 🚀 移动端从10增加到50，桌面端从20增加到100
  }

  const getCacheKey = (url: string, level?: 'blur' | 'final') => {
    const suffix = level ? `_${level}` : ''

    if (cacheKey) {
      return `${cacheKey}${suffix}`
    }

    // 使用完整URL生成唯一缓存键，避免不同模板命中同一条目
    const encodedUrl = (() => {
      try {
        return encodeURIComponent(url)
      } catch {
        return encodeURIComponent(String(url ?? ''))
      }
    })()

    return `cached_img${suffix}_${encodedUrl}`
  }
  
  // 生成两级质量的URL：模糊图 → 最终缩略图
  const generateImageUrls = (originalUrl: string) => {
    if (!fastPreview) {
      return { final: originalUrl }
    }
    
    // 🔧 优化的CDN检测逻辑 - 更精确的匹配条件
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
    
    // 🚨 测试模式：暂时强制启用所有图片的模糊图功能
    const isCDNUrl = urlChecks.hasTemplatesPath || 
                     urlChecks.hasCDNDomain || 
                     urlChecks.hasSupabaseDomain ||
                     urlChecks.isValidImageUrl ||
                     true // 🔧 强制启用用于测试
    
    if (!isCDNUrl) {
      return { final: originalUrl }
    }
    
    try {
      // 生成两级质量的URL
      const cleanUrl = originalUrl.split('?')[0] // 移除查询参数
      
      // 安全处理URL路径 - 支持相对和绝对路径
      let path: string
      
      if (cleanUrl.startsWith('/')) {
        // 相对路径：直接使用
        path = cleanUrl
      } else if (cleanUrl.startsWith('http')) {
        // 绝对路径：提取pathname
        try {
          const url = new URL(cleanUrl)
          path = url.pathname
        } catch (urlError) {
          return { final: originalUrl }
        }
      } else {
        // 其他情况：假设为相对路径，添加前导斜杠
        path = '/' + cleanUrl
      }
      
      // 确保路径格式正确
      if (!path.startsWith('/')) {
        path = '/' + path
      }
      
      const result = {
        blur: `/cdn-cgi/image/w=150,q=20,blur=1,f=auto${path}`,   // 模糊图：立即显示
        final: `/cdn-cgi/image/w=400,q=75,f=auto${path}`          // 最终缩略图：高质量
      }
      
      return result
    } catch (error) {
      // 发生任何错误时回退到原始URL
      return { final: originalUrl }
    }
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

  const getCachedImage = (url: string, level?: 'blur' | 'final') => {
    try {
      // 检查缓存是否被禁用
      if (isCacheDisabled) {
        return null
      }
      
      if (!isLocalStorageAvailable()) {
        return null
      }
      
      const key = getCacheKey(url, level)
      const cached = localStorage.getItem(key)
      if (!cached) return null

      const data = JSON.parse(cached)
      const now = Date.now()
      
      // 不同级别的缓存有效期
      const cacheMaxAge = level === 'blur' ? 7 * 24 * 60 * 60 * 1000 : // 模糊图7天
                          level === 'final' ? 24 * 60 * 60 * 1000 : // 最终图1天
                          maxAge // 默认缓存时间
      
      // 检查是否过期
      if (now - data.timestamp > cacheMaxAge) {
        localStorage.removeItem(key)
        return null
      }
      
      return data.base64
    } catch (error) {
      return null
    }
  }

  const cacheImage = async (url: string, level?: 'blur' | 'final'): Promise<string> => {
    return new Promise((resolve) => {
      // 📊 缓存诊断开始
      const startTime = performance.now()
      const deviceType = isMobile ? 'Mobile' : 'Desktop'
      
      // 检查缓存是否被禁用
      if (isCacheDisabled) {
        resolve(url)
        return
      }
      
      // 🔍 记录缓存尝试
      cacheHealthChecker.recordCacheAttempt()
      
      // 检查localStorage是否可用
      if (!isLocalStorageAvailable()) {
        resolve(url)
        return
      }
      
      // 使用代理URL避免CORS问题
      const proxyUrl = getProxyVideoUrl(url)
      const isUsingProxy = proxyUrl !== url
      
      // 创建临时img元素来加载图片
      const img = new Image()
      
      // CORS设置优化：尝试设置crossOrigin以支持缓存
      // 必须在设置src之前设置crossOrigin（移动Safari要求）
      const shouldSetCors = needsCorsProxy(proxyUrl)
      if (shouldSetCors) {
        img.crossOrigin = 'anonymous'
      }
      
      img.onload = () => {
        try {
          const loadTime = performance.now() - startTime
          
          // 创建canvas来转换图片为Base64
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
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
          } catch (taintError) {
            // 🔍 记录Canvas污染错误
            cacheHealthChecker.recordCanvasTaintError(url)
            
            // 如果使用了代理且Canvas被污染，尝试不使用CORS的方式
            if (isUsingProxy && shouldSetCors) {
              const noCorsImg = new Image()
              noCorsImg.onload = () => {
                resolve(url)
              }
              noCorsImg.onerror = () => {
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
          
          if (estimatedSize > config.maxFileSize) {
            resolve(url)
            return
          }
          
          // 检查总缓存大小，如果接近限制则清理旧缓存
          manageStorageQuota()
          
          try {
            const key = getCacheKey(url, level)
            const data = {
              base64,
              timestamp: Date.now(),
              size: estimatedSize,
              deviceType,
              quality: config.imageQuality,
              dimensions: `${img.naturalWidth}x${img.naturalHeight}`,
              processTime: performance.now() - startTime,
              level: level || 'default'
            }
            
            const storageStartTime = performance.now()
            localStorage.setItem(key, JSON.stringify(data))
            const storageTime = performance.now() - storageStartTime
            
            // 🔍 记录缓存成功
            cacheHealthChecker.recordCacheSuccess(estimatedSize, performance.now() - startTime)
            
            resolve(base64)
          } catch (storageError) {
            if (storageError instanceof DOMException && storageError.name === 'QuotaExceededError') {
              // 🔍 记录配额超限错误
              cacheHealthChecker.recordQuotaError()
              
              // 强制清理更多缓存
              try {
                const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cached_img_'))
                const beforeCount = cacheKeys.length
                const toDelete = Math.min(10, cacheKeys.length) // 清理10个或全部
                
                for (let i = 0; i < toDelete; i++) {
                  localStorage.removeItem(cacheKeys[i])
                }
                
                // 重试存储
                const key = getCacheKey(url, level)
                const data = {
                  base64,
                  timestamp: Date.now(),
                  size: estimatedSize,
                  deviceType,
                  retried: true
                }
                localStorage.setItem(key, JSON.stringify(data))
                resolve(base64)
              } catch (retryError) {
                resolve(url)
              }
            } else {
              resolve(url)
            }
          }
        } catch (canvasError) {
          resolve(url)
        }
      }
      
      img.onerror = (errorEvent) => {
        const loadTime = performance.now() - startTime
        
        // 🔍 记录加载失败
        cacheHealthChecker.recordLoadFailure(url)
        
        // 🔧 改进的CORS处理和回退策略
        if (isUsingProxy && shouldSetCors) {
          // 第一级回退：尝试不使用CORS的代理URL
          const fallbackImg1 = new Image()
          fallbackImg1.onload = () => {
            resolve(proxyUrl)
          }
          fallbackImg1.onerror = () => {
            // 第二级回退：尝试原始URL + CORS
            const fallbackImg2 = new Image()
            fallbackImg2.crossOrigin = 'anonymous'
            fallbackImg2.onload = () => {
              resolve(url)
            }
            fallbackImg2.onerror = () => {
              // 第三级回退：直接使用原始URL
              const fallbackImg3 = new Image()
              fallbackImg3.onload = () => {
                resolve(url)
              }
              fallbackImg3.onerror = (finalError) => {
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
        resolve(url)
      }
      
      // 开始加载图片 - 使用代理URL
      img.src = proxyUrl
    })
  }

  useEffect(() => {
    // 🔧 增强执行条件检查
    if (!src) {
      return
    }
    
    const loadImage = async () => {
      
      setHasError(false)
      
      if (!fastPreview) {
        // 传统加载模式
        setIsLoading(true)
        setImageSrcToShow('')
        setIsShowingBlur(false)
        
        const cached = getCachedImage(src)
        if (cached) {
          setImageSrc(cached)
          setIsLoading(false)
          return
        }
        
        const proxyUrl = getProxyVideoUrl(src)
        setImageSrc(proxyUrl)
        setIsLoading(false)
        
        // 后台缓存
        if (needsCorsProxy(src)) {
          try {
            await cacheImage(src)
          } catch (error) {
            console.warn('后台缓存失败，静默处理:', error)
          }
        }
        return
      }
      
      // 🚀 两级加载模式：模糊图 → 最终缩略图
      
      let urls
      try {
        urls = generateImageUrls(src)
      } catch (error) {
        // 回退到传统模式
        const proxyUrl = getProxyVideoUrl(src)
        setImageSrc(proxyUrl)
        setIsLoading(false)
        setImageSrcToShow('')
        setIsShowingBlur(false)
        return
      }
      
      // 阶段1：立即显示模糊图（无延迟），支持缓存禁用模式
      if (urls.blur) {
        try {
          // 🔧 优先检查本地缓存（如果缓存启用）
          const blurCached = !isCacheDisabled ? getCachedImage(urls.blur, 'blur') : null
          if (blurCached) {
            setImageSrcToShow(blurCached)
            setIsShowingBlur(true)
            setIsLoading(false) // 立即设置为非加载状态
          } else {
            // 🚀 立即显示远程模糊图（不依赖缓存）
            setImageSrcToShow(urls.blur)
            setIsShowingBlur(true)
            setIsLoading(false) // 关键：不显示加载状态，直接显示模糊图
            
            // 🔄 后台缓存模糊图（仅在缓存启用时）
            if (!isCacheDisabled) {
              cacheImage(urls.blur, 'blur').then(cached => {
                if (cached && cached.startsWith('data:image/')) {
                  // 模糊图缓存完成
                }
              }).catch(e => console.warn('模糊图缓存失败:', e))
            }
          }
        } catch (error) {
          setIsLoading(false)
          setImageSrcToShow('')
          setIsShowingBlur(false)
        }
      } else {
        // 如果没有模糊图URL，设置加载状态等待最终图
        setIsLoading(true)
        setImageSrcToShow('')
        setIsShowingBlur(false)
      }
      
      // 阶段2：后台加载最终缩略图，加载完成后替换模糊图（支持缓存禁用模式）
      if (urls?.final) {
        try {
          // 🔧 优先检查本地缓存（如果缓存启用）
          const finalCached = !isCacheDisabled ? getCachedImage(urls.final, 'final') : null
          if (finalCached) {
            // 如果缓存命中，延迟100ms后显示以确保模糊图已经渲染
            setTimeout(() => {
              setImageSrcToShow(finalCached)
              setIsShowingBlur(false)
              setIsLoading(false)
            }, 100)
          } else {
            // 🔄 预加载最终缩略图（不依赖缓存）
            const img = new Image()
            img.onload = () => {
              setImageSrcToShow(urls.final)
              setIsShowingBlur(false)
              setIsLoading(false)
              
              // 🔄 后台缓存最终图（仅在缓存启用时）
              if (!isCacheDisabled) {
                cacheImage(urls.final, 'final').catch(e => console.warn('最终图缓存失败:', e))
              }
            }
            img.onerror = () => {
              // 如果最终图加载失败但有模糊图，不设置错误状态
              if (!urls.blur) {
                setIsLoading(false)
                setHasError(true)
              }
            }
            img.src = urls.final
          }
        } catch (error) {
          // 如果没有模糊图显示，设置为错误状态
          if (!urls.blur) {
            setIsLoading(false)
            setHasError(true)
          }
        }
      }
    }

    loadImage()
  }, [src, fastPreview, componentId]) // 🔧 添加componentId确保组件实例稳定性

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

  // 两级加载模式渲染
  if (fastPreview) {
    // 如果有图片源，显示图片
    if (imageSrcToShow) {
      // 生成简化的过渡效果CSS类
      const getTransitionClasses = () => {
        const baseClasses = `transition-all duration-300 ease-out`
        
        if (isShowingBlur) {
          return `${baseClasses} filter blur-sm opacity-90`
        } else {
          return `${baseClasses} filter blur-none opacity-100`
        }
      }
      
      return (
        <img
          src={imageSrcToShow}
          alt={alt}
          className={cn(getTransitionClasses(), className)}
          onLoad={handleLoad}
          onError={handleError}
          crossOrigin={needsCorsProxy(imageSrcToShow) ? 'anonymous' : undefined}
          {...props}
        />
      )
    }
    
    // 两级加载模式下的加载状态
    if (isLoading) {
      return (
        <div className={cn("bg-muted animate-pulse relative overflow-hidden", className?.replace(/absolute|inset-\d+/g, ''))} {...props}>
          <div className="w-full h-full bg-muted-foreground/10 flex items-center justify-center">
            <div className="text-xs text-muted-foreground">加载中...</div>
          </div>
        </div>
      )
    }
    
    // 两级加载模式下的错误状态
    if (hasError) {
      return (
        <div className={cn("bg-muted relative overflow-hidden", className?.replace(/absolute|inset-\d+/g, ''))} {...props}>
          <div className="w-full h-full bg-muted-foreground/10 flex items-center justify-center">
            <div className="text-xs text-muted-foreground">加载失败</div>
          </div>
        </div>
      )
    }
  }
  
  // 传统模式的加载和错误状态
  if (isLoading) {
    return (
      <div className={cn("bg-muted animate-pulse relative overflow-hidden", className?.replace(/absolute|inset-\d+/g, ''))} {...props}>
        <div className="w-full h-full bg-muted-foreground/10 flex items-center justify-center">
          <div className="text-xs text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className={cn("bg-muted relative overflow-hidden", className?.replace(/absolute|inset-\d+/g, ''))} {...props}>
        <div className="w-full h-full bg-muted-foreground/10 flex items-center justify-center">
          <div className="text-xs text-muted-foreground">加载失败</div>
        </div>
      </div>
    )
  }
  
  // 传统模式渲染
  const needsCors = needsCorsProxy(imageSrc)
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
