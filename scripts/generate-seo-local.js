#!/usr/bin/env node
/**
 * 本地 SEO 内容生成脚本
 * 通过 Claude Code CLI 生成 SEO 优化的用户指南内容
 *
 * 使用方法:
 * node scripts/generate-seo-local.js <template_id> <primary_keyword> <language> [long_tail_keywords...]
 *
 * 示例:
 * node scripts/generate-seo-local.js template-001 "ASMR Food Videos" en "asmr food" "food asmr" "asmr cooking"
 */

import { spawn } from 'child_process'
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 配置缺失')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 语言名称映射
const LANGUAGE_NAMES = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  ar: 'العربية'
}

/**
 * 调用 Claude Code CLI
 */
async function callClaudeCLI(prompt) {
  return new Promise((resolve, reject) => {
    console.log('🤖 调用 Claude Code CLI...')

    const claude = spawn('claude', ['-p', prompt], {
      stdio: ['inherit', 'pipe', 'pipe']
    })

    let output = ''
    let errorOutput = ''

    claude.stdout.on('data', (data) => {
      output += data.toString()
    })

    claude.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    claude.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI 退出码: ${code}\nError: ${errorOutput}`))
      } else {
        resolve(output)
      }
    })

    claude.on('error', (error) => {
      reject(new Error(`无法启动 Claude CLI: ${error.message}\n请确保已安装 Claude Code CLI`))
    })
  })
}

/**
 * 构建 SEO 生成提示词（精简版）
 */
function buildPrompt(template, primaryKeyword, longTailKeywords, language) {
  const languageName = LANGUAGE_NAMES[language] || 'English'

  // 解析模板名称
  let templateName = template.name
  if (typeof templateName === 'object') {
    templateName = templateName[language] || templateName['en'] || Object.values(templateName)[0]
  }

  const prompt = `Create SEO-optimized guide for video template "${templateName}".
Keywords: ${primaryKeyword}, ${longTailKeywords.join(', ')}
Language: ${languageName}

Return ONLY valid JSON:
{
  "meta_title": "SEO title 55-60 chars with keyword",
  "meta_description": "Description 150-155 chars",
  "meta_keywords": "keyword1, keyword2, keyword3",
  "guide_intro": "Intro paragraph 100-150 words",
  "guide_content": "Full Markdown guide 1500-2000 words with sections: Introduction, Key Features, How to Use (5-8 steps), Best Practices, Troubleshooting, Creative Ideas, Conclusion",
  "faq_items": [{"question": "Q1", "answer": "A1"}, {"question": "Q2", "answer": "A2"}, {"question": "Q3", "answer": "A3"}, {"question": "Q4", "answer": "A4"}, {"question": "Q5", "answer": "A5"}],
  "secondary_keywords": ["keyword1", "keyword2", "keyword3"]
}

Write in ${languageName}. Focus on educational, actionable content with natural keyword integration.`

  return prompt
}

/**
 * 解析 Claude 输出的 JSON
 */
function parseClaudeOutput(output) {
  // 提取 JSON 内容
  const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/) ||
                   output.match(/```\n([\s\S]*?)\n```/) ||
                   [null, output]

  let jsonContent = jsonMatch[1] || output
  jsonContent = jsonContent.trim()

  // 移除可能的 markdown 代码块标记
  jsonContent = jsonContent.replace(/^```json?\n?/, '').replace(/\n?```$/, '')

  try {
    return JSON.parse(jsonContent)
  } catch (error) {
    console.error('❌ JSON 解析失败:', error.message)
    console.error('原始输出:', output.substring(0, 500))
    throw new Error('无法解析 Claude 输出的 JSON')
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.error('❌ 参数不足')
    console.log('使用方法: node scripts/generate-seo-local.js <template_id> <primary_keyword> <language> [long_tail_keywords...]')
    console.log('示例: node scripts/generate-seo-local.js template-001 "ASMR Food Videos" en "asmr food" "food asmr"')
    process.exit(1)
  }

  const [templateId, primaryKeyword, language, ...longTailKeywords] = args

  console.log('📝 SEO 内容生成开始...')
  console.log(`- 模板ID: ${templateId}`)
  console.log(`- 主关键词: ${primaryKeyword}`)
  console.log(`- 语言: ${language}`)
  console.log(`- 长尾关键词: ${longTailKeywords.join(', ')}`)

  try {
    // 1. 获取模板信息
    console.log('\n📚 获取模板信息...')
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      throw new Error(`模板不存在: ${templateId}`)
    }

    console.log(`✅ 模板: ${JSON.stringify(template.name)}`)

    // 2. 构建提示词
    const prompt = buildPrompt(template, primaryKeyword, longTailKeywords, language)

    // 3. 调用 Claude CLI
    const output = await callClaudeCLI(prompt)

    console.log('✅ Claude 响应成功')

    // 4. 解析输出
    console.log('\n🔍 解析 JSON 内容...')
    const generatedContent = parseClaudeOutput(output)

    console.log('✅ JSON 解析成功')
    console.log(`- Meta Title: ${generatedContent.meta_title}`)
    console.log(`- FAQ 数量: ${generatedContent.faq_items?.length || 0}`)
    console.log(`- 内容长度: ${generatedContent.guide_content?.length || 0} 字符`)

    // 5. 保存到数据库
    console.log('\n💾 保存到数据库...')
    const { data: seoGuide, error: insertError } = await supabase
      .from('template_seo_guides')
      .insert({
        template_id: templateId,
        language: language,
        primary_keyword: primaryKeyword,
        long_tail_keywords: longTailKeywords,
        meta_title: generatedContent.meta_title,
        meta_description: generatedContent.meta_description,
        meta_keywords: generatedContent.meta_keywords,
        guide_intro: generatedContent.guide_intro,
        guide_content: generatedContent.guide_content,
        faq_items: generatedContent.faq_items,
        secondary_keywords: generatedContent.secondary_keywords,
        generated_by: 'local-cli',
        ai_model: 'claude-sonnet-4-5',
        is_published: false
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`保存失败: ${insertError.message}`)
    }

    console.log('✅ 保存成功!')
    console.log(`📄 SEO Guide ID: ${seoGuide.id}`)
    console.log('\n🎉 SEO 内容生成完成！')

    return seoGuide

  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    process.exit(1)
  }
}

// 运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export default main
