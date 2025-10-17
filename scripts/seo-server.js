#!/usr/bin/env node
/**
 * 本地 SEO 生成服务器
 * 提供 HTTP API 接口，让浏览器能够调用本地 Claude Code CLI 生成 SEO 内容
 *
 * 启动方法:
 * node scripts/seo-server.js
 * 或
 * npm run seo:server
 *
 * 服务器将运行在 http://localhost:3030
 */

import { createServer } from 'http'
import { spawn } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildSEOScorePrompt } from './seoPrompts.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = 3030

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
 * 精确计算关键词密度 - 使用确定性算法（JavaScript版本）
 * @param {string} content - 要分析的文本内容
 * @param {string[]} keywords - 关键词列表
 * @returns {Object} 每个关键词的密度（百分比，保留1位小数）
 */
function calculateKeywordDensity(content, keywords) {
  if (!content || keywords.length === 0) {
    return {}
  }

  // 1. 文本预处理：转小写、移除多余空白
  const normalizedContent = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  // 2. 简单分词（按空格和标点符号分割）
  const words = normalizedContent.split(/[\s\p{P}]+/u).filter(w => w.length > 0)
  const totalWords = words.length

  if (totalWords === 0) {
    return {}
  }

  const density = {}

  // 3. 对每个关键词进行精确匹配计数
  keywords.forEach(keyword => {
    const normalizedKeyword = keyword.toLowerCase().trim()
    const keywordWords = normalizedKeyword.split(/\s+/)

    let count = 0

    // 滑动窗口匹配多词关键词
    if (keywordWords.length === 1) {
      // 单词关键词：直接计数
      count = words.filter(w => w === keywordWords[0]).length
    } else {
      // 多词关键词：使用滑动窗口
      for (let i = 0; i <= words.length - keywordWords.length; i++) {
        const match = keywordWords.every((kw, idx) => words[i + idx] === kw)
        if (match) {
          count++
        }
      }
    }

    // 4. 计算密度百分比（保留1位小数）
    const densityValue = (count / totalWords) * 100
    density[keyword] = parseFloat(densityValue.toFixed(1))
  })

  return density
}

/**
 * 从请求数据中提取完整文本内容
 * @param {Object} data - 请求数据对象
 * @returns {string} 完整文本内容
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
 * 调用 Claude Code CLI
 * @param {string} prompt - 提示词
 * @param {number} timeout - 超时时间（毫秒），默认180000（3分钟）
 */
async function callClaudeCLI(prompt, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const timeoutMinutes = Math.round(timeout / 60000)
    console.log(`🤖 调用 Claude Code CLI（超时：${timeoutMinutes}分钟）...`)

    // 使用 --output-format json 强制JSON输出 (必须配合-p使用)
    const claude = spawn('claude', ['-p', '--output-format=json', prompt], {
      stdio: ['inherit', 'pipe', 'pipe']
    })

    let output = ''
    let errorOutput = ''
    let lastOutputTime = Date.now()

    // 超时检测
    const timeoutCheck = setInterval(() => {
      const now = Date.now()
      if (now - lastOutputTime > timeout) {
        clearInterval(timeoutCheck)
        claude.kill()
        reject(new Error(`Claude CLI 超时（${timeoutMinutes}分钟无响应）`))
      }
    }, 10000) // 每10秒检查一次

    claude.stdout.on('data', (data) => {
      output += data.toString()
      lastOutputTime = Date.now()
      // 实时输出进度
      process.stdout.write('.')
    })

    claude.stderr.on('data', (data) => {
      errorOutput += data.toString()
      lastOutputTime = Date.now()
    })

    claude.on('close', (code) => {
      clearInterval(timeoutCheck)
      console.log('') // 换行
      if (code !== 0) {
        reject(new Error(`Claude CLI 退出码: ${code}\nError: ${errorOutput}`))
      } else {
        resolve(output)
      }
    })

    claude.on('error', (error) => {
      clearInterval(timeoutCheck)
      reject(new Error(`无法启动 Claude CLI: ${error.message}\n请确保已安装 Claude Code CLI`))
    })
  })
}

/**
 * 构建 SEO 生成提示词（精简版）
 */
function buildPrompt(template, targetKeyword, longTailKeywords, language) {
  const languageName = LANGUAGE_NAMES[language] || 'English'

  // 解析模板名称
  let templateName = template.name
  if (typeof templateName === 'object') {
    templateName = templateName[language] || templateName['en'] || Object.values(templateName)[0]
  }

  const prompt = `⚠️ CRITICAL: You MUST return ONLY valid JSON. NO explanations, NO text before or after!

Create SEO-optimized guide for video template "${templateName}".
Keywords: ${targetKeyword}, ${longTailKeywords.join(', ')}
Target Language: ${languageName}

⚠️ CRITICAL LANGUAGE REQUIREMENT:
- ALL content MUST be written ENTIRELY in ${languageName}
- DO NOT mix any other languages (including English, Chinese, etc.)
- Even if keywords are in English, integrate them naturally into ${languageName} text
- Meta information, guide content, and FAQ must all be in ${languageName}
- Use proper ${languageName} grammar, vocabulary, and expressions
- If ${languageName} is not English, avoid English words unless they are commonly used technical terms

⚠️ OUTPUT REQUIREMENT: Return ONLY this JSON structure, nothing else:
{
  "meta_title": "SEO title (55-60 chars, in ${languageName})",
  "meta_description": "Description 150-155 chars (in ${languageName})",
  "meta_keywords": "keyword1, keyword2, keyword3 (in ${languageName})",
  "guide_intro": "Intro paragraph 100-150 words (in ${languageName})",
  "guide_content": "Full Markdown guide 1500-2000 words with sections: Introduction, Key Features, How to Use (5-8 steps), Best Practices, Troubleshooting, Creative Ideas, Conclusion (ALL in ${languageName})",
  "faq_items": [{"question": "Q1 (in ${languageName})", "answer": "A1 (in ${languageName})"}, {"question": "Q2 (in ${languageName})", "answer": "A2 (in ${languageName})"}, {"question": "Q3 (in ${languageName})", "answer": "A3 (in ${languageName})"}, {"question": "Q4 (in ${languageName})", "answer": "A4 (in ${languageName})"}, {"question": "Q5 (in ${languageName})", "answer": "A5 (in ${languageName})"}],
  "secondary_keywords": ["keyword1", "keyword2", "keyword3 (in ${languageName})"]
}

⚠️ CRITICAL: Meta Title Requirements (MOST IMPORTANT!)

The **meta_title** is the MOST CRITICAL SEO element. You MUST create a professional, engaging title:

1. **Length**: Strictly 55-60 characters (Chinese ~25-30 chars, English ~55-60 chars)
2. **Keyword Position**: Primary keyword in first half (ideally first 10 characters)
3. **Attractive**: Must entice clicks and convey clear value proposition
4. **Professional**: Demonstrate expertise, avoid simple keyword stuffing
5. **Unique**: Stand out from competitors, highlight unique selling points

❌ BAD Examples (DO NOT DO THIS):
- "asmr food video" (too simple, no value)
- "best asmr food video template" (awkward, unnatural)
- "ASMR FOOD VIDEO - BEST TUTORIAL" (all caps, spam-like)

✅ GOOD Examples (DO THIS):
- "Create Relaxing ASMR Food Videos: Complete Tutorial & Tips"
- "ASMR美食视频制作指南：从入门到精通的完整教程"
- "ASMRフードビデオ作成ガイド：初心者向けの詳しい手順"

📐 Title Formula:
- English: [Action Verb] + [Primary Keyword] + [Value Promise/Modifier]
- Chinese: [Primary Keyword] + [Use Case/Scenario] + [Value Promise]
- Japanese/Korean: Similar to Chinese structure

Focus on educational, actionable content with natural keyword integration. Remember: 100% ${languageName}, NO mixed languages!

⚠️ FINAL REMINDER: Return ONLY the JSON object. Do NOT add:
- "## ✅ SEO指南已完成生成" or similar headers
- "我已经为..." or explanations
- "### 📊 核心指标" or summaries
- Any text before { or after }
- Just start with { and end with }`

  return prompt
}

