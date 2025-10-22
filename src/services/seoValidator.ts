/**
 * SEO交叉验证层
 * 对比算法计算和AI分析结果，检测冲突，确保准确性
 *
 * 核心功能：
 * - 冲突检测：AI评分与算法数据矛盾时标记
 * - 置信度聚合：综合各维度置信度
 * - 异常值检测：分数异常时触发人工复核
 * - 自动修正：明显错误自动纠正
 */

import type { SEOFacts } from './seoFactsCalculator'
import type { AIAnalysisResult } from './seoAIAnalyzer'

export interface ValidatedSEOScore {
  total_score: number
  dimension_scores: {
    meta_quality: number
    content_quality: number
    keyword_optimization: number
    readability: number
    ux: number
  }
  detailed_breakdown: AIAnalysisResult['detailed_breakdown']
  top_strengths: string[]
  critical_issues: AIAnalysisResult['critical_issues']
  actionable_recommendations: string[]
  confidence: {
    overall: number // 0-100
    meta_quality: number
    content_quality: number
    keyword_optimization: number
    readability: number
    ux: number
  }
  conflicts: Array<{
    dimension: string
    algorithm_suggests: number
    ai_score: number
    reason: string
    confidence: 'high' | 'medium' | 'low'
    auto_resolved: boolean
    resolution?: string
  }>
  validation_warnings: string[]
  requires_manual_review: boolean
}

/**
 * 交叉验证算法结果和AI分析
 */
export function crossValidate(
  facts: SEOFacts,
  aiResult: AIAnalysisResult
): ValidatedSEOScore {
  // 第1步：冲突检测
  const conflicts = detectConflicts(facts, aiResult)

  // 第2步：异常值检测
  const warnings = detectAnomalies(facts, aiResult)

  // 第3步：置信度聚合
  const confidence = aggregateConfidence(aiResult, conflicts, warnings)

  // 第4步：自动修正明显错误
  const correctedScores = autoCorrectErrors(facts, aiResult, conflicts)

  // 第5步：判断是否需要人工复核
  const requiresManualReview = shouldRequireManualReview(confidence, conflicts, warnings)

  return {
    total_score: correctedScores.total_score,
    dimension_scores: correctedScores.dimension_scores,
    detailed_breakdown: aiResult.detailed_breakdown,
    top_strengths: aiResult.top_strengths,
    critical_issues: aiResult.critical_issues,
    actionable_recommendations: aiResult.actionable_recommendations,
    confidence,
    conflicts,
    validation_warnings: warnings,
    requires_manual_review: requiresManualReview
  }
}

/**
 * 冲突检测：AI评分与算法数据矛盾
 */
function detectConflicts(
  facts: SEOFacts,
  aiResult: AIAnalysisResult
): ValidatedSEOScore['conflicts'] {
  const conflicts: ValidatedSEOScore['conflicts'] = []

  // 1. Meta信息质量冲突检测
  const metaConflict = detectMetaConflict(facts, aiResult)
  if (metaConflict) conflicts.push(metaConflict)

  // 2. 关键词优化冲突检测
  const keywordConflict = detectKeywordConflict(facts, aiResult)
  if (keywordConflict) conflicts.push(keywordConflict)

  // 3. 可读性冲突检测
  const readabilityConflict = detectReadabilityConflict(facts, aiResult)
  if (readabilityConflict) conflicts.push(readabilityConflict)

  // 4. UX冲突检测
  const uxConflict = detectUXConflict(facts, aiResult)
  if (uxConflict) conflicts.push(uxConflict)

  // 合并AI自己报告的冲突
  const aiConflicts = aiResult.conflicts.map(c => ({
    ...c,
    auto_resolved: false
  }))

  return [...conflicts, ...aiConflicts]
}

/**
 * Meta信息冲突检测
 */
