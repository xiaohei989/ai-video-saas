/**
 * 测试AI评分更新逻辑
 * 验证AI评分不会被基础评分覆盖
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取环境变量
config({ path: join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testScoreUpdate() {
  console.log('🧪 开始测试AI评分更新逻辑...\n')

  try {
    // 1. 获取最新的一条记录
    const { data: guides, error: queryError } = await supabase
      .from('template_seo_guides')
      .select('id, primary_keyword, seo_score, content_quality_score, keyword_optimization_score, readability_score, performance_score')
      .order('created_at', { ascending: false })
      .limit(1)

    if (queryError) throw queryError
    if (!guides || guides.length === 0) {
      console.log('❌ 没有找到任何SEO指南记录')
      return
    }

    const guide = guides[0]
    console.log('📋 找到测试记录:')
    console.log(`   ID: ${guide.id}`)
    console.log(`   关键词: ${guide.primary_keyword}`)
    console.log(`   当前总分: ${guide.seo_score || 0}`)
    console.log(`   内容质量: ${guide.content_quality_score || 0}`)
    console.log(`   关键词优化: ${guide.keyword_optimization_score || 0}`)
    console.log(`   可读性: ${guide.readability_score || 0}`)
    console.log(`   用户表现: ${guide.performance_score || 0}\n`)

    // 2. 模拟AI评分数据（假设AI给出了85分的高分）
    const aiScoreData = {
      seo_score: 85,
      content_quality_score: 35,
      keyword_optimization_score: 28,
      readability_score: 17,
      performance_score: 5,
      keyword_density: {
        'video template': 2.5,
        'video editing': 1.8
      },
      seo_recommendations: [
        'AI建议1: 增加更多内部链接',
        'AI建议2: 优化meta描述长度'
      ]
    }

    console.log('🤖 模拟AI评分数据:')
    console.log(`   总分: ${aiScoreData.seo_score}`)
    console.log(`   内容质量: ${aiScoreData.content_quality_score}`)
    console.log(`   关键词优化: ${aiScoreData.keyword_optimization_score}`)
    console.log(`   可读性: ${aiScoreData.readability_score}`)
    console.log(`   用户表现: ${aiScoreData.performance_score}\n`)

    // 3. 执行更新（带AI评分数据）
    console.log('📤 执行更新（模拟前端AI评分后的update调用）...')
    const { data: updated, error: updateError } = await supabase
      .from('template_seo_guides')
      .update(aiScoreData)
      .eq('id', guide.id)
      .select()

    if (updateError) throw updateError

    console.log('✅ 更新成功！\n')

    // 4. 重新查询验证结果
    const { data: verified, error: verifyError } = await supabase
      .from('template_seo_guides')
      .select('seo_score, content_quality_score, keyword_optimization_score, readability_score, performance_score')
      .eq('id', guide.id)
      .single()

    if (verifyError) throw verifyError

    console.log('🔍 验证最终结果:')
    console.log(`   总分: ${verified.seo_score}`)
    console.log(`   内容质量: ${verified.content_quality_score}`)
    console.log(`   关键词优化: ${verified.keyword_optimization_score}`)
    console.log(`   可读性: ${verified.readability_score}`)
    console.log(`   用户表现: ${verified.performance_score}\n`)

    // 5. 判断测试结果
    if (verified.seo_score === aiScoreData.seo_score &&
        verified.content_quality_score === aiScoreData.content_quality_score) {
      console.log('✅✅✅ 测试通过！AI评分数据已正确保存，没有被覆盖！')
    } else {
      console.log('❌❌❌ 测试失败！评分数据被修改了：')
      console.log(`   预期总分: ${aiScoreData.seo_score}，实际: ${verified.seo_score}`)
      console.log(`   预期内容质量: ${aiScoreData.content_quality_score}，实际: ${verified.content_quality_score}`)
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
testScoreUpdate()
  .then(() => {
    console.log('\n✅ 测试完成!')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ 错误:', error)
    process.exit(1)
  })
