import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export type PageKey = 'home' | 'templates' | 'create' | 'videos' | 'pricing' | 'profile' | 'signin' | 'signup' | 'help'

interface SEOConfig {
  title?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  twitterTitle?: string
  twitterDescription?: string
}

export const useSEO = (pageKey: PageKey, customConfig?: SEOConfig) => {
  const { t, i18n } = useTranslation()
  
  useEffect(() => {
    const updateSEO = () => {
      const lang = i18n.language
      
      // 获取页面SEO配置
      const title = customConfig?.title || t(`seo.pages.${pageKey}.title`)
      const description = customConfig?.description || t(`seo.pages.${pageKey}.description`)  
      const keywords = customConfig?.keywords || t(`seo.pages.${pageKey}.keywords`)
      
      // 更新页面标题
      if (title) {
        document.title = title
      }
      
      // 更新Meta标签
      updateMetaTag('description', description)
      updateMetaTag('keywords', keywords)
      
      // 更新Open Graph标签
      const ogTitle = customConfig?.ogTitle || title
      const ogDescription = customConfig?.ogDescription || description
      updateMetaTag('og:title', ogTitle, 'property')
      updateMetaTag('og:description', ogDescription, 'property')
      updateMetaTag('og:type', 'website', 'property')
      
      // 更新Twitter Card标签
      const twitterTitle = customConfig?.twitterTitle || title
      const twitterDescription = customConfig?.twitterDescription || description
      updateMetaTag('twitter:card', 'summary_large_image')
      updateMetaTag('twitter:title', twitterTitle)
      updateMetaTag('twitter:description', twitterDescription)
      
      // 设置语言属性
      document.documentElement.lang = lang
    }
    
    updateSEO()
  }, [pageKey, customConfig, t, i18n.language])
}

// Helper function to update meta tags
const updateMetaTag = (name: string, content: string, attribute: 'name' | 'property' = 'name') => {
  if (!content) return
  
  let selector = `meta[${attribute}="${name}"]`
  let metaTag = document.querySelector(selector) as HTMLMetaElement
  
  if (metaTag) {
    metaTag.content = content
  } else {
    metaTag = document.createElement('meta')
    metaTag.setAttribute(attribute, name)
    metaTag.content = content
    document.head.appendChild(metaTag)
  }
}

// 页面路径映射到PageKey的工具函数
export const getPageKeyFromPath = (pathname: string): PageKey => {
  if (pathname === '/' || pathname === '/home') return 'home'
  if (pathname === '/templates') return 'templates'
  if (pathname === '/create') return 'create'
  if (pathname === '/videos') return 'videos'
  if (pathname === '/pricing') return 'pricing'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname === '/signin') return 'signin'
  if (pathname === '/signup') return 'signup'
  if (pathname === '/help') return 'help'
  
  // 默认返回首页配置
  return 'home'
}