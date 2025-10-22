/**
 * SEO算法事实层 - 客观数据计算
 * 提供100%准确的客观事实，供AI深度分析使用
 *
 * 核心原则：
 * - 只计算客观事实（字数、密度、长度等）
 * - 不做主观判断（质量、吸引力等）
 * - 结果完全可复现（每次一致）
 */

export interface SEOFacts {
  // Meta信息事实
  meta: {
    titleLength: number
    titleHasKeyword: boolean
    titleKeywordPosition: number // -1表示不包含
    descLength: number
    descHasKeyword: boolean
    descHasCTA: boolean
    ctaType?: string // "Learn more" | "Start now" | 等
  }

  // 内容统计事实
  content: {
    totalWords: number
    totalChars: number
    h1Count: number
    h2Count: number
    h3Count: number
    paragraphCount: number
    avgParagraphLength: number
    maxParagraphLength: number
    listCount: number
    codeBlockCount: number
    quoteBlockCount: number
  }

  // 关键词分析事实
  keywords: {
    primary: {
      keyword: string
      count: number
      density: number // 百分比
      positions: number[] // 字符位置
      inTitle: boolean
      inFirstParagraph: boolean
      inLastParagraph: boolean
      inH2Count: number
      inH3Count: number
    }
  }

  // 可读性事实
  readability: {
    fleschScore: number // 0-100
    avgSentenceLength: number // 词/句
    avgWordLength: number // 字符/词
    complexWordCount: number // ≥3音节的词
    complexWordRatio: number // 百分比
    totalSentences: number
  }

  // 用户体验事实
  ux: {
    faqCount: number
    faqAvgQuestionLength: number
    faqAvgAnswerLength: number
    faqTotalWords: number
    internalLinkCount: number
    externalLinkCount: number
  }
}

export interface SEOContent {
  meta_title: string
  meta_description: string
  meta_keywords?: string
  guide_intro?: string
  guide_content: string
  faq_items?: Array<{ question: string; answer: string }>
  target_keyword: string
  language?: string
}

/**
 * 计算所有SEO客观事实
 */
export function calculateSEOFacts(content: SEOContent): SEOFacts {
  const fullContent = extractFullContent(content)

  return {
    meta: calculateMetaFacts(content),
    content: calculateContentFacts(content),
    keywords: calculateKeywordFacts(content, fullContent),
    readability: calculateReadabilityFacts(fullContent, content.language),
    ux: calculateUXFacts(content)
  }
}

/**
 * Meta信息事实计算
 */
function calculateMetaFacts(content: SEOContent) {
  const { meta_title, meta_description, target_keyword } = content

  // 标题关键词位置
  const titleLower = meta_title.toLowerCase()
  const keywordLower = target_keyword.toLowerCase()
  const keywordPosition = titleLower.indexOf(keywordLower)

  // CTA检测
  const ctaPatterns = {
    en: ['start now', 'get started', 'learn more', 'try it', 'download', 'sign up', 'join', 'discover'],
    zh: ['立即开始', '免费试用', '了解更多', '立即下载', '马上体验', '开始使用', '点击查看'],
    ja: ['今すぐ', '詳細', '無料', '始める', 'ダウンロード'],
    ko: ['지금', '시작', '무료', '다운로드', '자세히'],
    es: ['empezar', 'descargar', 'prueba', 'gratis'],
  }

  const lang = content.language || 'en'
  const patterns = ctaPatterns[lang as keyof typeof ctaPatterns] || ctaPatterns.en
  const descLower = meta_description.toLowerCase()

  let hasCTA = false
  let ctaType: string | undefined

  for (const pattern of patterns) {
    if (descLower.includes(pattern)) {
      hasCTA = true
      ctaType = pattern
      break
    }
  }

  return {
    titleLength: meta_title.length,
    titleHasKeyword: keywordPosition !== -1,
    titleKeywordPosition: keywordPosition,
    descLength: meta_description.length,
    descHasKeyword: descLower.includes(keywordLower),
    descHasCTA: hasCTA,
    ctaType
  }
}