/**
 * 解析 Claude 输出的 JSON（增强容错版本）
 */
function parseClaudeOutput(output) {
  console.log(`   原始输出长度: ${output.length} 字符`)

  // 记录原始输出的前200字符用于调试
  console.log(`   原始输出开头: ${output.substring(0, 200).replace(/\n/g, '\\n')}`)

  // 策略0: 处理 --output-format=json 的包装格式
  try {
    const wrapper = JSON.parse(output)
    if (wrapper.type === 'result' && wrapper.result) {
      console.log('   策略0: 检测到 Claude CLI JSON 包装格式,提取 result 字段')
      output = wrapper.result
      console.log(`   提取后输出开头: ${output.substring(0, 200).replace(/\n/g, '\\n')}`)
    }
  } catch (e) {
    // 不是JSON包装格式,继续使用原输出
  }

  // 策略1: 尝试匹配代码块中的JSON
  let jsonMatch = output.match(/```json\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    console.log('   策略1: 找到 ```json 代码块')
    try {
      return JSON.parse(jsonMatch[1].trim())
    } catch (e) {
      console.log('   策略1解析失败，继续尝试其他策略...')
    }
  }

  // 策略2: 尝试匹配普通代码块
  jsonMatch = output.match(/```\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    console.log('   策略2: 找到 ``` 代码块')
    try {
      return JSON.parse(jsonMatch[1].trim())
    } catch (e) {
      console.log('   策略2解析失败，继续尝试其他策略...')
    }
  }

  // 策略3: 查找第一个 { 到最后一个 } (最激进的方法)
  const firstBrace = output.indexOf('{')
  const lastBrace = output.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    console.log(`   策略3: 提取 JSON 对象 (位置 ${firstBrace} 到 ${lastBrace})`)
    const jsonContent = output.substring(firstBrace, lastBrace + 1)

    try {
      return JSON.parse(jsonContent)
    } catch (error) {
      // 如果直接解析失败，尝试清理内容
      console.log('   策略3失败，尝试清理后再解析...')
      console.log(`   JSON解析错误: ${error.message}`)
      console.log(`   提取内容的开头: ${jsonContent.substring(0, 200)}`)

      // 移除Markdown标题和说明文字
      const lines = jsonContent.split('\n')
      const cleanedLines = lines.filter(line => {
        const trimmed = line.trim()
        // 过滤掉Markdown标题、空行、说明文字
        return trimmed &&
               !trimmed.startsWith('##') &&
               !trimmed.startsWith('###') &&
               !trimmed.startsWith('我已经') &&
               !trimmed.startsWith('包含:') &&
               !trimmed.startsWith('**') &&
               !trimmed.startsWith('- **')
      })
      const cleanedContent = cleanedLines.join('\n')

      try {
        return JSON.parse(cleanedContent)
      } catch (secondError) {
        console.error('❌ JSON 解析失败（尝试所有策略后）')
        console.error('最终错误:', secondError.message)
        console.error('提取的内容（前500字符）:', jsonContent.substring(0, 500))
        console.error('清理后的内容（前500字符）:', cleanedContent.substring(0, 500))
        throw new Error(`无法解析 Claude 输出的 JSON: ${secondError.message}`)
      }
    }
  }

  // 策略4: 尝试直接解析整个输出（最后的fallback）
  console.log('   策略4: 尝试直接解析整个输出')
  try {
    return JSON.parse(output.trim())
  } catch (error) {
    console.error('❌ JSON 解析失败（所有策略均失败）')
    console.error('最终错误:', error.message)
    console.error('原始输出（前500字符）:', output.substring(0, 500))
    console.error('原始输出（最后200字符）:', output.substring(Math.max(0, output.length - 200)))
    throw new Error(`无法解析 Claude 输出的 JSON: ${error.message}`)
  }
}

/**
 * 将建议分类到不同优化步骤
 */
function categorizeRecommendations(recommendations) {
  const categories = {
    meta: [],      // Meta信息相关
    intro: [],     // 引言相关
    content: [],   // 正文内容相关
    faq: []        // FAQ相关
  }

  recommendations.forEach(rec => {
    const lowerRec = rec.toLowerCase()

    // Meta信息相关
    if (lowerRec.includes('meta') ||
        lowerRec.includes('标题') ||
        lowerRec.includes('title') ||
        lowerRec.includes('描述') ||
        lowerRec.includes('description') ||
        lowerRec.includes('关键词') ||
        lowerRec.includes('keyword')) {
      categories.meta.push(rec)
    }
    // 引言相关
    else if (lowerRec.includes('引言') ||
             lowerRec.includes('intro') ||
             lowerRec.includes('introduction') ||
             lowerRec.includes('开头') ||
             lowerRec.includes('第一段')) {
      categories.intro.push(rec)
    }
    // FAQ相关
    else if (lowerRec.includes('faq') ||
             lowerRec.includes('问题') ||
             lowerRec.includes('question') ||
             lowerRec.includes('回答') ||
             lowerRec.includes('answer')) {
      categories.faq.push(rec)
    }
    // 其他归入正文内容
    else {
      categories.content.push(rec)
    }
  })

  return categories
}

