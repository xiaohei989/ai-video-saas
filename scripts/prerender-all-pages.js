/**
 * 全站预渲染脚本
 *
 * 功能：
 * 1. 预渲染所有需要SEO优化的页面
 * 2. 生成完整的sitemap.xml
 * 3. 优化robots.txt
 */

import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// 配置
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

// 检查必需的环境变量
if (!SUPABASE_ANON_KEY) {
  console.error('❌ 错误: 缺少 VITE_SUPABASE_ANON_KEY 环境变量')
  console.error('请确保 .env.local 文件存在并包含必要的环境变量')
  process.exit(1)
}
const BUILD_DIR = path.resolve(process.cwd(), 'build')
const BASE_URL = process.env.APP_URL || 'http://localhost:3000'
const SUPPORTED_LANGUAGES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'ar']

// 创建Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('🚀 [全站预渲染] 开始预渲染所有SEO页面...')
console.log('📍 [全站预渲染] 构建目录:', BUILD_DIR)
console.log('🌐 [全站预渲染] 基础URL:', BASE_URL)

/**
 * 获取所有需要预渲染的路由
 */
async function getAllRoutes() {
  const routes = []

  console.log('\n📋 [全站预渲染] 收集所有需要预渲染的路由...\n')

  // 1. 静态页面（所有语言）
  const staticPages = [
    { path: '/', priority: 1.0, changefreq: 'daily', name: '首页' },
    { path: '/templates', priority: 0.9, changefreq: 'daily', name: '模板列表' },
    { path: '/pricing', priority: 0.9, changefreq: 'weekly', name: '定价页面' },
    { path: '/privacy', priority: 0.5, changefreq: 'monthly', name: '隐私政策' },
    { path: '/terms', priority: 0.5, changefreq: 'monthly', name: '服务条款' },
    { path: '/cookies', priority: 0.4, changefreq: 'monthly', name: 'Cookie政策' },
    { path: '/help', priority: 0.7, changefreq: 'weekly', name: '帮助中心' },
  ]

  SUPPORTED_LANGUAGES.forEach(lang => {
    staticPages.forEach(page => {
      routes.push({
        path: `/${lang}${page.path}`,
        language: lang,
        type: 'static',
        priority: page.priority,
        changefreq: page.changefreq,
        name: `${page.name} (${lang})`
      })
    })
  })

  console.log(`✅ [静态页面] 添加了 ${routes.length} 个静态页面路由`)

  // 2. SEO指南页面
  const { data: guides } = await supabase
    .from('template_seo_guides')
    .select(`
      id,
      template_id,
      language,
      is_published,
      templates:template_id (
        id,
        slug,
        is_active
      )
    `)
    .eq('is_published', true)

  const guideRoutes = guides
    ?.filter(guide => guide.templates?.is_active)
    .map(guide => ({
      path: `/${guide.language}/guide/${guide.templates.slug}`,
      language: guide.language,
      type: 'seo-guide',
      priority: 0.8,
      changefreq: 'weekly',
      guideId: guide.id,
      slug: guide.templates.slug
    })) || []

  routes.push(...guideRoutes)
  console.log(`✅ [SEO指南] 添加了 ${guideRoutes.length} 个SEO指南路由`)

  // 3. 视频详情页（最近的公开视频）
  const { data: videos } = await supabase
    .from('videos')
    .select('id, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(100) // 只预渲染最近100个视频

  const videoRoutes = []
  videos?.forEach(video => {
    SUPPORTED_LANGUAGES.forEach(lang => {
      videoRoutes.push({
        path: `/${lang}/video/${video.id}`,
        language: lang,
        type: 'video',
        priority: 0.7,
        changefreq: 'monthly',
        videoId: video.id
      })
    })
  })

  routes.push(...videoRoutes)
  console.log(`✅ [视频详情] 添加了 ${videoRoutes.length} 个视频详情路由`)

  // 统计
  console.log('\n📊 [全站预渲染] 路由统计:')
  console.log(`   总计: ${routes.length} 个路由`)
  console.log(`   - 静态页面: ${routes.filter(r => r.type === 'static').length}`)
  console.log(`   - SEO指南: ${routes.filter(r => r.type === 'seo-guide').length}`)
  console.log(`   - 视频详情: ${routes.filter(r => r.type === 'video').length}`)

  // 按语言分组
  const byLanguage = routes.reduce((acc, route) => {
    acc[route.language] = (acc[route.language] || 0) + 1
    return acc
  }, {})
  console.log('\n📈 [全站预渲染] 语言分布:', byLanguage)

  return routes
}

/**
 * 预渲染单个页面
 */
async function prerenderPage(browser, route) {
  const url = `${BASE_URL}${route.path}`
  console.log(`\n🔄 [${route.type}] 渲染: ${route.name || route.path}`)

  try {
    const page = await browser.newPage()

    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 })

    // 设置超时
    const timeout = route.type === 'video' ? 90000 : 60000

    // 访问页面
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout
    })

    // 根据页面类型等待不同的元素
    try {
      if (route.type === 'seo-guide') {
        await page.waitForSelector('article', { timeout: 10000 })
      } else if (route.type === 'static' && route.path.includes('/templates')) {
        await page.waitForSelector('.template-grid, .template-list', { timeout: 10000 })
      } else if (route.type === 'video') {
        await page.waitForSelector('.video-player, video', { timeout: 15000 })
      }
    } catch (e) {
      console.log(`   ⚠️  等待选择器超时，继续渲染...`)
    }

    // 等待额外的异步内容加载
    await page.waitForTimeout(2000)

    // 获取渲染后的HTML
    const html = await page.content()

    // 构建输出路径
    const outputPath = path.join(BUILD_DIR, route.path, 'index.html')
    const outputDir = path.dirname(outputPath)

    // 确保目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // 保存HTML文件
    fs.writeFileSync(outputPath, html, 'utf-8')

    const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(2)
    console.log(`✅ [成功] ${outputPath} (${sizeKB} KB)`)

    await page.close()

    return {
      success: true,
      route: route.path,
      type: route.type,
      size: Buffer.byteLength(html, 'utf-8')
    }

  } catch (error) {
    console.error(`❌ [失败] ${route.path}:`, error.message)
    return {
      success: false,
      route: route.path,
      type: route.type,
      error: error.message
    }
  }
}

