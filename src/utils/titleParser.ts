/**
 * 解析多语言标题工具函数
 * 处理AI返回的多语言JSON标题格式
 */

export interface MultiLanguageTitle {
  en?: string
  zh?: string
  ja?: string
  ko?: string
  es?: string
  fr?: string
  de?: string
  ar?: string
  [key: string]: string | undefined
}

/**
 * 解析标题 - 支持多语言JSON对象或普通字符串
 * @param title - 原始标题字段（可能是字符串或JSON对象）
 * @param currentLocale - 当前语言代码（如 'zh', 'en'）
 * @param fallbackText - 当无法解析时的回退文本
 * @returns 解析后的标题字符串
 */
export function parseTitle(
  title: string | null | undefined, 
  currentLocale: string = 'en',
  fallbackText: string = 'Untitled Video'
): string {
  // 如果没有标题，返回回退文本
  if (!title) {
    return fallbackText
  }

  // 如果是普通字符串且不像JSON，直接返回
  if (typeof title === 'string' && !title.trim().startsWith('{')) {
    return title.trim()
  }

  try {
    // 尝试解析JSON格式的多语言标题
    const parsed: MultiLanguageTitle = typeof title === 'string' ? JSON.parse(title) : title
    
    if (typeof parsed === 'object' && parsed !== null) {
      // 优先返回当前语言的标题
      if (parsed[currentLocale]) {
        return parsed[currentLocale]!.trim()
      }
      
      // 回退语言优先级：英语 -> 中文 -> 第一个可用的语言
      const fallbackLanguages = ['en', 'zh', 'ja', 'ko', 'es']
      for (const lang of fallbackLanguages) {
        if (parsed[lang]) {
          return parsed[lang]!.trim()
        }
      }
      
      // 如果上述语言都没有，返回第一个非空值
      const firstAvailable = Object.values(parsed).find(val => val && val.trim())
      if (firstAvailable) {
        return firstAvailable.trim()
      }
    }
  } catch (error) {
    // JSON解析失败，返回原始字符串（去除明显的JSON格式）
    console.warn('Failed to parse title JSON:', error)
    
    // 如果看起来像损坏的JSON，尝试提取第一个可读的值
    if (title.includes('"') && title.includes(':')) {
      const matches = title.match(/"([^"]+)"/g)
      if (matches && matches.length > 0) {
        // 跳过键名，取第一个值
        const values = matches.filter(match => !match.includes(':') && match.length > 3)
        if (values.length > 0) {
          return values[0].replace(/"/g, '').trim()
        }
      }
    }
    
    // 最后的回退：返回原始字符串但清理明显的JSON字符
    return title
      .replace(/[{}"\[\]]/g, '')
      .replace(/[a-z]{2}:/g, '')
      .trim() || fallbackText
  }

  return fallbackText
}

/**
 * 检查标题是否为多语言JSON格式
 */
export function isMultiLanguageTitle(title: string | null | undefined): boolean {
  if (!title || typeof title !== 'string') {
    return false
  }
  
  try {
    const parsed = JSON.parse(title)
    return typeof parsed === 'object' && parsed !== null && Object.keys(parsed).some(key => 
      ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ar'].includes(key)
    )
  } catch {
    return false
  }
}