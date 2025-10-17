/**
 * SEO AI 提示词配置中心 (JavaScript版本)
 * 统一管理所有SEO相关的AI提示词
 *
 * ✅ 新架构：提示词存储在 Markdown 文件中，代码只负责加载和填充变量
 * - 提示词模板: prompts/seo-score-prompt.md
 * - 加载工具: promptLoader (内联在本文件中)
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载极简版Markdown模板内容
// 极简版: 200行纯定量规则,删除了260行"禁止示例"和主观描述
const PROMPT_TEMPLATE = readFileSync(
  join(__dirname, '../prompts/seo-score-prompt-simple.md'),
  'utf-8'
)

/**
 * 填充提示词模板
 * @param {string} templateContent - Markdown模板内容
 * @param {Object} variables - 要替换的变量对象
 * @returns {string} 填充后的提示词
 */
function fillPromptTemplate(templateContent, variables) {
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
 * SEO评分提示词专用加载器
 * @param {Object} params - 参数对象
 * @returns {string} 填充后的提示词
 */
export function buildSEOScorePrompt(params) {
  const {
    languageName,
    languageCode,
    targetKeyword,
    metaTitle,
    metaDescription,
    metaKeywords,
    longTailKeywords = [],
    secondaryKeywords = [],
    keywordDensity = {},
    guideIntro,
    guideContent,
    faqItems = [],
    pageViews = 0,
    avgTimeOnPage = 0,
    bounceRate = 0,
    conversionRate = 0
  } = params

  // 格式化关键词密度
  const keywordDensityText = Object.entries(keywordDensity)
    .map(([kw, density]) => `- **${kw}**: ${density}%`)
    .join('\n') || '- 暂无密度数据'

  // 格式化FAQ
  const faqText = faqItems
    .map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`)
    .join('\n\n') || '未提供'

  // 无关键词警告
  const noKeywordWarning = !targetKeyword
    ? '⚠️ **致命错误：未提供目标关键词** - 无法进行SEO评分。'
    : ''

  // 使用Markdown模板填充变量
  return fillPromptTemplate(PROMPT_TEMPLATE, {
    languageName,
    languageCode,
    targetKeyword: targetKeyword || '未提供',
    metaTitle: metaTitle || '未提供',
    metaDescription: metaDescription || '未提供',
    keywordDensity: keywordDensityText,
    guideIntro: guideIntro || '未提供',
    guideContent: guideContent || '未提供',
    faq: faqText,
    pageViews,
    avgTimeOnPage,
    bounceRate,
    conversionRate,
    noKeywordWarning
  })
}
