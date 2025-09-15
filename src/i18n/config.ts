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
      // 🚀 特殊检查：如果设置为阿拉伯语，但用户没有明确选择，则可能是bug
      if (preferredLanguage === 'ar') {
        const userExplicitlyChoseArabic = localStorage.getItem('user_explicitly_chose_arabic') === 'true'
        if (!userExplicitlyChoseArabic) {
          console.warn('[i18n] 检测到异常的阿拉伯语设置（用户未明确选择），尝试修复')
          
          // 尝试从OAuth前保存的语言或浏览器语言恢复
          const preOAuthLanguage = localStorage.getItem('pre_oauth_language')
          const fallbackLanguage = preOAuthLanguage || 
                                   (navigator.language.startsWith('zh') ? 'zh' : 'en')
          
          console.log('[i18n] 修复语言设置为:', fallbackLanguage)
          localStorage.setItem('preferred_language', fallbackLanguage)
          localStorage.setItem('language_fixed_after_oauth', 'true')
          
          return fallbackLanguage
        }
      }
      
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
    
    // 🚀 增强调试日志 - 详细记录语言变化
    console.log('[i18n] 语言已更改并保存:', {
      newLanguage: validatedLng,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 50),
      url: window.location.href,
      referrer: document.referrer || 'none',
      localStorageState: {
        preferred_language: localStorage.getItem('preferred_language'),
        pre_oauth_language: localStorage.getItem('pre_oauth_language'),
        user_explicitly_chose_arabic: localStorage.getItem('user_explicitly_chose_arabic'),
        oauth_provider: localStorage.getItem('oauth_provider'),
        language_fixed_after_oauth: localStorage.getItem('language_fixed_after_oauth')
      }
    })
    
    // 特殊监控阿拉伯语切换
    if (validatedLng === 'ar') {
      console.warn('[i18n] 🚨 语言切换到阿拉伯语 - 详细信息:', {
        stackTrace: new Error().stack?.split('\n').slice(1, 5) || 'unknown',
        isExplicitChoice: localStorage.getItem('user_explicitly_chose_arabic') === 'true',
        browserLanguage: navigator.language,
        availableLanguages: navigator.languages
      })
    }
  }
})

// 页面加载时的语言状态诊断（开发环境可用）
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      // 仅在需要调试语言问题时启用
      // console.log('[i18n] 页面加载完成后的语言状态诊断:', {
      //   currentLanguage: i18n.language,
      //   timestamp: new Date().toISOString(),
      //   localStorage: {
      //     preferred_language: localStorage.getItem('preferred_language'),
      //     pre_oauth_language: localStorage.getItem('pre_oauth_language'),
      //     user_explicitly_chose_arabic: localStorage.getItem('user_explicitly_chose_arabic'),
      //     language_fixed_after_oauth: localStorage.getItem('language_fixed_after_oauth')
      //   },
      //   browser: {
      //     language: navigator.language,
      //     languages: navigator.languages,
      //     userAgent: navigator.userAgent.substring(0, 100)
      //   },
      //   url: window.location.href
      // })
    }, 1000)
  })
}

export default i18n