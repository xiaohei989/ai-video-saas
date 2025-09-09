/**
 * 自定义Vite插件
 * 用于优化资源预加载和构建过程
 */

import type { Plugin } from 'vite'

/**
 * 移除不必要的预加载链接插件
 */
export function removeUnnecessaryPreloads(): Plugin {
  return {
    name: 'remove-unnecessary-preloads',
    transformIndexHtml(html, ctx) {
      // 在开发和生产环境都移除不必要的预加载链接
      console.log('[VITE PLUGIN] Removing unnecessary preload links...')
      
      // 移除所有assets相关的预加载（包括vendor.js, index.css等）
      html = html.replace(/<link[^>]*rel="preload"[^>]*href="[^"]*\/assets\/[^"]*"[^>]*>/gi, '')
      
      // 移除Google字体的预加载，因为我们现在延迟加载
      html = html.replace(/<link[^>]*rel="preload"[^>]*href="[^"]*fonts\.gstatic\.com[^"]*"[^>]*>/gi, '')
      
      // 移除Inter字体的具体URL预加载
      html = html.replace(/<link[^>]*rel="preload"[^>]*href="[^"]*UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA\.woff2[^"]*"[^>]*>/gi, '')
      
      // 通用预加载移除模式 - 移除所有可能问题的预加载
      html = html.replace(/<link[^>]*rel="preload"[^>]*>/gi, (match) => {
        // 如果包含我们要移除的关键词，则移除
        if (match.includes('vendor.js') || 
            match.includes('index.css') || 
            match.includes('fonts.gstatic.com') ||
            match.includes('UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2')) {
          console.log('[VITE PLUGIN] Removed preload:', match)
          return ''
        }
        return match
      })
      
      return html
    }
  }
}

/**
 * 智能资源提示插件
 */
export function smartResourceHints(): Plugin {
  return {
    name: 'smart-resource-hints',
    transformIndexHtml(html, ctx) {
      // 只在生产环境添加关键资源的预连接
      if (!ctx.server) {
        const preconnectLinks = [
          '<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>',
          '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
          '<link rel="dns-prefetch" href="https://js.stripe.com">',
          '<link rel="dns-prefetch" href="https://www.googletagmanager.com">'
        ]
        
        // 在</head>之前插入预连接链接
        html = html.replace('</head>', `${preconnectLinks.join('\n    ')}\n  </head>`)
      }
      return html
    }
  }
}

/**
 * 开发环境性能优化插件
 */
export function devPerformanceOptimizer(): Plugin {
  return {
    name: 'dev-performance-optimizer',
    configureServer(server) {
      // 在开发环境中优化模块加载
      server.middlewares.use('/src', (req, res, next) => {
        // 添加适当的缓存头
        if (req.url?.endsWith('.ts') || req.url?.endsWith('.tsx')) {
          res.setHeader('Cache-Control', 'private, max-age=0')
        } else if (req.url?.endsWith('.css')) {
          res.setHeader('Cache-Control', 'private, max-age=300')
        }
        next()
      })
    }
  }
}