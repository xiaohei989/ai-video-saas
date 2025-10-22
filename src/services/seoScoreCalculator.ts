/**
 * SEO评分计算器 - 兼容层
 *
 * ⚠️ 注意：这是一个向后兼容层，将旧的API调用转发到新的SEO评分引擎
 *
 * 新系统架构：
 * - seoFactsCalculator.ts: 算法事实计算
 * - seoAIAnalyzer.ts: AI深度分析
 * - seoValidator.ts: 交叉验证
 * - seoScoringEngine.ts: 统一评分引擎
 *
 * 旧代码调用路径：
 * 旧代码 → seoScoreCalculator (兼容层) → seoScoringEngine (新引擎)
 */

import { scoreSEOContent, quickScoreSEO } from './seoScoringEngine'
import type { SEOContent } from './seoFactsCalculator'

// ==================== 旧接口类型定义（向后兼容） ====================

export interface SEOGuideData {
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  guide_content?: string
  guide_intro?: string
  target_keyword?: string
  long_tail_keywords?: string[]
  secondary_keywords?: string[]
  faq_items?: Array<{ question: string; answer: string }>
  page_views?: number
  avg_time_on_page?: number
  bounce_rate?: number
  conversion_rate?: number
  language?: string
}

export interface SEOScoreResult {
  total_score: number
  meta_info_quality_score?: number
  content_quality_score: number
  keyword_optimization_score: number
  readability_score: number
  keyword_density_score: number
  keyword_density: Record<string, number>
  recommendations: string[]
}

// ==================== 导出新的函数（推荐使用） ====================

// 从新系统导出
export {
  calculateKeywordDensity,
  extractFullContent,
  countWords
} from './seoFactsCalculator'

// ==================== 兼容旧接口 ====================

/**
 * 计算SEO评分（旧接口，兼容层）
 *
 * @deprecated 建议使用新的 scoreSEOContent() 或 quickScoreSEO()
 *
 * 迁移指南：
 * ```typescript
 * // 旧代码
 * const result = await calculateSEOScore(data)
 *
 * // 新代码（快速评分，仅算法）
 * import { quickScoreSEO } from './seoScoringEngine'
 * const result = await quickScoreSEO(data)
 *
 * // 新代码（完整评分，算法+AI）
 * import { scoreSEOContent } from './seoScoringEngine'
 * const result = await scoreSEOContent(data, { aiModel: 'claude' })
 * ```
 */
export async function calculateSEOScore(data: SEOGuideData): Promise<SEOScoreResult> {
  console.warn('[SEO Score] ⚠️ 使用了旧的 calculateSEOScore API，建议迁移到新的 scoreSEOContent()')

  // 转换为新的数据格式
  const seoContent: SEOContent = {
    meta_title: data.meta_title || '',
    meta_description: data.meta_description || '',
    meta_keywords: data.meta_keywords,
    guide_intro: data.guide_intro,
    guide_content: data.guide_content || '',
    faq_items: data.faq_items,
    target_keyword: data.target_keyword || '',
    language: data.language || 'en'
  }

  // 调用新的快速评分（仅算法，避免AI调用成本）
  const result = await quickScoreSEO(seoContent)

  // 转换为旧的返回格式
  return {
    total_score: result.total_score,
    meta_info_quality_score: result.dimension_scores.meta_quality,
    content_quality_score: result.dimension_scores.content_quality,
    keyword_optimization_score: result.dimension_scores.keyword_optimization,
    readability_score: result.dimension_scores.readability,
    keyword_density_score: result.dimension_scores.ux,
    keyword_density: result.facts.keywords.primary.density
      ? { [result.facts.keywords.primary.keyword]: result.facts.keywords.primary.density }
      : {},
    recommendations: result.actionable_recommendations
  }
}

/**
 * 计算关键词密度评分（旧接口，兼容层）
 *
 * @deprecated 已合并到新的评分引擎中
 */
export function calculateKeywordDensityScore(
  keywordDensity: Record<string, number>,
  targetKeyword?: string
): number {
  if (!targetKeyword || Object.keys(keywordDensity).length === 0) {
    return 0
  }

  const normalizedTarget = targetKeyword.toLowerCase().trim()
  let density = 0

  for (const [keyword, value] of Object.entries(keywordDensity)) {
    if (keyword.toLowerCase().trim() === normalizedTarget) {
      density = value
      break
    }
  }

  if (density === 0) return 0

  // 密度评分逻辑（1.0-2.0% 理想）
  if (density >= 1.5 && density <= 2.5) return 10
  else if (density >= 1.0 && density < 1.5) return Math.round(7 + (density - 1.0) * 4)
  else if (density > 2.5 && density <= 3.0) return Math.round(9 - (density - 2.5) * 4)
  else if (density >= 0.5 && density < 1.0) return Math.round(4 + (density - 0.5) * 4)
  else if (density > 3.0 && density <= 4.0) return Math.round(6 - (density - 3.0) * 2)
  else if (density < 0.5) return Math.max(1, Math.round(density * 6))
  else return Math.max(1, Math.round((6.0 - density) * 2))
}

/**
 * 获取评分等级（旧接口，兼容层）
 */
export function getSEOScoreGrade(score: number): {
  grade: string
  color: 'success' | 'warning' | 'error'
  label: string
} {
  if (score >= 80) {
    return { grade: 'A', color: 'success', label: '优秀' }
  } else if (score >= 60) {
    return { grade: 'B', color: 'warning', label: '良好' }
  } else if (score >= 40) {
    return { grade: 'C', color: 'warning', label: '及格' }
  } else {
    return { grade: 'D', color: 'error', label: '差' }
  }
}
