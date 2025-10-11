/**
 * 语言路由自定义Hook
 * 提供语言感知的导航功能
 */

import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getCurrentLanguage,
  addLanguagePrefix,
  switchPathLanguage,
  SupportedLanguage,
  removeLanguagePrefix
} from '@/utils/languageRouter'

export function useLanguageRouter() {
  const navigate = useNavigate()
  const location = useLocation()
  const { i18n } = useTranslation()

  // 获取当前语言
  const currentLanguage = getCurrentLanguage(location.pathname)

  /**
   * 语言感知的导航函数
   * 自动为路径添加当前语言前缀
   */
  const navigateTo = useCallback((path: string, options?: { replace?: boolean }) => {
    // 分离路径和查询参数
    const [pathname, search] = path.split('?')

    // 处理路径部分
    const cleanPath = removeLanguagePrefix(pathname)
    const pathWithLang = addLanguagePrefix(cleanPath, currentLanguage)

    // 拼接查询参数
    const fullPath = search ? `${pathWithLang}?${search}` : pathWithLang

    navigate(fullPath, options)
  }, [navigate, currentLanguage])

  /**
   * 切换语言并保持当前路径
   */
  const changeLanguage = useCallback((newLang: SupportedLanguage) => {
    const newPath = switchPathLanguage(location.pathname, newLang)

    // 更新i18n语言
    i18n.changeLanguage(newLang)

    // 导航到新的语言路径
    navigate(newPath, { replace: false })

    // 保存语言偏好
    localStorage.setItem('preferred_language', newLang)

    console.log('[useLanguageRouter] 切换语言:', {
      from: currentLanguage,
      to: newLang,
      oldPath: location.pathname,
      newPath
    })
  }, [location.pathname, navigate, i18n, currentLanguage])

  /**
   * 获取指定语言的路径
   */
  const getPathForLanguage = useCallback((lang: SupportedLanguage) => {
    return switchPathLanguage(location.pathname, lang)
  }, [location.pathname])

  return {
    currentLanguage,
    navigateTo,
    changeLanguage,
    getPathForLanguage
  }
}

export default useLanguageRouter