/**
 * 生成完整的sitemap.xml
 */
async function generateSitemap(routes) {
  console.log('\n🗺️  [全站预渲染] 生成sitemap.xml...')

  const baseUrl = 'https://veo3video.me'
  const today = new Date().toISOString().split('T')[0]

  const urls = routes.map(route => {
    const loc = `${baseUrl}${route.path}`
    const priority = route.priority || 0.5
    const changefreq = route.changefreq || 'monthly'

    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  }).join('\n')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`

  const sitemapPath = path.join(BUILD_DIR, 'sitemap.xml')
  fs.writeFileSync(sitemapPath, sitemap, 'utf-8')

  console.log(`✅ [全站预渲染] Sitemap已生成: ${sitemapPath}`)
  console.log(`   包含 ${routes.length} 个URL`)
}

/**
 * 生成robots.txt
 */
async function generateRobotsTxt() {
  console.log('\n🤖 [全站预渲染] 生成robots.txt...')

  const robotsTxt = `# veo3video.me robots.txt

User-agent: *
Allow: /

# 禁止AI训练爬虫
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Claude-Web
Disallow: /

# 禁止索引管理后台
User-agent: *
Disallow: /admin/
Disallow: /*/admin/

# 禁止索引登录页面
User-agent: *
Disallow: /*/signin
Disallow: /*/signup
Disallow: /*/forgot-password
Disallow: /*/reset-password

# 禁止索引个人中心（需要登录）
User-agent: *
Disallow: /*/profile
Disallow: /*/videos
Disallow: /*/create

# Sitemap
Sitemap: https://veo3video.me/sitemap.xml
`

  const robotsPath = path.join(BUILD_DIR, 'robots.txt')
  fs.writeFileSync(robotsPath, robotsTxt, 'utf-8')
  console.log(`✅ [全站预渲染] robots.txt已生成`)
}

/**
 * 主函数
 */
async function main() {
  const startTime = Date.now()

  try {
    // 1. 获取所有路由
    const routes = await getAllRoutes()

    if (routes.length === 0) {
      console.log('⚠️  [全站预渲染] 没有需要预渲染的路由，退出')
      return
    }

    // 2. 启动浏览器
    console.log('\n🌐 [全站预渲染] 启动Puppeteer浏览器...')
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    })

    console.log('✅ [全站预渲染] 浏览器已启动')

    // 3. 预渲染所有页面
    console.log(`\n📦 [全站预渲染] 开始渲染 ${routes.length} 个页面...\n`)

    const results = []

    // 并发控制：每次渲染3个页面
    const CONCURRENT_LIMIT = 3
    for (let i = 0; i < routes.length; i += CONCURRENT_LIMIT) {
      const batch = routes.slice(i, i + CONCURRENT_LIMIT)
      const batchResults = await Promise.all(
        batch.map(route => prerenderPage(browser, route))
      )
      results.push(...batchResults)

      // 显示进度
      const progress = Math.min(i + CONCURRENT_LIMIT, routes.length)
      console.log(`\n📊 [进度] ${progress}/${routes.length} (${((progress / routes.length) * 100).toFixed(1)}%)`)
    }

    // 4. 关闭浏览器
    await browser.close()
    console.log('\n✅ [全站预渲染] 浏览器已关闭')

    // 5. 生成sitemap（只包含成功渲染的页面）
    const successfulRoutes = results
      .filter(r => r.success)
      .map(r => routes.find(route => route.path === r.route))
      .filter(Boolean)

    await generateSitemap(successfulRoutes)

    // 6. 生成robots.txt
    await generateRobotsTxt()

    // 7. 统计结果
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const totalSize = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.size, 0)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    // 按类型统计
    const byType = results.reduce((acc, r) => {
      if (r.success) {
        acc[r.type] = (acc[r.type] || 0) + 1
      }
      return acc
    }, {})

    console.log('\n' + '='.repeat(70))
    console.log('✨ [全站预渲染] 预渲染完成！')
    console.log('='.repeat(70))
    console.log(`✅ 成功: ${successful} 个页面`)
    console.log(`❌ 失败: ${failed} 个页面`)
    console.log(`📦 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`⏱️  耗时: ${duration}s`)
    console.log(`📊 按类型统计:`)
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`)
    })
    console.log('='.repeat(70))

    if (failed > 0) {
      console.log('\n⚠️  失败的路由:')
      results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.route}: ${r.error}`))
    }

    console.log('\n🎉 [全站预渲染] 所有页面已成功预渲染！')
    console.log('📋 下一步:')
    console.log('   1. 运行 npm run preview:seo 预览结果')
    console.log('   2. 部署到Cloudflare Pages')
    console.log('   3. 在Google Search Console提交sitemap.xml')

  } catch (error) {
    console.error('\n❌ [全站预渲染] 预渲染失败:', error)
    process.exit(1)
  }
}

// 运行
main().catch(error => {
  console.error('❌ [全站预渲染] 致命错误:', error)
  process.exit(1)
})
