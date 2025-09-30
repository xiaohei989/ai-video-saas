/**
 * 多语言路由工具函数
 * 支持URL路径前缀的多语言架构
 * 例如: /zh/templates, /en/templates
 */

// 支持的语言列表
export const SUPPORTED_LANGUAGES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'ar'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

// 默认语言
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh'

/**
 * 从路径中提取语言代码
 * @param pathname - URL路径名
 * @returns 语言代码，如果未找到则返回null
 */
export function extractLangFromPath(pathname: string): SupportedLanguage | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const firstSegment = segments[0].toLowerCase()
  if (SUPPORTED_LANGUAGES.includes(firstSegment as SupportedLanguage)) {
    return firstSegment as SupportedLanguage
  }

  return null
}

/**
 * 从路径中移除语言前缀
 * @param pathname - URL路径名
 * @returns 移除语言前缀后的路径
 */
export function removeLanguagePrefix(pathname: string): string {
  const lang = extractLangFromPath(pathname)
  if (!lang) return pathname

  // 移除 /zh/, /en/ 等前缀
  const withoutLang = pathname.replace(new RegExp(`^/${lang}`), '')
  return withoutLang || '/'
}

/**
 * 为路径添加语言前缀
 * @param pathname - URL路径名
 * @param lang - 语言代码
 * @returns 带语言前缀的路径
 */
export function addLanguagePrefix(pathname: string, lang: SupportedLanguage): string {
  // 移除现有的语言前缀
  const cleanPath = removeLanguagePrefix(pathname)

  // 确保路径以 / 开头
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`

  // 添加新的语言前缀
  return `/${lang}${normalizedPath}`
}

/**
 * 切换路径的语言
 * @param pathname - 当前URL路径名
 * @param newLang - 新的语言代码
 * @returns 切换语言后的路径
 */
export function switchPathLanguage(pathname: string, newLang: SupportedLanguage): string {
  const cleanPath = removeLanguagePrefix(pathname)
  return addLanguagePrefix(cleanPath, newLang)
}

/**
 * 检测浏览器首选语言
 * @returns 匹配的语言代码或默认语言
 */
export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE

  // 检查localStorage中保存的语言偏好
  const savedLanguage = localStorage.getItem('preferred_language')
  if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage as SupportedLanguage)) {
    return savedLanguage as SupportedLanguage
  }

  // 检测浏览器语言
  const browserLang = navigator.language.toLowerCase()

  // 直接匹配
  if (SUPPORTED_LANGUAGES.includes(browserLang as SupportedLanguage)) {
    return browserLang as SupportedLanguage
  }

  // 前缀匹配 (en-US -> en)
  const langPrefix = browserLang.split('-')[0]
  if (SUPPORTED_LANGUAGES.includes(langPrefix as SupportedLanguage)) {
    return langPrefix as SupportedLanguage
  }

  // 中文特殊处理
  if (browserLang.includes('zh')) {
    return 'zh'
  }

  return DEFAULT_LANGUAGE
}

/**
 * 获取当前语言或从路径中提取
 * @param pathname - URL路径名
 * @returns 当前语言代码
 */
export function getCurrentLanguage(pathname: string): SupportedLanguage {
  return extractLangFromPath(pathname) || detectBrowserLanguage()
}

/**
 * 生成所有语言版本的URL
 * @param pathname - 基础路径(不含语言前缀)
 * @returns 所有语言版本的URL映射
 */
export function generateLanguageUrls(pathname: string, baseUrl: string = 'https://veo3video.me'): Record<SupportedLanguage, string> {
  const cleanPath = removeLanguagePrefix(pathname)

  const urls: Partial<Record<SupportedLanguage, string>> = {}
  SUPPORTED_LANGUAGES.forEach(lang => {
    urls[lang] = `${baseUrl}${addLanguagePrefix(cleanPath, lang)}`
  })

  return urls as Record<SupportedLanguage, string>
}

/**
 * 语言代码到全名的映射
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  ar: 'العربية'
}

/**
 * 语言代码到国家代码的映射(用于hreflang)
 */
export const LANGUAGE_TO_COUNTRY: Record<SupportedLanguage, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR',
  ar: 'ar-SA'
}