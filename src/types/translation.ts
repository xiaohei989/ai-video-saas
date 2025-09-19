/**
 * Translation Types
 * 翻译工具相关的类型定义
 */

export interface TranslationRequest {
  text: string
  sourceLanguage: string
  targetLanguage: string
  context?: string
}

export interface TranslationResponse {
  translatedText: string
  sourceText: string
  sourceLanguage: string
  targetLanguage: string
  confidence?: number
}

export interface BatchTranslationRequest {
  texts: string[]
  sourceLanguage: string
  targetLanguage: string
  context?: string
}

export interface BatchTranslationResponse {
  translations: TranslationResponse[]
  errors: string[]
}

export interface TemplateTranslationJob {
  templateId: string
  templateName: string
  sourceLanguage: string
  targetLanguages: string[]
  fields: TranslationField[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number
  errors: string[]
  createdAt: Date
  completedAt?: Date
}

export interface TranslationField {
  path: string // JSON path like "params.fruit.options[0].label"
  originalText: string
  translatedTexts: Record<string, string> // language -> translated text
  isTranslated: boolean
  fieldType: 'label' | 'description' | 'option' | 'name'
}

export interface TemplateTranslationProgress {
  templateId: string
  totalFields: number
  translatedFields: number
  currentField?: string
  currentLanguage?: string
  errors: string[]
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' }
] as const

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code']

export interface TranslationConfig {
  sourceLanguage: SupportedLanguageCode
  targetLanguages: SupportedLanguageCode[]
  includeParameterLabels: boolean
  includeOptionLabels: boolean
  includeDescriptions: boolean
  includeTemplateNames: boolean
  preserveEmojis: boolean
  maxRetries: number
  batchSize: number
}

// 批量翻译数据结构
export interface BatchTemplateTranslationRequest {
  templateId: string
  templateName: string
  sourceLanguage: SupportedLanguageCode
  targetLanguages: SupportedLanguageCode[]
  fieldsToTranslate: BatchTranslationField[]
}

export interface BatchTranslationField {
  path: string // JSON path like "params.fruit.options[0].label"
  text: string
  fieldType: 'label' | 'description' | 'option' | 'name'
  context?: string
}

export interface StructuredTranslationData {
  templateInfo: {
    name?: string
    description?: string
  }
  parameters: Record<string, {
    label?: string
    options?: string[]
  }>
}

export interface BatchTranslationAPIRequest {
  sourceLanguage: SupportedLanguageCode
  targetLanguage: SupportedLanguageCode
  templateData: StructuredTranslationData
  context: string
}

export interface BatchTranslationAPIResponse {
  templateInfo: {
    name?: string
    description?: string
  }
  parameters: Record<string, {
    label?: string
    options?: string[]
  }>
}

// 导出相关类型
export type ExportMode = 'download' | 'overwrite' | 'backup_overwrite'

export interface ExportOptions {
  mode: ExportMode
  createBackup: boolean
  confirmOverwrite: boolean
}

export interface ExportConfig {
  includeOriginalTemplate: boolean
  includeTranslationJob: boolean
  includeMetadata: boolean
  exportFormat: 'json' | 'separate_files'
  // 导出模式：兼容格式（可直接替换原文件）vs 包装格式（包含完整翻译信息）
  outputMode: 'compatible' | 'wrapped'
}