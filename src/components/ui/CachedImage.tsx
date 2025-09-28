import React, { useState, useEffect, useLayoutEffect } from 'react'
import { cn } from '@/utils/cn'
import { getProxyVideoUrl, needsCorsProxy } from '@/utils/videoUrlProxy'
import { smartLoadImage, getCachedImage } from '@/utils/newImageCache'
import { useTranslation } from 'react-i18next'

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  className?: string
  cacheKey?: string
  maxAge?: number // 缓存有效期（毫秒），开发环境1小时，生产环境24小时
  
  // 两级加载功能
  fastPreview?: boolean // 启用两级加载模式（模糊图→最终图）
  placeholderSrc?: string // 可选：外部提供的低清占位图（如 blurThumbnailUrl）
}

export default function CachedImage({ 
  src, 
  alt, 
  className, 
  cacheKey, 
  maxAge = import.meta.env.DEV ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 开发环境1小时，生产环境24小时
  
  // 两级加载参数
  fastPreview = false,
  placeholderSrc,
  
  ...props 
}: CachedImageProps) {
  const { t } = useTranslation()
  const [imageSrc, setImageSrc] = useState<string>(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  
  // 两级加载状态
  const [isShowingBlur, setIsShowingBlur] = useState(false)
  const [imageSrcToShow, setImageSrcToShow] = useState<string>('')

  // 缓存禁用检查 - 通过环境变量控制
  const isCacheDisabled = import.meta.env.VITE_DISABLE_TEMPLATE_THUMBNAIL_CACHE === 'true'
  
  // 组件实例ID
  const componentId = React.useMemo(() => Math.random().toString(36).substr(2, 5), [])


  useEffect(() => {
    if (!src) return

    console.log('[CachedImage] 🔍 开始加载图片:', src.substring(0, 60) + '...')

    const loadImage = async () => {
      setHasError(false)

      // 如果提供了外部占位图（如 blurThumbnailUrl），并且启用两级加载，则先显示占位，再加载高清
      if (fastPreview && placeholderSrc) {
        console.log('[CachedImage] 🖼️ 使用外部占位图作为模糊图')
        setImageSrcToShow(placeholderSrc)
        setIsShowingBlur(true)
        setIsLoading(false)

        try {
          const finalImageUrl = await smartLoadImage(src, {
            enableFastPreview: false,
            onFinalLoad: (finalUrl) => {
              setImageSrcToShow(finalUrl)
              setIsShowingBlur(false)
              setIsLoading(false)
            }
          })
          console.log('[CachedImage] ✅ 外部占位→高清完成:', typeof finalImageUrl)
          return
        } catch (e) {
          console.warn('[CachedImage] 外部占位→高清失败:', e)
          // 失败保持占位图
          return
        }
      }

      if (isCacheDisabled) {
        // 缓存禁用：直接使用代理URL
        console.log('[CachedImage] ⚠️ 缓存已禁用，直接加载')
        const proxyUrl = getProxyVideoUrl(src)
        setImageSrc(proxyUrl)
        setIsLoading(false)
        setImageSrcToShow('')
        setIsShowingBlur(false)
        return
      }

      if (!fastPreview) {
        // 传统单级加载模式
        console.log('[CachedImage] 🔄 传统单级加载模式')
        setIsLoading(true)
        setImageSrcToShow('')
        setIsShowingBlur(false)

        // 检查缓存
        const cached = await getCachedImage(src)
        if (cached) {
          console.log('[CachedImage] ✅ 单级模式缓存命中')
          setImageSrc(cached)
          setIsLoading(false)
          return
        }

        // 使用代理URL并后台缓存
        const proxyUrl = getProxyVideoUrl(src)
        setImageSrc(proxyUrl)
        setIsLoading(false)

        // 后台缓存
        smartLoadImage(src, { enableFastPreview: false })
          .catch(e => console.warn('[CachedImage] 后台缓存失败:', e))
        return
      }

      // 智能两级加载模式
      console.log('[CachedImage] 🧠 智能两级加载模式')
      try {
        const finalImageUrl = await smartLoadImage(src, {
          enableFastPreview: true,
          onBlurLoad: (blurUrl) => {
            console.log('[CachedImage] 🔄 显示模糊图过渡')
            setImageSrcToShow(blurUrl)
            setIsShowingBlur(true)
            setIsLoading(false)
          },
          onFinalLoad: (finalUrl) => {
            console.log('[CachedImage] ✅ 最终图加载完成:', typeof finalUrl)
            setImageSrcToShow(finalUrl)
            setIsShowingBlur(false)
            setIsLoading(false)
          }
        })

        console.log('[CachedImage] 🎯 智能加载完成')
      } catch (error) {
        console.error('[CachedImage] ❌ 智能加载失败:', error)
        setIsLoading(false)
        setHasError(true)
      }
    }

    loadImage()
  }, [src, fastPreview, isCacheDisabled, componentId, placeholderSrc])

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
            <div className="text-xs text-muted-foreground">{t('components.templateGrid.loadFailed')}</div>
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
          <div className="text-xs text-muted-foreground">{t('components.templateGrid.loadFailed')}</div>
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
