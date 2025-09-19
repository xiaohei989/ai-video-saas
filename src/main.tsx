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

// 开发环境下引入调试测试
if (import.meta.env.DEV) {
  import('./test-debug-url-params')
}
import './styles/fonts.css'
import './i18n/config'
import { initCloudflareOptimizations } from './utils/cloudflare'
import { initializeFontLoading } from './utils/fontLoader'
import { initializeSmartPreloading } from './utils/smartPreloader'
import { initPreloadCleanup } from './utils/removePreloadLinks'
import './utils/quickCacheClear' // 加载缓存清除工具到全局
import './utils/apicoreDebugUtils' // 加载APICore调试工具
import { initializeTemplateSync } from './utils/templateSyncInitializer' // 模板同步初始化

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

// 模板同步已禁用 - 使用 window.templateSyncDebug.manual() 手动同步
// 如需自动同步，取消注释以下代码：
/*
if (import.meta.env.DEV && typeof window !== 'undefined') {
  setTimeout(() => {
    initializeTemplateSync({
      skipInProduction: true,
      silent: false
    }).catch(error => {
      console.warn('[MAIN] 模板同步初始化失败，但不影响应用运行:', error)
    })
  }, 2000)
}
*/

ReactDOM.createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
)