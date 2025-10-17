/**
 * 去重检测服务
 * 使用TF-IDF和余弦相似度检测内容重复
 * 防止Programmatic SEO生成过多相似内容导致搜索引擎惩罚
 */

import { createClient } from '@supabase/supabase-js'

// 兼容Vite和Node环境
const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || ''
  }
  return process.env[key] || ''
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

export interface DuplicateCheckRequest {
  templateId: string          // 视频模板ID
  language: string             // 语言
  newContent: string           // 新生成的内容
  compareWithAll?: boolean     // 是否与所有已有内容比较（默认false，仅同模板同语言）
}

export interface DuplicateCheckResult {
  isDuplicate: boolean         // 是否重复（相似度>70%）
  maxSimilarity: number        // 最高相似度
  similarPages: SimilarPage[]  // 相似页面列表
  threshold: number            // 判定阈值
  checkedCount: number         // 检查的页面数量
}

export interface SimilarPage {
  pageId: string
  targetKeyword: string
  similarity: number           // 相似度0-1
  contentPreview: string       // 内容预览
  url: string                  // 页面URL
}

export interface BatchDuplicateCheckRequest {
  templateId: string
  language: string
  contents: Array<{
    id: string               // 临时ID（用于识别）
    keyword: string
    content: string
  }>
}

export interface BatchDuplicateCheckResult {
  duplicates: Array<{
    id: string
    keyword: string
    isDuplicate: boolean
    maxSimilarity: number
    similarTo: string[]      // 相似的其他ID或keyword
  }>
  overallDuplicateRate: number  // 总体重复率
}

class DuplicateDetectionService {
  private readonly DUPLICATE_THRESHOLD = 0.70  // 70%相似度视为重复
  private readonly WARNING_THRESHOLD = 0.50    // 50%相似度发出警告

  /**
   * 检查单个内容是否重复
   */
  async checkDuplicate(request: DuplicateCheckRequest): Promise<DuplicateCheckResult> {
    console.log(`\n[DuplicateDetect] 🔍 开始检测重复...`)
    console.log(`[DuplicateDetect] 模板ID: ${request.templateId}`)
    console.log(`[DuplicateDetect] 语言: ${request.language}`)

    // 1. 获取已有内容
    const existingPages = await this.loadExistingPages(
      request.templateId,
      request.language,
      request.compareWithAll
    )

    console.log(`[DuplicateDetect] 已加载 ${existingPages.length} 个已有页面`)

    if (existingPages.length === 0) {
      console.log(`[DuplicateDetect] ✅ 无已有页面，跳过检测`)
      return {
        isDuplicate: false,
        maxSimilarity: 0,
        similarPages: [],
        threshold: this.DUPLICATE_THRESHOLD,
        checkedCount: 0
      }
    }

    // 2. 计算相似度
    const similarities: SimilarPage[] = []

    for (const page of existingPages) {
      const similarity = this.calculateSimilarity(
        request.newContent,
        page.guide_content
      )

      if (similarity > this.WARNING_THRESHOLD) {
        similarities.push({
          pageId: page.id,
          targetKeyword: page.target_keyword,
          similarity,
          contentPreview: page.guide_content.slice(0, 200),
          url: `/${page.language}/guide/${page.content_template?.slug || 'template'}/${page.keyword_slug}`
        })
      }
    }

    // 3. 按相似度排序
    similarities.sort((a, b) => b.similarity - a.similarity)

    const maxSimilarity = similarities.length > 0 ? similarities[0].similarity : 0
    const isDuplicate = maxSimilarity > this.DUPLICATE_THRESHOLD

    console.log(`[DuplicateDetect] 📊 检测结果:`)
    console.log(`[DuplicateDetect] 最高相似度: ${(maxSimilarity * 100).toFixed(2)}%`)
    console.log(`[DuplicateDetect] 是否重复: ${isDuplicate ? '是' : '否'}`)
    console.log(`[DuplicateDetect] 相似页面数: ${similarities.length}`)

    return {
      isDuplicate,
      maxSimilarity,
      similarPages: similarities.slice(0, 10), // 最多返回10个
      threshold: this.DUPLICATE_THRESHOLD,
      checkedCount: existingPages.length
    }
  }