/**
 * 构建步骤1：Meta信息优化提示词
 */
function buildStep1Prompt(requestBody, languageName, relatedRecommendations) {
  const recText = relatedRecommendations.length > 0
    ? relatedRecommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
    : '暂无针对Meta信息的具体建议，请全面优化。'

  return `你是SEO专家。优化Meta信息（标题、描述、关键词）。

⚠️ 语言：ALL content MUST be 100% ${languageName}!

## 当前Meta信息
**Meta标题** (${(requestBody.meta_title || '').length}字符): ${requestBody.meta_title || '未提供'}
**Meta描述** (${(requestBody.meta_description || '').length}字符): ${requestBody.meta_description || '未提供'}
**Meta关键词**: ${requestBody.meta_keywords || '未提供'}

**关键词策略**:
- 目标关键词: ${requestBody.target_keyword}
- 长尾关键词: ${(requestBody.long_tail_keywords || []).join(', ')}
- 次要关键词: ${(requestBody.secondary_keywords || []).join(', ')}

## 必须解决的问题（来自AI评分）
${recText}

⚠️ 你的优化必须**直接解决**上述每条建议！

## 优化要求
1. Meta标题：55-60字符，主关键词前置，吸引点击
2. Meta描述：150-155字符，包含CTA，自然融入1-2个关键词
3. Meta关键词：5-8个，逗号分隔
4. 次要关键词：5-8个，语义相关

## 输出格式（JSON）
\`\`\`json
{
  "optimized_content": {
    "meta_title": "优化后标题(${languageName})",
    "meta_description": "优化后描述(${languageName})",
    "meta_keywords": "关键词1, 关键词2(${languageName})",
    "secondary_keywords": ["词1", "词2"(${languageName})]
  },
  "key_improvements": [
    "解决建议1: 具体说明如何解决",
    "解决建议2: 具体说明如何解决"
  ]
}
\`\`\`

只返回JSON，100% ${languageName}！`
}

/**
 * 构建步骤2：引言优化提示词
 */
function buildStep2Prompt(requestBody, languageName, relatedRecommendations) {
  const recText = relatedRecommendations.length > 0
    ? relatedRecommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
    : '暂无针对引言的具体建议，请全面优化。'

  return `你是SEO专家。优化引言部分。

⚠️ 语言：ALL content MUST be 100% ${languageName}!

## 当前引言 (${(requestBody.guide_intro || '').length}字符)
${requestBody.guide_intro || '未提供'}

**目标关键词**: ${requestBody.target_keyword}

## 必须解决的问题
${recText}

⚠️ 你的优化必须**直接解决**上述每条建议！

## 优化要求
1. 长度：100-150字
2. 第一句吸引注意力
3. 明确说明指南价值
4. 自然融入主关键词
5. 语言：100% ${languageName}

## 输出格式（JSON）
\`\`\`json
{
  "optimized_content": {
    "guide_intro": "优化后的引言(100-150字，${languageName})"
  },
  "key_improvements": [
    "解决建议X: 具体说明"
  ]
}
\`\`\`

只返回JSON，100% ${languageName}！`
}

/**
 * 构建步骤3：正文内容优化提示词
 */
function buildStep3Prompt(requestBody, languageName, relatedRecommendations) {
  const recText = relatedRecommendations.length > 0
    ? relatedRecommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
    : '暂无针对正文的具体建议，请全面优化。'

  return `⚠️ CRITICAL: You MUST return ONLY valid JSON. NO explanations, NO text before or after the JSON!

你是SEO专家。优化正文内容（Markdown格式）。

⚠️ 语言：ALL content MUST be 100% ${languageName}!

## 当前正文 (${(requestBody.guide_content || '').length}字符)
${requestBody.guide_content || '未提供'}

**目标关键词**: ${requestBody.target_keyword}
**长尾关键词（必须优化）**: ${(requestBody.long_tail_keywords || []).join(', ')}

## 必须解决的问题
${recText}

⚠️ 你的优化必须**直接解决**上述每条建议！

## ⚠️ 目标关键词密度优化要求（最高优先级）

当前目标关键词密度需要优化到1.5-2.5%的理想范围（最佳：2.0%）！

**必须做到：**
1. **密度目标**：
   - 目标关键词：1.5-2.5%（理想值：2.0%）
   - 自然分布，不要堆砌
2. **自然融入位置**：
   - Introduction段落：自然引入目标关键词
   - How to Use步骤中：在关键步骤中融入目标关键词
   - Best Practices：结合最佳实践提及目标关键词
   - Troubleshooting：在问题解决场景中使用目标关键词
   - Creative Ideas：创意想法中自然包含目标关键词
   - Conclusion：总结时再次强调目标关键词
3. **避免堆砌**：每次提及要在完整的句子中自然使用，确保语义通顺

## 其他优化要求
1. 长度：1500-2000字
2. Markdown格式，清晰结构（标题用${languageName}）:
   - # Introduction
   - ## Key Features (3-5要点)
   - ## How to Use (5-8步骤)
   - ## Best Practices (3-5建议)
   - ## Troubleshooting (2-3场景)
   - ## Creative Ideas (3-5想法)
   - ## Conclusion
3. 段落：100-300字
4. 加入具体例子和场景
5. 语言：100% ${languageName}

## ⚠️ CRITICAL OUTPUT REQUIREMENT ⚠️
You MUST return ONLY this JSON structure, with NO additional text:

\`\`\`json
{
  "optimized_content": {
    "guide_content": "优化后的完整Markdown正文(1500-2000字，${languageName})"
  },
  "key_improvements": [
    "解决建议X: 具体说明如何解决"
  ]
}
\`\`\`

⚠️ DO NOT add any explanations before or after the JSON!
⚠️ DO NOT say "已完成优化" or any other text!
⚠️ ONLY return the JSON structure shown above!
⚠️ Content must be 100% ${languageName}!`
}

/**
 * 构建步骤4：FAQ优化提示词
 */
