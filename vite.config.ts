import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // 第三个参数为空字符串表示加载所有环境变量，包括 VITE_ 前缀的
  const env = loadEnv(mode, process.cwd(), '')
  
  // 打印调试信息
  if (mode === 'development') {
    console.log('[VITE CONFIG] VITE_SUPABASE_SERVICE_ROLE_KEY exists:', !!env.VITE_SUPABASE_SERVICE_ROLE_KEY)
    if (env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
      console.log('[VITE CONFIG] Key length:', env.VITE_SUPABASE_SERVICE_ROLE_KEY.length)
      console.log('[VITE CONFIG] Key preview:', env.VITE_SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...')
    }
  }
  
  return {
    plugins: [react()],
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
    },
    build: {
      outDir: 'build',
      sourcemap: true,
    },
  }
})