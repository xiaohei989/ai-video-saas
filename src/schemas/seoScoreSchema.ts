/**
 * SEO AI 评分 JSON Schema 定义
 * 用于强制大模型输出标准的JSON格式
 *
 * 支持:
 * - OpenAI/Anthropic Structured Output API
 * - JSON Schema 验证
 * - TypeScript 类型定义
 */

/**
 * SEO评分结果的 JSON Schema (OpenAI/Anthropic Structured Output 格式)
 *
 * 这个schema会被传递给API的 response_format 参数，强制大模型输出符合此格式的JSON
 */
export const SEO_SCORE_JSON_SCHEMA = {
  name: "seo_score_result",
  strict: true,
  schema: {
    type: "object",
    properties: {
      // 总分 (0-100)
      overall_score: {
        type: "number",
        description: "总体SEO评分，范围0-100"
      },

      // 五个维度分数
      dimension_scores: {
        type: "object",
        properties: {
          meta_quality: {
            type: "number",
            description: "Meta信息质量分数，范围0-30"
          },
          keyword_optimization: {
            type: "number",
            description: "关键词优化分数，范围0-25"
          },
          content_quality: {
            type: "number",
            description: "内容质量分数，范围0-25"
          },
          readability: {
            type: "number",
            description: "可读性分数，范围0-20"
          },
          ux: {
            type: "number",
            description: "用户体验分数，范围0-20"
          }
        },
        required: ["meta_quality", "keyword_optimization", "content_quality", "readability", "ux"],
        additionalProperties: false
      },

      // 可执行建议列表 (字符串数组)
      actionable_recommendations: {
        type: "array",
        items: {
          type: "string",
          description: "具体可执行的SEO优化建议"
        },
        description: "可执行的SEO优化建议列表"
      }
    },
    required: ["overall_score", "dimension_scores", "actionable_recommendations"],
    additionalProperties: false
  }
} as const

/**
 * SEO内容生成结果的 JSON Schema
 */
export const SEO_CONTENT_JSON_SCHEMA = {
  name: "seo_content_result",
  strict: true,
  schema: {
    type: "object",
    properties: {
      meta_title: {
        type: "string",
        description: "SEO标题，55-60个字符"
      },
      meta_description: {
        type: "string",
        description: "SEO描述，150-155个字符"
      },
      meta_keywords: {
        type: "string",
        description: "逗号分隔的关键词列表"
      },
      guide_intro: {
        type: "string",
        description: "导读段落，100-150字"
      },
      guide_content: {
        type: "string",
        description: "Markdown格式的完整指南内容，1500-2000字"
      },
      faq_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "FAQ问题"
            },
            answer: {
              type: "string",
              description: "FAQ答案"
            }
          },
          required: ["question", "answer"],
          additionalProperties: false
        },
        description: "FAQ列表，至少5个"
      },
      secondary_keywords: {
        type: "array",
        items: {
          type: "string"
        },
        description: "次要关键词列表"
      }
    },
    required: ["meta_title", "meta_description", "meta_keywords", "guide_intro", "guide_content", "faq_items", "secondary_keywords"],
    additionalProperties: false
  }
} as const

/**
 * SEO内容优化结果的 JSON Schema
 */
export const SEO_OPTIMIZE_JSON_SCHEMA = {
  name: "seo_optimize_result",
  strict: true,
  schema: {
    type: "object",
    properties: {
      optimized_content: {
        type: "object",
        properties: {
          meta_title: { type: "string" },
          meta_description: { type: "string" },
          meta_keywords: { type: "string" },
          guide_intro: { type: "string" },
          guide_content: { type: "string" },
          faq_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" }
              },
              required: ["question", "answer"],
              additionalProperties: false
            }
          }
        },
        required: ["meta_title", "meta_description", "meta_keywords", "guide_intro", "guide_content", "faq_items"],
        additionalProperties: false
      },
      optimization_summary: {
        type: "string",
        description: "优化摘要说明"
      },
      key_improvements: {
        type: "array",
        items: {
          type: "string"
        },
        description: "关键改进点列表"
      }
    },
    required: ["optimized_content", "optimization_summary", "key_improvements"],
    additionalProperties: false
  }
} as const

/**
 * 关键词密度优化结果的 JSON Schema
 */
export const KEYWORD_DENSITY_OPTIMIZE_SCHEMA = {
  name: "keyword_density_optimize_result",
  strict: true,
  schema: {
    type: "object",
    properties: {
      optimized_content: {
        type: "object",
        properties: {
          guide_intro: { type: "string" },
          guide_content: { type: "string" }
        },
        required: ["guide_intro", "guide_content"],
        additionalProperties: false
      },
      key_improvements: {
        type: "array",
        items: {
          type: "string"
        },
        description: "关键改进点列表"
      },
      optimization_summary: {
        type: "string",
        description: "优化摘要"
      }
    },
    required: ["optimized_content", "key_improvements", "optimization_summary"],
    additionalProperties: false
  }
} as const

/**
 * TypeScript 类型定义 (从 Schema 推导)
 */
export interface SEOScoreResult {
  overall_score: number
  dimension_scores: {
    meta_quality: number
    keyword_optimization: number
    content_quality: number
    readability: number
    ux: number
  }
  actionable_recommendations: string[]
}

export interface SEOContentResult {
  meta_title: string
  meta_description: string
  meta_keywords: string
  guide_intro: string
  guide_content: string
  faq_items: Array<{
    question: string
    answer: string
  }>
  secondary_keywords: string[]
}

export interface SEOOptimizeResult {
  optimized_content: {
    meta_title: string
    meta_description: string
    meta_keywords: string
    guide_intro: string
    guide_content: string
    faq_items: Array<{
      question: string
      answer: string
    }>
  }
  optimization_summary: string
  key_improvements: string[]
}

export interface KeywordDensityOptimizeResult {
  optimized_content: {
    guide_intro: string
    guide_content: string
  }
  key_improvements: string[]
  optimization_summary: string
}
