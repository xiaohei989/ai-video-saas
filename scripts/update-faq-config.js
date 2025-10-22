#!/usr/bin/env node
/**
 * 更新SEO内容模板的FAQ配置
 * 将FAQ数量限制为3-5条（符合方案B：固定精简策略）
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateFAQConfig() {
  console.log('📝 开始更新FAQ配置...\n')

  // 1. 更新 how-to 模板
  console.log('1️⃣ 更新 how-to 模板...')
  const { data: howTo, error: error1 } = await supabase
    .from('seo_content_templates')
    .select('structure_schema')
    .eq('slug', 'how-to')
    .single()

  if (error1) throw error1

  howTo.structure_schema.faq_config = {
    min_items: 3,
    max_items: 5,
    question_patterns: [
      "How long does it take to {keyword}?",
      "What is the best way to {keyword}?",
      "Can beginners {keyword}?",
      "What tools do I need to {keyword}?",
      "How much does it cost to {keyword}?"
    ],
    keyword_mentions_per_faq: "1-2"
  }

  await supabase
    .from('seo_content_templates')
    .update({ structure_schema: howTo.structure_schema })
    .eq('slug', 'how-to')

  console.log('   ✅ how-to: FAQ配置更新为 3-5 条')

  // 2. 更新 alternatives 模板
  console.log('2️⃣ 更新 alternatives 模板...')
  const { data: alternatives, error: error2 } = await supabase
    .from('seo_content_templates')
    .select('structure_schema')
    .eq('slug', 'alternatives')
    .single()

  if (error2) throw error2

  alternatives.structure_schema.faq_config = {
    min_items: 3,
    max_items: 5,
    question_patterns: [
      "What are the best alternatives to {keyword}?",
      "Is there a free alternative to {keyword}?",
      "Which {keyword} alternative is easiest to use?"
    ]
  }

  await supabase
    .from('seo_content_templates')
    .update({ structure_schema: alternatives.structure_schema })
    .eq('slug', 'alternatives')

  console.log('   ✅ alternatives: FAQ配置更新为 3-5 条')

  // 3. 更新 platform-specific 模板
  console.log('3️⃣ 更新 platform-specific 模板...')
  const { data: platformSpec, error: error3 } = await supabase
    .from('seo_content_templates')
    .select('structure_schema')
    .eq('slug', 'platform-specific')
    .single()

  if (error3) throw error3

  platformSpec.structure_schema.faq_config = {
    min_items: 3,
    max_items: 5,
    question_patterns: [
      "What is the best format for {keyword} on {Platform}?",
      "How long should {keyword} be for {Platform}?",
      "Can I use {keyword} on {Platform}?"
    ]
  }

  await supabase
    .from('seo_content_templates')
    .update({ structure_schema: platformSpec.structure_schema })
    .eq('slug', 'platform-specific')

  console.log('   ✅ platform-specific: FAQ配置更新为 3-5 条')

  // 4. 验证更新
  console.log('\n📊 验证更新结果...')
  const { data: templates } = await supabase
    .from('seo_content_templates')
    .select('slug, recommended_word_count, structure_schema')
    .order('slug')

  console.log('\n当前配置:')
  templates.forEach(t => {
    const faq = t.structure_schema.faq_config
    console.log(`  ${t.slug}:`)
    console.log(`    推荐字数: ${t.recommended_word_count}`)
    console.log(`    FAQ数量: ${faq.min_items}-${faq.max_items} 条`)
  })

  console.log('\n✅ 所有FAQ配置已更新为 3-5 条！')
  console.log('\n📈 方案B（固定精简策略）已实施：')
  console.log('   - guide_content: 1,600词左右')
  console.log('   - FAQ: 3-5条（约400词）')
  console.log('   - 总计: 约2,000-2,400词')
}

updateFAQConfig().catch(console.error)
