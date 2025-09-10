import i18n from '@/i18n/config'

/**
 * 获取当前语言对应的日期本地化代码
 */
export const getDateLocale = (language?: string): string => {
  const lang = language || i18n.language
  const localeMap: Record<string, string> = {
    'zh': 'zh-CN',
    'en': 'en-US', 
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'es': 'es-ES',
    'de': 'de-DE',
    'fr': 'fr-FR',
    'ar': 'ar-SA'
  }
  return localeMap[lang] || 'en-US'
}

/**
 * 格式化日期为本地化字符串
 * @param date 日期对象或日期字符串
 * @param options 格式化选项
 * @param language 可选的语言代码，默认使用当前i18n语言
 * @returns 格式化后的日期字符串
 */
export const formatDate = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short', 
    day: 'numeric'
  },
  language?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString(getDateLocale(language), options)
}

/**
 * 格式化日期为简短格式（月-日）
 */
export const formatShortDate = (date: Date | string, language?: string): string => {
  return formatDate(date, { month: 'short', day: 'numeric' }, language)
}

/**
 * 格式化日期为完整格式（年-月-日）
 */
export const formatFullDate = (date: Date | string, language?: string): string => {
  return formatDate(date, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }, language)
}