/**
 * 内容统计事实计算
 */
function calculateContentFacts(content: SEOContent) {
  const { guide_content, guide_intro } = content
  const fullText = [guide_intro, guide_content].filter(Boolean).join('\n\n')

  // 统计H标签
  const h1Count = (fullText.match(/^#\s/gm) || []).length
  const h2Count = (fullText.match(/^##\s/gm) || []).length
  const h3Count = (fullText.match(/^###\s/gm) || []).length

  // 统计段落
  const paragraphs = fullText
    .split(/\n\n+/)
    .filter(p => p.trim() && !p.trim().startsWith('#'))
    .map(p => p.replace(/\n/g, ' ').trim())

  const paragraphLengths = paragraphs.map(p => countWords(p))
  const avgParagraphLength = paragraphLengths.length > 0
    ? Math.round(paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length)
    : 0
  const maxParagraphLength = paragraphLengths.length > 0 ? Math.max(...paragraphLengths) : 0

  // 统计列表
  const listCount = (fullText.match(/^[-*+]\s/gm) || []).length +
                   (fullText.match(/^\d+\.\s/gm) || []).length

  // 统计代码块
  const codeBlockCount = (fullText.match(/```/g) || []).length / 2

  // 统计引用块
  const quoteBlockCount = (fullText.match(/^>\s/gm) || []).length

  // 统计总字数
  const totalWords = countWords(fullText)

  return {
    totalWords,
    totalChars: fullText.length,
    h1Count,
    h2Count,
    h3Count,
    paragraphCount: paragraphs.length,
    avgParagraphLength,
    maxParagraphLength,
    listCount,
    codeBlockCount,
    quoteBlockCount
  }
}

/**
 * 关键词事实计算
 */
function calculateKeywordFacts(content: SEOContent, fullContent: string) {
  const { target_keyword, guide_intro = '', guide_content } = content
  const keywordLower = target_keyword.toLowerCase()

  // 精确计算关键词密度
  const { count, density, positions } = calculateKeywordDensity(fullContent, target_keyword)

  // 检查关键词位置
  const fullContentLower = fullContent.toLowerCase()
  const firstParagraph = fullContent.split(/\n\n/)[0] || ''
  const paragraphs = fullContent.split(/\n\n/)
  const lastParagraph = paragraphs[paragraphs.length - 1] || ''

  const inTitle = content.meta_title.toLowerCase().includes(keywordLower)
  const inFirstParagraph = firstParagraph.toLowerCase().includes(keywordLower)
  const inLastParagraph = lastParagraph.toLowerCase().includes(keywordLower)

  // 统计H2中的关键词
  const h2Lines = (guide_content.match(/^##\s.*$/gm) || [])
  const inH2Count = h2Lines.filter(line => line.toLowerCase().includes(keywordLower)).length

  // 统计H3中的关键词
  const h3Lines = (guide_content.match(/^###\s.*$/gm) || [])
  const inH3Count = h3Lines.filter(line => line.toLowerCase().includes(keywordLower)).length

  return {
    primary: {
      keyword: target_keyword,
      count,
      density,
      positions,
      inTitle,
      inFirstParagraph,
      inLastParagraph,
      inH2Count,
      inH3Count
    }
  }
}

/**
 * 可读性事实计算（Flesch Reading Ease公式）
 */
function calculateReadabilityFacts(content: string, language?: string) {
  // 移除Markdown标记
  const plainText = content
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/`[^`]+`/g, '') // 移除行内代码
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文本
    .replace(/[#*>`-]/g, '') // 移除Markdown符号
    .replace(/\s+/g, ' ')
    .trim()

  // 分句（简化版，支持英文和中文）
  const sentences = plainText
    .split(/[.!?。!?]+/)
    .filter(s => s.trim().length > 0)

  const totalSentences = sentences.length

  // 分词
  const words = plainText.split(/\s+/).filter(w => w.length > 0)
  const totalWords = words.length

  // 平均句长
  const avgSentenceLength = totalWords / (totalSentences || 1)

  // 平均词长
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (totalWords || 1)

  // 复杂词统计（简化：长度≥8字符的词）
  const complexWords = words.filter(w => w.length >= 8)
  const complexWordCount = complexWords.length
  const complexWordRatio = (complexWordCount / (totalWords || 1)) * 100

  // Flesch Reading Ease 公式（简化版）
  // 分数 = 206.835 - 1.015 × (总词数/总句数) - 84.6 × (总音节数/总词数)
  // 简化：用词长代替音节数
  const fleschScore = Math.max(0, Math.min(100,
    206.835 - 1.015 * avgSentenceLength - 84.6 * (avgWordLength / 5)
  ))

  return {
    fleschScore: Math.round(fleschScore * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgWordLength: Math.round(avgWordLength * 10) / 10,
    complexWordCount,
    complexWordRatio: Math.round(complexWordRatio * 10) / 10,
    totalSentences
  }
}

/**
 * 用户体验事实计算
 */
function calculateUXFacts(content: SEOContent) {
  const { faq_items = [], guide_content } = content

  // FAQ统计
  const faqCount = faq_items.length
  const faqQuestionLengths = faq_items.map(item => countWords(item.question))
  const faqAnswerLengths = faq_items.map(item => countWords(item.answer))

  const faqAvgQuestionLength = faqQuestionLengths.length > 0
    ? Math.round(faqQuestionLengths.reduce((a, b) => a + b, 0) / faqQuestionLengths.length)
    : 0

  const faqAvgAnswerLength = faqAnswerLengths.length > 0
    ? Math.round(faqAnswerLengths.reduce((a, b) => a + b, 0) / faqAnswerLengths.length)
    : 0

  const faqTotalWords = faqQuestionLengths.reduce((a, b) => a + b, 0) +
                       faqAnswerLengths.reduce((a, b) => a + b, 0)

  // 链接统计
  const internalLinkCount = (guide_content.match(/\[([^\]]+)\]\((?!http)/g) || []).length
  const externalLinkCount = (guide_content.match(/\[([^\]]+)\]\(https?:\/\//g) || []).length

  return {
    faqCount,
    faqAvgQuestionLength,
    faqAvgAnswerLength,
    faqTotalWords,
    internalLinkCount,
    externalLinkCount
  }
}

/**
 * 精确计算关键词密度 - 新版本（单个关键词）
 * (导出以保持向后兼容)
 */
function calculateKeywordDensitySingle(content: string, keyword: string): {
  count: number
  density: number
  positions: number[]
} {
  // 参数验证和类型转换
  if (!content || typeof content !== 'string') {
    return { count: 0, density: 0, positions: [] }
  }

  if (!keyword || typeof keyword !== 'string') {
    return { count: 0, density: 0, positions: [] }
  }

  const normalizedContent = content.toLowerCase().replace(/\s+/g, ' ').trim()
  const normalizedKeyword = keyword.toLowerCase().trim()
  const words = normalizedContent.split(/[\s\p{P}]+/u).filter(w => w.length > 0)
  const totalWords = words.length

  if (totalWords === 0 || !normalizedKeyword) {
    return { count: 0, density: 0, positions: [] }
  }

  const keywordWords = normalizedKeyword.split(/\s+/)
  let count = 0
  const positions: number[] = []

  // 滑动窗口匹配
  if (keywordWords.length === 1) {
    // 单词关键词
    words.forEach((word, index) => {
      if (word === keywordWords[0]) {
        count++
        // 估算字符位置
        const charPos = content.toLowerCase().indexOf(word, positions[positions.length - 1] || 0)
        if (charPos !== -1) {
          positions.push(charPos)
        }
      }
    })
  } else {
    // 多词关键词
    for (let i = 0; i <= words.length - keywordWords.length; i++) {
      const match = keywordWords.every((kw, idx) => words[i + idx] === kw)
      if (match) {
        count++
        // 估算字符位置
        const searchStart = positions[positions.length - 1] || 0
        const charPos = normalizedContent.indexOf(normalizedKeyword, searchStart)
        if (charPos !== -1) {
          positions.push(charPos)
        }
      }
    }
  }

  const density = (count / totalWords) * 100

  return {
    count,
    density: Math.round(density * 10) / 10,
    positions
  }
}

/**
 * 精确计算关键词密度 - 支持两种调用方式
 * 1. 新版本: calculateKeywordDensity(content, keyword) 返回 { count, density, positions }
 * 2. 旧版本: calculateKeywordDensity(content, keywords[]) 返回 Record<string, number>
 */
export function calculateKeywordDensity(
  content: string,
  keywordOrKeywords: string | string[]
): { count: number; density: number; positions: number[] } | Record<string, number> {
  // 旧版本：传入数组，返回 Record
  if (Array.isArray(keywordOrKeywords)) {
    const keywords = keywordOrKeywords
    if (!content || keywords.length === 0) {
      return {}
    }

    const result: Record<string, number> = {}

    keywords.forEach(keyword => {
      if (keyword && typeof keyword === 'string') {
        const { density } = calculateKeywordDensitySingle(content, keyword)
        result[keyword] = density
      }
    })

    return result
  }

  // 新版本：传入字符串，返回详细对象
  return calculateKeywordDensitySingle(content, keywordOrKeywords)
}

/**
 * 提取完整内容
 * (导出以保持向后兼容)
 */
export function extractFullContent(content: SEOContent): string {
  const parts: string[] = []

  if (content.meta_title) parts.push(content.meta_title)
  if (content.meta_description) parts.push(content.meta_description)
  if (content.guide_intro) parts.push(content.guide_intro)
  if (content.guide_content) parts.push(content.guide_content)

  if (content.faq_items && content.faq_items.length > 0) {
    content.faq_items.forEach(item => {
      parts.push(item.question)
      parts.push(item.answer)
    })
  }

  return parts.join('\n\n')
}

/**
 * 统计词数（支持英文和中文）
 * (导出以保持向后兼容)
 */
export function countWords(text: string): number {
  // 移除Markdown标记
  const plainText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*>`-]/g, '')
    .trim()

  // 中文字符数
  const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length

  // 英文单词数
  const englishWords = plainText
    .replace(/[\u4e00-\u9fa5]/g, '') // 移除中文
    .split(/\s+/)
    .filter(w => w.length > 0).length

  // 中文按字符计，英文按单词计
  return chineseChars + englishWords
}

/**
 * 计算SEO各维度的基础分数
 * 基于算法事实，返回可用于AI提示词的基础分数
 */
export interface SEOBaseScores {
  metaBaseScore: number
  contentBaseScore: number
  keywordBaseScore: number
  readabilityBaseScore: number
  uxBaseScore: number
}

export function calculateBaseScores(facts: SEOFacts): SEOBaseScores {
  // 1. Meta信息质量基础分 (0-20)
  let metaBaseScore = 0

  // 标题长度评分 (0-10分)
  const titleLen = facts.meta.titleLength
  if (titleLen >= 50 && titleLen <= 60) {
    metaBaseScore += 10
  } else if ((titleLen >= 45 && titleLen <= 49) || (titleLen >= 61 && titleLen <= 65)) {
    metaBaseScore += 7
  } else {
    metaBaseScore += 3
  }

  // 描述长度评分 (0-7分)
  const descLen = facts.meta.descLength
  if (descLen >= 150 && descLen <= 160) {
    metaBaseScore += 7
  } else if ((descLen >= 140 && descLen <= 149) || (descLen >= 161 && descLen <= 170)) {
    metaBaseScore += 5
  } else {
    metaBaseScore += 2
  }

  // 关键词优化 (0-3分)
  if (facts.meta.titleHasKeyword) metaBaseScore += 2
  if (facts.meta.descHasKeyword) metaBaseScore += 1

  // 2. 内容质量基础分 (0-15分，AI深度评估0-20分)
  let contentBaseScore = 0

  // 字数评分 (0-8分)
  const totalWords = facts.content.totalWords
  if (totalWords >= 1500) {
    contentBaseScore += 8
  } else if (totalWords >= 1000) {
    contentBaseScore += 5
  } else {
    contentBaseScore += 2
  }

  // 结构评分 (0-7分)
  if (facts.content.h2Count >= 5) {
    contentBaseScore += 7
  } else if (facts.content.h2Count >= 3) {
    contentBaseScore += 5
  } else {
    contentBaseScore += 2
  }

  // 多媒体元素加分
  if (facts.content.listCount > 0 || facts.content.codeBlockCount > 0 || facts.content.quoteBlockCount > 0) {
    contentBaseScore += 3
  }

  // 3. 关键词优化基础分 (0-20分)
  let keywordBaseScore = 0

  // 密度评分 (0-15分)
  const density = facts.keywords.primary.density
  if (density >= 1.0 && density <= 2.0) {
    keywordBaseScore += 15
  } else if ((density >= 0.5 && density < 1.0) || (density > 2.0 && density <= 3.0)) {
    keywordBaseScore += 10
  } else {
    keywordBaseScore += 5
  }

  // 分布评分 (0-5分)
  if (facts.keywords.primary.inTitle) keywordBaseScore += 2
  if (facts.keywords.primary.inFirstParagraph) keywordBaseScore += 1
  if (facts.keywords.primary.inLastParagraph) keywordBaseScore += 1
  if (facts.keywords.primary.inH2Count >= 2) keywordBaseScore += 1

  // 4. 可读性基础分 (0-20分)
  let readabilityBaseScore = 0

  // Flesch评分映射 (0-15分)
  const flesch = facts.readability.fleschScore
  if (flesch >= 60 && flesch <= 80) {
    readabilityBaseScore += 15
  } else if ((flesch >= 50 && flesch < 60) || (flesch > 80 && flesch <= 90)) {
    readabilityBaseScore += 12
  } else if ((flesch >= 40 && flesch < 50) || (flesch > 90)) {
    readabilityBaseScore += 8
  } else {
    readabilityBaseScore += 5
  }

  // 段落长度评分 (0-5分)
  const avgParaLen = facts.content.avgParagraphLength
  const maxParaLen = facts.content.maxParagraphLength
  if (avgParaLen >= 50 && avgParaLen <= 150 && maxParaLen <= 300) {
    readabilityBaseScore += 5
  } else if (avgParaLen < 200 && maxParaLen <= 400) {
    readabilityBaseScore += 3
  } else {
    readabilityBaseScore += 1
  }

  // 5. 用户体验基础分 (0-10分)
  let uxBaseScore = 0

  // FAQ评分 (0-5分)
  const faqCount = facts.ux.faqCount
  if (faqCount >= 5) {
    uxBaseScore += 5
  } else if (faqCount >= 3) {
    uxBaseScore += 3
  } else if (faqCount >= 1) {
    uxBaseScore += 1
  }

  // 链接评分 (0-5分)
  const totalLinks = facts.ux.internalLinkCount + facts.ux.externalLinkCount
  if (totalLinks >= 5) {
    uxBaseScore += 5
  } else if (totalLinks >= 3) {
    uxBaseScore += 3
  } else if (totalLinks >= 1) {
    uxBaseScore += 1
  }

  return {
    metaBaseScore,
    contentBaseScore,
    keywordBaseScore,
    readabilityBaseScore,
    uxBaseScore
  }
}