function detectMetaConflict(
  facts: SEOFacts,
  aiResult: AIAnalysisResult
): ValidatedSEOScore['conflicts'][0] | null {
  const { meta } = facts
  const { meta_quality } = aiResult.dimension_scores

  // 算法建议分数
  let algorithmSuggests = 0

  // 标题长度评分
  if (meta.titleLength >= 50 && meta.titleLength <= 60) algorithmSuggests += 10
  else if (meta.titleLength >= 45 && meta.titleLength <= 65) algorithmSuggests += 7
  else algorithmSuggests += 3

  // 描述长度评分
  if (meta.descLength >= 150 && meta.descLength <= 160) algorithmSuggests += 7
  else if (meta.descLength >= 140 && meta.descLength <= 170) algorithmSuggests += 5
  else algorithmSuggests += 2

  // 关键词评分
  if (meta.titleHasKeyword) algorithmSuggests += 2
  if (meta.descHasKeyword) algorithmSuggests += 1

  // 冲突检测：AI评分低于算法建议5分以上
  const diff = meta_quality - algorithmSuggests
  if (Math.abs(diff) >= 5) {
    const autoResolved = diff < 0 // AI评分过低，可以自动修正

    return {
      dimension: 'meta_quality',
      algorithm_suggests: algorithmSuggests,
      ai_score: meta_quality,
      reason: diff < 0
        ? `AI评分过低(${meta_quality}分)，算法数据显示标题${meta.titleLength}字符、描述${meta.descLength}字符、包含关键词，建议至少${algorithmSuggests}分`
        : `AI评分过高(${meta_quality}分)，算法数据显示Meta信息有明显问题，建议不超过${algorithmSuggests}分`,
      confidence: 'high',
      auto_resolved: autoResolved,
      resolution: autoResolved ? `自动采用算法建议分数${algorithmSuggests}分` : undefined
    }
  }

  return null
}

/**
 * 关键词优化冲突检测
 */
function detectKeywordConflict(
  facts: SEOFacts,
  aiResult: AIAnalysisResult
): ValidatedSEOScore['conflicts'][0] | null {
  const { keywords } = facts
  const { keyword_optimization } = aiResult.dimension_scores
  const density = keywords.primary.density

  // 算法建议分数
  let algorithmSuggests = 0

  // 密度评分
  if (density >= 1.0 && density <= 2.0) algorithmSuggests += 15
  else if ((density >= 0.5 && density < 1.0) || (density > 2.0 && density <= 3.0)) algorithmSuggests += 10
  else algorithmSuggests += 5

  // 分布评分
  if (keywords.primary.inTitle) algorithmSuggests += 2
  if (keywords.primary.inFirstParagraph) algorithmSuggests += 1
  if (keywords.primary.inLastParagraph) algorithmSuggests += 1
  if (keywords.primary.inH2Count >= 2) algorithmSuggests += 1

  algorithmSuggests = Math.min(algorithmSuggests, 20)

  // 冲突检测：AI评分低于算法建议3分以上（AI可能检测到堆砌）
  const diff = keyword_optimization - algorithmSuggests
  if (Math.abs(diff) >= 3) {
    // 如果AI评分低，可能是发现了自然度问题，这是合理的
    const autoResolved = diff > 0 // AI评分过高才自动修正

    return {
      dimension: 'keyword_optimization',
      algorithm_suggests: algorithmSuggests,
      ai_score: keyword_optimization,
      reason: diff < 0
        ? `AI评分${keyword_optimization}分低于算法建议${algorithmSuggests}分。密度${density}%在理想范围，但AI可能检测到关键词堆砌或不自然，这是合理的调整。`
        : `AI评分${keyword_optimization}分高于算法建议${algorithmSuggests}分。密度${density}%${density < 1 ? '过低' : density > 2.5 ? '过高' : ''}，AI评分可能过于乐观。`,
      confidence: diff < 0 ? 'medium' : 'high',
      auto_resolved: autoResolved,
      resolution: autoResolved ? `自动采用算法建议分数${algorithmSuggests}分` : undefined
    }
  }

  return null
}

/**
 * 可读性冲突检测
 */
