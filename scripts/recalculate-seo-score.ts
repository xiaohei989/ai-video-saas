/**
 * 重新计算 SEO 指南的 AI 智能评分
 * 使用 Claude CLI 进行深度 SEO 分析
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { calculateSEOScore, type SEOGuideData } from '../src/services/seoScoreCalculator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取环境变量
config({ path: join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 重新计算单个指南的评分
 */
async function recalculateScore(guideId: string) {
  console.log(`\n🤖 开始 AI 智能评分: ${guideId}`)
  console.log('━'.repeat(60))

  try {
    // 1. 获取指南数据
    const { data: guide, error: fetchError } = await supabase
      .from('template_seo_guides')
      .select('*')
      .eq('id', guideId)
      .single()

    if (fetchError || !guide) {
      console.error('❌ 获取指南失败:', fetchError)
      return { success: false, error: fetchError }
    }

    console.log('📄 指南信息:', {
      template_id: guide.template_id,
      language: guide.language,
      primary_keyword: guide.primary_keyword,
      content_length: (guide.guide_content || '').length,
      long_tail_count: (guide.long_tail_keywords || []).length
    })

    // 2. 准备数据
    const seoGuideData: SEOGuideData = {
      meta_title: guide.meta_title,
      meta_description: guide.meta_description,
      meta_keywords: guide.meta_keywords,
      guide_content: guide.guide_content,
      guide_intro: guide.guide_intro,
      primary_keyword: guide.primary_keyword,
      long_tail_keywords: guide.long_tail_keywords,
      secondary_keywords: guide.secondary_keywords,
      faq_items: guide.faq_items,
      page_views: guide.page_views || 0,
      avg_time_on_page: guide.avg_time_on_page || 0,
      bounce_rate: guide.bounce_rate || 0,
      conversion_rate: guide.conversion_rate || 0
    }

    // 3. 调用 AI 评分（可能需要 30-60 秒）
    console.log('\n🧠 调用 Claude AI 进行深度分析...')
    console.log('⏱️  预计耗时: 30-60 秒')

    const startTime = Date.now()
    const scoreResult = await calculateSEOScore(seoGuideData)
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(`\n✅ AI 评分完成 (耗时: ${duration}s)`)
    console.log('━'.repeat(60))
    console.log('📊 评分结果:')
    console.log(`   总分: ${scoreResult.total_score}/100`)
    console.log(`   内容质量: ${scoreResult.content_quality_score}/40`)
    console.log(`   关键词优化: ${scoreResult.keyword_optimization_score}/30`)
    console.log(`   可读性: ${scoreResult.readability_score}/20`)
    console.log(`   用户表现: ${scoreResult.performance_score}/10`)

    if (Object.keys(scoreResult.keyword_density).length > 0) {
      console.log('\n🔍 关键词密度:')
      Object.entries(scoreResult.keyword_density).forEach(([keyword, density]) => {
        console.log(`   ${keyword}: ${density}%`)
      })
    }

    if (scoreResult.recommendations.length > 0) {
      console.log(`\n💡 优化建议 (${scoreResult.recommendations.length}条):`)
      scoreResult.recommendations.slice(0, 5).forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`)
      })
      if (scoreResult.recommendations.length > 5) {
        console.log(`   ... 还有 ${scoreResult.recommendations.length - 5} 条建议`)
      }
    }

    // 4. 更新数据库
    console.log('\n💾 保存评分结果到数据库...')

    const { data: updated, error: updateError } = await supabase
      .from('template_seo_guides')
      .update({
        seo_score: scoreResult.total_score,
        content_quality_score: scoreResult.content_quality_score,
        keyword_optimization_score: scoreResult.keyword_optimization_score,
        readability_score: scoreResult.readability_score,
        performance_score: scoreResult.performance_score,
        keyword_density: scoreResult.keyword_density,
        seo_recommendations: scoreResult.recommendations,
        updated_at: new Date().toISOString()
      })
      .eq('id', guideId)
      .select()

    if (updateError) {
      console.error('❌ 更新失败:', updateError)
      return { success: false, error: updateError }
    }

    console.log('✅ 评分已保存!')
    console.log('━'.repeat(60))

    return { success: true, score: scoreResult.total_score, updated }
  } catch (error) {
    console.error('\n❌ 评分失败:', error)
    return { success: false, error }
  }
}

/**
 * 批量重新计算评分
 */
async function recalculateAllScores() {
  console.log('\n🚀 开始批量 AI 智能评分')
  console.log('━'.repeat(60))

  // 获取所有指南
  const { data: guides, error } = await supabase
    .from('template_seo_guides')
    .select('id, template_id, language, primary_keyword')
    .order('created_at', { ascending: false })

  if (error || !guides) {
    console.error('❌ 获取指南列表失败:', error)
    return
  }

  console.log(`📋 找到 ${guides.length} 个指南需要评分\n`)

  const results = {
    success: 0,
    failed: 0,
    total: guides.length
  }

  // 逐个评分（避免并发调用 Claude CLI）
  for (let i = 0; i < guides.length; i++) {
    const guide = guides[i]
    console.log(`\n[${i + 1}/${guides.length}] ${guide.id}`)

    const result = await recalculateScore(guide.id)

    if (result.success) {
      results.success++
      console.log(`✅ 成功 (${result.score}分)`)
    } else {
      results.failed++
      console.log('❌ 失败')
    }

    // 每次评分后等待 2 秒，避免 API 限流
    if (i < guides.length - 1) {
      console.log('\n⏸️  等待 2 秒...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log('\n' + '━'.repeat(60))
  console.log('📊 批量评分完成:')
  console.log(`   总数: ${results.total}`)
  console.log(`   成功: ${results.success}`)
  console.log(`   失败: ${results.failed}`)
  console.log('━'.repeat(60) + '\n')
}

// 运行
const guideId = process.argv[2]

if (guideId === 'all') {
  // 批量评分
  recalculateAllScores()
    .then(() => {
      console.log('✅ 所有任务完成!')
      process.exit(0)
    })
    .catch(err => {
      console.error('❌ 错误:', err)
      process.exit(1)
    })
} else if (guideId) {
  // 单个评分
  recalculateScore(guideId)
    .then((result) => {
      if (result.success) {
        console.log('\n✅ 评分完成!')
        process.exit(0)
      } else {
        console.log('\n❌ 评分失败')
        process.exit(1)
      }
    })
    .catch(err => {
      console.error('❌ 错误:', err)
      process.exit(1)
    })
} else {
  console.log(`
📖 使用方法:

  # 单个指南评分
  npm run seo:score <guide-id>

  # 批量评分所有指南
  npm run seo:score all

  # 示例
  npm run seo:score 3d1d6b71-7904-4b18-8852-d52e862e1082
  npm run seo:score all
  `)
  process.exit(0)
}
