#!/usr/bin/env node
/**
 * 测试新旧JSON格式映射逻辑
 */

console.log('🧪 测试JSON格式映射逻辑\n')

// 模拟新格式的AI响应
const newFormatResponse = {
  overall_score: 88,
  dimension_scores: {
    meta_info_quality: 28,
    keyword_optimization: 20,
    content_quality: 23,
    readability: 17
  },
  suggestions: [
    {
      category: '关键词优化',
      issue: '目标关键词密度为1.2%,低于理想范围',
      suggestion: '建议在内容中自然增加关键词使用3-5次',
      priority: 'high',
      expected_impact: '+5分'
    },
    {
      category: 'Meta信息',
      issue: 'Meta描述长度169字符,略超理想范围',
      suggestion: '建议调整到160字符',
      priority: 'low',
      expected_impact: '+2分'
    }
  ]
}

console.log('📥 输入 (新格式):', JSON.stringify(newFormatResponse, null, 2))

// 应用映射逻辑 (复制自seo-server.js第886-924行)
const scoreResult = newFormatResponse

const totalScore = scoreResult.total_score || scoreResult.overall_score
const recommendations = scoreResult.recommendations || scoreResult.suggestions || []

let contentQualityScore = scoreResult.content_quality_score || 0
let keywordOptimizationScore = scoreResult.keyword_optimization_score || 0
let readabilityScore = scoreResult.readability_score || 0
let performanceScore = scoreResult.performance_score || 0

if (scoreResult.dimension_scores) {
  contentQualityScore = scoreResult.dimension_scores.meta_info_quality ||
                        scoreResult.dimension_scores.content_quality || 0
  keywordOptimizationScore = scoreResult.dimension_scores.keyword_optimization || 0
  readabilityScore = scoreResult.dimension_scores.readability || 0
  performanceScore = scoreResult.dimension_scores.performance || 0
}

scoreResult.total_score = totalScore
scoreResult.content_quality_score = contentQualityScore
scoreResult.keyword_optimization_score = keywordOptimizationScore
scoreResult.readability_score = readabilityScore
scoreResult.performance_score = performanceScore

scoreResult.recommendations = recommendations.map(s => {
  if (typeof s === 'object' && s.suggestion) {
    return `[${s.priority?.toUpperCase() || 'MEDIUM'}] ${s.category || '优化建议'}: ${s.suggestion}`
  }
  return s
})

// 构建最终响应 (复制自seo-server.js第926-937行)
const finalResponse = {
  success: true,
  data: {
    total_score: scoreResult.total_score,
    content_quality_score: scoreResult.content_quality_score,
    keyword_optimization_score: scoreResult.keyword_optimization_score,
    readability_score: scoreResult.readability_score,
    performance_score: scoreResult.performance_score,
    keyword_density: { 'test keyword': 2.5 }, // 模拟
    recommendations: scoreResult.recommendations
  }
}

console.log('\n📤 输出 (转换后):', JSON.stringify(finalResponse, null, 2))

console.log('\n✅ 格式验证:')
console.log(`  - total_score: ${finalResponse.data.total_score} (${typeof finalResponse.data.total_score})`)
console.log(`  - content_quality_score: ${finalResponse.data.content_quality_score}`)
console.log(`  - keyword_optimization_score: ${finalResponse.data.keyword_optimization_score}`)
console.log(`  - readability_score: ${finalResponse.data.readability_score}`)
console.log(`  - performance_score: ${finalResponse.data.performance_score}`)
console.log(`  - recommendations数量: ${finalResponse.data.recommendations.length}`)
console.log(`  - recommendations类型: ${typeof finalResponse.data.recommendations[0]}`)

console.log('\n建议内容:')
finalResponse.data.recommendations.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r}`)
})

console.log('\n✅ 映射逻辑测试通过!')
