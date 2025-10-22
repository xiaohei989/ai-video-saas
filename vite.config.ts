import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import compression from 'vite-plugin-compression'
import { removeUnnecessaryPreloads, smartResourceHints, devPerformanceOptimizer } from './src/utils/vite-plugins'
import { stripeSyncPlugin } from './src/utils/vite-plugin-stripe-sync'

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
      // 🔄 Stripe 环境变量自动同步插件
      stripeSyncPlugin({
        enabled: mode === 'development', // 仅在开发模式启用
        mode: 'auto', // 自动检测测试/生产模式
      }),
      react(),
      removeUnnecessaryPreloads(),
      smartResourceHints(),
      devPerformanceOptimizer(),
      // 🚀 Brotli压缩 - 提供更好的压缩率(比gzip高20-30%)
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240, // 只压缩大于10KB的文件
        deleteOriginFile: false
      }),
      // 🚀 Gzip压缩 - 兼容旧浏览器
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240,
        deleteOriginFile: false
      })
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
    // 🔥 全局 esbuild 配置 - 生产环境移除 console 和 debugger
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger'],
    } : {
      // 开发环境保留 console
    },
    // 🔥 优化依赖预构建,排除所有AWS SDK模块
    optimizeDeps: {
      exclude: [
        '@aws-sdk/client-s3',
        '@aws-sdk/signature-v4-crt',
        '@aws-sdk/signature-v4',
        '@aws-sdk/s3-request-presigner'
      ],
      esbuildOptions: {
        target: 'esnext',
        supported: {
          'top-level-await': true
        }
      }
    },
    server: {
      port: 3000,
      strictPort: false, // 🚀 允许端口自动切换，支持3001、3002、3003
      host: true,
      open: true,
      // 添加代理配置解凍CORS问题
      proxy: {
        // 🚀 增强的R2代理配置 - 支持多端口和高级错误处理
        '/api/r2': {
          target: 'https://cdn.veo3video.me',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/r2/, ''),
          timeout: 30000, // 🚀 减少到30秒超时避免过长等待
          secure: true, // 🚀 启用SSL验证
          followRedirects: true, // 🚀 自动跟随重定向
          configure: (proxy, options) => {
            let retryCount = new Map(); // 🚀 重试计数器
            
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const currentPort = req.socket.localPort || process.env.PORT || '3000';
              
              // 🚀 增强请求头
              proxyReq.setHeader('Access-Control-Allow-Origin', '*');
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (compatible; VideoProxy/2.0)');
              proxyReq.setHeader('Connection', 'keep-alive');
              proxyReq.setHeader('Accept', '*/*');
              proxyReq.setHeader('Accept-Encoding', 'gzip, deflate, br');
              
              // 🚀 设置增强的超时处理
              proxyReq.setTimeout(30000, () => {
                proxyReq.destroy();
              });
            });
            
            proxy.on('proxyRes', (proxyRes, req, res) => {
              const currentPort = req.socket.localPort || process.env.PORT || '3000';
              
              // 🚀 增强CORS头
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
              proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS';
              proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type,Range,Authorization';
              proxyRes.headers['Access-Control-Expose-Headers'] = 'Content-Length,Content-Range';
              
              // 🚀 智能缓存策略
              if (proxyRes.statusCode === 200 || proxyRes.statusCode === 206) {
                proxyRes.headers['Cache-Control'] = 'public, max-age=3600, s-maxage=86400'; // 1小时客户端，24小时CDN
                proxyRes.headers['ETag'] = `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`;
                proxyRes.headers['Last-Modified'] = new Date().toUTCString();
                
                // 🚀 重置重试计数
                retryCount.delete(req.url);
              }
            });
            
            proxy.on('error', (err, req, res) => {
              const currentPort = req.socket.localPort || process.env.PORT || '3000';
              const url = req.url;
              const retries = retryCount.get(url) || 0;
              
              
              // 🚀 智能重试机制
              if (retries < 3 && !res.headersSent) {
                retryCount.set(url, retries + 1);
                
                // 延迟重试
                setTimeout(() => {
                  // 这里可以添加重试逻辑，但由于Vite代理限制，我们主要依赖客户端重试
                }, 1000 * (retries + 1));
              }
              
              if (!res.headersSent) {
                // 🚀 详细错误分类
                let statusCode = 500;
                let errorType = 'unknown';
                
                if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
                  statusCode = 503; // Service Unavailable
                  errorType = 'connection_failed';
                } else if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
                  statusCode = 504; // Gateway Timeout
                  errorType = 'timeout';
                } else if (err.message.includes('TLS') || err.message.includes('SSL')) {
                  statusCode = 502; // Bad Gateway
                  errorType = 'ssl_error';
                }
                
                res.writeHead(statusCode, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
                  'X-Proxy-Error': errorType
                });
                
                res.end(JSON.stringify({
                  error: 'R2 Proxy Error',
                  type: errorType,
                  message: err.message,
                  retry: retries < 3,
                  retryCount: retries,
                  fallbackUrl: `https://cdn.veo3video.me${url.replace('/api/r2', '')}`,
                  timestamp: new Date().toISOString(),
                  port: currentPort
                }));
              }
            });
          }
        },
        // 🚀 增强的用户视频代理配置 - 支持多端口和智能缓存
        '/videos/*.mp4': {
          target: 'https://cdn.veo3video.me',
          changeOrigin: true,
          timeout: 45000, // 🚀 增强超时配置
          secure: true,
          configure: (proxy, options) => {
            let videoRetryCount = new Map(); // 🚀 视频重试计数器
            
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const currentPort = req.socket.localPort || process.env.PORT || '3000';
              console.log(`🎥 [VIDEO PROXY:${currentPort}] 请求:`, proxyReq.method, proxyReq.path);
              
              // 🚀 优化视频请求头
              proxyReq.setHeader('Access-Control-Allow-Origin', '*');
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (compatible; VideoProxy/2.0)');
              proxyReq.setHeader('Accept', 'video/mp4,video/*,*/*');
              proxyReq.setHeader('Accept-Encoding', 'gzip, deflate, br');
              proxyReq.setHeader('Connection', 'keep-alive');
              
              // 🚀 超时处理
              proxyReq.setTimeout(45000, () => {
                console.error(`❌ [VIDEO PROXY:${currentPort}] 视频请求超时:`, req.url);
                proxyReq.destroy();
              });
            });
            
            proxy.on('proxyRes', (proxyRes, req, res) => {
              const currentPort = req.socket.localPort || process.env.PORT || '3000';
              console.log(`✅ [VIDEO PROXY:${currentPort}] 响应:`, proxyRes.statusCode, req.url);
              
              // 🚀 增强CORS和视频流支持
              proxyRes.headers['Access-Control-Allow-Origin'] = '*';
              proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,OPTIONS';
              proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type,Range,Authorization';
              proxyRes.headers['Access-Control-Expose-Headers'] = 'Content-Length,Content-Range,Accept-Ranges';
              proxyRes.headers['Accept-Ranges'] = 'bytes'; // 🚀 支持视频分片加载
              
              // 🚀 智能视频缓存策略
              if (proxyRes.statusCode === 200 || proxyRes.statusCode === 206) {
                // 视频文件长期缓存
                proxyRes.headers['Cache-Control'] = 'public, max-age=7200, s-maxage=86400, immutable'; // 2小时客户端，24小时CDN
                proxyRes.headers['ETag'] = `"video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`;
                proxyRes.headers['Last-Modified'] = new Date().toUTCString();
                console.log(`📦 [VIDEO PROXY:${currentPort}] 视频缓存头已设置:`, req.url);
                
                // 🚀 重置重试计数
                videoRetryCount.delete(req.url);
              }
            });
            
            proxy.on('error', (err, req, res) => {
              const currentPort = req.socket.localPort || process.env.PORT || '3000';
              const url = req.url;
              const retries = videoRetryCount.get(url) || 0;
              
              console.error(`💥 [VIDEO PROXY:${currentPort}] 视频代理错误 (重试${retries}/2):`, err.message, url);
              
              if (!res.headersSent) {
                // 🚀 视频错误分类处理
                let statusCode = 500;
                let errorType = 'video_proxy_error';
                
                if (err.message.includes('ENOTFOUND')) {
                  statusCode = 503;
                  errorType = 'video_not_found';
                } else if (err.message.includes('timeout')) {
                  statusCode = 504;
                  errorType = 'video_timeout';
                }
                
                res.writeHead(statusCode, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'X-Video-Proxy-Error': errorType
                });
                
                res.end(JSON.stringify({
                  error: 'Video Proxy Error',
                  type: errorType,
                  message: err.message,
                  retry: retries < 2,
                  retryCount: retries,
                  fallbackUrl: `https://cdn.veo3video.me${url}`,
                  timestamp: new Date().toISOString(),
                  port: currentPort
                }));
              }
            });
          }
        },
        // 已移除 Cloudflare Transform 代理（/cdn-cgi/image）
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
      // 🚀 CSS优化 - 使用lightningcss压缩
      cssMinify: 'lightningcss',
      // 🚀 增强CSS Tree Shaking
      cssCodeSplit: true, // 按路由分割CSS
      // 🚀 优化资源内联
      assetsInlineLimit: 4096, // 小于4KB的资源内联为base64
      // 🔥 CommonJS 选项 - 确保正确处理 AWS SDK
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      // Cloudflare Pages 优化配置
      rollupOptions: {
        // 🔥 将 AWS SDK 标记为 external，完全排除在浏览器构建之外
        external: [
          '@aws-sdk/client-s3',
          '@aws-sdk/signature-v4',
          '@aws-sdk/s3-request-presigner'
        ],
        // 🚀 增强Tree Shaking配置
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false
        },
        output: {
          // 🔥 临时禁用手动chunk分割，使用Vite自动分割避免初始化问题
          // manualChunks: undefined,
          // 优化chunk文件名
          chunkFileNames: 'assets/[name]-[hash].js',
          // 启用实验性CSS代码分割
          experimentalMinChunkSize: 10000
        },
      },
      // 🔥 使用 esbuild 压缩生产代码（console移除在顶层esbuild配置）
      minify: mode === 'production' ? 'esbuild' : false,
      // 构建优化
      chunkSizeWarningLimit: 1500, // 放宽限制避免警告
      // 🚀 模块预加载配置 - 排除管理员模块
      modulePreload: {
        polyfill: true,
        resolveDependencies: (filename, deps, { hostId, hostType }) => {
          // 🎯 过滤掉管理员相关的chunk,避免首屏加载
          const filteredDeps = deps.filter(dep => {
            const shouldExclude = dep.includes('admin') ||
                                  dep.includes('Admin') ||
                                  dep.includes('charts') || // recharts也只用于管理后台
                                  dep.includes('react-admin')

            if (shouldExclude) {
              console.log('[MODULE PRELOAD] 🚫 排除管理员模块:', dep.split('/').pop())
            }

            return !shouldExclude
          })

          // 按优先级排序剩余依赖
          const sortedDeps = filteredDeps.sort((a, b) => {
            // React 核心库最高优先级
            if (a.includes('react-core') && !b.includes('react-core')) return -1
            if (!a.includes('react-core') && b.includes('react-core')) return 1

            // React 生态系统第二优先级
            if (a.includes('react-ecosystem') && !b.includes('react-ecosystem')) return -1
            if (!a.includes('react-ecosystem') && b.includes('react-ecosystem')) return 1

            return 0
          })

          console.log('[MODULE PRELOAD] ✅ 预加载依赖:', sortedDeps.map(d => d.split('/').pop()))
          return sortedDeps
        }
      },
    },
  }
})
