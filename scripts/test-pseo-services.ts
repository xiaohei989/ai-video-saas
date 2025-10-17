/**
 * Programmatic SEO服务测试脚本
 * 验证所有服务是否正常工作
 */

import { createClient } from '@supabase/supabase-js'
import keywordAnalysisService from '../src/services/keywordAnalysisService'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import path from 'path'

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testDatabaseTables() {
  console.log('\n=== 测试 1: 验证数据库表 ===\n')

  // 测试表是否存在
  const tables = [
    'seo_content_templates',
    'seo_page_variants',
    'seo_keywords',
    'seo_batch_jobs'
  ]

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`❌ 表 ${table}: 不存在或无权限`)
        console.error(`   错误: ${error.message}`)
      } else {
        console.log(`✅ 表 ${table}: 存在且可访问`)
      }
    } catch (e) {
      console.log(`❌ 表 ${table}: 查询失败`)
      console.error(`   错误: ${e}`)
    }
  }
}

async function testContentTemplates() {
  console.log('\n=== 测试 2: 验证内容模板数据 ===\n')

  const { data: templates, error } = await supabase
    .from('seo_content_templates')
    .select('id, name, slug, template_type, is_active, recommended_word_count')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.log('❌ 无法加载内容模板')
    console.error(`   错误: ${error.message}`)
    return
  }

  if (!templates || templates.length === 0) {
    console.log('⚠️  没有找到活跃的内容模板')
    return
  }

  console.log(`✅ 找到 ${templates.length} 个内容模板:\n`)

  templates.forEach((template, index) => {
    console.log(`${index + 1}. ${template.name}`)
    console.log(`   Slug: ${template.slug}`)
    console.log(`   类型: ${template.template_type}`)
    console.log(`   推荐字数: ${template.recommended_word_count}`)
    console.log(`   ID: ${template.id}\n`)
  })
}

async function testKeywordAnalysis() {
  console.log('\n=== 测试 3: 关键词分析服务 ===\n')

  const testKeywords = [
    'how to make youtube videos',
    'best alternatives to canva',
    'tiktok video editing tutorial',
    'instagram reels for business',
    'video editing for beginners'
  ]

  console.log(`测试 ${testKeywords.length} 个关键词:\n`)

  for (const keyword of testKeywords) {
    try {
      const result = keywordAnalysisService.analyzeKeyword(keyword)

      console.log(`📌 关键词: "${keyword}"`)
      console.log(`   推荐模板: ${result.recommendedTemplateSlug}`)
      console.log(`   置信度: ${(result.confidence * 100).toFixed(0)}%`)
      console.log(`   Slug: ${result.keywordSlug}`)
      console.log(`   差异化因子:`)
      if (result.differentiationFactors.platform) {
        console.log(`     - 平台: ${result.differentiationFactors.platform}`)
      }
      if (result.differentiationFactors.audience) {
        console.log(`     - 受众: ${result.differentiationFactors.audience}`)
      }
      if (result.differentiationFactors.keywordType) {
        console.log(`     - 类型: ${result.differentiationFactors.keywordType}`)
      }
      if (result.differentiationFactors.searchIntent) {
        console.log(`     - 意图: ${result.differentiationFactors.searchIntent}`)
      }
      console.log('')
    } catch (error) {
      console.log(`❌ 分析失败: ${keyword}`)
      console.error(`   错误: ${error}`)
    }
  }
}

async function testKeywordValidation() {
  console.log('\n=== 测试 4: 关键词验证 ===\n')

  const testCases = [
    { keyword: 'ab', shouldPass: false, reason: '太短' },
    { keyword: 'how to make videos', shouldPass: true, reason: '正常' },
    { keyword: '<script>alert(1)</script>', shouldPass: false, reason: '非法字符' },
    { keyword: '   ', shouldPass: false, reason: '纯空格' },
    { keyword: 'a'.repeat(250), shouldPass: false, reason: '太长' }
  ]

  for (const testCase of testCases) {
    const result = keywordAnalysisService.validateKeyword(testCase.keyword)

    const status = result.isValid === testCase.shouldPass ? '✅' : '❌'
    console.log(`${status} "${testCase.keyword.slice(0, 30)}..." - ${testCase.reason}`)
    if (!result.isValid) {
      console.log(`   原因: ${result.reason}`)
    }
  }
}

async function testSimilarityDetection() {
  console.log('\n=== 测试 5: 相似关键词检测 ===\n')

  const existingKeywords = [
    'how to make youtube videos',
    'best video editing software',
    'instagram reels tutorial'
  ]

  const testKeywords = [
    'how to make youtube videos', // 完全相同
    'how to create youtube videos', // 相似
    'dog training tips' // 完全不同
  ]

  for (const keyword of testKeywords) {
    const result = keywordAnalysisService.detectSimilarKeywords(
      keyword,
      existingKeywords
    )

    console.log(`📌 关键词: "${keyword}"`)
    if (result.hasSimilar) {
      console.log(`   ⚠️  发现相似关键词:`)
      result.similarKeywords.forEach((similar, index) => {
        const similarity = (result.similarity[index] * 100).toFixed(0)
        console.log(`     - "${similar}" (${similarity}% 相似)`)
      })
    } else {
      console.log(`   ✅ 无相似关键词`)
    }
    console.log('')
  }
}

async function testAPIConfig() {
  console.log('\n=== 测试 6: API配置检查 ===\n')

  console.log('Supabase配置:')
  console.log(`  URL: ${SUPABASE_URL}`)
  console.log(`  Anon Key: ${SUPABASE_ANON_KEY ? '已配置 ✅' : '未配置 ❌'}`)

  console.log('\nAPICore配置:')
  const apiCoreKey = process.env.VITE_APICORE_API_KEY || process.env.VITE_APICORE_SEO_API_KEY
  const apiCoreEndpoint = process.env.VITE_APICORE_ENDPOINT
  console.log(`  API Key: ${apiCoreKey ? '已配置 ✅' : '未配置 ❌'}`)
  console.log(`  Endpoint: ${apiCoreEndpoint || '使用默认'}`)
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║   Programmatic SEO 服务验证测试                        ║')
  console.log('╚════════════════════════════════════════════════════════╝')

  try {
    await testDatabaseTables()
    await testContentTemplates()
    await testKeywordAnalysis()
    await testKeywordValidation()
    await testSimilarityDetection()
    await testAPIConfig()

    console.log('\n' + '='.repeat(60))
    console.log('✅ 所有测试完成！')
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:')
    console.error(error)
    process.exit(1)
  }
}

// 运行测试
runAllTests()
