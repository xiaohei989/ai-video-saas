/**
 * SEO用户指南系统类型定义
 */

export interface FAQItem {
  question: string
  answer: string
}

export interface KeywordDensity {
  [keyword: string]: {
    count: number
    density: number // 百分比
  }
}

export interface KeywordRank {
  [keyword: string]: number // Google排名位置
}

export type ReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'
export type GeneratedBy = 'ai' | 'manual' | 'hybrid'

// ==================== 旧系统类型已删除 ====================
// 以下类型专用于已废弃的 template_seo_guides 表，已全部删除：
// - TemplateSEOGuide
// - TemplateSEOGuideInput
// - SEOAnalysisResult
// - GenerateKeywordsRequest/Response
// - GenerateGuideContentRequest/Response
// - SEOGuidesStats
// - BatchGenerateRequest/Progress
// - KeywordSuggestion
// - SEOAuditReport
// - TemplateWithSEOStatus
// 新系统请使用 seo_page_variants 相关类型
// ==================== AI 服务相关类型 ====================

// SEO 指南数据 (用于AI评分和优化)
export interface SEOGuideData {
  language: string
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  guide_content?: string
  guide_intro?: string
  target_keyword?: string // 目标关键词（单关键词优化）
  long_tail_keywords?: string[]
  secondary_keywords?: string[]
  faq_items?: FAQItem[]
  page_views?: number
  avg_time_on_page?: number
  bounce_rate?: number
  conversion_rate?: number
  keyword_density?: Record<string, number> // ✅ 实时计算的关键词密度，传给AI用于生成准确建议
}

// SEO 评分结果
export interface SEOScoreResult {
  total_score: number // 总分 0-100
  meta_info_quality_score?: number // v2.0: Meta信息质量分 0-20
  content_quality_score: number // v2.0: 内容质量分 0-30
  keyword_optimization_score: number // v2.0: 关键词优化分 0-20
  readability_score: number // v2.0: 可读性分 0-20
  ux_score?: number // v2.0: 用户体验分 0-10
  keyword_density_score?: number // 已废弃: 关键词密度分 (已合并到keyword_optimization)
  keyword_density: Record<string, number> // 关键词密度数据
  recommendations: string[] // 优化建议
}

// SEO 内容优化请求
export interface SEOOptimizeRequest {
  language: string
  meta_title: string
  meta_description: string
  meta_keywords: string
  guide_content: string
  guide_intro: string
  target_keyword: string // 目标关键词（单关键词优化）
  long_tail_keywords: string[]
  secondary_keywords: string[]
  faq_items: FAQItem[]
  seo_score: number
  seo_recommendations: string[]
}

// SEO 内容优化结果
export interface SEOOptimizeResult {
  optimized_content: {
    meta_title: string
    meta_description: string
    meta_keywords: string
    guide_intro: string
    guide_content: string
    faq_items: FAQItem[]
    secondary_keywords: string[]
  }
  optimization_summary: string
  key_improvements: string[]
}

// ==================== 关键词密度优化专用类型 ====================

// 单个关键词的优化目标
export interface KeywordOptimizeTarget {
  keyword: string // 关键词文本
  type: 'primary' | 'long_tail' | 'secondary' // 关键词类型
  isPrimary: boolean // 是否为主关键词（快捷判断）
  currentDensity: number // 当前密度（%）
  currentCount: number // 当前出现次数
  targetDensity: number // 目标密度（%）
  targetCount: number // 目标出现次数
  needToAdd: number // 需要增加的次数（0表示不需要增加）
  needToRemove: number // 需要减少的次数（0表示不需要减少）
  action: 'increase' | 'decrease' // 操作类型
  reason: string // 优化原因（用于UI显示）
}

// 关键词密度优化请求
export interface KeywordDensityOptimizeRequest {
  language: string // 目标语言
  guide_content: string // 正文内容
  faq_items: FAQItem[] // FAQ列表
  target_keyword: string // 目标关键词（单关键词优化）
  long_tail_keywords: string[] // 长尾关键词
  secondary_keywords?: string[] // 次要关键词
  total_words: number // 文章总字数（实际计算值）
  keywords_to_optimize: KeywordOptimizeTarget[] // 需要优化的关键词列表（带精确目标）
}

// 关键词密度优化结果
export interface KeywordDensityOptimizeResult {
  optimized_guide_content: string // 优化后的正文
  optimized_faq_items: FAQItem[] // 优化后的FAQ
  key_improvements: string[] // 改进说明列表
  verification?: Record<string, number> // AI自行验证的关键词次数（可选）
}

// 关键词验证结果（用于前端验证优化效果）
export interface KeywordVerificationResult {
  keyword: string // 关键词
  isPrimary: boolean // 是否为主关键词
  type: 'primary' | 'long_tail' | 'secondary' // 关键词类型
  oldDensity: number // 优化前密度（%）
  newDensity: number // 优化后密度（%）
  oldCount: number // 优化前次数
  newCount: number // 优化后次数
  isNowIdeal: boolean // 是否现在达标
  improvement: number // 密度改善值（正数=提升，负数=降低）
  improvementPercent: number // 改善百分比
  minIdeal: number // 理想范围下限
  maxIdeal: number // 理想范围上限
}
