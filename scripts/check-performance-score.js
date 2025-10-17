#!/usr/bin/env node
/**
 * 检查performance_score是否正确映射
 */

const testMapping = () => {
  // 模拟AI返回的数据
  const aiResponse = {
    overall_score: 92,
    dimension_scores: {
      meta_info_quality: 28,
      keyword_optimization: 22,
      content_quality: 25,  // ← 这个应该映射到 performance_score
      readability: 17
    },
    suggestions: []
  }

  console.log('🔍 测试维度映射\n')
  console.log('AI返回的数据:')
  console.log(JSON.stringify(aiResponse, null, 2))

  // 应用映射逻辑 (复制自seo-server.js)
  const scoreResult = aiResponse
  let contentQualityScore = 0
  let keywordOptimizationScore = 0
  let readabilityScore = 0
  let performanceScore = 0

  if (scoreResult.dimension_scores) {
    contentQualityScore = scoreResult.dimension_scores.meta_info_quality || 0
    keywordOptimizationScore = scoreResult.dimension_scores.keyword_optimization || 0
    performanceScore = scoreResult.dimension_scores.content_quality || 0  // ← 映射
    readabilityScore = scoreResult.dimension_scores.readability || 0
  }

  console.log('\n映射后的结果:')
  console.log({
    content_quality_score: contentQualityScore,  // Meta信息
    keyword_optimization_score: keywordOptimizationScore,
    performance_score: performanceScore,  // 内容质量
    readability_score: readabilityScore
  })

  console.log('\n✅ 验证:')
  console.log(`  - Meta信息质量 (content_quality_score): ${contentQualityScore}/30 ${contentQualityScore === 28 ? '✓' : '✗'}`)
  console.log(`  - 关键词优化 (keyword_optimization_score): ${keywordOptimizationScore}/25 ${keywordOptimizationScore === 22 ? '✓' : '✗'}`)
  console.log(`  - 内容质量 (performance_score): ${performanceScore}/25 ${performanceScore === 25 ? '✓' : '✗'}`)
  console.log(`  - 可读性 (readability_score): ${readabilityScore}/20 ${readabilityScore === 17 ? '✓' : '✗'}`)

  if (performanceScore === 25) {
    console.log('\n🎉 映射逻辑正确!')
  } else {
    console.log('\n❌ 映射逻辑有问题!')
  }
}

testMapping()
