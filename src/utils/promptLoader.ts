/**
 * Prompt模板加载工具
 * 从Markdown文件加载提示词模板并填充变量
 */

/**
 * 加载并填充提示词模板
 * @param templateContent - Markdown模板内容
 * @param variables - 要替换的变量对象
 * @returns 填充后的提示词
 */
export function fillPromptTemplate(
  templateContent: string,
  variables: Record<string, any>
): string {
  let result = templateContent

  // 替换所有 {{variableName}} 格式的变量
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    const replacement = value !== undefined && value !== null ? String(value) : ''
    result = result.replaceAll(placeholder, replacement)
  })

  return result
}

/**
 * 从本地文件系统加载Markdown模板（用于 Node.js 环境）
 */
export function loadPromptTemplateNode(filePath: string): string {
  if (typeof require !== 'undefined') {
    const fs = require('fs')
    return fs.readFileSync(filePath, 'utf-8')
  }
  throw new Error('loadPromptTemplateNode 只能在 Node.js 环境中使用')
}

/**
 * SEO评分提示词专用加载器
 */
export interface SEOScorePromptParams {
  languageName: string
  languageCode: string
  targetKeyword: string
  metaTitle: string
  metaDescription: string
  keywordDensity: string  // 已格式化的密度文本
  guideIntro: string
  guideContent: string
  faq: string  // 已格式化的FAQ文本
  pageViews?: number
  avgTimeOnPage?: number
  bounceRate?: number
  conversionRate?: number
  noKeywordWarning?: string  // 无关键词时的警告信息
}

/**
 * 加载SEO评分提示词
 * @param templateContent - Markdown模板内容
 * @param params - 参数对象
 * @returns 填充后的提示词
 */
export function loadSEOScorePrompt(
  templateContent: string,
  params: SEOScorePromptParams
): string {
  return fillPromptTemplate(templateContent, {
    languageName: params.languageName,
    languageCode: params.languageCode,
    targetKeyword: params.targetKeyword || '未提供',
    metaTitle: params.metaTitle || '未提供',
    metaDescription: params.metaDescription || '未提供',
    keywordDensity: params.keywordDensity,
    guideIntro: params.guideIntro || '未提供',
    guideContent: params.guideContent || '未提供',
    faq: params.faq,
    pageViews: params.pageViews || 0,
    avgTimeOnPage: params.avgTimeOnPage || 0,
    bounceRate: params.bounceRate || 0,
    conversionRate: params.conversionRate || 0,
    noKeywordWarning: params.noKeywordWarning || ''
  })
}
