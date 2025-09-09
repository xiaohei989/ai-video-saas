import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
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