function detectReadabilityConflict(
  facts: SEOFacts,
  aiResult: AIAnalysisResult
): ValidatedSEOScore['conflicts'][0] | null {
  const { readability } = facts
  const { readability: readabilityScore } = aiResult.dimension_scores
  const flesch = readability.fleschScore

  // 算法建议分数
  let algorithmSuggests = 0

  // Flesch分数评分
  if (flesch >= 70) algorithmSuggests += 10
  else if (flesch >= 60) algorithmSuggests += 7
  else if (flesch >= 50) algorithmSuggests += 5
  else algorithmSuggests += 2

  // 格式评分（简化）
  algorithmSuggests += 5 // 假设有列表/引用等
  algorithmSuggests += 5 // 假设段落长度适中

  algorithmSuggests = Math.min(algorithmSuggests, 20)

  // 冲突检测：AI评分超出算法建议5分以上
  const diff = readabilityScore - algorithmSuggests
  if (Math.abs(diff) >= 5) {
    const autoResolved = true // 可读性冲突通常自动修正

    return {
      dimension: 'readability',
      algorithm_suggests: algorithmSuggests,
      ai_score: readabilityScore,
      reason: diff < 0
        ? `AI评分${readabilityScore}分过低，Flesch分数${flesch}分${flesch >= 60 ? '良好' : flesch >= 50 ? '一般' : '较差'}，算法建议${algorithmSuggests}分`
        : `AI评分${readabilityScore}分超出20分上限，Flesch分数${flesch}分，算法建议不超过${algorithmSuggests}分`,
      confidence: 'high',
      auto_resolved: autoResolved,
      resolution: `自动采用算法建议分数${algorithmSuggests}分`
    }
  }

  return null
}

/**
 * UX冲突检测
 */
function detectUXConflict(
  facts: SEOFacts,
  aiResult: AIAnalysisResult
): ValidatedSEOScore['conflicts'][0] | null {
  const { ux } = facts
  const { ux: uxScore } = aiResult.dimension_scores

  // 算法建议分数
  let algorithmSuggests = 0

  // FAQ评分
  if (ux.faqCount >= 5) algorithmSuggests += 5
  else if (ux.faqCount >= 3) algorithmSuggests += 3
  else if (ux.faqCount > 0) algorithmSuggests += 1

  // 内容增强（简化）
  algorithmSuggests += 5 // 假设有列表、H2等

  algorithmSuggests = Math.min(algorithmSuggests, 10)

  // 冲突检测
  const diff = uxScore - algorithmSuggests
  if (Math.abs(diff) >= 3) {
    const autoResolved = diff > 0 // UX评分过高自动修正

    return {
      dimension: 'ux',
      algorithm_suggests: algorithmSuggests,
      ai_score: uxScore,
      reason: diff < 0
        ? `AI评分${uxScore}分低于算法建议${algorithmSuggests}分。FAQ${ux.faqCount}个，AI可能检测到质量问题。`
        : `AI评分${uxScore}分高于算法建议${algorithmSuggests}分（上限10分）。`,
      confidence: 'high',
      auto_resolved: autoResolved,
      resolution: autoResolved ? `自动采用算法建议分数${algorithmSuggests}分` : undefined
    }
  }

  return null
}

/**
 * 异常值检测
 */
function detectAnomalies(
  facts: SEOFacts,
  aiResult: AIAnalysisResult
): string[] {
  const warnings: string[] = []

  // 1. 总分超出100
  if (aiResult.total_score > 100) {
    warnings.push(`⚠️ 总分${aiResult.total_score}超出100分上限`)
  }

  // 2. 单个维度超出上限
  if (aiResult.dimension_scores.meta_quality > 20) {
    warnings.push(`⚠️ Meta质量分${aiResult.dimension_scores.meta_quality}超出20分上限`)
  }
  if (aiResult.dimension_scores.content_quality > 30) {
    warnings.push(`⚠️ 内容质量分${aiResult.dimension_scores.content_quality}超出30分上限`)
  }
  if (aiResult.dimension_scores.keyword_optimization > 20) {
    warnings.push(`⚠️ 关键词优化分${aiResult.dimension_scores.keyword_optimization}超出20分上限`)
  }
  if (aiResult.dimension_scores.readability > 20) {
    warnings.push(`⚠️ 可读性分${aiResult.dimension_scores.readability}超出20分上限`)
  }
  if (aiResult.dimension_scores.ux > 10) {
    warnings.push(`⚠️ 用户体验分${aiResult.dimension_scores.ux}超出10分上限`)
  }

  // 3. 总分与各维度之和不一致
  const sum = Object.values(aiResult.dimension_scores).reduce((a, b) => a + b, 0)
  if (Math.abs(aiResult.total_score - sum) > 1) {
    warnings.push(`⚠️ 总分${aiResult.total_score}与各维度之和${sum}不一致`)
  }

  // 4. 关键词密度与评分不匹配
  const density = facts.keywords.primary.density
  const keywordScore = aiResult.dimension_scores.keyword_optimization
  if (density >= 1.0 && density <= 2.0 && keywordScore < 12) {
    warnings.push(`⚠️ 关键词密度${density}%在理想范围，但评分仅${keywordScore}分（建议≥12分）`)
  }
  if ((density < 0.5 || density > 3.0) && keywordScore > 10) {
    warnings.push(`⚠️ 关键词密度${density}%异常，但评分${keywordScore}分较高`)
  }

  // 5. Flesch分数与可读性评分不匹配
  const flesch = facts.readability.fleschScore
  const readabilityScore = aiResult.dimension_scores.readability
  if (flesch >= 70 && readabilityScore < 12) {
    warnings.push(`⚠️ Flesch分数${flesch}分(易读)，但评分仅${readabilityScore}分（建议≥12分）`)
  }
  if (flesch < 50 && readabilityScore > 12) {
    warnings.push(`⚠️ Flesch分数${flesch}分(难读)，但评分${readabilityScore}分较高`)
  }

  return warnings
}

