/**
 * SEO统一评分引擎
 * 整合算法计算、AI分析、交叉验证三层架构
 *
 * 使用流程：
 * 1. calculateSEOFacts() → 算法计算客观事实
 * 2. callAI() → AI深度分析
 * 3. crossValidate() → 交叉验证
 * 4. 返回最终评分 + 详细breakdown + 建议
 */

import { calculateSEOFacts, type SEOContent, type SEOFacts } from './seoFactsCalculator'
import { buildAIAnalysisPrompt, type AIAnalysisResult } from './seoAIAnalyzer'
import { crossValidate, type ValidatedSEOScore } from './seoValidator'
import seoAIService from './seoAIService'

export interface SEOScoringOptions {
  aiModel?: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli'
  skipAI?: boolean // 仅使用算法评分（快速模式）
  debug?: boolean // 输出详细日志
}

export interface SEOScoringResult extends ValidatedSEOScore {
  facts: SEOFacts // 原始算法事实
  ai_raw_result?: AIAnalysisResult // AI原始结果（调试用）
  performance: {
    facts_calculation_ms: number
    ai_analysis_ms: number
    validation_ms: number
    total_ms: number
  }
}

/**
 * 主评分函数 - 完整流程
 */
export async function scoreSEOContent(
  content: SEOContent,
  options: SEOScoringOptions = {}
): Promise<SEOScoringResult> {
  const { aiModel = 'claude', skipAI = false, debug = false } = options
  const startTime = Date.now()

  if (debug) {
    console.log('[SEO Scoring Engine] 开始评分流程')
    console.log('[SEO Scoring Engine] 配置:', { aiModel, skipAI })
  }

  // ==================== 第1层：算法计算事实 ====================
  const factsStart = Date.now()
  const facts = calculateSEOFacts(content)
  const factsTime = Date.now() - factsStart

  if (debug) {
    console.log('[SEO Scoring Engine] ✅ 算法事实计算完成', {
      time: `${factsTime}ms`,
      totalWords: facts.content.totalWords,
      keywordDensity: facts.keywords.primary.density,
      fleschScore: facts.readability.fleschScore
    })
  }

  // ==================== 第2层：AI深度分析 ====================
  let aiResult: AIAnalysisResult
  let aiTime = 0

  if (skipAI) {
    // 快速模式：仅使用算法评分
    if (debug) {
      console.log('[SEO Scoring Engine] ⚡ 快速模式：跳过AI分析，使用算法评分')
    }
    aiResult = generateAlgorithmicScore(facts)
    aiTime = 0
  } else {
    // 完整模式：调用AI深度分析
    const aiStart = Date.now()

    try {
      const prompt = buildAIAnalysisPrompt(content, facts)

      if (debug) {
        console.log('[SEO Scoring Engine] 🤖 调用AI分析...', {
          model: aiModel,
          promptLength: prompt.length
        })
      }

      const aiResponse = await seoAIService.callAI(prompt, aiModel)

      // 解析AI响应
      aiResult = parseAIResponse(aiResponse)

      aiTime = Date.now() - aiStart

      if (debug) {
        console.log('[SEO Scoring Engine] ✅ AI分析完成', {
          time: `${aiTime}ms`,
          totalScore: aiResult.total_score,
          confidence: aiResult.confidence
        })
      }
    } catch (error) {
      console.error('[SEO Scoring Engine] ❌ AI分析失败，降级到算法评分:', error)

      // 降级到算法评分
      aiResult = generateAlgorithmicScore(facts)
      aiTime = Date.now() - aiStart

      if (debug) {
        console.log('[SEO Scoring Engine] ⚠️ 已降级到算法评分')
      }
    }
  }

  // ==================== 第3层：交叉验证 ====================
  const validationStart = Date.now()
  const validatedResult = crossValidate(facts, aiResult)
  const validationTime = Date.now() - validationStart

  if (debug) {
    console.log('[SEO Scoring Engine] ✅ 交叉验证完成', {
      time: `${validationTime}ms`,
      conflicts: validatedResult.conflicts.length,
      warnings: validatedResult.validation_warnings.length,
      confidence: validatedResult.confidence.overall,
      requiresReview: validatedResult.requires_manual_review
    })
  }

  // ==================== 返回最终结果 ====================
  const totalTime = Date.now() - startTime

  const result: SEOScoringResult = {
    ...validatedResult,
    facts,
    ai_raw_result: debug ? aiResult : undefined,
    performance: {
      facts_calculation_ms: factsTime,
      ai_analysis_ms: aiTime,
      validation_ms: validationTime,
      total_ms: totalTime
    }
  }

  if (debug) {
    console.log('[SEO Scoring Engine] 🎯 评分流程完成', {
      totalTime: `${totalTime}ms`,
      finalScore: result.total_score,
      confidence: result.confidence.overall
    })
  }

  return result
}

