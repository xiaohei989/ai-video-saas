#!/usr/bin/env node
/**
 * 从数据库验证关键词密度统计
 * 直接读取数据库中的SEO guide数据并验证密度计算
 */

import { createClient } from '@supabase/supabase-js'

// Supabase配置
const SUPABASE_URL = 'https://hvkzwrnvxsleeonqqrzq.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'

// 创建Supabase客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * 精确计算关键词密度
 */
function calculateKeywordDensity(content, keywords) {
  if (!content || keywords.length === 0) {
    return {}
  }

  // 1. 文本预处理
  const normalizedContent = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  // 2. 分词
  const words = normalizedContent.split(/[\s\p{P}]+/u).filter(w => w.length > 0)
  const totalWords = words.length

  console.log(`📝 总词数: ${totalWords}`)

  if (totalWords === 0) {
    return {}
  }

  const density = {}

  // 3. 计数每个关键词
  keywords.forEach(keyword => {
    const normalizedKeyword = keyword.toLowerCase().trim()
    const keywordWords = normalizedKeyword.split(/\s+/)

    let count = 0

    if (keywordWords.length === 1) {
      // 单词关键词
      count = words.filter(w => w === keywordWords[0]).length
    } else {
      // 多词关键词：滑动窗口
      for (let i = 0; i <= words.length - keywordWords.length; i++) {
        const match = keywordWords.every((kw, idx) => words[i + idx] === kw)
        if (match) {
          count++
        }
      }
    }

    const densityValue = (count / totalWords) * 100
    density[keyword] = {
      count: count,
      density: parseFloat(densityValue.toFixed(1))
    }
  })

  return density
}

/**
 * 从SEOGuideData提取完整内容
 */
function extractFullContent(data) {
  const parts = []

  // Meta信息
  if (data.meta_title) parts.push(data.meta_title)
  if (data.meta_description) parts.push(data.meta_description)
  if (data.meta_keywords) parts.push(data.meta_keywords)

  // 主要内容
  if (data.guide_intro) parts.push(data.guide_intro)
  if (data.guide_content) parts.push(data.guide_content)

  // FAQ
  if (data.faq_items && data.faq_items.length > 0) {
    data.faq_items.forEach(item => {
      parts.push(item.question)
      parts.push(item.answer)
    })
  }

  return parts.join('\n\n')
}

/**
 * 主函数
 */
