import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// 确保React已完全加载并可用
if (!React || !React.createContext || !ReactDOM) {
  throw new Error('React核心库加载失败，请检查依赖配置')
}

// 添加简单的React Context功能验证
try {
  const TestContext = React.createContext(null)
  if (!TestContext || !TestContext.Provider) {
    throw new Error('React createContext功能不可用')
  }
} catch (error) {
  console.error('[MAIN] React Context验证失败:', error)
  throw error
}
import './styles/index.css'
import './styles/fonts.css'
import './i18n/config'
import { initCloudflareOptimizations } from './utils/cloudflare'
import { initializeFontLoading } from './utils/fontLoader'
import { initializeSmartPreloading } from './utils/smartPreloader'
import { initPreloadCleanup } from './utils/removePreloadLinks'
import './utils/quickCacheClear' // 加载缓存清除工具到全局
import './utils/apicoreDebugUtils' // 加载APICore调试工具

// 立即清理不必要的预加载链接
initPreloadCleanup()

// 初始化字体加载优化
initializeFontLoading()

// 初始化智能预加载
initializeSmartPreloading()

// 初始化Cloudflare优化
if (typeof window !== 'undefined') {
  initCloudflareOptimizations()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)