/**
 * 结构化数据组件 (JSON-LD)
 * 为搜索引擎和AI爬虫提供结构化的网站信息
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCurrentLanguage } from '@/utils/languageRouter'

interface StructuredDataProps {
  type?: 'organization' | 'website' | 'softwareApplication' | 'breadcrumb' | 'video'
  data?: Record<string, any>
}

export function StructuredData({ type = 'website', data }: StructuredDataProps) {
  const location = useLocation()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    const currentLang = getCurrentLanguage(location.pathname)
    let structuredData: any = {}

    switch (type) {
      case 'organization':
        structuredData = generateOrganizationSchema(currentLang, t)
        break
      case 'website':
        structuredData = generateWebsiteSchema(currentLang, t)
        break
      case 'softwareApplication':
        structuredData = generateSoftwareApplicationSchema(currentLang, t)
        break
      case 'breadcrumb':
        structuredData = generateBreadcrumbSchema(location.pathname, t)
        break
      case 'video':
        structuredData = data || {}
        break
      default:
        structuredData = generateWebsiteSchema(currentLang, t)
    }

    // 移除现有的JSON-LD脚本
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]')
    existingScripts.forEach(script => {
      if (script.id === `structured-data-${type}`) {
        script.remove()
      }
    })

    // 添加新的JSON-LD脚本
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = `structured-data-${type}`
    script.textContent = JSON.stringify(structuredData, null, 2)
    document.head.appendChild(script)

    console.log('[StructuredData] 结构化数据已添加:', type)

  }, [type, location.pathname, i18n.language, data, t])

  return null
}

/**
 * 生成Organization schema
 */
function generateOrganizationSchema(lang: string, t: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'Veo3Video',
    'alternateName': t('seo.pages.home.title'),
    'url': 'https://veo3video.me',
    'logo': 'https://veo3video.me/logo.png',
    'description': t('seo.pages.home.description'),
    'sameAs': [
      // 社交媒体链接(如果有)
      // 'https://twitter.com/veo3video',
      // 'https://linkedin.com/company/veo3video'
    ],
    'contactPoint': {
      '@type': 'ContactPoint',
      'email': 'support@veo3video.me',
      'contactType': 'Customer Service',
      'availableLanguage': ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'es-ES', 'de-DE', 'fr-FR', 'ar-SA']
    },
    'foundingDate': '2024',
    'slogan': t('app.tagline'),
    'knowsAbout': [
      'AI Video Generation',
      'ASMR Content',
      'Video Editing',
      'Content Creation',
      'Multimedia Production'
    ]
  }
}

/**
 * 生成Website schema
 */
function generateWebsiteSchema(lang: string, t: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Veo3Video',
    'alternateName': t('seo.pages.home.title'),
    'url': 'https://veo3video.me',
    'description': t('seo.pages.home.description'),
    'inLanguage': ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'es-ES', 'de-DE', 'fr-FR', 'ar-SA'],
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': 'https://veo3video.me/templates?search={search_term_string}'
      },
      'query-input': 'required name=search_term_string'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Veo3Video',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://veo3video.me/logo.png'
      }
    }
  }
}

/**
 * 生成SoftwareApplication schema
 */
function generateSoftwareApplicationSchema(lang: string, t: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': 'Veo3Video ASMR Generator',
    'applicationCategory': 'MultimediaApplication',
    'applicationSubCategory': 'Video Editing',
    'operatingSystem': 'Web Browser',
    'description': t('seo.pages.home.description'),
    'url': 'https://veo3video.me',
    'screenshot': 'https://veo3video.me/screenshot.png',
    // 'aggregateRating': {
    //   '@type': 'AggregateRating',
    //   'ratingValue': '4.8',
    //   'ratingCount': '1000',
    //   'bestRating': '5',
    //   'worstRating': '1'
    // },
    // ⚠️ 评分已暂时注释 - 等待真实用户评价数据后再启用
    // TODO: 集成真实评价系统后取消注释
    'offers': [
      {
        '@type': 'Offer',
        'name': 'Basic Plan',
        'price': '9.99',
        'priceCurrency': 'USD',
        'priceValidUntil': '2025-12-31',
        'availability': 'https://schema.org/InStock',
        'billingDuration': 'P1M',
        'description': '200 credits per month with unlimited HD downloads'
      },
      {
        '@type': 'Offer',
        'name': 'Pro Plan',
        'price': '19.99',
        'priceCurrency': 'USD',
        'priceValidUntil': '2025-12-31',
        'availability': 'https://schema.org/InStock',
        'billingDuration': 'P1M',
        'description': '1500 credits per month with priority support'
      },
      {
        '@type': 'Offer',
        'name': 'Enterprise Plan',
        'price': '99.99',
        'priceCurrency': 'USD',
        'priceValidUntil': '2025-12-31',
        'availability': 'https://schema.org/InStock',
        'billingDuration': 'P1M',
        'description': '6000 credits per month with API access'
      }
    ],
    'featureList': [
      'AI Video Generation',
      'ASMR Content Creation',
      'Template Library',
      'Multi-language Support',
      'HD Video Export',
      '9:16 Portrait Format',
      'Unlimited Downloads'
    ],
    'softwareRequirements': 'Modern Web Browser',
    'memoryRequirements': '2GB RAM',
    'storageRequirements': '100MB',
    'releaseNotes': 'Latest version with improved AI generation and multi-language support'
  }
}

/**
 * 生成Breadcrumb schema
 */
function generateBreadcrumbSchema(pathname: string, t: any) {
  const segments = pathname.split('/').filter(Boolean)

  // 移除语言前缀
  if (segments.length > 0 && ['zh', 'en', 'ja', 'ko', 'es', 'de', 'fr', 'ar'].includes(segments[0])) {
    segments.shift()
  }

  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      'position': 1,
      'name': t('nav.home'),
      'item': 'https://veo3video.me'
    }
  ]

  // 根据路径生成面包屑
  segments.forEach((segment, index) => {
    let name = segment
    let url = `https://veo3video.me/${segments.slice(0, index + 1).join('/')}`

    // 翻译常见路径名称
    switch (segment) {
      case 'templates':
        name = t('nav.templates')
        break
      case 'videos':
        name = t('nav.videos')
        break
      case 'pricing':
        name = t('nav.pricing')
        break
      case 'profile':
        name = t('nav.profile')
        break
      case 'help':
        name = t('footer.helpCenter')
        break
      default:
        name = segment.charAt(0).toUpperCase() + segment.slice(1)
    }

    breadcrumbItems.push({
      '@type': 'ListItem',
      'position': index + 2,
      'name': name,
      'item': url
    })
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbItems
  }
}

export default StructuredData