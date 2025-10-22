#!/usr/bin/env node
/**
 * 提示词模板文件管理API
 * 提供HTTP接口用于读写prompts/content-generation下的Markdown模板文件
 */

import { createServer } from 'http'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROMPTS_DIR = join(__dirname, '../prompts/content-generation')
const PORT = 3031

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
}

/**
 * 获取所有可用的模板列表
 */
function getTemplateList() {
  if (!existsSync(PROMPTS_DIR)) {
    return []
  }

  const files = readdirSync(PROMPTS_DIR)
  return files
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const slug = f.replace('.md', '')
      const filePath = join(PROMPTS_DIR, f)
      const content = readFileSync(filePath, 'utf-8')
      const firstLine = content.split('\n')[0]
      const title = firstLine.replace(/^#\s*/, '')

      return {
        slug,
        filename: f,
        title,
        size: content.length,
        path: filePath
      }
    })
}

/**
 * 读取模板内容
 */
function getTemplateContent(slug) {
  const filePath = join(PROMPTS_DIR, `${slug}.md`)

  if (!existsSync(filePath)) {
    throw new Error(`Template not found: ${slug}`)
  }

  return readFileSync(filePath, 'utf-8')
}

/**
 * 保存模板内容
 */
function saveTemplateContent(slug, content) {
  const filePath = join(PROMPTS_DIR, `${slug}.md`)
  writeFileSync(filePath, content, 'utf-8')
  return { success: true, slug, size: content.length }
}

/**
 * 处理HTTP请求
 */
function handleRequest(req, res) {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS_HEADERS)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = url.pathname

  try {
    // GET /api/prompt-templates - 获取模板列表
    if (req.method === 'GET' && pathname === '/api/prompt-templates') {
      const templates = getTemplateList()
      res.writeHead(200, CORS_HEADERS)
      res.end(JSON.stringify({ success: true, data: templates }))
      return
    }

    // GET /api/prompt-templates/:slug - 获取模板内容
    if (req.method === 'GET' && pathname.startsWith('/api/prompt-templates/')) {
      const slug = pathname.replace('/api/prompt-templates/', '')
      const content = getTemplateContent(slug)
      res.writeHead(200, CORS_HEADERS)
      res.end(JSON.stringify({ success: true, data: { slug, content } }))
      return
    }

    // PUT /api/prompt-templates/:slug - 更新模板内容
    if (req.method === 'PUT' && pathname.startsWith('/api/prompt-templates/')) {
      const slug = pathname.replace('/api/prompt-templates/', '')

      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const { content } = JSON.parse(body)
          const result = saveTemplateContent(slug, content)
          res.writeHead(200, CORS_HEADERS)
          res.end(JSON.stringify({ success: true, data: result }))
        } catch (err) {
          res.writeHead(400, CORS_HEADERS)
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      })
      return
    }

    // 404
    res.writeHead(404, CORS_HEADERS)
    res.end(JSON.stringify({ success: false, error: 'Not found' }))

  } catch (error) {
    console.error('❌ Error:', error)
    res.writeHead(500, CORS_HEADERS)
    res.end(JSON.stringify({ success: false, error: error.message }))
  }
}

// 启动服务器
const server = createServer(handleRequest)

server.listen(PORT, () => {
  console.log(`📝 提示词模板API服务器已启动`)
  console.log(`🌐 监听端口: ${PORT}`)
  console.log(`📂 模板目录: ${PROMPTS_DIR}`)
  console.log(``)
  console.log(`可用API:`)
  console.log(`  GET  /api/prompt-templates          - 获取模板列表`)
  console.log(`  GET  /api/prompt-templates/:slug    - 获取模板内容`)
  console.log(`  PUT  /api/prompt-templates/:slug    - 更新模板内容`)
  console.log(``)
  console.log(`示例:`)
  console.log(`  curl http://localhost:${PORT}/api/prompt-templates`)
  console.log(`  curl http://localhost:${PORT}/api/prompt-templates/how-to`)
  console.log(``)
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 关闭服务器...')
  server.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})
