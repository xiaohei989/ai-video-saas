import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslations from './locales/en.json'
import zhTranslations from './locales/zh.json'
import jaTranslations from './locales/ja.json'
import koTranslations from './locales/ko.json'
import esTranslations from './locales/es.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      zh: { translation: zhTranslations },
      ja: { translation: jaTranslations },
      ko: { translation: koTranslations },
      es: { translation: esTranslations },
    },
    lng: (typeof localStorage !== 'undefined' ? localStorage.getItem('preferred_language') : null) || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    pluralSeparator: '_',
    contextSeparator: '_',
    returnObjects: false,
  })

export default i18n