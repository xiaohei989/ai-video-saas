import { useState } from 'react'
import { getStripeEnvironmentInfo, isStripeTestMode } from '@/config/stripe-env'
import { AlertTriangle, Check, Info, Settings } from 'lucide-react'

export function EnvironmentIndicator() {
  const [isExpanded, setIsExpanded] = useState(false)
  const envInfo = getStripeEnvironmentInfo()
  const isTestMode = isStripeTestMode()

  // 生产环境下不显示指示器
  if (!import.meta.env.DEV) {
    return null
  }

  const iconColor = isTestMode 
    ? "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
    : "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"

  const panelClasses = isTestMode 
    ? "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100"
    : "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100"

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* 悬浮图标 */}
      <div
        className={`w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg cursor-pointer flex items-center justify-center transition-all duration-200 hover:shadow-xl ${iconColor}`}
        onClick={() => setIsExpanded(!isExpanded)}
        title={`Stripe ${isTestMode ? '测试' : '生产'}环境`}
      >
        <Settings className="h-5 w-5" />
      </div>

      {/* 展开面板 */}
      {isExpanded && (
        <div 
          className={`absolute bottom-12 left-0 w-80 border rounded-lg p-4 shadow-lg transition-all duration-200 ${panelClasses}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isTestMode ? (
                <Info className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span className="font-medium">
                Stripe {isTestMode ? '测试环境' : '生产环境'}
              </span>
            </div>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ×
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="font-medium mb-1">Stripe配置</div>
              <div className="space-y-1 opacity-80">
                <div>模式: {envInfo.mode}</div>
                <div>公钥: {envInfo.publishableKey.substring(0, 20)}...</div>
              </div>
            </div>
            
            <div className="border-t border-current/20 pt-2">
              <div className="font-medium mb-1">价格ID</div>
              <div className="space-y-1 opacity-80">
                <div>基础版: {envInfo.prices.basic}</div>
                <div>专业版: {envInfo.prices.pro}</div>
                <div>企业版: {envInfo.prices.enterprise}</div>
              </div>
            </div>

            {isTestMode && (
              <div className="border-t border-current/20 pt-2">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Check className="h-3 w-3" />
                  <span>测试模式安全</span>
                </div>
              </div>
            )}

            {!isTestMode && (
              <div className="border-t border-current/20 pt-2">
                <div className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  <span>⚠️ 生产环境警告</span>
                </div>
                <div className="opacity-80 mt-1">
                  真实付款将被处理
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 点击外部关闭面板 */}
      {isExpanded && (
        <div 
          className="fixed inset-0 -z-10"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  )
}

export default EnvironmentIndicator