  /**
   * 批量检测重复
   */
  async checkBatchDuplicates(request: BatchDuplicateCheckRequest): Promise<BatchDuplicateCheckResult> {
    console.log(`\n[DuplicateDetect Batch] 🔍 开始批量检测重复...`)
    console.log(`[DuplicateDetect Batch] 内容数量: ${request.contents.length}`)

    // 1. 获取已有内容
    const existingPages = await this.loadExistingPages(
      request.templateId,
      request.language,
      false
    )

    console.log(`[DuplicateDetect Batch] 已加载 ${existingPages.length} 个已有页面`)

    const results: BatchDuplicateCheckResult['duplicates'] = []

    // 2. 检测每个新内容与已有内容的相似度
    for (const content of request.contents) {
      let maxSimilarity = 0
      const similarTo: string[] = []

      // 与已有页面比较
      for (const page of existingPages) {
        const similarity = this.calculateSimilarity(content.content, page.guide_content)

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity
        }

        if (similarity > this.DUPLICATE_THRESHOLD) {
          similarTo.push(page.target_keyword)
        }
      }

      // 与同批次其他内容比较
      for (const other of request.contents) {
        if (other.id === content.id) continue

        const similarity = this.calculateSimilarity(content.content, other.content)

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity
        }

        if (similarity > this.DUPLICATE_THRESHOLD) {
          similarTo.push(other.keyword)
        }
      }

