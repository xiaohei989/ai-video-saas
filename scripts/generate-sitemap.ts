/**
 * Sitemap生成脚本
 * 为所有8种语言生成sitemap.xml文件
 *
 * 运行方式: ts-node scripts/generate-sitemap.ts
 */

import fs from 'fs'
import path from 'path'

// 支持的语言
const SUPPORTED_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'es', 'de', 'fr', 'ar'] as const
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

const BASE_URL = 'https://veo3video.me'

// 定义路由配置
interface RouteConfig {
  path: string
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
  lastmod?: string
}

// 核心路由(需要包含在sitemap中的页面)
const CORE_ROUTES: RouteConfig[] = [
  {
    path: '/',
    changefreq: 'daily',
    priority: 1.0
  },
  {
    path: '/templates',
    changefreq: 'daily',
    priority: 0.9
  },
  {
    path: '/pricing',
    changefreq: 'weekly',
    priority: 0.8
  },
  {
    path: '/videos',
    changefreq: 'hourly',
    priority: 0.7
  },
  {
    path: '/profile',
    changefreq: 'monthly',
    priority: 0.5
  },
  {
    path: '/help',
    changefreq: 'weekly',
    priority: 0.6
  }
]

/**
 * 生成单个URL的sitemap条目
 */
function generateUrlEntry(url: string, config: RouteConfig): string {
  const lastmod = config.lastmod || new Date().toISOString().split('T')[0]

  return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${config.changefreq}</changefreq>
    <priority>${config.priority}</priority>
  </url>`
}

/**
 * 生成语言专属sitemap
 */
function generateLanguageSitemap(lang: SupportedLanguage): string {
  const urls = CORE_ROUTES.map(route => {
    const url = `${BASE_URL}/${lang}${route.path === '/' ? '' : route.path}`
    return generateUrlEntry(url, route)
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`
}

/**
 * 生成主sitemap索引
 */
function generateSitemapIndex(): string {
  const lastmod = new Date().toISOString().split('T')[0]

  const sitemaps = SUPPORTED_LANGUAGES.map(lang => {
    return `  <sitemap>
    <loc>${BASE_URL}/sitemap-${lang}.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`
}

/**
 * 生成带hreflang的高级sitemap(单个语言)
 */
function generateAdvancedLanguageSitemap(lang: SupportedLanguage): string {
  const urls = CORE_ROUTES.map(route => {
    const baseUrl = `${BASE_URL}/${lang}${route.path === '/' ? '' : route.path}`
    const lastmod = route.lastmod || new Date().toISOString().split('T')[0]

    // 生成所有语言的hreflang链接
    const hreflangLinks = SUPPORTED_LANGUAGES.map(alternateLang => {
      const alternateUrl = `${BASE_URL}/${alternateLang}${route.path === '/' ? '' : route.path}`
      const hreflangCode = getHreflangCode(alternateLang)
      return `    <xhtml:link rel="alternate" hreflang="${hreflangCode}" href="${alternateUrl}"/>`
    }).join('\n')

    return `  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
${hreflangLinks}
  </url>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`
}

/**
 * 获取hreflang代码
 */
function getHreflangCode(lang: SupportedLanguage): string {
  const LANGUAGE_TO_COUNTRY: Record<SupportedLanguage, string> = {
    'zh': 'zh-CN',
    'en': 'en-US',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'es': 'es-ES',
    'de': 'de-DE',
    'fr': 'fr-FR',
    'ar': 'ar-SA'
  }
  return LANGUAGE_TO_COUNTRY[lang]
}

/**
 * 主执行函数
 */
function main() {
  const publicDir = path.join(process.cwd(), 'public')

  // 确保public目录存在
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  console.log('🚀 开始生成sitemap...')

  // 生成主sitemap索引文件
  const sitemapIndex = generateSitemapIndex()
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapIndex, 'utf-8')
  console.log('✅ 已生成 sitemap.xml (主索引)')

  // 生成每个语言的sitemap
  SUPPORTED_LANGUAGES.forEach(lang => {
    const sitemap = generateAdvancedLanguageSitemap(lang)
    const filename = `sitemap-${lang}.xml`
    fs.writeFileSync(path.join(publicDir, filename), sitemap, 'utf-8')
    console.log(`✅ 已生成 ${filename}`)
  })

  console.log('\n🎉 所有sitemap文件生成完成!')
  console.log(`📍 文件位置: ${publicDir}`)
  console.log('\n生成的文件列表:')
  console.log('  - sitemap.xml (主索引)')
  SUPPORTED_LANGUAGES.forEach(lang => {
    console.log(`  - sitemap-${lang}.xml`)
  })
}

// 执行脚本
main()