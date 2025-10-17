#!/usr/bin/env node
/**
 * 真实API调用测试 - 验证极简版提示词的实际效果
 * 使用数据库中的真实数据调用AI API,观察返回的suggestions质量
 */

import { createClient } from '@supabase/supabase-js'
import { buildSEOScorePrompt } from './seoPrompts.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取环境变量
const envPath = join(__dirname, '../.env.local')
let supabaseUrl, supabaseServiceKey, apiKey

try {
  const envContent = readFileSync(envPath, 'utf-8')
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/)
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)
  const apiMatch = envContent.match(/VITE_APICORE_SEO_API_KEY=(.+)/)

  supabaseUrl = urlMatch ? urlMatch[1].trim() : process.env.VITE_SUPABASE_URL
  supabaseServiceKey = keyMatch ? keyMatch[1].trim() : process.env.SUPABASE_SERVICE_ROLE_KEY
  apiKey = apiMatch ? apiMatch[1].trim() : process.env.VITE_APICORE_SEO_API_KEY
} catch (error) {
  console.warn('⚠️  无法读取 .env.local，使用环境变量')
  supabaseUrl = process.env.VITE_SUPABASE_URL
  supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  apiKey = process.env.VITE_APICORE_KEY
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function callAIAPI(prompt) {
  const response = await fetch('https://api.apicore.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'claude-3-7-sonnet-20250219',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API调用失败: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

function parseJSON(text) {
  // 尝试提取JSON (可能包含在```json```代码块中)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    throw new Error('无法从响应中提取JSON')
  }

  return JSON.parse(jsonMatch[1] || jsonMatch[0])
}

async function main() {
  console.log('🚀 开始真实API调用测试...\n')

  // 获取测试数据
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
  console.log('📋 测试数据概况:')
  console.log(`  - 目标关键词: "${data.target_keyword}"`)
  console.log(`  - Meta标题: "${data.meta_title}" (${data.meta_title.length}字符)`)
  console.log(`  - Meta描述: "${data.meta_description.substring(0, 80)}..." (${data.meta_description.length}字符)`)

  // 分析关键词位置
  const keywordPos = data.meta_title.toLowerCase().indexOf(data.target_keyword.toLowerCase())
  console.log(`  - 关键词位置: 第${keywordPos}字符`)
  console.log(`  - CTA检查: ${data.meta_description.includes('Start now') ? '✅ 有 (Start now!)' : '❌ 无'}\n`)

  // 构建提示词
  console.log('🤖 使用极简版提示词构建prompt...')
  const prompt = buildSEOScorePrompt({
    languageName: 'English',
    languageCode: 'en',
    targetKeyword: data.target_keyword,
    metaTitle: data.meta_title,
    metaDescription: data.meta_description,
    metaKeywords: data.meta_keywords || '',
    longTailKeywords: [],
    secondaryKeywords: data.secondary_keywords || [],
    keywordDensity: data.keyword_density || {},
    guideIntro: data.guide_intro || '',
    guideContent: data.guide_content || '',
    faqItems: data.faq_items || []
  })

  console.log(`✅ Prompt生成完成 (${prompt.length}字符)\n`)

  // 调用AI API
  console.log('☁️  调用AI API...')
  console.log('  - 模型: claude-3-7-sonnet-20250219')
  console.log('  - Temperature: 0.3')
  console.log('  - Max tokens: 4000\n')

  const startTime = Date.now()

  try {
    const response = await callAIAPI(prompt)
    const elapsed = Date.now() - startTime

    console.log(`✅ API调用成功 (耗时: ${elapsed}ms)\n`)

    // 解析响应
    console.log('📄 解析AI响应...')
    const result = parseJSON(response)

    console.log('✅ JSON解析成功\n')
    console.log('━'.repeat(80))
    console.log('📊 AI评分结果:\n')
    console.log(`总分: ${result.overall_score}/100\n`)

    console.log('维度得分:')
    Object.entries(result.dimension_scores || {}).forEach(([key, score]) => {
      console.log(`  - ${key}: ${score}分`)
    })

    console.log('\n' + '━'.repeat(80))
    console.log(`\n💡 优化建议 (共${result.suggestions?.length || 0}条):\n`)

    // 声明在外层作用域
    let invalidSuggestions = []

    if (!result.suggestions || result.suggestions.length === 0) {
      console.log('  🎉 无建议! AI认为当前内容质量已经很好,不需要优化。')
      console.log('  💭 这正是我们期望的结果 - 不堆砌无用建议!\n')
    } else {
      result.suggestions.forEach((suggestion, i) => {
        console.log(`${i + 1}. [${suggestion.priority?.toUpperCase()}] ${suggestion.category}`)
        console.log(`   问题: ${suggestion.issue}`)
        console.log(`   建议: ${suggestion.suggestion}`)
        console.log(`   预期影响: ${suggestion.expected_impact}\n`)
      })

      // 分析建议质量
      console.log('━'.repeat(80))
      console.log('🔍 建议质量分析:\n')

      invalidSuggestions = [] // 重置数组

      result.suggestions.forEach((s, i) => {
        const num = i + 1

        // 检查1: 是否有定量依据
        const hasNumbers = /\d+/.test(s.issue) || /\d+/.test(s.suggestion)
        if (!hasNumbers) {
          invalidSuggestions.push(`建议${num}: 缺少定量依据(无具体数字)`)
        }

        // 检查2: 是否是换词游戏
        if (s.suggestion.includes('Master') && s.suggestion.includes('Learn') ||
            s.suggestion.includes('Start now') && s.suggestion.includes('Download')) {
          invalidSuggestions.push(`建议${num}: 疑似换词游戏`)
        }

        // 检查3: Meta标题相关 - 检查是否已在合理范围
        if (s.category.includes('Meta') && s.category.includes('标题')) {
          if (data.meta_title.length >= 50 && data.meta_title.length <= 70) {
            if (s.issue.includes('长度')) {
              invalidSuggestions.push(`建议${num}: Meta标题${data.meta_title.length}字符已在理想范围(50-70),不应提长度建议`)
            }
          }
          if (keywordPos >= 0 && keywordPos <= 50) {
            if (s.issue.includes('位置') || s.suggestion.includes('前置')) {
              invalidSuggestions.push(`建议${num}: 关键词第${keywordPos}字符已在理想范围(0-50),不应提位置建议`)
            }
          }
        }

        // 检查4: CTA相关
        if (s.issue.includes('CTA') || s.issue.includes('行动号召')) {
          if (data.meta_description.includes('Start now') ||
              data.meta_description.includes('Get started') ||
              data.meta_description.includes('Learn more')) {
            invalidSuggestions.push(`建议${num}: Meta描述已有CTA("Start now!"),不应提CTA建议`)
          }
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
    }

    console.log('\n' + '━'.repeat(80))
    console.log('\n📈 测试总结:\n')
    console.log(`  旧版提示词: 471行 (260行禁止示例)`)
    console.log(`  新版提示词: 232行 (0行禁止示例)`)
    console.log(`  建议数量: ${result.suggestions?.length || 0}条`)
    console.log(`  质量评估: ${(invalidSuggestions && invalidSuggestions.length === 0) ? '✅ 优秀' : `⚠️ 发现${invalidSuggestions?.length || 0}条问题`}`)

    console.log('\n✅ 测试完成!\n')

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    if (error.stack) {
      console.error('\n堆栈跟踪:', error.stack)
    }
    process.exit(1)
  }
}

main().catch(console.error)