/**
 * 解析AI响应
 */
function parseAIResponse(response: string): AIAnalysisResult {
  // 移除可能的Markdown代码块标记
  let jsonContent = response.trim()

  // 尝试提取JSON
  const jsonMatch = jsonContent.match(/```json\n([\s\S]*?)\n```/) ||
                   jsonContent.match(/```\n([\s\S]*?)\n```/)

  if (jsonMatch) {
    jsonContent = jsonMatch[1]
  }

  // 解析JSON
  try {
    const parsed = JSON.parse(jsonContent)

    // 验证必需字段
    if (!parsed.total_score || !parsed.dimension_scores) {
      throw new Error('缺少必需字段: total_score or dimension_scores')
    }

    return parsed as AIAnalysisResult
  } catch (error) {
    console.error('[SEO Scoring Engine] AI响应解析失败:', error)
    console.error('[SEO Scoring Engine] 原始响应:', response.substring(0, 500))
    throw new Error(`AI响应格式不正确: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 纯算法评分（降级方案）
 */
function generateAlgorithmicScore(facts: SEOFacts): AIAnalysisResult {
  // 1. Meta信息质量 (0-20分)
  let metaScore = 0
  if (facts.meta.titleLength >= 50 && facts.meta.titleLength <= 60) metaScore += 10
  else if (facts.meta.titleLength >= 45 && facts.meta.titleLength <= 65) metaScore += 7
  else metaScore += 3

  if (facts.meta.descLength >= 150 && facts.meta.descLength <= 160) metaScore += 7
  else if (facts.meta.descLength >= 140 && facts.meta.descLength <= 170) metaScore += 5
  else metaScore += 2

  if (facts.meta.titleHasKeyword) metaScore += 2
  if (facts.meta.descHasKeyword) metaScore += 1

  // 2. 内容质量 (0-30分)
  let contentScore = 0
  if (facts.content.totalWords >= 1500) contentScore += 8
  else if (facts.content.totalWords >= 1000) contentScore += 5
  else contentScore += 2

  if (facts.content.h2Count >= 5) contentScore += 7
  else if (facts.content.h2Count >= 3) contentScore += 5

  if (facts.content.listCount > 0 || facts.content.codeBlockCount > 0) contentScore += 3

  // AI评估部分用中等分数
  contentScore += 12 // E-E-A-T、原创性等无法算法评估，给中等分

  // 3. 关键词优化 (0-20分)
  let keywordScore = 0
  const density = facts.keywords.primary.density

  if (density >= 1.0 && density <= 2.0) keywordScore += 15
  else if ((density >= 0.5 && density < 1.0) || (density > 2.0 && density <= 3.0)) keywordScore += 10
  else keywordScore += 5

  if (facts.keywords.primary.inTitle) keywordScore += 2
  if (facts.keywords.primary.inFirstParagraph) keywordScore += 1
  if (facts.keywords.primary.inLastParagraph) keywordScore += 1
  if (facts.keywords.primary.inH2Count >= 2) keywordScore += 1

  keywordScore = Math.min(keywordScore, 20)

  // 4. 可读性 (0-20分)
  let readabilityScore = 0
  const flesch = facts.readability.fleschScore

  if (flesch >= 70) readabilityScore += 10
  else if (flesch >= 60) readabilityScore += 7
  else if (flesch >= 50) readabilityScore += 5
  else readabilityScore += 2

  if (facts.content.avgParagraphLength >= 50 && facts.content.avgParagraphLength <= 100) {
    readabilityScore += 5
  } else {
    readabilityScore += 2
  }

  if (facts.content.listCount > 0 || facts.content.codeBlockCount > 0) {
    readabilityScore += 5
  } else {
    readabilityScore += 2
  }

  // 5. 用户体验 (0-10分)
  let uxScore = 0

  if (facts.ux.faqCount >= 5) uxScore += 5
  else if (facts.ux.faqCount >= 3) uxScore += 3
  else if (facts.ux.faqCount > 0) uxScore += 1

  if (facts.content.listCount > 0) uxScore += 2
  if (facts.content.h2Count >= 3) uxScore += 2
  if (facts.content.totalWords >= 1500) uxScore += 1

  uxScore = Math.min(uxScore, 10)

  // 总分
  const totalScore = metaScore + contentScore + keywordScore + readabilityScore + uxScore

  // 生成建议
  const recommendations: string[] = []

  if (metaScore < 15) {
    if (facts.meta.titleLength < 50 || facts.meta.titleLength > 60) {
      recommendations.push(`【Meta优化】标题长度${facts.meta.titleLength}字符，建议调整到50-60字符`)
    }
    if (!facts.meta.titleHasKeyword) {
      recommendations.push(`【Meta优化】标题中未包含关键词"${facts.keywords.primary.keyword}"，建议添加`)
    }
  }

  if (contentScore < 20) {
    if (facts.content.totalWords < 1500) {
      recommendations.push(`【内容优化】当前${facts.content.totalWords}字，建议扩充到1500-2000字`)
    }
    if (facts.content.h2Count < 3) {
      recommendations.push(`【内容优化】仅有${facts.content.h2Count}个H2标题，建议增加到至少3个`)
    }
  }

  if (keywordScore < 15) {
    if (density < 1.0) {
      recommendations.push(`【关键词优化】密度${density}%过低，建议增加关键词使用到1.5-2.0%`)
    } else if (density > 2.5) {
      recommendations.push(`【关键词优化】密度${density}%过高，建议减少到1.5-2.0%避免堆砌`)
    }
  }

  if (readabilityScore < 15) {
    if (flesch < 60) {
      recommendations.push(`【可读性优化】Flesch分数${flesch}分较低，建议使用更简单的句子和词汇`)
    }
    if (facts.content.avgParagraphLength > 100) {
      recommendations.push(`【可读性优化】平均段落${facts.content.avgParagraphLength}字过长，建议控制在50-100字`)
    }
  }

  if (uxScore < 7) {
    if (facts.ux.faqCount < 5) {
      recommendations.push(`【用户体验优化】仅有${facts.ux.faqCount}个FAQ，建议增加到5个以上`)
    }
  }

  return {
    total_score: totalScore,
    dimension_scores: {
      meta_quality: metaScore,
      content_quality: contentScore,
      keyword_optimization: keywordScore,
      readability: readabilityScore,
      ux: uxScore
    },
    detailed_breakdown: {
      meta_quality: {
        base_score: metaScore,
        title_appeal: 0,
        description_persuasion: 0,
        reason: '算法评分（未使用AI分析）'
      },
      content_quality: {
        base_score: contentScore,
        originality_depth: 0,
        eeat: 0,
        structure_flow: 0,
        practicality: 0,
        highlights: [],
        issues: []
      },
      keyword_optimization: {
        base_score: keywordScore,
        naturalness_penalty: 0,
        semantic_relevance: 0,
        distribution: 0,
        issues: []
      },
      readability: {
        flesch_base: readabilityScore >= 10 ? 10 : readabilityScore,
        language_fluency: 0,
        format_optimization: 0,
        visual_friendliness: 0,
        issues: []
      },
      ux: {
        base_score: uxScore,
        faq_quality: 0,
        completeness: 0,
        issues: []
      }
    },
    top_strengths: generateStrengths(facts, metaScore, contentScore, keywordScore, readabilityScore, uxScore),
    critical_issues: [],
    actionable_recommendations: recommendations,
    confidence: 75, // 算法评分置信度中等（无AI深度分析）
    conflicts: []
  }
}

/**
 * 生成优势列表
 */
function generateStrengths(
  facts: SEOFacts,
  metaScore: number,
  contentScore: number,
  keywordScore: number,
  readabilityScore: number,
  uxScore: number
): string[] {
  const strengths: string[] = []

  if (metaScore >= 17) {
    strengths.push(`Meta信息优秀(${metaScore}/20分)：标题${facts.meta.titleLength}字符、描述${facts.meta.descLength}字符在理想范围`)
  }

  if (facts.keywords.primary.density >= 1.0 && facts.keywords.primary.density <= 2.0) {
    strengths.push(`关键词密度理想(${facts.keywords.primary.density}%)：在1.0-2.0%范围内`)
  }

  if (facts.readability.fleschScore >= 70) {
    strengths.push(`可读性优秀(Flesch ${facts.readability.fleschScore}分)：内容易于阅读理解`)
  }

  if (facts.content.totalWords >= 1500) {
    strengths.push(`内容充实(${facts.content.totalWords}字)：达到SEO推荐字数标准`)
  }

  if (facts.ux.faqCount >= 5) {
    strengths.push(`FAQ完整(${facts.ux.faqCount}个)：充分覆盖用户常见问题`)
  }

  return strengths
}

/**
 * 快速评分（仅算法，不调用AI）
 */
export async function quickScoreSEO(content: SEOContent): Promise<SEOScoringResult> {
  return scoreSEOContent(content, { skipAI: true })
}

/**
 * 完整评分（算法+AI+验证）
 */
export async function fullScoreSEO(
  content: SEOContent,
  aiModel: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli' = 'claude'
): Promise<SEOScoringResult> {
  return scoreSEOContent(content, { aiModel, skipAI: false, debug: true })
}
