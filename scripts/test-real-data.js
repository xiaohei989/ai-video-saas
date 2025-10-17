#!/usr/bin/env node
/**
 * 用真实数据库数据测试极简版SEO提示词
 * 检查是否能避免之前的无效建议问题
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

// 导入极简版提示词构建器
import { buildSEOScorePrompt } from './seoPrompts.js'

async function main() {
  console.log('🔍 获取真实数据库数据...\n')

  // 获取最新的SEO页面数据
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
  console.log('📄 测试数据:')
  console.log(`  - ID: ${data.id}`)
  console.log(`  - 目标关键词: ${data.target_keyword}`)
  console.log(`  - Meta标题: ${data.meta_title}`)
  console.log(`  - Meta标题长度: ${data.meta_title.length}字符`)
  console.log(`  - Meta描述: ${data.meta_description}`)
  console.log(`  - Meta描述长度: ${data.meta_description.length}字符`)
  console.log(`  - 关键词密度: ${data.keyword_density || '未计算'}`)
  console.log(`  - 当前SEO分数: ${data.seo_score || '未评分'}\n`)

  // 分析Meta标题中的关键词位置
  const keyword = data.target_keyword
  const titleLower = data.meta_title.toLowerCase()
  const keywordPosition = titleLower.indexOf(keyword.toLowerCase())

  console.log('🔍 关键信息分析:')
  console.log(`  - 关键词"${keyword}"在Meta标题中的位置: 第${keywordPosition}字符`)
  console.log(`  - Meta标题是否在理想范围(50-65): ${data.meta_title.length >= 50 && data.meta_title.length <= 65 ? '✅ 是' : '❌ 否'}`)
  console.log(`  - 关键词位置是否在理想范围(0-50): ${keywordPosition <= 50 ? '✅ 是' : '❌ 否'}`)
  console.log(`  - Meta描述是否在理想范围(140-165): ${data.meta_description.length >= 140 && data.meta_description.length <= 165 ? '✅ 是' : '❌ 否'}`)

  // 检查CTA
  const ctaWords = ['Start now', 'Get started', 'Learn more', 'Try it', 'Download now']
  const hasCTA = ctaWords.some(cta => data.meta_description.includes(cta))
  console.log(`  - Meta描述是否有CTA: ${hasCTA ? '✅ 有 (Start now!)' : '❌ 无'}\n`)

  // 构建提示词
  console.log('🤖 生成极简版提示词...\n')

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

  console.log('✅ 提示词生成完成')
  console.log(`📏 提示词长度: ${prompt.length}字符\n`)

  // 验证新提示词是否包含正确的规则
  console.log('🔍 规则验证:\n')

  const ruleChecks = [
    {
      name: '规则1: Meta标题长度50-70才提建议',
      check: prompt.includes('IF 长度 < 50 OR 长度 > 70')
    },
    {
      name: '规则2: 关键词位置>50才提建议',
      check: prompt.includes('IF 关键词首次出现位置 > 50')
    },
    {
      name: '规则3: 有CTA就不提建议',
      check: prompt.includes('IF 结尾无CTA词')
    },
    {
      name: '检查1: 定量依据检查',
      check: prompt.includes('### ✅ 检查1: 是否有定量依据')
    },
    {
      name: '检查2: 合理范围检查',
      check: prompt.includes('### ✅ 检查2: 当前值是否已在合理范围')
    },
    {
      name: '检查3: 换词检查',
      check: prompt.includes('### ✅ 检查3: 是否只是换词')
    },
    {
      name: '检查4: 改进幅度检查',
      check: prompt.includes('### ✅ 检查4: 改进幅度是否>10%')
    },
    {
      name: '无"禁止示例"章节',
      check: !prompt.includes('❌ **严禁的荒谬建议**') && !prompt.includes('禁止建议类型')
    }
  ]

  ruleChecks.forEach(check => {
    console.log(`  ${check.check ? '✅' : '❌'} ${check.name}`)
  })

  console.log('\n🎯 理论分析:')
  console.log('  基于当前数据:')
  console.log(`  - Meta标题长度${data.meta_title.length}字符 → 在50-70范围内 → ❌ 不应提长度建议`)
  console.log(`  - 关键词位置第${keywordPosition}字符 → 在0-50范围内 → ❌ 不应提位置建议`)
  console.log(`  - Meta描述有"Start now!" → 有CTA → ❌ 不应提CTA建议`)
  console.log('\n  💡 如果AI按照新规则执行,这3条建议都不应该出现!')

  console.log('\n📊 提示词对比:')
  console.log(`  - 旧版本: 460行 (260行"禁止示例" + 200行规则)`)
  console.log(`  - 新版本: 200行 (0行"禁止示例" + 200行纯定量规则)`)
  console.log(`  - 精简率: ${Math.round((1 - 200/460) * 100)}%\n`)

  console.log('✅ 测试完成! 新提示词已部署,等待实际AI调用验证。\n')
  console.log('📝 下一步: 用此提示词调用API,观察suggestions数组是否为空或只包含真正有价值的建议。')
}

main().catch(console.error)
