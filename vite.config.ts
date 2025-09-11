import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { removeUnnecessaryPreloads, smartResourceHints, devPerformanceOptimizer } from './src/utils/vite-plugins'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // 第三个参数为空字符串表示加载所有环境变量，包括 VITE_ 前缀的
  const env = loadEnv(mode, process.cwd(), '')
  
  // Cloudflare Pages 环境检测
  const isCloudflarePages = process.env.CF_PAGES === '1' || process.env.CLOUDFLARE_ENV
  console.log('[VITE CONFIG] Cloudflare Pages environment:', isCloudflarePages)
  
  // 打印调试信息
  if (mode === 'development') {
    console.log('[VITE CONFIG] VITE_SUPABASE_SERVICE_ROLE_KEY exists:', !!env.VITE_SUPABASE_SERVICE_ROLE_KEY)
    if (env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
      console.log('[VITE CONFIG] Key length:', env.VITE_SUPABASE_SERVICE_ROLE_KEY.length)
      console.log('[VITE CONFIG] Key preview:', env.VITE_SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...')
    }
  }
  
  return {
    plugins: [
      react(),
      removeUnnecessaryPreloads(),
      smartResourceHints(),
      devPerformanceOptimizer()
    ],
    define: {
      // Pass env variables to the app
      // API Provider Configuration
      'process.env.VEO_API_PROVIDER': JSON.stringify(env.VEO_API_PROVIDER),
      'process.env.VEO_USE_REAL_API': JSON.stringify(env.VEO_USE_REAL_API),
      
      // Google Veo3 API Configuration
      'process.env.VEO_API_KEYS': JSON.stringify(env.VEO_API_KEYS),
      'process.env.VEO_API_EMAILS': JSON.stringify(env.VEO_API_EMAILS),
      'process.env.VEO_QUOTA_LIMITS': JSON.stringify(env.VEO_QUOTA_LIMITS),
      'process.env.VEO_MODEL_VERSION': JSON.stringify(env.VEO_MODEL_VERSION),
      'process.env.VEO_MAX_CONCURRENT': JSON.stringify(env.VEO_MAX_CONCURRENT),
      'process.env.VEO_MAX_QUEUE_SIZE': JSON.stringify(env.VEO_MAX_QUEUE_SIZE),
      
      // Qingyun API Configuration
      'process.env.QINGYUN_API_KEY': JSON.stringify(env.QINGYUN_API_KEY),
      'process.env.QINGYUN_API_ENDPOINT': JSON.stringify(env.QINGYUN_API_ENDPOINT),
      'process.env.QINGYUN_DEFAULT_QUALITY': JSON.stringify(env.QINGYUN_DEFAULT_QUALITY),
      
      // Application Configuration
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV),
      'process.env.APP_URL': JSON.stringify(env.APP_URL),
      
      // Google Analytics Configuration
      'import.meta.env.VITE_GA_MEASUREMENT_ID': JSON.stringify(env.VITE_GA_MEASUREMENT_ID),
      'import.meta.env.VITE_GA_DEBUG_MODE': JSON.stringify(env.VITE_GA_DEBUG_MODE),
      
      // Development Only - Service Role Key for admin operations
      // 注意：这仅用于开发环境调试，生产环境应使用 Edge Functions
      ...(mode === 'development' && env.VITE_SUPABASE_SERVICE_ROLE_KEY ? {
        'import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(env.VITE_SUPABASE_SERVICE_ROLE_KEY)
      } : {}),
    },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
    },
    },
    server: {
      port: 3000,
      host: true,
      open: true,
      // 添加代理配置解凍CORS问题
      proxy: {
        // 代理filesystem.site的视频请求
        '/api/filesystem': {
          target: 'https://filesystem.site',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/filesystem/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('[VITE PROXY] Filesystem request:', proxyReq.method, proxyReq.path);
              proxyReq.setHeader('Access-Control-Allow-Origin', '*');
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (compatible; VideoProxy/1.0)');
            });
            
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('[VITE PROXY] Filesystem response:', proxyRes.statusCode, req.url);
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
              proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS';
              proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type,Range';
            });
            
            proxy.on('error', (err, req, res) => {
              console.error('[VITE PROXY] Filesystem proxy error:', err.message, req.url);
              if (!res.headersSent) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'Proxy error', message: err.message}));
              }
            });
          }
        },
        // 代理heyoo.oss的视频请求
        '/api/heyoo': {
          target: 'https://heyoo.oss-ap-southeast-1.aliyuncs.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/heyoo/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('[VITE PROXY] Heyoo request:', proxyReq.method, proxyReq.path);
              proxyReq.setHeader('Access-Control-Allow-Origin', '*');
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (compatible; VideoProxy/1.0)');
            });
            
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('[VITE PROXY] Heyoo response:', proxyRes.statusCode, req.url);
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
              proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS';
              proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type,Range';
            });
            
            proxy.on('error', (err, req, res) => {
              console.error('[VITE PROXY] Heyoo proxy error:', err.message, req.url);
              if (!res.headersSent) {
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'Proxy error', message: err.message}));
              }
            });
          }
        },
        // 代理APICore API请求
        '/api/apicore': {
          target: 'https://api.apicore.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/apicore/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // 保持原有的Authorization header
              console.log('[VITE PROXY] APICore request:', proxyReq.method, proxyReq.path);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // 添加CORS头到响应
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
              proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
              proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization';
            });
          }
        }
      }
    },
    build: {
      outDir: 'build',
      sourcemap: true,
      // Cloudflare Pages 优化配置
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // 核心依赖 - 立即需要的库
            if (id.includes('react/') || id.includes('react-dom/')) {
              return 'react-core'
            }
            
            // 路由相关 - 根据路由懒加载
            if (id.includes('react-router')) {
              return 'router'
            }
            
            // UI组件库 - 按需加载
            if (id.includes('@radix-ui')) {
              return 'ui-components'
            }
            
            // 数据库和API - 异步加载
            if (id.includes('@supabase/supabase-js')) {
              return 'supabase'
            }
            
            // 支付相关 - 延迟加载
            if (id.includes('@stripe/stripe-js')) {
              return 'stripe'
            }
            
            // 图表库 - 延迟加载
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts'
            }
            
            // 国际化 - 按需加载
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n'
            }
            
            // 其他第三方库
            if (id.includes('node_modules') && !id.includes('react/') && !id.includes('react-dom/')) {
              return 'vendor'
            }
          },
        },
      },
      // 压缩配置 - 针对 Cloudflare Pages 优化
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
        },
        format: {
          // 确保输出兼容 Cloudflare Pages
          comments: false,
        },
      },
      // 构建优化
      chunkSizeWarningLimit: 1500, // 放宽限制避免警告
      assetsInlineLimit: 4096,
      // 禁用模块预加载以避免 Cloudflare Pages 兼容性问题
      modulePreload: {
        polyfill: false,
      },
      // CSS代码分割优化
      cssCodeSplit: true,
    },
  }
})