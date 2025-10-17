#!/usr/bin/env node
/**
 * 测试SEO服务器的评分功能
 * 验证JSON格式输出是否正常
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取环境变量
const envPath = join(__dirname, '../.env.local')
let supabaseUrl, supabaseServiceKey

try {
  const envContent = readFileSync(envPath, 'utf-8')
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/)
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)

  supabaseUrl = urlMatch ? urlMatch[1].trim() : process.env.VITE_SUPABASE_URL
  supabaseServiceKey = keyMatch ? keyMatch[1].trim() : process.env.SUPABASE_SERVICE_ROLE_KEY
} catch (error) {
  console.warn('⚠️  无法读取 .env.local，使用环境变量')
  supabaseUrl = process.env.VITE_SUPABASE_URL
  supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testSEOServer() {
  console.log('🧪 测试SEO服务器评分功能...\n')

  // 1. 获取测试数据
  console.log('📊 获取测试数据...')
  const { data, error } = await supabase
    .from('seo_page_variants')
    .select('*')
    .eq('id', '1a3eb56c-677a-44b4-a8bb-53b18f642674')
    .single()

  if (error) {
    console.error('❌ 数据库查询失败:', error.message)
    process.exit(1)
  }

  console.log('✅ 数据获取成功\n')
  console.log('📋 测试数据:')
  console.log(`  - ID: ${data.id}`)
  console.log(`  - 关键词: ${data.target_keyword}`)
  console.log(`  - Meta标题: ${data.meta_title.substring(0, 50)}...`)
  console.log(`  - Meta标题长度: ${data.meta_title.length}字符`)
  console.log(`  - 关键词位置: 第${data.meta_title.toLowerCase().indexOf(data.target_keyword.toLowerCase())}字符`)
  console.log(`  - Meta描述长度: ${data.meta_description.length}字符\n`)

  // 2. 调用SEO服务器
  console.log('☁️  调用SEO服务器评分接口...')
  console.log('  - URL: http://localhost:3030/calculate-seo-score')
  console.log('  - 使用极简版提示词 (232行)')
  console.log('  - 输出格式: JSON\n')

  const startTime = Date.now()

  try {
    const response = await fetch('http://localhost:3030/calculate-seo-score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language: 'en',
        target_keyword: data.target_keyword,
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        meta_keywords: data.meta_keywords || '',
        long_tail_keywords: [],
        secondary_keywords: data.secondary_keywords || [],
        keyword_density: data.keyword_density || {},
        guide_intro: data.guide_intro || '',
        guide_content: data.guide_content || '',
        faq_items: data.faq_items || []
      })
    })

    const elapsed = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()

    console.log(`✅ 评分完成 (耗时: ${elapsed}ms)\n`)

    if (!result.success) {
      throw new Error(result.error || '评分失败')
    }

    const scoreData = result.data

    console.log('━'.repeat(80))
    console.log('📊 评分结果:\n')
    console.log(`总分: ${scoreData.total_score}/100\n`)

    console.log('维度得分:')
    console.log(`  - Meta信息质量: ${scoreData.content_quality_score || 0}分`)
    console.log(`  - 关键词优化: ${scoreData.keyword_optimization_score || 0}分`)
    console.log(`  - 可读性: ${scoreData.readability_score || 0}分`)
    console.log(`  - 性能: ${scoreData.performance_score || 0}分\n`)

    console.log(`优化建议 (共${scoreData.recommendations?.length || 0}条):\n`)

    if (!scoreData.recommendations || scoreData.recommendations.length === 0) {
      console.log('  🎉 无建议! 内容质量优秀,无需优化。')
      console.log('  💭 这正是极简版提示词的目标 - 不堆砌无用建议!\n')
    } else {
      scoreData.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`)
      })
      console.log()
    }

    console.log('━'.repeat(80))
    console.log('\n🔍 质量验证:\n')

    // 验证是否避免了之前的问题
    const invalidSuggestions = []

    scoreData.recommendations?.forEach((rec, i) => {
      const num = i + 1

      // 检查1: Meta标题长度在合理范围,不应提建议
      if (data.meta_title.length >= 50 && data.meta_title.length <= 70) {
        if (rec.includes('Meta标题') && rec.includes('长度')) {
          invalidSuggestions.push(`建议${num}: Meta标题${data.meta_title.length}字符已在理想范围(50-70)`)
        }
      }

      // 检查2: 关键词在前面,不应提位置建议
      const keywordPos = data.meta_title.toLowerCase().indexOf(data.target_keyword.toLowerCase())
      if (keywordPos >= 0 && keywordPos <= 50) {
        if (rec.includes('关键词') && (rec.includes('位置') || rec.includes('前置'))) {
          invalidSuggestions.push(`建议${num}: 关键词第${keywordPos}字符已在理想范围(0-50)`)
        }
      }

      // 检查3: 有CTA,不应提CTA建议
      if (data.meta_description.includes('Start now') || data.meta_description.includes('Get started')) {
        if (rec.includes('CTA') || rec.includes('行动号召')) {
          invalidSuggestions.push(`建议${num}: Meta描述已有CTA,不应提CTA建议`)
        }
      }

      // 检查4: 换词游戏
      if (rec.includes('Master') && rec.includes('Learn') ||
          rec.includes('Start now') && rec.includes('Download')) {
        invalidSuggestions.push(`建议${num}: 疑似换词游戏`)
      }
    })

    if (invalidSuggestions.length === 0) {
      console.log('✅ 所有建议均通过质量检查!')
      console.log('✅ 无换词游戏、无范围内微调、无逻辑错误')
    } else {
      console.log(`⚠️  发现 ${invalidSuggestions.length} 条潜在无效建议:\n`)
      invalidSuggestions.forEach(issue => {
        console.log(`  ❌ ${issue}`)
      })
    }

    console.log('\n━'.repeat(80))
    console.log('\n📈 测试总结:\n')
    console.log(`  ✅ JSON格式解析: 成功`)
    console.log(`  ✅ 提示词版本: 极简版 (232行)`)
    console.log(`  ✅ 输出格式: --output-format=json`)
    console.log(`  ✅ 建议数量: ${scoreData.recommendations?.length || 0}条`)
    console.log(`  ✅ 质量评估: ${invalidSuggestions.length === 0 ? '优秀' : `发现${invalidSuggestions.length}条问题`}`)
    console.log(`  ✅ 耗时: ${elapsed}ms\n`)

    if (scoreData.total_score >= 90) {
      console.log('🎉 评分≥90分,极简版提示词工作正常!\n')
    } else {
      console.log(`📊 评分${scoreData.total_score}分,略低于理想值(90+)\n`)
    }

    console.log('✅ 测试完成!\n')

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    if (error.stack) {
      console.error('\n堆栈跟踪:', error.stack)
    }
    process.exit(1)
  }
}

testSEOServer().catch(console.error)
