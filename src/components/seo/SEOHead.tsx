/**
 * SEO Head组件
 * 动态生成hreflang标签、canonical URL和AI爬虫专用meta标签
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getCurrentLanguage,
  generateLanguageUrls,
  LANGUAGE_TO_COUNTRY,
  removeLanguagePrefix,
  SUPPORTED_LANGUAGES
} from '@/utils/languageRouter'

interface SEOHeadProps {
  title?: string
  description?: string
  keywords?: string
  ogImage?: string
  canonical?: string
  noindex?: boolean
}

export function SEOHead({
  title,
  description,
  keywords,
  ogImage = 'https://veo3video.me/logo.png',
  canonical,
  noindex = false
}: SEOHeadProps) {
  const location = useLocation()
  const { i18n } = useTranslation()

  useEffect(() => {
    const currentLang = getCurrentLanguage(location.pathname)
    const cleanPath = removeLanguagePrefix(location.pathname)
    const baseUrl = 'https://veo3video.me'

    // 生成所有语言版本的URL
    const languageUrls = generateLanguageUrls(cleanPath, baseUrl)

    // 设置canonical URL
    const canonicalUrl = canonical || `${baseUrl}/${currentLang}${cleanPath}`

    // 清理现有的hreflang和link标签
    const existingLinks = document.querySelectorAll('link[rel="alternate"], link[rel="canonical"]')
    existingLinks.forEach(link => link.remove())

    // 添加canonical标签
    const canonicalLink = document.createElement('link')
    canonicalLink.rel = 'canonical'
    canonicalLink.href = canonicalUrl
    document.head.appendChild(canonicalLink)

    // 添加hreflang标签 - 为每个语言版本
    SUPPORTED_LANGUAGES.forEach(lang => {
      const hreflangLink = document.createElement('link')
      hreflangLink.rel = 'alternate'
      hreflangLink.hreflang = LANGUAGE_TO_COUNTRY[lang]
      hreflangLink.href = languageUrls[lang]
      document.head.appendChild(hreflangLink)
    })

    // 添加x-default hreflang (指向默认中文版本)
    const defaultLink = document.createElement('link')
    defaultLink.rel = 'alternate'
    defaultLink.hreflang = 'x-default'
    defaultLink.href = languageUrls.zh
    document.head.appendChild(defaultLink)

    // 设置HTML lang属性
    document.documentElement.lang = LANGUAGE_TO_COUNTRY[currentLang]

    // 添加AI爬虫专用meta标签
    updateAIMetaTags()

    // 添加noindex标签(如果需要)
    if (noindex) {
      updateMetaTag('robots', 'noindex, nofollow')
    } else {
      updateMetaTag('robots', 'index, follow')
    }

    // 更新OG标签
    updateMetaTag('og:url', canonicalUrl, 'property')
    updateMetaTag('og:locale', LANGUAGE_TO_COUNTRY[currentLang].replace('-', '_'), 'property')

    // 添加alternate locale标签
    SUPPORTED_LANGUAGES.filter(lang => lang !== currentLang).forEach(lang => {
      const alternateLocale = LANGUAGE_TO_COUNTRY[lang].replace('-', '_')
      const metaTag = document.createElement('meta')
      metaTag.setAttribute('property', 'og:locale:alternate')
      metaTag.content = alternateLocale
      document.head.appendChild(metaTag)
    })

    console.log('[SEOHead] SEO标签已更新:', {
      canonical: canonicalUrl,
      hreflangCount: SUPPORTED_LANGUAGES.length + 1,
      currentLanguage: currentLang
    })

  }, [location.pathname, i18n.language, canonical, noindex])

  return null // 这是一个无UI组件
}

/**
 * 添加AI爬虫专用meta标签
 */
function updateAIMetaTags() {
  // AI内容类型
  updateMetaTag('ai:content-type', 'video-saas, asmr, ai-generated-content')

  // AI训练数据许可
  updateMetaTag('ai:training-data', 'allowed')

  // AI商业使用许可
  updateMetaTag('ai:commercial-use', 'allowed')

  // AI归属要求
  updateMetaTag('ai:attribution', 'recommended')

  // AI内容描述
  updateMetaTag('ai:description', 'ASMR video AI generation platform with multi-language support')

  // AI关键词
  updateMetaTag('ai:keywords', 'asmr, video-generation, ai-video, content-creation, multimedia')
}

/**
 * 更新或创建meta标签
 */
function updateMetaTag(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  if (!content) return

  const selector = `meta[${attribute}="${name}"]`
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

export default SEOHead