function buildStep4Prompt(requestBody, languageName, relatedRecommendations) {
  const currentFAQ = (requestBody.faq_items || [])
    .map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`)
    .join('\n\n')

  const recText = relatedRecommendations.length > 0
    ? relatedRecommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
    : '暂无针对FAQ的具体建议，请全面优化。'

  return `你是SEO专家。优化FAQ部分。

⚠️ 语言：ALL content MUST be 100% ${languageName}!

## 当前FAQ (${(requestBody.faq_items || []).length}个问题)
${currentFAQ || '未提供'}

**长尾关键词**: ${(requestBody.long_tail_keywords || []).join(', ')}

## 必须解决的问题
${recText}

⚠️ 你的优化必须**直接解决**上述每条建议！

## 优化要求
1. 提供5-7个高质量问题
2. 每个问题具体、用户真实关心
3. 每个回答：80-150字，详细实用
4. 自然融入长尾关键词
5. 覆盖不同用户场景
6. 语言：100% ${languageName}

## 输出格式（JSON）
\`\`\`json
{
  "optimized_content": {
    "faq_items": [
      {"question": "问题1(${languageName})", "answer": "回答1(80-150字，${languageName})"},
      {"question": "问题2(${languageName})", "answer": "回答2(80-150字，${languageName})"},
      {"question": "问题3(${languageName})", "answer": "回答3(80-150字，${languageName})"},
      {"question": "问题4(${languageName})", "answer": "回答4(80-150字，${languageName})"},
      {"question": "问题5(${languageName})", "answer": "回答5(80-150字，${languageName})"}
    ]
  },
  "key_improvements": [
    "解决建议X: 具体说明"
  ]
}
\`\`\`

只返回JSON，100% ${languageName}！`
}

/**
 * 处理生成请求
 */
