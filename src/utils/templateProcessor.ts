/**
 * Template Processor Utilities
 * 模板处理工具函数
 */

import { TranslationField, TemplateTranslationJob } from '@/types/translation'

/**
 * 验证模板结构
 */
export function validateTemplateStructure(template: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!template) {
    errors.push('模板不能为空')
    return { isValid: false, errors }
  }

  if (!template.id) {
    errors.push('模板缺少ID字段')
  }

  if (!template.slug) {
    errors.push('模板缺少slug字段')
  }

  if (!template.name) {
    errors.push('模板缺少name字段')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 计算翻译完整性
 */
export function calculateTranslationCompleteness(
  template: any, 
  targetLanguages: string[]
): { completeness: number; missingTranslations: string[] } {
  const missingTranslations: string[] = []
  let totalFields = 0
  let translatedFields = 0

  function checkObject(obj: any, path: string = '') {
    if (!obj || typeof obj !== 'object') return

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key

      if (key === 'label' && typeof value === 'object') {
        totalFields += targetLanguages.length
        
        for (const lang of targetLanguages) {
          if (value[lang]) {
            translatedFields++
          } else {
            missingTranslations.push(`${currentPath}.${lang}`)
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          checkObject(item, `${currentPath}[${index}]`)
        })
      } else if (typeof value === 'object') {
        checkObject(value, currentPath)
      }
    }
  }

  checkObject(template)

  const completeness = totalFields > 0 ? (translatedFields / totalFields) * 100 : 100

  return {
    completeness: Math.round(completeness),
    missingTranslations
  }
}

/**
 * 生成翻译统计报告
 */
export function generateTranslationReport(jobs: TemplateTranslationJob[]): {
  totalTemplates: number
  completedTemplates: number
  failedTemplates: number
  totalFields: number
  translatedFields: number
  errorSummary: Record<string, number>
} {
  const report = {
    totalTemplates: jobs.length,
    completedTemplates: 0,
    failedTemplates: 0,
    totalFields: 0,
    translatedFields: 0,
    errorSummary: {} as Record<string, number>
  }

  for (const job of jobs) {
    if (job.status === 'completed') {
      report.completedTemplates++
    } else if (job.status === 'failed') {
      report.failedTemplates++
    }

    report.totalFields += job.fields.length
    report.translatedFields += job.fields.filter(f => f.isTranslated).length

    // 统计错误类型
    for (const error of job.errors) {
      const errorType = error.split(':')[0].trim()
      report.errorSummary[errorType] = (report.errorSummary[errorType] || 0) + 1
    }
  }

  return report
}

/**
 * 导出翻译结果为JSON
 */
export function exportTranslationResults(jobs: TemplateTranslationJob[]): string {
  const exportData = {
    exportDate: new Date().toISOString(),
    totalJobs: jobs.length,
    jobs: jobs.map(job => ({
      templateId: job.templateId,
      templateName: job.templateName,
      status: job.status,
      progress: job.progress,
      sourceLanguage: job.sourceLanguage,
      targetLanguages: job.targetLanguages,
      fieldsCount: job.fields.length,
      translatedFieldsCount: job.fields.filter(f => f.isTranslated).length,
      errorsCount: job.errors.length,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      fields: job.fields.map(field => ({
        path: field.path,
        fieldType: field.fieldType,
        originalText: field.originalText,
        translatedTexts: field.translatedTexts,
        isTranslated: field.isTranslated
      })),
      errors: job.errors
    }))
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * 合并翻译结果到模板文件
 */
export function mergeTranslationToTemplate(
  originalTemplate: any, 
  translationJob: TemplateTranslationJob
): any {
  const mergedTemplate = JSON.parse(JSON.stringify(originalTemplate))

  for (const field of translationJob.fields) {
    const pathParts = field.path.split('.')
    let current = mergedTemplate

    // 导航到目标对象
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i]
      
      if (part.includes('[') && part.includes(']')) {
        const [arrayKey, indexStr] = part.split('[')
        const index = parseInt(indexStr.replace(']', ''))
        current = current[arrayKey][index]
      } else {
        current = current[part]
      }
    }

    // 设置翻译值
    const lastPart = pathParts[pathParts.length - 1]
    if (typeof current[lastPart] === 'object') {
      // 合并翻译到现有的多语言对象
      Object.assign(current[lastPart], field.translatedTexts)
    } else {
      // 创建新的多语言对象
      current[lastPart] = {
        [translationJob.sourceLanguage]: field.originalText,
        ...field.translatedTexts
      }
    }
  }

  return mergedTemplate
}

/**
 * 验证翻译质量
 */
export function validateTranslationQuality(field: TranslationField): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // 检查是否包含原始语言标记
  for (const [lang, translation] of Object.entries(field.translatedTexts)) {
    if (!translation || translation.trim() === '') {
      issues.push(`${lang}: 翻译为空`)
      continue
    }

    // 检查长度是否过度偏差
    const lengthRatio = translation.length / field.originalText.length
    if (lengthRatio > 3 || lengthRatio < 0.3) {
      issues.push(`${lang}: 翻译长度可能有问题 (原文:${field.originalText.length}, 译文:${translation.length})`)
    }

    // 检查是否保留了表情符号
    const originalEmojis = field.originalText.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []
    const translatedEmojis = translation.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []
    
    if (originalEmojis.length !== translatedEmojis.length) {
      issues.push(`${lang}: 表情符号数量不匹配`)
    }

    // 检查是否包含明显的翻译错误标记
    if (translation.includes('[翻译]') || translation.includes('[Translation]') || translation.includes('ERROR')) {
      issues.push(`${lang}: 包含翻译错误标记`)
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  }
}

/**
 * 比较两个翻译版本的差异
 */
export function compareTranslationVersions(
  oldVersion: TranslationField[], 
  newVersion: TranslationField[]
): {
  added: TranslationField[]
  modified: TranslationField[]
  removed: TranslationField[]
} {
  const result = {
    added: [] as TranslationField[],
    modified: [] as TranslationField[],
    removed: [] as TranslationField[]
  }

  const oldMap = new Map(oldVersion.map(f => [f.path, f]))
  const newMap = new Map(newVersion.map(f => [f.path, f]))

  // 查找新增和修改的字段
  for (const [path, newField] of newMap) {
    const oldField = oldMap.get(path)
    
    if (!oldField) {
      result.added.push(newField)
    } else {
      // 检查是否有修改
      const oldTranslations = JSON.stringify(oldField.translatedTexts)
      const newTranslations = JSON.stringify(newField.translatedTexts)
      
      if (oldTranslations !== newTranslations) {
        result.modified.push(newField)
      }
    }
  }

  // 查找删除的字段
  for (const [path, oldField] of oldMap) {
    if (!newMap.has(path)) {
      result.removed.push(oldField)
    }
  }

  return result
}