/**
 * 置信度聚合
 */
function aggregateConfidence(
  aiResult: AIAnalysisResult,
  conflicts: ValidatedSEOScore['conflicts'],
  warnings: string[]
): ValidatedSEOScore['confidence'] {
  // 基础置信度（AI自己报告的）
  const baseConfidence = aiResult.confidence

  // 冲突惩罚：每个冲突降低5分
  const conflictPenalty = conflicts.length * 5

  // 警告惩罚：每个警告降低3分
  const warningPenalty = warnings.length * 3

  // 总体置信度
  const overall = Math.max(0, Math.min(100, baseConfidence - conflictPenalty - warningPenalty))

  // 各维度置信度（简化：基于是否有冲突）
  const getDimensionConfidence = (dimension: string) => {
    const hasConflict = conflicts.some(c => c.dimension === dimension)
    return hasConflict ? Math.max(60, baseConfidence - 20) : Math.min(95, baseConfidence + 5)
  }

  return {
    overall,
    meta_quality: getDimensionConfidence('meta_quality'),
    content_quality: getDimensionConfidence('content_quality'),
    keyword_optimization: getDimensionConfidence('keyword_optimization'),
    readability: getDimensionConfidence('readability'),
    ux: getDimensionConfidence('ux')
  }
}

/**
 * 自动修正明显错误
 */
function autoCorrectErrors(
  facts: SEOFacts,
  aiResult: AIAnalysisResult,
  conflicts: ValidatedSEOScore['conflicts']
): {
  total_score: number
  dimension_scores: AIAnalysisResult['dimension_scores']
} {
  const correctedScores = { ...aiResult.dimension_scores }

  // 应用自动解决的冲突修正
  conflicts.forEach(conflict => {
    if (conflict.auto_resolved) {
      const dimension = conflict.dimension as keyof typeof correctedScores
      correctedScores[dimension] = conflict.algorithm_suggests
    }
  })

  // 强制上限
  correctedScores.meta_quality = Math.min(correctedScores.meta_quality, 20)
  correctedScores.content_quality = Math.min(correctedScores.content_quality, 30)
  correctedScores.keyword_optimization = Math.min(correctedScores.keyword_optimization, 20)
  correctedScores.readability = Math.min(correctedScores.readability, 20)
  correctedScores.ux = Math.min(correctedScores.ux, 10)

  // 重新计算总分
  const total_score = Math.min(100,
    correctedScores.meta_quality +
    correctedScores.content_quality +
    correctedScores.keyword_optimization +
    correctedScores.readability +
    correctedScores.ux
  )

  return {
    total_score,
    dimension_scores: correctedScores
  }
}

/**
 * 判断是否需要人工复核
 */
function shouldRequireManualReview(
  confidence: ValidatedSEOScore['confidence'],
  conflicts: ValidatedSEOScore['conflicts'],
  warnings: string[]
): boolean {
  // 1. 总体置信度低于70%
  if (confidence.overall < 70) return true

  // 2. 有未自动解决的high置信度冲突
  const unresolvedHighConflicts = conflicts.filter(c => !c.auto_resolved && c.confidence === 'high')
  if (unresolvedHighConflicts.length > 0) return true

  // 3. 警告数量超过3个
  if (warnings.length > 3) return true

  // 4. 任何维度置信度低于60%
  if (Object.values(confidence).some(c => c < 60)) return true

  return false
}