async function handleGenerateRequest(requestBody) {
  const { templateId, targetKeyword, longTailKeywords, language } = requestBody

  console.log('📝 SEO 内容生成开始...')
  console.log(`- 模板ID: ${templateId}`)
  console.log(`- 目标关键词: ${targetKeyword}`)
  console.log(`- 语言: ${language}`)
  console.log(`- 长尾关键词: ${longTailKeywords.join(', ')}`)

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
  const prompt = buildPrompt(template, targetKeyword, longTailKeywords, language)

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

  // 5. 检查是否已存在记录
  console.log('\n💾 保存到数据库...')
  console.log('   检查是否存在旧记录...')
  const { data: existingGuide } = await supabase
    .from('template_seo_guides')
    .select('id')
    .eq('template_id', templateId)
    .eq('language', language)
    .maybeSingle()

  let seoGuide
  let upsertError

  if (existingGuide) {
    // 已存在，更新记录并自动发布
    console.log(`   找到已存在记录 (ID: ${existingGuide.id})，将更新内容并发布...`)
    const { data, error } = await supabase
      .from('template_seo_guides')
      .update({
        target_keyword: targetKeyword,
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
        is_published: true,
        published_at: new Date().toISOString(),
        review_status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', existingGuide.id)
      .select()
      .single()

    seoGuide = data
    upsertError = error
  } else {
    // 不存在，插入新记录并自动发布
    console.log('   未找到旧记录，创建新记录并发布...')
    const { data, error } = await supabase
      .from('template_seo_guides')
      .insert({
        template_id: templateId,
        language: language,
        target_keyword: targetKeyword,
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
        is_published: true,
        published_at: new Date().toISOString(),
        review_status: 'approved'
      })
      .select()
      .single()

    seoGuide = data
    upsertError = error
  }

  if (upsertError) {
    throw new Error(`保存失败: ${upsertError.message}`)
  }

  console.log('✅ 保存成功!')
  console.log(`📄 SEO Guide ID: ${seoGuide.id}`)
  console.log('\n🎉 SEO 内容生成完成！')

  return {
    success: true,
    data: seoGuide
  }
}

/**
 * HTTP 服务器
 */
const server = createServer(async (req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // 健康检查
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      message: 'SEO 生成服务器运行中',
      port: PORT
    }))
    return
  }

  // Claude CLI 测试
  if (req.url === '/test-claude' && req.method === 'GET') {
    try {
      console.log('[测试] 开始测试 Claude CLI...')

      const testPrompt = 'Say "Hello World" in Chinese. Return only the text, no explanation.'
      const output = await callClaudeCLI(testPrompt)

      console.log('[测试] Claude CLI 响应:', output)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        message: 'Claude CLI 测试成功',
        output: output,
        length: output.length
      }))
    } catch (error) {
      console.error('[测试] Claude CLI 测试失败:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: false,
        error: error.message
      }))
    }
    return
  }

  // AI 智能评分
  if (req.url === '/calculate-seo-score' && req.method === 'POST') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const requestBody = JSON.parse(body)
        console.log('🤖 AI 智能评分开始...')

        // 检测目标语言
        const targetLanguage = requestBody.language || 'en'
        const languageName = LANGUAGE_NAMES[targetLanguage] || 'English'

        // 获取目标关键词（兼容 target_keyword 和 primary_keyword）
        const targetKeyword = requestBody.target_keyword || requestBody.primary_keyword || ''

        // ✅ 使用统一的提示词配置
        const prompt = buildSEOScorePrompt({
          languageName,
          languageCode: targetLanguage,
          targetKeyword,
          metaTitle: requestBody.meta_title || '',
          metaDescription: requestBody.meta_description || '',
          metaKeywords: requestBody.meta_keywords || '',
          longTailKeywords: requestBody.long_tail_keywords || [],
          secondaryKeywords: requestBody.secondary_keywords || [],
          keywordDensity: requestBody.keyword_density || {},
          guideIntro: requestBody.guide_intro || '',
          guideContent: requestBody.guide_content || '',
          faqItems: requestBody.faq_items || [],
          pageViews: requestBody.page_views || 0,
          avgTimeOnPage: requestBody.avg_time_on_page || 0,
          bounceRate: requestBody.bounce_rate || 0,
          conversionRate: requestBody.conversion_rate || 0
        })


        // 调用 Claude CLI
        console.log('🧠 调用 Claude AI 进行深度分析...')
        const output = await callClaudeCLI(prompt)
        console.log('✅ Claude 响应成功')

        // 解析输出
        console.log('🔍 解析评分结果...')
        const scoreResult = parseClaudeOutput(output)

        // 兼容新旧字段名
        const totalScore = scoreResult.total_score || scoreResult.overall_score
        const recommendations = scoreResult.recommendations || scoreResult.suggestions || []

        // 验证格式
        if (!totalScore) {
          console.error('   解析结果:', JSON.stringify(scoreResult, null, 2).substring(0, 500))
          throw new Error('AI 返回的评分格式不正确: 缺少 total_score/overall_score 字段')
        }

        // ✅ 严格按照4个维度映射分数
        // AI返回格式: {meta_info_quality, keyword_optimization, content_quality, readability}
        // 数据库字段:
        //   - meta_info_quality_score ← meta_info_quality (Meta信息质量 /30分)
        //   - keyword_optimization_score ← keyword_optimization (关键词优化 /25分)
        //   - content_quality_score ← content_quality (内容质量 /25分)
        //   - readability_score ← readability (可读性 /20分)

        let metaInfoQualityScore = scoreResult.meta_info_quality_score || 0
        let keywordOptimizationScore = scoreResult.keyword_optimization_score || 0
        let contentQualityScore = scoreResult.content_quality_score || 0
        let readabilityScore = scoreResult.readability_score || 0

        // 如果存在 dimension_scores (新格式),严格提取4个维度分数
        if (scoreResult.dimension_scores) {
          metaInfoQualityScore = scoreResult.dimension_scores.meta_info_quality || 0
          keywordOptimizationScore = scoreResult.dimension_scores.keyword_optimization || 0
          contentQualityScore = scoreResult.dimension_scores.content_quality || 0
          readabilityScore = scoreResult.dimension_scores.readability || 0
        }

        // 标准化字段名 - 严格4个维度
        scoreResult.total_score = totalScore
        scoreResult.meta_info_quality_score = metaInfoQualityScore
        scoreResult.keyword_optimization_score = keywordOptimizationScore
        scoreResult.content_quality_score = contentQualityScore
        scoreResult.readability_score = readabilityScore

        scoreResult.recommendations = recommendations.map(s => {
          // 如果是新格式(对象),转换为字符串
          if (typeof s === 'object' && s.suggestion) {
            return `[${s.priority?.toUpperCase() || 'MEDIUM'}] ${s.category || '优化建议'}: ${s.suggestion}`
          }
          return s
        })

        console.log('✅ AI 智能评分完成!')
        console.log(`   总分: ${scoreResult.total_score}/100`)
        console.log(`   建议数: ${scoreResult.recommendations.length}条`)
        console.log('   维度分数 (严格4个维度):')
        console.log(`     - Meta信息质量: ${scoreResult.meta_info_quality_score}/30`)
        console.log(`     - 关键词优化: ${scoreResult.keyword_optimization_score}/25`)
        console.log(`     - 内容质量: ${scoreResult.content_quality_score}/25`)
        console.log(`     - 可读性: ${scoreResult.readability_score}/20`)

        // ✅ 使用确定性算法重新计算关键词密度（替代AI估算）
        const fullContent = extractFullContent(requestBody)
        const allKeywords = [
          ...(requestBody.target_keyword ? [requestBody.target_keyword] : []),
          ...(requestBody.long_tail_keywords || []),
          ...(requestBody.secondary_keywords || [])
        ].filter(Boolean)

        const accurateKeywordDensity = calculateKeywordDensity(fullContent, allKeywords)

        console.log('   使用算法重新计算密度:')
        console.log(`     - 关键词数: ${allKeywords.length}`)
        console.log(`     - AI密度数: ${Object.keys(scoreResult.keyword_density || {}).length}`)
        console.log(`     - 算法密度数: ${Object.keys(accurateKeywordDensity).length}`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: {
            total_score: scoreResult.total_score,
            meta_info_quality_score: scoreResult.meta_info_quality_score || 0,
            keyword_optimization_score: scoreResult.keyword_optimization_score || 0,
            content_quality_score: scoreResult.content_quality_score || 0,
            readability_score: scoreResult.readability_score || 0,
            keyword_density: accurateKeywordDensity, // 使用算法计算的密度，不是AI估算的
            recommendations: scoreResult.recommendations || []
          }
        }))

      } catch (error) {
        console.error('\n❌ AI 评分失败:', error.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }))
      }
    })

    return
  }

  // 从 Prompt 生成 SEO 内容（给前端 contentGenerationService 使用）
  if (req.url === '/generate-seo-from-prompt' && req.method === 'POST') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const requestBody = JSON.parse(body)

        // 验证必填字段
        if (!requestBody.systemPrompt || !requestBody.userPrompt || !requestBody.targetKeyword || !requestBody.language) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: false,
            error: '缺少必要参数: systemPrompt, userPrompt, targetKeyword, language'
          }))
          return
        }

        console.log('📝 从 Prompt 生成 SEO 内容...')
        console.log(`- 目标关键词: ${requestBody.targetKeyword}`)
        console.log(`- 语言: ${requestBody.language}`)

        // 合并系统提示词和用户提示词
        // ⚠️ 在提示词中强调只返回 JSON
        const fullPrompt = `${requestBody.systemPrompt}\n\n${requestBody.userPrompt}

⚠️ CRITICAL OUTPUT REQUIREMENT (再次强调):
- You MUST return ONLY valid JSON
- NO markdown code blocks (\`\`\`json)
- NO explanations before or after the JSON
- NO additional text like "已完成生成" or "这是生成的内容"
- Just start with { and end with }
- Return the raw JSON object directly`

        // 调用 Claude CLI
        console.log('🤖 调用 Claude CLI...')
        const output = await callClaudeCLI(fullPrompt, 180000) // 3分钟超时
        console.log('✅ Claude 响应成功')
        console.log(`   原始输出长度: ${output.length} 字符`)

        // 解析 JSON 输出
        console.log('🔍 解析 JSON 内容...')
        const generatedContent = parseClaudeOutput(output)

        // 验证必要字段
        if (!generatedContent.guide_content) {
          console.error('❌ 解析后的 JSON 缺少 guide_content 字段')
          console.error('   实际字段:', Object.keys(generatedContent))
          throw new Error('生成的内容缺少 guide_content 字段')
        }

        console.log('✅ JSON 解析成功')
        console.log(`   - Title: ${generatedContent.title}`)
        console.log(`   - Meta Title: ${generatedContent.meta_title}`)
        console.log(`   - FAQ 数量: ${generatedContent.faq_items?.length || 0}`)
        console.log(`   - 内容长度: ${generatedContent.guide_content?.length || 0} 字符`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: generatedContent
        }))

      } catch (error) {
        console.error('\n❌ 错误:', error.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }))
      }
    })

    return
  }

  // 生成 SEO 内容
  if (req.url === '/generate-seo' && req.method === 'POST') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const requestBody = JSON.parse(body)

        // 验证必填字段
        if (!requestBody.templateId || !requestBody.targetKeyword || !requestBody.longTailKeywords || !requestBody.language) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: false,
            error: '缺少必要参数: templateId, targetKeyword, longTailKeywords, language'
          }))
          return
        }

        // 处理生成请求
        const result = await handleGenerateRequest(requestBody)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))

      } catch (error) {
        console.error('\n❌ 错误:', error.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }))
      }
    })

    return
  }

  // AI 分步优化内容（新端点）
  if (req.url === '/optimize-seo-content-step' && req.method === 'POST') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      let requestBody
      let step = 1

      try {
        requestBody = JSON.parse(body)
        step = requestBody.step || 1
        console.log(`🚀 AI 分步优化 - 步骤 ${step}/4...`)

        // 检测目标语言
        const targetLanguage = requestBody.language || 'en'
        const languageName = LANGUAGE_NAMES[targetLanguage] || 'English'

        // 分类建议
        const recommendations = requestBody.seo_recommendations || []
        const categorized = categorizeRecommendations(recommendations)

        // 根据步骤选择对应的提示词构建函数和相关建议
        let prompt
        let relatedRecommendations = []

        switch (step) {
          case 1:
            relatedRecommendations = categorized.meta
            prompt = buildStep1Prompt(requestBody, languageName, relatedRecommendations)
            console.log(`   Meta信息相关建议: ${relatedRecommendations.length}条`)
            break
          case 2:
            relatedRecommendations = categorized.intro
            prompt = buildStep2Prompt(requestBody, languageName, relatedRecommendations)
            console.log(`   引言相关建议: ${relatedRecommendations.length}条`)
            break
          case 3:
            relatedRecommendations = categorized.content
            prompt = buildStep3Prompt(requestBody, languageName, relatedRecommendations)
            console.log(`   正文相关建议: ${relatedRecommendations.length}条`)
            break
          case 4:
            relatedRecommendations = categorized.faq
            prompt = buildStep4Prompt(requestBody, languageName, relatedRecommendations)
            console.log(`   FAQ相关建议: ${relatedRecommendations.length}条`)
            break
          default:
            throw new Error(`无效的步骤: ${step}`)
        }

        // 调用 Claude CLI（步骤3使用更长超时）
        console.log(`🧠 调用 Claude AI 优化步骤 ${step}...`)
        const timeout = step === 3 ? 360000 : 180000 // 步骤3: 6分钟，其他: 3分钟
        const output = await callClaudeCLI(prompt, timeout)
        console.log('✅ Claude 响应成功')

        // 解析输出
        console.log('🔍 解析优化结果...')
        const result = parseClaudeOutput(output)

        // 验证格式
        if (!result.optimized_content || !result.key_improvements) {
          throw new Error('AI 返回的优化结果格式不正确')
        }

        console.log(`✅ 步骤 ${step}/4 优化完成!`)
        console.log(`   改进点: ${result.key_improvements.length}个`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          step: step,
          data: result
        }))

      } catch (error) {
        console.error(`\n❌ 步骤 ${step} 优化失败:`, error.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          step: step,
          error: error.message
        }))
      }
    })

    return
  }

  // AI 优化关键词密度（新端点）
  if (req.url === '/optimize-keyword-density' && req.method === 'POST') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const requestBody = JSON.parse(body)
        console.log('🎯 关键词密度优化开始...')

        const targetLanguage = requestBody.language || 'en'
        const languageName = LANGUAGE_NAMES[targetLanguage] || 'English'

        // 构建需要优化的关键词列表
        const lowDensityKeywords = requestBody.low_density_keywords || []
        const keywordsToOptimize = lowDensityKeywords
          .map(k => `- **${k.keyword}**: 当前密度 ${k.currentDensity.toFixed(2)}% → 目标 ${k.targetDensity.toFixed(2)}%`)
          .join('\n')

        console.log(`   需优化关键词: ${lowDensityKeywords.length}个`)

        const prompt = `你是一位专业的SEO内容优化专家。请针对性地优化以下内容中的关键词密度。

⚠️ 目标语言: ${languageName} (${targetLanguage})
所有内容必须保持 ${languageName} 语言。

## 任务目标

以下关键词密度不足，需要针对性优化：

${keywordsToOptimize}

## 当前内容

### 正文内容 (${(requestBody.guide_content || '').length}字符)
${requestBody.guide_content || '未提供'}

### FAQ (${(requestBody.faq_items || []).length}个问题)
${(requestBody.faq_items || []).map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n') || '未提供'}

## 优化要求

⚠️ **关键词密度优化策略（最高优先级）**：

**⚠️ 核心要求：确保每个关键词密度在1.0%-2.5%的理想范围内！**

1. **密度目标范围（严格遵守）**：
   - **最低密度**：1.0%（约15次）- 任何关键词不得低于此值
   - **理想密度**：1.5%-2.5%（约22-37次）- 大部分关键词应在此范围
   - **最高上限**：3.0%（约45次）- 超过此值会被视为关键词堆砌，严重影响SEO

2. **关键词优化优先级**（按此顺序处理）：
   - **优先级1（必须优化）**：密度<1.0%的关键词，增加至1.5%左右
   - **优先级2（适度优化）**：密度1.0%-1.4%的关键词，增加至1.8%左右
   - **优先级3（保持不变）**：密度1.5%-2.5%的关键词，无需修改
   - **优先级4（必须减少）**：密度>2.5%的关键词，减少至2.0%左右

3. **计算每个关键词需要调整的次数**：
   - 假设正文总字数约1500字
   - **增加示例**：如果某关键词当前密度0.30%（约4-5次），需要增加约18次达到1.5%
   - **减少示例**：如果某关键词当前密度4.0%（约60次），需要减少约30次降至2.0%

4. **分布要求（根据关键词当前密度灵活调整）**：

   **对于需要增加的低密度关键词（<1.5%）**：
   - **Introduction 段落**：增加1-2次
   - **How to Use 步骤**：在3-4个步骤中各增加1次
   - **Best Practices**：增加1-2次
   - **Troubleshooting**：增加1次
   - **Creative Ideas**：增加1-2次
   - **Conclusion**：增加1次
   - **FAQ**：在2-3个问题/答案中增加，总计2-3次

   **对于需要减少的高密度关键词（>2.5%）**：
   - 检查每个章节，移除不必要的重复提及
   - 保留最自然、最有价值的提及
   - 可以用同义词或变体替换部分重复

5. **关键词融入技巧**：
   - 作为主语："{关键词} provides unique benefits"
   - 作为宾语："Learn how to create {关键词}"
   - 在问题中："What makes {关键词} so effective?"
   - 在列表中："Try {关键词} for..."
   - 变体使用：可以略微调整顺序，如 "{词A} {词B}" 也算 "{词B} {词A}"

6. **质量与数量平衡（严格遵守）**：
   - **质量优先**：永远不要为了达到数量而生硬重复
   - **密度范围**：每个关键词必须保持在1.0%-2.5%之间
   - **自然流畅**：每次提及都要在完整、有意义的句子中
   - **避免堆砌**：如果某个位置已经有该关键词，不要强行再加

7. **自我验证（最关键步骤）**：
   在返回结果前，你必须逐个检查每个关键词：
   - ✅ 当前密度<1.0%的关键词，是否已增加到1.5%-2.0%？
   - ✅ 当前密度1.0%-2.5%的关键词，是否保持不变？
   - ✅ 当前密度>2.5%的关键词，是否已减少到2.0%以下？
   - ❌ 不要让任何关键词超过3.0%！这会严重损害SEO效果！

## ⚠️ CRITICAL OUTPUT REQUIREMENT ⚠️
You MUST return ONLY this JSON structure, with NO additional text:

\`\`\`json
{
  "optimized_guide_content": "优化后的正文内容（Markdown格式，${languageName}）",
  "optimized_faq_items": [
    {"question": "问题1（${languageName}）", "answer": "答案1（${languageName}）"},
    {"question": "问题2（${languageName}）", "answer": "答案2（${languageName}）"}
  ],
  "key_improvements": [
    "为 '{关键词1}' 在 Introduction 段落增加X次提及",
    "为 '{关键词2}' 在 Best Practices 中增加X次自然使用",
    "在FAQ新增问题使用 '{关键词3}'",
    "为 '{关键词4}' 在 Conclusion 中增加X次总结性提及"
  ]
}
\`\`\`

⚠️ DO NOT add any explanations before or after the JSON!
⚠️ DO NOT say "已完成优化" or any other text!
⚠️ ONLY return the JSON structure shown above!
⚠️ Content must be 100% ${languageName}!`

        // 调用 Claude CLI
        console.log('🧠 调用 Claude AI 进行关键词密度优化...')
        const output = await callClaudeCLI(prompt, 180000) // 3分钟超时
        console.log('✅ Claude 响应成功')

        // 解析输出
        console.log('🔍 解析优化结果...')
        const optimizeResult = parseClaudeOutput(output)

        // 验证格式
        if (!optimizeResult.optimized_guide_content || !optimizeResult.optimized_faq_items) {
          throw new Error('AI 返回的优化结果格式不正确')
        }

        console.log('✅ 关键词密度优化完成!')
        console.log(`   改进点: ${optimizeResult.key_improvements?.length || 0}个`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: optimizeResult
        }))

      } catch (error) {
        console.error('\n❌ 关键词密度优化失败:', error.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }))
      }
    })

    return
  }

  // AI 一键优化内容（原有端点，保留兼容）
  if (req.url === '/optimize-seo-content' && req.method === 'POST') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const requestBody = JSON.parse(body)
        console.log('🚀 AI 一键优化开始...')

        // 检测目标语言
        const targetLanguage = requestBody.language || 'en'
        const languageName = LANGUAGE_NAMES[targetLanguage] || 'English'

        // 构建 SEO 专家优化提示词
        const currentScore = requestBody.seo_score || 0
        const recommendations = requestBody.seo_recommendations || []

        const prompt = `你是一位拥有10年经验的资深 SEO 专家和内容创作大师。

⚠️ CRITICAL LANGUAGE REQUIREMENT - 语言一致性要求（最重要！）
目标语言: ${languageName} (${targetLanguage})

**这是最关键的要求，必须严格遵守：**
1. ALL content MUST be written ENTIRELY in ${languageName}
2. 所有优化后的内容必须 100% 使用 ${languageName}
3. DO NOT mix any other languages - 绝对不能混用其他语言
4. Even if the current content has mixed languages, YOU MUST fix it
5. Meta title, meta description, meta keywords, intro, content, FAQ - ALL must be in ${languageName}
6. If ${languageName} is not English, avoid English words unless they are commonly used technical terms
7. 如果发现原内容有语言混用，必须在优化时全部改为 ${languageName}

## 当前状态分析

**当前评分**: ${currentScore}/100分

**当前内容**:

### Meta 信息
- **Meta 标题** (${(requestBody.meta_title || '').length}字符): ${requestBody.meta_title || '未提供'}
- **Meta 描述** (${(requestBody.meta_description || '').length}字符): ${requestBody.meta_description || '未提供'}
- **Meta 关键词**: ${requestBody.meta_keywords || '未提供'}

### 关键词策略
- **目标关键词**: ${requestBody.target_keyword || '未提供'}
- **长尾关键词**: ${(requestBody.long_tail_keywords || []).join(', ') || '未提供'}
- **次要关键词**: ${(requestBody.secondary_keywords || []).join(', ') || '未提供'}

### 引言 (${(requestBody.guide_intro || '').length}字符)
${requestBody.guide_intro || '未提供'}

### 正文内容 (${(requestBody.guide_content || '').length}字符)
${requestBody.guide_content || '未提供'}

### FAQ (${(requestBody.faq_items || []).length}个问题)
${(requestBody.faq_items || []).map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n') || '未提供'}

**主要问题和改进建议**:
${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

---

## 优化任务

请对以上内容进行**深度思考**和**全面优化**。你需要：

### 1. Meta 标题优化
- **必须使用 ${languageName}**
- 长度控制在 55-60 字符
- 必须包含主关键词（靠前位置）
- 吸引点击，传递核心价值
- 避免关键词堆砌

### 2. Meta 描述优化
- **必须使用 ${languageName}**
- 长度控制在 150-155 字符
- 包含行动号召（CTA）
- 自然融入 1-2 个关键词
- 突出独特价值主张

### 3. Meta 关键词优化
- **必须使用 ${languageName}**
- 提供 5-8 个相关关键词
- 主关键词 + 长尾关键词组合
- 用逗号分隔

### 4. 引言优化
- **必须使用 ${languageName}**
- 长度 100-150 字
- 第一句话吸引注意力
- 明确说明本指南的价值
- 自然融入主关键词

### 5. 正文内容优化
- **必须使用 ${languageName}**
- 目标长度 1500-2000 字
- 使用 Markdown 格式
- 清晰的结构层次（标题也必须是 ${languageName}）：
  * # Introduction（简短介绍）
  * ## Key Features（核心特性，3-5个要点）
  * ## How to Use（使用步骤，5-8个步骤）
  * ## Best Practices（最佳实践，3-5个建议）
  * ## Troubleshooting（常见问题解决，2-3个场景）
  * ## Creative Ideas（创意用法，3-5个想法）
  * ## Conclusion（总结）
- 段落长度控制在 100-300 字
- **⚠️ 长尾关键词密度优化（最高优先级）**：
  * **逐个检查每个长尾关键词**，确保每个关键词至少出现2-3次
  * 主关键词密度：2-3%
  * 每个长尾关键词密度：1-2%（至少出现2-3次）
  * 在Introduction、How to Use、Best Practices、Troubleshooting、Creative Ideas、Conclusion等各部分自然融入
  * 避免关键词堆砌，要在完整句子中自然使用
- 使用 H2/H3 标题分割内容
- 加入具体例子和使用场景

### 6. FAQ 优化
- **问题和答案都必须使用 ${languageName}**
- 提供 5-7 个高质量问题
- 每个问题要具体、用户真实关心的
- 每个回答 80-150 字，详细实用
- **⚠️ 长尾关键词融入（重要）**：
  * FAQ是融入长尾关键词的绝佳位置
  * 在问题和答案中自然使用至少3-5个不同的长尾关键词
  * 特别是那些在正文中密度不足的长尾关键词
- 覆盖不同的用户场景

### 7. 次要关键词优化
- **必须使用 ${languageName}**
- 提供 5-8 个相关次要关键词
- 与主题相关的语义变体
- 可用于后续内容扩展

---

## 输出格式

请严格按照以下 JSON 格式返回优化结果：

⚠️ 再次提醒：所有字段内容都必须是 ${languageName}！

\`\`\`json
{
  "optimized_content": {
    "meta_title": "优化后的Meta标题（55-60字符，必须是 ${languageName}）",
    "meta_description": "优化后的Meta描述（150-155字符，必须是 ${languageName}）",
    "meta_keywords": "关键词1, 关键词2, 关键词3, 关键词4, 关键词5（必须是 ${languageName}）",
    "guide_intro": "优化后的引言（100-150字，必须是 ${languageName}）",
    "guide_content": "优化后的完整Markdown正文（1500-2000字，包含所有章节，必须是 ${languageName}）",
    "faq_items": [
      {
        "question": "优化后的问题1？（必须是 ${languageName}）",
        "answer": "详细的回答1（80-150字，必须是 ${languageName}）"
      },
      {
        "question": "优化后的问题2？（必须是 ${languageName}）",
        "answer": "详细的回答2（80-150字，必须是 ${languageName}）"
      },
      {
        "question": "优化后的问题3？（必须是 ${languageName}）",
        "answer": "详细的回答3（80-150字，必须是 ${languageName}）"
      }
    ],
    "secondary_keywords": ["次要关键词1", "次要关键词2", "次要关键词3", "次要关键词4", "次要关键词5（必须是 ${languageName}）"]
  },
  "optimization_summary": "简要说明本次优化的核心改进点和策略（100-150字）",
  "key_improvements": [
    "具体改进点1：例如 'Meta标题从45字符扩展到58字符，并将主关键词前置'",
    "具体改进点2：例如 '正文新增3个H2标题，优化内容结构'",
    "具体改进点3：例如 '关键词密度从5.2%优化到2.8%，避免堆砌'",
    "具体改进点4：例如 'FAQ从3个扩展到6个，覆盖更多用户场景'",
    "具体改进点5：例如 'Meta描述增加明确的CTA，提升点击率'",
    "具体改进点6：如果原内容有语言混用，必须说明：'修复语言混用问题，全部改为 ${languageName}'"
  ]
}
\`\`\`

## 重要提醒

1. **⚠️ 语言一致性（最高优先级）**：ALL content must be 100% ${languageName}, NO mixed languages!
2. **内容必须原创且高质量**：不要简单复制现有内容，要真正优化和改进
3. **关键词自然融入**：避免生硬插入，保持语言流畅
4. **用户价值优先**：内容要真正有用，而不是为了SEO而SEO
5. **具体可操作**：给出的建议要明确、具体、可执行
6. **保持专业性**：语言要准确、权威，体现专业水平
7. **结构清晰**：使用 Markdown 格式，层次分明
8. **语言纯净检查**：如果原内容混用了语言，你必须全部改为 ${languageName}

请只返回 JSON，不要添加任何其他说明文字。记住：100% ${languageName}！开始深度思考并全面优化吧！`

        // 调用 Claude CLI
        console.log('🧠 调用 Claude AI 进行深度优化...')
        console.log(`   目标语言: ${languageName} (${targetLanguage})`)
        console.log(`   当前评分: ${currentScore}分`)
        console.log(`   建议数量: ${recommendations.length}条`)

        const output = await callClaudeCLI(prompt)
        console.log('✅ Claude 响应成功')

        // 解析输出
        console.log('🔍 解析优化结果...')
        const optimizationResult = parseClaudeOutput(output)

        // 验证格式
        if (!optimizationResult.optimized_content || !optimizationResult.optimization_summary) {
          throw new Error('AI 返回的优化结果格式不正确')
        }

        const optimized = optimizationResult.optimized_content
        console.log('✅ AI 优化完成!')
        console.log(`   优化摘要: ${optimizationResult.optimization_summary.substring(0, 50)}...`)
        console.log(`   Meta 标题长度: ${(optimized.meta_title || '').length}字符`)
        console.log(`   Meta 描述长度: ${(optimized.meta_description || '').length}字符`)
        console.log(`   正文长度: ${(optimized.guide_content || '').length}字符`)
        console.log(`   FAQ 数量: ${(optimized.faq_items || []).length}个`)
        console.log(`   改进点数量: ${(optimizationResult.key_improvements || []).length}个`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: optimizationResult
        }))

      } catch (error) {
        console.error('\n❌ AI 优化失败:', error.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }))
      }
    })

    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    error: 'Not found',
    availableEndpoints: [
      'GET /health',
      'GET /test-claude',
      'POST /generate-seo-from-prompt',
      'POST /generate-seo',
      'POST /calculate-seo-score',
      'POST /optimize-keyword-density',
      'POST /optimize-seo-content-step',
      'POST /optimize-seo-content'
    ]
  }))
})

