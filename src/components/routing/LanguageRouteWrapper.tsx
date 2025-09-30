/**
 * 语言路由包装器
 * 自动检测URL中的语言前缀，如果缺失则重定向到正确的语言路径
 */

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  extractLangFromPath,
  detectBrowserLanguage,
  addLanguagePrefix,
  SUPPORTED_LANGUAGES,
  SupportedLanguage
} from '@/utils/languageRouter'

export function LanguageRouteWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { i18n } = useTranslation()

  useEffect(() => {
    const currentPath = location.pathname
    const langFromPath = extractLangFromPath(currentPath)

    // 如果URL中没有语言前缀,重定向到带语言前缀的URL
    if (!langFromPath) {
      const preferredLang = detectBrowserLanguage()

      // 添加语言前缀并重定向
      const newPath = addLanguagePrefix(currentPath, preferredLang)

      console.log('[LanguageRouter] 检测到缺少语言前缀，重定向:', {
        from: currentPath,
        to: newPath,
        detectedLanguage: preferredLang
      })

      // 使用replace避免产生历史记录
      navigate(newPath, { replace: true })
      return
    }

    // 确保i18n语言与URL语言同步
    if (langFromPath !== i18n.language) {
      console.log('[LanguageRouter] 同步i18n语言:', {
        from: i18n.language,
        to: langFromPath
      })
      i18n.changeLanguage(langFromPath)
    }
  }, [location.pathname, navigate, i18n])

  return <>{children}</>
}

/**
 * 根路由重定向组件
 * 用于处理 / 路径的语言检测和重定向
 */
export function RootRedirect() {
  const navigate = useNavigate()
  const { i18n } = useTranslation()

  useEffect(() => {
    // 检测用户偏好语言
    const preferredLang = detectBrowserLanguage()

    // 同步i18n
    if (preferredLang !== i18n.language) {
      i18n.changeLanguage(preferredLang)
    }

    // 重定向到带语言前缀的首页
    const targetPath = `/${preferredLang}/`

    console.log('[RootRedirect] 根路径重定向:', {
      detectedLanguage: preferredLang,
      targetPath
    })

    navigate(targetPath, { replace: true })
  }, [navigate, i18n])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">正在加载...</p>
      </div>
    </div>
  )
}

export default LanguageRouteWrapper