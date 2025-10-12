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

export interface TemplateSEOGuide {
  id: string
  template_id: string
  language: string

  // 关键词
  long_tail_keywords: string[] // JSON数组转换为string[]
  primary_keyword: string
  secondary_keywords: string[]

  // Meta标签
  meta_title: string
  meta_description: string
  meta_keywords: string

  // 内容
  guide_content: string
  guide_intro: string

  // FAQ
  faq_items: FAQItem[]

  // SEO评分
  seo_score: number
  keyword_density: KeywordDensity
  content_quality_score: number
  readability_score: number

  // 统计数据
  page_views: number
  unique_visitors: number
  avg_time_on_page: number
  bounce_rate: number
  conversion_rate: number

  // 搜索引擎
  google_indexed: boolean
  google_indexed_at?: string
  current_rank: KeywordRank

  // 元信息
  generated_by: GeneratedBy
  ai_model?: string
  last_seo_audit_at?: string
  last_optimized_at?: string

  // 版本
  version: number
  previous_version_id?: string

  // 发布
  is_published: boolean
  published_at?: string
  unpublished_at?: string

  // 审核
  review_status: ReviewStatus
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string

  created_at: string
  updated_at: string
}

// 创建/更新SEO指南的输入类型
export interface TemplateSEOGuideInput {
  template_id: string
  language: string
  long_tail_keywords: string[]
  primary_keyword: string
  secondary_keywords?: string[]
  meta_title: string
  meta_description: string
  meta_keywords?: string
  guide_content: string
  guide_intro?: string
  faq_items?: FAQItem[]
  generated_by?: GeneratedBy
  ai_model?: string
}

// SEO分析结果
export interface SEOAnalysisResult {
  overall_score: number
  keyword_density_score: number
  content_quality_score: number
  readability_score: number
  suggestions: string[]
  warnings: string[]
  keyword_density: KeywordDensity
}

// AI生成关键词请求
export interface GenerateKeywordsRequest {
  template_id: string
  language: string
  count?: number // 生成数量，默认15-20
  existing_keywords?: string[] // 现有关键词（用于补充生成）
}

// AI生成关键词响应
export interface GenerateKeywordsResponse {
  keywords: string[]
  primary_keyword: string
  secondary_keywords: string[]
  analysis: {
    search_volume: {
      [keyword: string]: number
    }
    difficulty: {
      [keyword: string]: 'easy' | 'medium' | 'hard'
    }
    relevance_score: {
      [keyword: string]: number
    }
  }
}

// AI生成指南内容请求
export interface GenerateGuideContentRequest {
  template_id: string
  language: string
  keywords: string[]
  target_word_count?: number // 目标字数，默认1500-2000
  include_faq?: boolean
}

// AI生成指南内容响应
export interface GenerateGuideContentResponse {
  guide_content: string // Markdown格式
  guide_intro: string
  meta_title: string
  meta_description: string
  faq_items: FAQItem[]
  estimated_reading_time: number // 分钟
}

// SEO指南统计
export interface SEOGuidesStats {
  total_guides: number
  published_guides: number
  draft_guides: number
  avg_seo_score: number
  total_page_views: number
  guides_by_language: {
    [language: string]: number
  }
}

// 批量生成请求
export interface BatchGenerateRequest {
  template_ids: string[]
  languages: string[]
  auto_publish?: boolean
}

// 批量生成进度
export interface BatchGenerateProgress {
  total: number
  completed: number
  failed: number
  current_template?: string
  current_language?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errors: Array<{
    template_id: string
    language: string
    error: string
  }>
}

// 关键词建议
export interface KeywordSuggestion {
  keyword: string
  search_volume: number
  difficulty: 'easy' | 'medium' | 'hard'
  relevance_score: number
  trend: 'rising' | 'stable' | 'declining'
}

// SEO审计报告
export interface SEOAuditReport {
  guide_id: string
  audit_date: string
  overall_health: 'excellent' | 'good' | 'needs_improvement' | 'poor'
  issues: Array<{
    severity: 'critical' | 'warning' | 'info'
    category: string
    message: string
    fix_suggestion: string
  }>
  keyword_performance: {
    [keyword: string]: {
      current_rank: number
      previous_rank?: number
      trend: 'up' | 'down' | 'stable'
      clicks: number
      impressions: number
      ctr: number
    }
  }
  recommendations: string[]
}

// 与Template相关的扩展类型
export interface TemplateWithSEOStatus {
  id: string
  name: string
  slug: string
  description: string
  thumbnail_url: string
  category: string
  tags: string[]
  seo_guides_count: number // 已创建的指南数量
  seo_guides_published: number // 已发布的指南数量
  languages_with_guides: string[] // 已有指南的语言列表
  avg_seo_score: number
  total_guide_views: number
}