async function main() {
  const recordId = process.argv[2]

  if (!recordId) {
    console.error('❌ 请提供记录ID')
    console.log('使用方法: node verify-db-density.js <record_id>')
    console.log('示例: node verify-db-density.js 31391a1e-5a9a-4184-8082-0e5168746193')
    process.exit(1)
  }

  console.log('🔍 开始从数据库验证关键词密度统计...\n')
  console.log(`📋 记录ID: ${recordId}\n`)

  try {
    // 1. 从数据库读取数据
    console.log('📥 正在从数据库读取数据...')
    const { data: record, error } = await supabase
      .from('template_seo_guides')
      .select('*')
      .eq('id', recordId)
      .single()

    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`)
    }

    if (!record) {
      throw new Error('未找到记录')
    }

    console.log('✅ 数据读取成功\n')

    // 2. 显示基本信息
    console.log('📊 记录信息：')
    console.log(`   模板ID: ${record.template_id}`)
    console.log(`   语言: ${record.language}`)
    console.log(`   主关键词: ${record.primary_keyword}`)
    console.log(`   长尾关键词数: ${record.long_tail_keywords?.length || 0}`)
    console.log(`   次要关键词数: ${record.secondary_keywords?.length || 0}`)
    console.log(`   SEO评分: ${record.seo_score}/100`)
    console.log('')

    // 3. 提取完整内容
    console.log('📄 内容统计：')
    const fullContent = extractFullContent(record)
    console.log(`   内容总长度: ${fullContent.length} 字符`)
    console.log(`   Meta标题: ${record.meta_title?.length || 0} 字符`)
    console.log(`   引言: ${record.guide_intro?.length || 0} 字符`)
    console.log(`   正文: ${record.guide_content?.length || 0} 字符`)
    console.log(`   FAQ: ${record.faq_items?.length || 0} 个问题`)
    console.log('')

    // 4. 获取所有关键词
    const allKeywords = [
      ...(record.primary_keyword ? [record.primary_keyword] : []),
      ...(record.long_tail_keywords || []),
      ...(record.secondary_keywords || [])
    ].filter(Boolean)

    console.log(`🔑 关键词总数: ${allKeywords.length}\n`)

    // 5. 计算密度
    console.log('🔄 正在计算密度...\n')
    const calculated = calculateKeywordDensity(fullContent, allKeywords)

    // 6. 获取数据库中保存的密度
    const displayed = record.keyword_density || {}

    // 7. 对比验证
    console.log('📊 验证结果：\n')

    let matchCount = 0
    let mismatchCount = 0
    const mismatches = []

    allKeywords.forEach(keyword => {
      const calc = calculated[keyword]?.density || 0
      const disp = displayed[keyword] || 0
      const calcCount = calculated[keyword]?.count || 0
      const diff = Math.abs(calc - disp)

      const status = diff < 0.01 ? '✅' : '❌'

      console.log(`${status} ${keyword}`)
      console.log(`   计算: ${calc.toFixed(2)}% (出现${calcCount}次)`)
      console.log(`   显示: ${disp.toFixed(2)}%`)
      console.log(`   差异: ${diff.toFixed(2)}%`)
      console.log('')

      if (diff < 0.01) {
        matchCount++
      } else {
        mismatchCount++
        mismatches.push({
          keyword,
          calculated: calc,
          displayed: disp,
          count: calcCount,
          diff: diff
        })
      }
    })

    // 8. 汇总统计
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📈 统计汇总：')
    console.log(`   ✅ 匹配: ${matchCount}/${allKeywords.length}`)
    console.log(`   ❌ 不匹配: ${mismatchCount}/${allKeywords.length}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (mismatchCount > 0) {
      console.log(`⚠️  发现 ${mismatchCount} 个差异较大的关键词：\n`)
      mismatches.forEach(m => {
        console.log(`❌ ${m.keyword}`)
        console.log(`   计算: ${m.calculated.toFixed(2)}% (${m.count}次)`)
        console.log(`   显示: ${m.displayed.toFixed(2)}%`)
        console.log(`   差异: ${m.diff.toFixed(2)}%`)
        console.log('')
      })

      console.log('🔧 可能的原因：')
      console.log('1. 内容在评分后被手动修改过')
      console.log('2. 使用了不同版本的密度计算算法')
      console.log('3. 数据库中的 keyword_density 字段未更新')
      console.log('')
      console.log('💡 建议：点击"AI智能评分"按钮重新评分以更新密度数据')
    } else {
      console.log('🎉 所有关键词密度统计完全准确！')
      console.log('✅ 数据库中保存的密度与实际计算结果一致')
    }

    // 9. 密度分析
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 密度分布分析：')

    const ideal = allKeywords.filter(k => {
      const d = calculated[k]?.density || 0
      return d >= 1.0 && d <= 2.5
    }).length

    const low = allKeywords.filter(k => {
      const d = calculated[k]?.density || 0
      return d < 1.0
    }).length

    const high = allKeywords.filter(k => {
      const d = calculated[k]?.density || 0
      return d > 2.5
    }).length

    console.log(`   ✅ 理想范围 (1.0%-2.5%): ${ideal}/${allKeywords.length}`)
    console.log(`   ⚠️  过低 (<1.0%): ${low}/${allKeywords.length}`)
    console.log(`   ⚠️  过高 (>2.5%): ${high}/${allKeywords.length}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (low > 0) {
      console.log('💡 建议：使用"优化关键词密度"功能提升密度过低的关键词')
    }

  } catch (error) {
    console.error('❌ 验证失败:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main()
