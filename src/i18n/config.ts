import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslations from './locales/en.json'
import zhTranslations from './locales/zh.json'
import jaTranslations from './locales/ja.json'
import koTranslations from './locales/ko.json'
import esTranslations from './locales/es.json'
import deTranslations from './locales/de.json'
import frTranslations from './locales/fr.json'
import arTranslations from './locales/ar.json'

// 支持的语言列表
const SUPPORTED_LANGUAGES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'ar']

// 获取初始语言设置的增强函数
function getInitialLanguage(): string {
  try {
    // 1. 优先使用用户明确设置的语言
    const preferredLanguage = localStorage.getItem('preferred_language')
    if (preferredLanguage && SUPPORTED_LANGUAGES.includes(preferredLanguage)) {
      console.log('[i18n] 使用用户偏好语言:', preferredLanguage)
      return preferredLanguage
    }

    // 2. 检查OAuth前保存的语言（防止OAuth过程中丢失）
    const preOAuthLanguage = localStorage.getItem('pre_oauth_language')
    if (preOAuthLanguage && SUPPORTED_LANGUAGES.includes(preOAuthLanguage)) {
      console.log('[i18n] 发现OAuth前保存的语言，恢复:', preOAuthLanguage)
      // 恢复后清理临时设置
      localStorage.setItem('preferred_language', preOAuthLanguage)
      localStorage.removeItem('pre_oauth_language')
      return preOAuthLanguage
    }

    // 3. 尝试从浏览器语言检测
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language.toLowerCase()
      
      // 直接匹配
      if (SUPPORTED_LANGUAGES.includes(browserLang)) {
        console.log('[i18n] 使用浏览器语言:', browserLang)
        return browserLang
      }
      
      // 语言前缀匹配（如 'en-US' -> 'en'）
      const langPrefix = browserLang.split('-')[0]
      if (SUPPORTED_LANGUAGES.includes(langPrefix)) {
        console.log('[i18n] 使用浏览器语言前缀:', langPrefix)
        return langPrefix
      }
      
      // 中文特殊处理
      if (browserLang.includes('zh')) {
        console.log('[i18n] 检测到中文，使用zh')
        return 'zh'
      }
    }

    // 4. 默认回落到英语
    console.log('[i18n] 使用默认语言: en')
    return 'en'
    
  } catch (error) {
    console.error('[i18n] 语言检测出错，使用默认英语:', error)
    return 'en'
  }
}

// 验证并修复语言设置
function validateAndFixLanguage(language: string): string {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    console.warn('[i18n] 无效语言设置:', language, '，回落到英语')
    return 'en'
  }
  return language
}

const initialLanguage = getInitialLanguage()

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      zh: { translation: zhTranslations },
      ja: { translation: jaTranslations },
      ko: { translation: koTranslations },
      es: { translation: esTranslations },
      de: { translation: deTranslations },
      fr: { translation: frTranslations },
      ar: { translation: arTranslations },
    },
    lng: validateAndFixLanguage(initialLanguage),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    pluralSeparator: '_',
    contextSeparator: '_',
    returnObjects: false,
  })

// 监听语言变化并保存到localStorage
i18n.on('languageChanged', (lng) => {
  if (typeof localStorage !== 'undefined') {
    const validatedLng = validateAndFixLanguage(lng)
    localStorage.setItem('preferred_language', validatedLng)
    console.log('[i18n] 语言已更改并保存:', validatedLng)
  }
})

export default i18n