/**
 * SEO指南预渲染脚本
 *
 * 功能：
 * 1. 从Supabase获取所有已发布的SEO指南路由
 * 2. 使用Puppeteer访问每个页面
 * 3. 将渲染后的HTML保存为静态文件
 * 4. 生成sitemap.xml
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

console.log('🚀 [预渲染] 开始SEO指南预渲染...')
console.log('📍 [预渲染] 构建目录:', BUILD_DIR)
console.log('🌐 [预渲染] 基础URL:', BASE_URL)

/**
 * 获取所有需要预渲染的路由
 */
async function getRoutes() {
  console.log('\n📋 [预渲染] 从数据库获取SEO指南路由...')

  const { data: guides, error } = await supabase
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

  if (error) {
    console.error('❌ [预渲染] 获取路由失败:', error)
    throw error
  }

  console.log(`✅ [预渲染] 找到 ${guides?.length || 0} 个已发布的SEO指南`)

  // 生成路由列表
  const routes = guides
    ?.filter(guide => guide.templates?.is_active)
    .map(guide => ({
      path: `/${guide.language}/guide/${guide.templates.slug}`,
      language: guide.language,
      slug: guide.templates.slug,
      guideId: guide.id
    })) || []

  console.log(`📊 [预渲染] 生成了 ${routes.length} 个路由`)

  // 按语言分组显示
  const byLanguage = routes.reduce((acc, route) => {
    acc[route.language] = (acc[route.language] || 0) + 1
    return acc
  }, {})

  console.log('📈 [预渲染] 路由分布:', byLanguage)

  return routes
}

/**
 * 预渲染单个页面
 */
async function prerenderPage(browser, route) {
  const url = `${BASE_URL}${route.path}`
  console.log(`\n🔄 [预渲染] 渲染页面: ${route.path}`)

  try {
    const page = await browser.newPage()

    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 })

    // 访问页面
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60000
    })

    // 等待React渲染完成
    await page.waitForSelector('article', { timeout: 10000 })

    // 等待额外的异步内容加载
    await new Promise(resolve => setTimeout(resolve, 2000))

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

    console.log(`✅ [预渲染] 已保存: ${outputPath}`)

    await page.close()

    return {
      success: true,
      route: route.path,
      size: Buffer.byteLength(html, 'utf-8')
    }

  } catch (error) {
    console.error(`❌ [预渲染] 渲染失败 ${route.path}:`, error.message)
    return {
      success: false,
      route: route.path,
      error: error.message
    }
  }
}

/**
 * 生成sitemap.xml
 */
async function generateSitemap(routes) {
  console.log('\n🗺️  [预渲染] 生成sitemap.xml...')

  const baseUrl = 'https://veo3video.me'
  const today = new Date().toISOString().split('T')[0]

  const urls = routes.map(route => `
  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  const sitemapPath = path.join(BUILD_DIR, 'sitemap-guides.xml')
  fs.writeFileSync(sitemapPath, sitemap, 'utf-8')

  console.log(`✅ [预渲染] Sitemap已生成: ${sitemapPath}`)
}

/**
 * 生成robots.txt
 */
async function generateRobotsTxt() {
  console.log('\n🤖 [预渲染] 更新robots.txt...')

  const robotsPath = path.join(BUILD_DIR, 'robots.txt')
  let robotsTxt = ''

  // 如果已存在，读取现有内容
  if (fs.existsSync(robotsPath)) {
    robotsTxt = fs.readFileSync(robotsPath, 'utf-8')
  } else {
    robotsTxt = `User-agent: *
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /
`
  }

  // 添加sitemap引用
  if (!robotsTxt.includes('sitemap-guides.xml')) {
    robotsTxt += `\nSitemap: https://veo3video.me/sitemap-guides.xml\n`
  }

  fs.writeFileSync(robotsPath, robotsTxt, 'utf-8')
  console.log(`✅ [预渲染] robots.txt已更新`)
}

/**
 * 主函数
 */
async function main() {
  const startTime = Date.now()

  try {
    // 1. 获取路由
    const routes = await getRoutes()

    if (routes.length === 0) {
      console.log('⚠️  [预渲染] 没有需要预渲染的路由，退出')
      return
    }

    // 2. 启动浏览器
    console.log('\n🌐 [预渲染] 启动Puppeteer浏览器...')
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    console.log('✅ [预渲染] 浏览器已启动')

    // 3. 预渲染所有页面
    console.log(`\n📦 [预渲染] 开始渲染 ${routes.length} 个页面...\n`)

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
      console.log(`\n📊 [预渲染] 进度: ${progress}/${routes.length}`)
    }

    // 4. 关闭浏览器
    await browser.close()
    console.log('\n✅ [预渲染] 浏览器已关闭')

    // 5. 生成sitemap
    await generateSitemap(routes)

    // 6. 更新robots.txt
    await generateRobotsTxt()

    // 7. 统计结果
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const totalSize = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.size, 0)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n' + '='.repeat(60))
    console.log('✨ [预渲染] 预渲染完成！')
    console.log('='.repeat(60))
    console.log(`✅ 成功: ${successful}`)
    console.log(`❌ 失败: ${failed}`)
    console.log(`📦 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`⏱️  耗时: ${duration}s`)
    console.log('='.repeat(60))

    if (failed > 0) {
      console.log('\n⚠️  失败的路由:')
      results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.route}: ${r.error}`))
    }

  } catch (error) {
    console.error('\n❌ [预渲染] 预渲染失败:', error)
    process.exit(1)
  }
}

// 运行
main().catch(error => {
  console.error('❌ [预渲染] 致命错误:', error)
  process.exit(1)
})