      results.push({
        id: content.id,
        keyword: content.keyword,
        isDuplicate: maxSimilarity > this.DUPLICATE_THRESHOLD,
        maxSimilarity,
        similarTo
      })
    }

    // 3. 计算总体重复率
    const duplicateCount = results.filter(r => r.isDuplicate).length
    const overallDuplicateRate = duplicateCount / results.length

    console.log(`[DuplicateDetect Batch] 📊 批量检测结果:`)
    console.log(`[DuplicateDetect Batch] 重复数量: ${duplicateCount}/${results.length}`)
    console.log(`[DuplicateDetect Batch] 重复率: ${(overallDuplicateRate * 100).toFixed(2)}%`)

    return {
      duplicates: results,
      overallDuplicateRate
    }
  }

  /**
   * 计算两个文本的相似度（使用TF-IDF + 余弦相似度）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // 1. 预处理文本
    const tokens1 = this.tokenize(text1)
    const tokens2 = this.tokenize(text2)

    if (tokens1.length === 0 || tokens2.length === 0) {
      return 0
    }

    // 2. 构建词汇表
    const vocabulary = new Set([...tokens1, ...tokens2])

    // 3. 计算TF（词频）
    const tf1 = this.calculateTF(tokens1, vocabulary)
    const tf2 = this.calculateTF(tokens2, vocabulary)

    // 4. 计算IDF（逆文档频率）
    const idf = this.calculateIDF([tokens1, tokens2], vocabulary)

    // 5. 计算TF-IDF向量
    const tfidf1 = this.calculateTFIDF(tf1, idf)
    const tfidf2 = this.calculateTFIDF(tf2, idf)

    // 6. 计算余弦相似度
    const similarity = this.cosineSimilarity(tfidf1, tfidf2)

    return similarity
  }

  /**
   * 分词（简单实现）
   */
  private tokenize(text: string): string[] {
    // 转小写，移除标点，分词
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2) // 过滤短词
  }

  /**
   * 计算TF（词频）
   */
  private calculateTF(tokens: string[], vocabulary: Set<string>): Map<string, number> {
    const tf = new Map<string, number>()
    const totalTokens = tokens.length

    for (const word of vocabulary) {
      const count = tokens.filter(t => t === word).length
      tf.set(word, count / totalTokens)
    }

    return tf
  }

  /**
   * 计算IDF（逆文档频率）
   */
  private calculateIDF(documents: string[][], vocabulary: Set<string>): Map<string, number> {
    const idf = new Map<string, number>()
    const totalDocs = documents.length

    for (const word of vocabulary) {
      const docsWithWord = documents.filter(doc => doc.includes(word)).length
      idf.set(word, Math.log((totalDocs + 1) / (docsWithWord + 1)) + 1) // 平滑IDF
    }

    return idf
  }

  /**
   * 计算TF-IDF向量
   */
  private calculateTFIDF(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
    const tfidf = new Map<string, number>()

    for (const [word, tfValue] of tf.entries()) {
      const idfValue = idf.get(word) || 0
      tfidf.set(word, tfValue * idfValue)
    }

    return tfidf
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vector1: Map<string, number>, vector2: Map<string, number>): number {
    let dotProduct = 0
    let magnitude1 = 0
    let magnitude2 = 0

    // 计算所有维度
    const allKeys = new Set([...vector1.keys(), ...vector2.keys()])

    for (const key of allKeys) {
      const v1 = vector1.get(key) || 0
      const v2 = vector2.get(key) || 0

      dotProduct += v1 * v2
      magnitude1 += v1 * v1
      magnitude2 += v2 * v2
    }

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0
    }

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2))
  }

  /**
   * 从数据库加载已有页面
   */
  private async loadExistingPages(
    templateId: string,
    language: string,
    compareWithAll: boolean = false
  ) {
    let query = getSupabase()
      .from('seo_page_variants')
      .select(`
        id,
        target_keyword,
        keyword_slug,
        guide_content,
        language,
        content_template:content_template_id (
          slug
        )
      `)
      .eq('is_published', true)

    // 如果不是全局比较，只比较同模板同语言
    if (!compareWithAll) {
      query = query
        .eq('template_id', templateId)
        .eq('language', language)
    } else {
      query = query.eq('language', language)
    }

    const { data, error } = await query

    if (error) {
      console.error('[DuplicateDetect] 加载已有页面失败:', error)
      throw new Error('加载已有页面失败')
    }

    return data || []
  }

  /**
   * 更新页面的相似度得分
   */
  async updateSimilarityScore(
    pageId: string,
    similarity: number,
    isDuplicate: boolean
  ): Promise<void> {
    const { error } = await getSupabase()
      .from('seo_page_variants')
      .update({
        content_similarity_score: similarity,
        is_duplicate: isDuplicate
      })
      .eq('id', pageId)

    if (error) {
      console.error('[DuplicateDetect] 更新相似度失败:', error)
      throw new Error('更新相似度失败')
    }
  }

  /**
   * 获取重复内容统计
   */
  async getDuplicateStats(templateId: string): Promise<{
    totalPages: number
    duplicatePages: number
    duplicateRate: number
    averageSimilarity: number
  }> {
    const { data, error } = await getSupabase()
      .from('seo_page_variants')
      .select('is_duplicate, content_similarity_score')
      .eq('template_id', templateId)
      .eq('is_published', true)

    if (error) {
      throw new Error('获取统计失败')
    }

    const pages = data || []
    const totalPages = pages.length
    const duplicatePages = pages.filter(p => p.is_duplicate).length
    const duplicateRate = totalPages > 0 ? duplicatePages / totalPages : 0

    const avgSimilarity = pages.reduce((sum, p) => sum + (p.content_similarity_score || 0), 0) / totalPages

    return {
      totalPages,
      duplicatePages,
      duplicateRate,
      averageSimilarity
    }
  }

  /**
   * 简单的Jaccard相似度（备用算法，更快但不太精确）
   */
  calculateJaccardSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(this.tokenize(text1))
    const tokens2 = new Set(this.tokenize(text2))

    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)))
    const union = new Set([...tokens1, ...tokens2])

    return intersection.size / union.size
  }

  /**
   * 快速指纹检测（用于初步筛选）
   */
  generateFingerprint(text: string): string {
    // 生成文本的短指纹（用于快速比较）
    const tokens = this.tokenize(text)
    const sorted = [...new Set(tokens)].sort()
    const topWords = sorted.slice(0, 50) // 取前50个唯一词
    return topWords.join('|')
  }

  /**
   * 检测结构相似度（H2标题相似度）
   */
  calculateStructuralSimilarity(text1: string, text2: string): number {
    const h2Regex = /^##\s+(.+)$/gm

    const h2s1 = [...text1.matchAll(h2Regex)].map(m => m[1].toLowerCase())
    const h2s2 = [...text2.matchAll(h2Regex)].map(m => m[1].toLowerCase())

    if (h2s1.length === 0 || h2s2.length === 0) {
      return 0
    }

    // 计算标题集合的Jaccard相似度
    const set1 = new Set(h2s1)
    const set2 = new Set(h2s2)

    const intersection = new Set([...set1].filter(h => set2.has(h)))
    const union = new Set([...set1, ...set2])

    return intersection.size / union.size
  }
}

export const duplicateDetectionService = new DuplicateDetectionService()
export default duplicateDetectionService
