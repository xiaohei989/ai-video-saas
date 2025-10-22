/**
 * 共享的 SEO 类型定义
 * 用于避免循环依赖
 */

export interface SubsectionStructure {
  h3Title: string
  minWords: number
  keywordMentions: Record<string, string | number>
  contentGuidelines: string[]
}

export interface SectionStructure {
  sectionName: string
  h2Title: string
  minWords: number
  maxWords: number
  keywordMentions: Record<string, string | number>
  contentRequirements: string[]
  subsections?: SubsectionStructure[]
}

// 可以在这里添加更多共享的 SEO 类型
