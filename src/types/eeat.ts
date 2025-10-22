/**
 * E-E-A-T 评分系统类型定义
 * Experience, Expertise, Authoritativeness, Trustworthiness
 * 符合 Google 2025 年搜索质量评估标准
 */

export interface FAQItem {
  question: string
  answer: string
}

/**
 * E-E-A-T 评分输入数据
 */
export interface EEATGuideData {
  // 语言
  language: string

  // Meta 信息
  meta_title?: string
  meta_description?: string
  meta_keywords?: string

  // 内容
  guide_intro?: string
  guide_content?: string
  faq_items?: FAQItem[]

  // 关键词策略
  target_keyword?: string
  long_tail_keywords?: string[]
  secondary_keywords?: string[]

  // 用户数据 (用于计算参与度评分)
  page_views?: number
  unique_visitors?: number
  avg_time_on_page?: number // 秒
  bounce_rate?: number // 百分比
  conversion_rate?: number // 百分比

  // 已计算的关键词密度 (可选，用于传递给AI)
  keyword_density?: Record<string, number>
}

/**
 * E-E-A-T 评分结果
 * 总分 = 100分
 */
export interface EEATScoreResult {
  // === 总分 ===
  total_score: number // 0-100

  // === E-E-A-T 维度 (35分) ===
  trustworthiness_score: number // 可信度 (0-15)
  authoritativeness_score: number // 权威性 (0-10)
  expertise_score: number // 专业性 (0-10)

  // === 内容质量维度 (30分) ===
  comprehensiveness_score: number // 全面性 (0-12)
  information_gain_score: number // 信息增益/原创性 (0-10)
  structured_quality_score: number // 结构化质量 (0-8)

  // === 用户满意度维度 (20分) ===
  engagement_score: number // 用户参与度 (0-12, 算法自动计算)
  readability_score: number // 可读性 (0-8)

  // === 技术SEO维度 (15分) ===
  keyword_optimization_score: number // 关键词优化 (0-8)
  keyword_density_score: number // 关键词密度 (0-7, 算法自动计算)

  // === 其他数据 ===
  keyword_density: Record<string, number> // 关键词密度数据 {keyword: density%}
  recommendations: string[] // 优化建议列表
}

/**
 * AI 返回的原始评分结果
 * 注意：不包含 engagement_score 和 keyword_density_score (由算法计算)
 */
export interface EEATAIScoreResult {
  // E-E-A-T 维度
  trustworthiness_score: number
  authoritativeness_score: number
  expertise_score: number

  // 内容质量维度
  comprehensiveness_score: number
  information_gain_score: number
  structured_quality_score: number

  // 可读性
  readability_score: number

  // 关键词优化
  keyword_optimization_score: number

  // 优化建议
  recommendations: string[]
}

/**
 * 用户参与度指标数据
 */
export interface EngagementMetricsData {
  page_views: number
  unique_visitors: number
  avg_time_on_page: number // 秒
  bounce_rate: number // 百分比
  conversion_rate: number // 百分比
}

/**
 * E-E-A-T 评分等级
 */
export interface EEATScoreGrade {
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  color: 'success' | 'info' | 'warning' | 'error'
  label: string
}

/**
 * E-E-A-T 雷达图数据
 */
export interface EEATRadarData {
  labels: string[]
  values: number[]
}

/**
 * E-E-A-T 优化请求
 */
export interface EEATOptimizeRequest {
  language: string
  meta_title: string
  meta_description: string
  meta_keywords: string
  guide_content: string
  guide_intro: string
  target_keyword: string
  long_tail_keywords: string[]
  secondary_keywords: string[]
  faq_items: FAQItem[]

  // 当前 E-E-A-T 评分
  eeat_score: number
  eeat_recommendations: string[]

  // 用户数据
  page_views: number
  avg_time_on_page: number
  bounce_rate: number
  conversion_rate: number
}

/**
 * E-E-A-T 优化结果
 */
export interface EEATOptimizeResult {
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
  expected_score_increase: number // 预期分数提升
}

/**
 * E-E-A-T 评分历史记录
 */
export interface EEATScoreHistory {
  id: string
  variant_id: string
  scored_at: string
  total_score: number
  trustworthiness_score: number
  authoritativeness_score: number
  expertise_score: number
  engagement_score: number
  recommendations_count: number
}
