/**
 * 测试 JSON Schema 和健壮JSON解析器
 *
 * 运行方式:
 * npx tsx scripts/test-json-schema.ts
 */

import { robustJSONParse, robustJSONParseWithValidation } from '../src/utils/robustJSONParser'
import { SEO_SCORE_JSON_SCHEMA } from '../src/schemas/seoScoreSchema'

// 测试用例集合
const testCases = [
  {
    name: '纯JSON对象',
    input: '{"overall_score":85,"dimension_scores":{"meta_quality":25,"keyword_optimization":20,"content_quality":22,"readability":18,"ux":18},"actionable_recommendations":["建议1","建议2"]}',
    shouldPass: true
  },
  {
    name: '带中文说明的JSON',
    input: '我已经完成了深度的SEO分析，结果如下:\n{"overall_score":85,"dimension_scores":{"meta_quality":25,"keyword_optimization":20,"content_quality":22,"readability":18,"ux":18},"actionable_recommendations":["建议1","建议2"]}',
    shouldPass: true
  },
  {
    name: 'Markdown代码块包裹的JSON',
    input: '```json\n{"overall_score":85,"dimension_scores":{"meta_quality":25,"keyword_optimization":20,"content_quality":22,"readability":18,"ux":18},"actionable_recommendations":["建议1","建议2"]}\n```',
    shouldPass: true
  },
  {
    name: 'Claude CLI JSON包装格式',
    input: '{"type":"result","result":"{\\"overall_score\\":85,\\"dimension_scores\\":{\\"meta_quality\\":25,\\"keyword_optimization\\":20,\\"content_quality\\":22,\\"readability\\":18,\\"ux\\":18},\\"actionable_recommendations\\":[\\"建议1\\",\\"建议2\\"]}"}',
    shouldPass: true
  },
  {
    name: '带Markdown标题的JSON',
    input: '## ✅ SEO评分完成\n\n{"overall_score":85,"dimension_scores":{"meta_quality":25,"keyword_optimization":20,"content_quality":22,"readability":18,"ux":18},"actionable_recommendations":["建议1","建议2"]}',
    shouldPass: true
  },
  {
    name: '使用别名字段 total_score (应该通过)',
    input: '{"total_score":85,"dimension_scores":{"meta_quality":25,"keyword_optimization":20,"content_quality":22,"readability":18,"ux":18},"actionable_recommendations":["建议1","建议2"]}',
    shouldPass: true
  },
  {
    name: '使用别名字段 recommendations (应该通过)',
    input: '{"overall_score":85,"dimension_scores":{"meta_quality":25,"keyword_optimization":20,"content_quality":22,"readability":18,"ux":18},"recommendations":["建议1","建议2"]}',
    shouldPass: true
  },
  {
    name: '缺少必填字段 (应该失败)',
    input: '{"overall_score":85}',
    shouldPass: false
  }
]

console.log('🧪 开始测试 JSON Schema 和健壮JSON解析器\n')
console.log('=' .repeat(80))

let passCount = 0
let failCount = 0

for (const testCase of testCases) {
  console.log(`\n📝 测试用例: ${testCase.name}`)
  console.log(`   输入长度: ${testCase.input.length} 字符`)
  console.log(`   输入预览: ${testCase.input.substring(0, 100)}...`)

  try {
    // 测试1: robustJSONParse (基础解析)
    const parsed = robustJSONParse(testCase.input, {
      logPrefix: `[${testCase.name}]`,
      verbose: false
    })

    console.log(`   ✅ robustJSONParse 成功`)
    console.log(`   解析结果字段:`, Object.keys(parsed))

    // 测试2: robustJSONParseWithValidation (带schema验证)
    const validated = robustJSONParseWithValidation(
      testCase.input,
      ['overall_score', 'dimension_scores', 'actionable_recommendations'],
      {
        logPrefix: `[${testCase.name}]`,
        verbose: false
      }
    )

    console.log(`   ✅ robustJSONParseWithValidation 成功`)

    // 验证dimension_scores的子字段
    if (validated.dimension_scores) {
      const dimensionKeys = Object.keys(validated.dimension_scores)
      console.log(`   维度分数字段:`, dimensionKeys)

      const expectedDimensions = ['meta_quality', 'keyword_optimization', 'content_quality', 'readability', 'ux']
      const missingDimensions = expectedDimensions.filter(d => !dimensionKeys.includes(d))

      if (missingDimensions.length > 0) {
        console.log(`   ⚠️  缺少维度字段: ${missingDimensions.join(', ')}`)
      }
    }

    if (testCase.shouldPass) {
      console.log(`   ✅ 测试通过 (预期: 通过)`)
      passCount++
    } else {
      console.log(`   ❌ 测试失败 (预期: 失败, 实际: 通过)`)
      failCount++
    }
  } catch (error) {
    console.log(`   ❌ 解析失败: ${(error as Error).message}`)

    if (!testCase.shouldPass) {
      console.log(`   ✅ 测试通过 (预期: 失败)`)
      passCount++
    } else {
      console.log(`   ❌ 测试失败 (预期: 通过, 实际: 失败)`)
      failCount++
    }
  }
}

console.log('\n' + '='.repeat(80))
console.log(`\n📊 测试总结:`)
console.log(`   ✅ 通过: ${passCount}/${testCases.length}`)
console.log(`   ❌ 失败: ${failCount}/${testCases.length}`)

if (failCount === 0) {
  console.log('\n🎉 所有测试通过!')
} else {
  console.log('\n⚠️  有测试失败，请检查')
  process.exit(1)
}

// 额外测试: 打印JSON Schema信息
console.log('\n' + '='.repeat(80))
console.log('\n📋 JSON Schema 信息:')
console.log(`   Schema名称: ${SEO_SCORE_JSON_SCHEMA.name}`)
console.log(`   Strict模式: ${SEO_SCORE_JSON_SCHEMA.strict}`)
console.log(`   必填字段:`, SEO_SCORE_JSON_SCHEMA.schema.required)
console.log(`   维度分数字段:`, SEO_SCORE_JSON_SCHEMA.schema.properties.dimension_scores.properties
  ? Object.keys(SEO_SCORE_JSON_SCHEMA.schema.properties.dimension_scores.properties)
  : []
)

console.log('\n✅ 测试完成!\n')
