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
          // 暂时禁用手动chunk分割，让Rollup自动处理
          // 这避免了复杂的React依赖关系导致的初始化问题
        },
      },
      // 暂时禁用压缩以调试问题
      minify: false,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          // 保留必要的函数名，避免 React Context 解析问题
          keep_fnames: /^(createContext|useContext|Context)$/,
          // 避免变量提升导致的初始化问题
          hoist_vars: false,
          hoist_funs: false,
          // 保持原始声明顺序
          sequences: false,
        },
        format: {
          // 确保输出兼容 Cloudflare Pages
          comments: false,
        },
        mangle: {
          // 保留关键的 React 函数名
          reserved: ['createContext', 'useContext', 'Context', 'React'],
          // 不要混淆顶级作用域的变量名
          toplevel: false,
        },
      },
      // 构建优化
      chunkSizeWarningLimit: 1500, // 放宽限制避免警告
      assetsInlineLimit: 4096,
      // 模块预加载配置 - 确保正确的加载顺序
      modulePreload: {
        polyfill: true,
        resolveDependencies: (filename, deps, { hostId, hostType }) => {
          // 按优先级排序依赖
          const sortedDeps = deps.sort((a, b) => {
            // React 核心库最高优先级
            if (a.includes('react-core') && !b.includes('react-core')) return -1
            if (!a.includes('react-core') && b.includes('react-core')) return 1
            
            // React 生态系统第二优先级
            if (a.includes('react-ecosystem') && !b.includes('react-ecosystem')) return -1
            if (!a.includes('react-ecosystem') && b.includes('react-ecosystem')) return 1
            
            return 0
          })
          
          console.log('[MODULE PRELOAD] Sorted dependencies:', sortedDeps.map(d => d.split('/').pop()))
          return sortedDeps
        }
      },
      // CSS代码分割优化
      cssCodeSplit: true,
    },
  }
})