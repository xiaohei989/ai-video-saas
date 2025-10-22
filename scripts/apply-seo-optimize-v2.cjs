#!/usr/bin/env node
/**
 * 应用 SEO Optimize v2.0 提示词更新
 * 直接使用Supabase Client执行SQL
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 错误: 缺少 SUPABASE_URL 或 SERVICE_KEY')
  process.exit(1)
}

console.log('✅ Supabase 配置加载成功')
console.log(`📡 URL: ${SUPABASE_URL}`)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  console.log('\n🚀 开始应用 SEO Optimize v2.0 提示词更新...\n')

  // 读取SQL文件
  const sqlFile = path.join(__dirname, '../supabase/migrations/038_update_seo_optimize_v2.sql')
  const sql = fs.readFileSync(sqlFile, 'utf8')

  // 提取 INSERT 语句中的数据
  console.log('📝 准备插入新版提示词模板...')

  const templateData = {
    name: 'seo-optimize',
    display_name: 'SEO内容一键优化 v2.0 - 密度平衡版',
    description: '解决关键词密度暴跌问题,平衡SEO优化与内容自然性。支持单主关键词场景,使用2025年语义SEO最佳实践。',
    category: 'seo',
    prompt_template: sql.match(/prompt_template,\s*E'([\s\S]*?)',\s*-- ==================== 提示词模板结束/)?.[1] || '',
    required_variables: [
      "languageName", "languageCode", "currentScore", "metaTitle",
      "metaTitleLength", "metaDescription", "metaDescriptionLength",
      "metaKeywords", "targetKeyword", "guideIntro", "guideIntroLength",
      "guideContent", "guideContentLength", "faqItems", "faqCount",
      "recommendations", "estimatedWordCount", "minTargetCount",
      "idealTargetCount", "maxTargetCount", "optimizationStrategy"
    ],
    optional_variables: [],
    expected_output_format: 'json',
    version: 2,
    is_active: true,
    created_by: 'system'
  }

  if (!templateData.prompt_template) {
    console.error('❌ 无法从SQL文件中提取提示词模板')
    process.exit(1)
  }

  console.log(`✅ 提示词模板长度: ${templateData.prompt_template.length} 字符`)
  console.log(`✅ 必需变量数量: ${templateData.required_variables.length} 个`)

  // 步骤1: 检查是否已存在 v2.0
  console.log('\n🔍 检查现有模板...')
  const { data: existing } = await supabase
    .from('ai_prompt_templates')
    .select('*')
    .eq('name', 'seo-optimize')
    .eq('version', 2)
    .single()

  if (existing) {
    console.log('⚠️  v2.0 已存在,将更新')

    const { error: updateError } = await supabase
      .from('ai_prompt_templates')
      .update({
        prompt_template: templateData.prompt_template,
        display_name: templateData.display_name,
        description: templateData.description,
        required_variables: templateData.required_variables,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('name', 'seo-optimize')
      .eq('version', 2)

    if (updateError) {
      console.error('❌ 更新失败:', updateError)
      process.exit(1)
    }

    console.log('✅ v2.0 更新成功')
  } else {
    console.log('📥 插入新版 v2.0...')

    const { error: insertError } = await supabase
      .from('ai_prompt_templates')
      .insert(templateData)

    if (insertError) {
      console.error('❌ 插入失败:', insertError)
      process.exit(1)
    }

    console.log('✅ v2.0 插入成功')
  }

  // 步骤2: 停用旧版本
  console.log('\n🔄 停用旧版本 (v1.0)...')
  const { error: deactivateError } = await supabase
    .from('ai_prompt_templates')
    .update({ is_active: false })
    .eq('name', 'seo-optimize')
    .lt('version', 2)

  if (deactivateError) {
    console.error('⚠️  停用旧版本失败:', deactivateError)
  } else {
    console.log('✅ 旧版本已停用')
  }

  // 步骤3: 验证结果
  console.log('\n📊 验证更新结果...')
  const { data: templates, error: queryError } = await supabase
    .from('ai_prompt_templates')
    .select('name, version, display_name, is_active, updated_at')
    .eq('name', 'seo-optimize')
    .order('version', { ascending: false })

  if (queryError) {
    console.error('❌ 查询失败:', queryError)
    process.exit(1)
  }

  console.log('\n当前 seo-optimize 模板状态:')
  console.table(templates)

  console.log('\n✅ SEO Optimize v2.0 应用成功!')
  console.log('\n核心改进:')
  console.log('  1. ✅ 增加精确的关键词密度目标计算')
  console.log('  2. ✅ 提供基于当前密度的差异化优化策略')
  console.log('  3. ✅ 强化语义SEO(使用同义词和相关术语)')
  console.log('  4. ✅ 添加自我验证清单')
  console.log('  5. ✅ 平衡关键词优化和内容自然性')
  console.log('\n预期效果:')
  console.log('  - 关键词密度稳定在 1.5-2.5%')
  console.log('  - 不会再出现密度暴跌问题')
  console.log('  - 语义丰富度提升(使用变体和相关术语)')
  console.log('  - 内容仍然自然流畅\n')
}

main().catch(error => {
  console.error('❌ 执行失败:', error)
  process.exit(1)
})
