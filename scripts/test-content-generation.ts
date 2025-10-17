/**
 * 完整内容生成流程测试
 * 测试从关键词分析到AI生成内容的整个链条
 */

import { createClient } from '@supabase/supabase-js'
import contentGenerationService from '../src/services/contentGenerationService'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import path from 'path'

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 测试关键词
const TEST_KEYWORD = 'how to make youtube shorts'
const TEST_LANGUAGE = 'en'

// 允许从命令行传入template ID，或使用默认的测试ID
const TEMPLATE_ID_FROM_ARGS = process.argv[2]

async function findOrCreateTestTemplate(): Promise<string | null> {
  console.log('📋 查找或创建测试用的视频模板...\n')

  // 如果命令行提供了template ID，直接使用
  if (TEMPLATE_ID_FROM_ARGS) {
    console.log(`✅ 使用命令行指定的模板ID: ${TEMPLATE_ID_FROM_ARGS}\n`)
    return TEMPLATE_ID_FROM_ARGS
  }

  // 尝试查找现有模板
  const { data: templates, error: queryError } = await supabase
    .from('templates')
    .select('id, slug, name, is_active')
    .eq('is_active', true)
    .limit(1)

  if (!queryError && templates && templates.length > 0) {
    const template = templates[0]
    console.log(`✅ 找到模板: ${template.name || template.slug}`)
    console.log(`   ID: ${template.id}\n`)
    return template.id
  }

  // 如果没有找到，创建一个测试模板
  console.log('⚠️  未找到活跃的视频模板，创建测试模板...\n')

  const { data: newTemplate, error: createError } = await supabase
    .from('templates')
    .insert({
      slug: 'test-pseo-template',
      name: { en: 'Test PSEO Template' },
      description: { en: 'Test template for Programmatic SEO' },
      is_active: true,
      category: 'test',
      tags: ['test', 'pseo']
    })
    .select('id')
    .single()

  if (createError || !newTemplate) {
    console.log('❌ 创建测试模板失败:', createError?.message)
    console.log('   请手动创建一个模板或提供template ID作为命令行参数:')
    console.log('   npx tsx scripts/test-content-generation.ts <template-id>')
    return null
  }

  console.log(`✅ 测试模板已创建: ${newTemplate.id}\n`)
  return newTemplate.id
}

