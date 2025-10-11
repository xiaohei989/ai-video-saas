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

  // 如果是普通字符串且不包含JSON标记，直接返回
  if (typeof title === 'string' && !title.includes('{') && !title.includes('"')) {
    return title.trim()
  }

  // 🔧 修复: 处理 "中文前缀{json}" 格式的标题
  let titleToProcess = title
  if (typeof title === 'string' && title.includes('{')) {
    // 尝试提取JSON部分 - 改进的正则表达式,匹配 {...} 结构
    const jsonMatch = title.match(/(\{(?:[^{}]|"[^"]*")*\})/);
    if (jsonMatch) {
      titleToProcess = jsonMatch[1]
    }
  }

  try {
    // 尝试解析JSON格式的多语言标题
    const parsed: MultiLanguageTitle = typeof titleToProcess === 'string' ? JSON.parse(titleToProcess) : titleToProcess
    
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

    // 如果看起来像损坏的JSON（包含 JSON 片段），尝试提取有用信息
    if (title.includes('{') && title.includes('"')) {
      // 尝试提取 JSON 部分
      const jsonMatch = title.match(/\{[^}]+\}/)
      if (jsonMatch) {
        try {
          // 尝试解析提取的 JSON 部分
          const parsed = JSON.parse(jsonMatch[0])
          if (typeof parsed === 'object' && parsed !== null) {
            // 优先返回当前语言
            if (parsed[currentLocale]) {
              return parsed[currentLocale].trim()
            }
            // 回退到英语或中文
            const fallbackLanguages = ['en', 'zh', 'ja', 'ko', 'es']
            for (const lang of fallbackLanguages) {
              if (parsed[lang]) {
                return parsed[lang].trim()
              }
            }
            // 返回第一个可用值
            const firstAvailable = Object.values(parsed).find(val => val && typeof val === 'string' && val.trim())
            if (firstAvailable && typeof firstAvailable === 'string') {
              return firstAvailable.trim()
            }
          }
        } catch {
          // JSON 部分也解析失败，继续下面的处理
        }
      }

      // 如果提取 JSON 失败，尝试通过正则提取引号中的值
      const matches = title.match(/"([^"]+)"/g)
      if (matches && matches.length > 0) {
        // 跳过语言代码键名（如 "en", "zh"），取第一个实际的值
        const values = matches
          .map(m => m.replace(/"/g, ''))
          .filter(val =>
            val.length > 3 &&
            !['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ar'].includes(val)
          )

        if (values.length > 0) {
          return values[0].trim()
        }
      }
    }

    // 最后的回退：清理 JSON 字符并返回
    const cleaned = title
      .replace(/\{[^}]*\}/g, '') // 移除所有 JSON 对象
      .replace(/[{}"\[\]]/g, '') // 移除 JSON 字符
      .replace(/[a-z]{2}:/gi, '') // 移除语言代码
      .trim()

    return cleaned || fallbackText
  }

  return fallbackText
}

/**
 * 解析描述 - 使用与标题相同的逻辑处理多语言JSON
 * @param description - 原始描述字段（可能是字符串或JSON对象）
 * @param currentLocale - 当前语言代码（如 'zh', 'en'）
 * @param fallbackText - 当无法解析时的回退文本
 * @returns 解析后的描述字符串
 */
export function parseDescription(
  description: string | null | undefined,
  currentLocale: string = 'en',
  fallbackText: string = ''
): string {
  // 复用 parseTitle 的逻辑，因为格式是一样的
  return parseTitle(description, currentLocale, fallbackText)
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