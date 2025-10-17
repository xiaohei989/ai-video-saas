/**
 * SEO AI 提示词配置中心
 * 统一管理所有SEO相关的AI提示词
 *
 * ✅ 新架构：提示词存储在 Markdown 文件中，代码只负责加载和填充变量
 * - 提示词模板: prompts/seo-score-prompt.md
 * - 加载工具: utils/promptLoader.ts
 */

import { loadSEOScorePrompt, type SEOScorePromptParams } from '@/utils/promptLoader'

// 导入极简版Markdown模板内容（Vite会在构建时内联文件内容）
// 极简版: 200行纯定量规则,删除了260行"禁止示例"和主观描述
import promptTemplate from '../../prompts/seo-score-prompt-simple.md?raw'

interface SEOScorePromptInputParams {
  languageName: string
  languageCode: string
  targetKeyword: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  longTailKeywords: string[]
  secondaryKeywords: string[]
  keywordDensity: Record<string, number>
  guideIntro: string
  guideContent: string
  faqItems: Array<{ question: string; answer: string }>
  pageViews?: number
  avgTimeOnPage?: number
  bounceRate?: number
  conversionRate?: number
}

/**
 * 构建SEO评分提示词
 */
export function buildSEOScorePrompt(params: SEOScorePromptInputParams): string {
  // 格式化关键词密度
  const keywordDensityText = Object.entries(params.keywordDensity)
    .map(([kw, density]) => `- **${kw}**: ${density}%`)
    .join('\n') || '- 暂无密度数据'

  // 格式化FAQ
  const faqText = params.faqItems
    .map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`)
    .join('\n\n') || '未提供'

  // 无关键词警告
  const noKeywordWarning = !params.targetKeyword
    ? '⚠️ **致命错误：未提供目标关键词** - 无法进行SEO评分。'
    : ''

  // 使用Markdown模板填充变量
  return loadSEOScorePrompt(promptTemplate, {
    languageName: params.languageName,
    languageCode: params.languageCode,
    targetKeyword: params.targetKeyword,
    metaTitle: params.metaTitle,
    metaDescription: params.metaDescription,
    keywordDensity: keywordDensityText,
    guideIntro: params.guideIntro,
    guideContent: params.guideContent,
    faq: faqText,
    pageViews: params.pageViews,
    avgTimeOnPage: params.avgTimeOnPage,
    bounceRate: params.bounceRate,
    conversionRate: params.conversionRate,
    noKeywordWarning
  })
}
