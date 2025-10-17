/**
 * 预览服务器
 *
 * 用于本地预览预渲染后的静态HTML文件
 * 支持SPA fallback和正确的Content-Type
 */

import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { extname, join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', 'build')
const PORT = process.env.PORT || 3000

// MIME类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

/**
 * 获取文件的Content-Type
 */
function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 处理请求
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  let filePath = join(ROOT, url.pathname)

  console.log(`📥 [请求] ${req.method} ${url.pathname}`)

  try {
    // 尝试直接访问文件
    if (await fileExists(filePath)) {
      const isDirectory = (await stat(filePath)).isDirectory()

      if (isDirectory) {
        filePath = join(filePath, 'index.html')
      }
    } else {
      // 尝试添加.html扩展名
      const htmlPath = filePath + '.html'
      if (await fileExists(htmlPath)) {
        filePath = htmlPath
      } else {
        // 尝试index.html
        const indexPath = join(filePath, 'index.html')
        if (await fileExists(indexPath)) {
          filePath = indexPath
        } else {
          // SPA fallback - 返回根index.html
          filePath = join(ROOT, 'index.html')
        }
      }
    }

    // 读取文件
    const content = await readFile(filePath)
    const contentType = getContentType(filePath)

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': filePath.endsWith('.html')
        ? 'no-cache'
        : 'public, max-age=31536000'
    })
    res.end(content)

    console.log(`✅ [成功] ${url.pathname} → ${filePath}`)

  } catch (error) {
    console.error(`❌ [错误] ${url.pathname}:`, error.message)

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>404 - Page Not Found</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .error {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            h1 { color: #e74c3c; margin: 0; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>404</h1>
            <p>Page Not Found</p>
            <p style="font-size: 0.9em; color: #999;">${url.pathname}</p>
          </div>
        </body>
      </html>
    `)
  }
}

// 创建服务器
const server = createServer(handleRequest)

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60))
  console.log('🚀 预览服务器已启动')
  console.log('='.repeat(60))
  console.log(`📂 根目录: ${ROOT}`)
  console.log(`🌐 本地访问: http://localhost:${PORT}`)
  console.log('\n💡 提示：')
  console.log('  - 预渲染的HTML在: /{lang}/guide/{slug}/')
  console.log('  - 例如: http://localhost:3000/en/guide/cat-trampoline/')
  console.log('  - 按 Ctrl+C 停止服务器')
  console.log('='.repeat(60) + '\n')
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n\n👋 关闭服务器...')
  server.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n\n👋 关闭服务器...')
  server.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})