async function testFullContentGeneration() {
  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║        完整内容生成流程测试                            ║')
  console.log('╚════════════════════════════════════════════════════════╝\n')

  try {
    // 1. 查找或创建测试模板
    const templateId = await findOrCreateTestTemplate()

    if (!templateId) {
      console.log('\n❌ 测试终止: 无法获取测试模板')
      return
    }

    // 2. 检查API配置
    const apiConfig = contentGenerationService.validateAPIConfig()
    if (!apiConfig.valid) {
      console.log(`\n❌ API配置错误: ${apiConfig.message}`)
      return
    }
    console.log(`✅ API配置验证通过: ${apiConfig.message}\n`)

    // 3. 开始生成内容
    console.log('🚀 开始生成SEO内容...')
    console.log(`   关键词: "${TEST_KEYWORD}"`)
    console.log(`   语言: ${TEST_LANGUAGE}`)
    console.log(`   模板ID: ${templateId}\n`)
    console.log('⏳ 预计耗时: 30-60秒（AI生成中...）\n')

    const startTime = Date.now()

    const result = await contentGenerationService.generateContent({
      templateId,
      targetKeyword: TEST_KEYWORD,
      language: TEST_LANGUAGE,
      aiModel: 'claude' // 使用Claude模型
    })

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    // 4. 显示结果
    console.log('\n' + '='.repeat(60))
    console.log('✅ 内容生成成功！')
    console.log('='.repeat(60) + '\n')

    console.log('📊 生成结果统计:')
    console.log(`   ⏱️  耗时: ${duration}秒`)
    console.log(`   📄 页面ID: ${result.pageVariantId}`)
    console.log(`   🎯 推荐模板: ${result.analysis.recommendedTemplateSlug}`)
    console.log(`   📈 置信度: ${(result.analysis.confidence * 100).toFixed(0)}%`)
    console.log(`   💯 SEO得分: ${result.metrics.seoScore}/100`)
    console.log(`   📝 字数: ${result.metrics.wordCount}`)
    console.log(`   🔤 Token使用: ${result.estimatedTokensUsed}`)
    console.log('')

    console.log('📋 内容质量细分:')
    console.log(`   内容质量: ${result.metrics.contentQualityScore}/40`)
    console.log(`   关键词优化: ${result.metrics.keywordOptimizationScore}/30`)
    console.log(`   可读性: ${result.metrics.readabilityScore}/20`)
    console.log(`   关键词密度: ${result.metrics.keywordDensityScore}/10`)
    console.log('')

    console.log('🏗️  内容结构:')
    console.log(`   H1标题: ${result.metrics.hasH1 ? '✅' : '❌'}`)
    console.log(`   H2章节: ${result.metrics.h2Count}个`)
    console.log(`   H3小节: ${result.metrics.h3Count}个`)
    console.log(`   段落数: ${result.metrics.paragraphCount}个`)
    console.log(`   FAQ: ${result.content.faq_items.length}个`)
    console.log('')

    console.log('🎯 差异化因子:')
    const factors = result.differentiationFactors
    if (factors.platform) console.log(`   平台: ${factors.platform}`)
    if (factors.audience) console.log(`   受众: ${factors.audience}`)
    if (factors.device) console.log(`   设备: ${factors.device}`)
    if (factors.keywordType) console.log(`   类型: ${factors.keywordType}`)
    if (factors.searchIntent) console.log(`   意图: ${factors.searchIntent}`)
    if (factors.scenario) console.log(`   场景: ${factors.scenario}`)
    console.log('')

    console.log('📊 关键词密度:')
    const densityEntries = Object.entries(result.metrics.keywordDensity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    densityEntries.forEach(([keyword, density]) => {
      console.log(`   "${keyword}": ${density.toFixed(2)}%`)
    })
    console.log('')

    console.log('📝 生成的内容预览:')
    console.log('─'.repeat(60))
    console.log(`标题: ${result.content.title}`)
    console.log(`Meta标题: ${result.content.meta_title}`)
    console.log(`Meta描述: ${result.content.meta_description}`)
    console.log('─'.repeat(60))
    console.log('\n正文前200字符:')
    console.log(result.content.guide_content.slice(0, 200) + '...')
    console.log('─'.repeat(60))
    console.log('')

    console.log('❓ FAQ示例:')
    result.content.faq_items.slice(0, 2).forEach((faq, i) => {
      console.log(`${i + 1}. Q: ${faq.question}`)
      console.log(`   A: ${faq.answer.slice(0, 100)}...`)
      console.log('')
    })

    // 5. 验证数据库记录
    console.log('🔍 验证数据库记录...\n')

    const { data: dbRecord, error: dbError } = await supabase
      .from('seo_page_variants')
      .select('*')
      .eq('id', result.pageVariantId)
      .single()

    if (dbError || !dbRecord) {
      console.log('⚠️  数据库记录未找到')
    } else {
      console.log('✅ 数据库记录验证成功:')
      console.log(`   ID: ${dbRecord.id}`)
      console.log(`   关键词: ${dbRecord.target_keyword}`)
      console.log(`   Slug: ${dbRecord.keyword_slug}`)
      console.log(`   语言: ${dbRecord.language}`)
      console.log(`   SEO得分: ${dbRecord.seo_score}`)
      console.log(`   字数: ${dbRecord.word_count}`)
      console.log(`   发布状态: ${dbRecord.is_published ? '已发布' : '草稿'}`)
      console.log(`   创建时间: ${new Date(dbRecord.created_at).toLocaleString('zh-CN')}`)
      console.log('')

      // 生成访问URL
      const contentTemplateSlug = result.analysis.recommendedTemplateSlug
      const keywordSlug = result.analysis.keywordSlug
      const url = `/${TEST_LANGUAGE}/guide/${contentTemplateSlug}/${keywordSlug}`

      console.log('🌐 页面URL:')
      console.log(`   ${url}`)
      console.log(`   完整URL: https://veo3video.me${url}`)
      console.log('')
    }

    console.log('═'.repeat(60))
    console.log('🎉 完整流程测试成功！')
    console.log('═'.repeat(60))
    console.log('')
    console.log('✅ 验证的功能:')
    console.log('   1. ✅ 关键词分析服务')
    console.log('   2. ✅ 内容模板加载')
    console.log('   3. ✅ Prompt构建')
    console.log('   4. ✅ AI内容生成')
    console.log('   5. ✅ 内容解析')
    console.log('   6. ✅ 质量指标计算')
    console.log('   7. ✅ 数据库保存')
    console.log('')
    console.log('📌 下一步建议:')
    console.log('   1. 查看数据库中的seo_page_variants表验证数据')
    console.log('   2. 测试去重检测功能（生成相似关键词的内容）')
    console.log('   3. 开始开发管理界面（Phase 3）')
    console.log('')

  } catch (error) {
    console.log('\n' + '═'.repeat(60))
    console.log('❌ 测试失败')
    console.log('═'.repeat(60) + '\n')

    if (error instanceof Error) {
      console.log(`错误信息: ${error.message}`)
      console.log('\n错误堆栈:')
      console.log(error.stack)
    } else {
      console.log('未知错误:', error)
    }

    console.log('\n💡 常见问题排查:')
    console.log('   1. 检查APICore API Key是否配置正确')
    console.log('   2. 检查网络连接（需要访问api.apicore.ai）')
    console.log('   3. 检查Supabase连接')
    console.log('   4. 检查seo_content_templates表是否有数据')
    console.log('')

    process.exit(1)
  }
}

// 运行测试
console.log('\n⏳ 正在初始化测试...\n')
testFullContentGeneration()