server.listen(PORT, () => {
  console.log('🚀 SEO 生成服务器已启动!')
  console.log(`📡 监听地址: http://localhost:${PORT}`)
  console.log('\n可用接口:')
  console.log(`  - GET  http://localhost:${PORT}/health - 健康检查`)
  console.log(`  - GET  http://localhost:${PORT}/test-claude - 测试 Claude CLI`)
  console.log(`  - POST http://localhost:${PORT}/generate-seo-from-prompt - 从 Prompt 生成（给前端用）`)
  console.log(`  - POST http://localhost:${PORT}/generate-seo - 生成 SEO 内容`)
  console.log(`  - POST http://localhost:${PORT}/calculate-seo-score - AI 智能评分`)
  console.log(`  - POST http://localhost:${PORT}/optimize-keyword-density - AI 优化关键词密度`)
  console.log(`  - POST http://localhost:${PORT}/optimize-seo-content-step - AI 分步优化`)
  console.log(`  - POST http://localhost:${PORT}/optimize-seo-content - AI 一键优化`)
  console.log('\n💡 提示: 保持此终端窗口运行，然后在浏览器中访问管理后台')
  console.log('  1. 在管理后台选择 "Claude Code CLI" 模型')
  console.log('  2. 点击批量生成按钮，前端会自动调用本地服务')
  console.log('  3. 所有 AI 操作都会通过本地 Claude CLI 执行')
  console.log('\n按 Ctrl+C 停止服务器\n')
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...')
  server.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})
