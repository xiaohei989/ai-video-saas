/**
 * 共享的 SEO 类型定义
 * 用于避免循环依赖
 */

export interface SectionStructure {
  sectionTitle: string
  minWordCount: number
  maxWordCount: number
  keyPoints: string[]
  requiredElements?: string[]
}

// 可以在这里添加更多共享的 SEO 类型
