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
import { buildSEOScorePrompt, buildOptimizePrompt } from './seoPrompts.js'

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
 * @param {number} timeout - 超时时间（毫秒），默认300000（5分钟）
 */
async function callClaudeCLI(prompt, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const timeoutMinutes = Math.round(timeout / 60000)
    console.log(`🤖 调用 Claude Code CLI（超时：${timeoutMinutes}分钟）...`)

    // 🔧 上下文隔离: 在提示词前添加明确指令，避免继承当前会话上下文
    const isolatedPrompt = `<SYSTEM_RESET>
You are starting a COMPLETELY NEW conversation. IGNORE ALL previous messages and context.

This is a standalone task with NO relation to any prior discussion.

</SYSTEM_RESET>

${prompt}`

    // 使用 --output-format json 强制JSON输出 (必须配合-p使用)
    const claude = spawn('claude', ['-p', '--output-format=json', isolatedPrompt], {
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
        // 🔧 解析 --output-format json 的包装格式
        try {
          const wrapper = JSON.parse(output)
          if (wrapper.type === 'result' && wrapper.result) {
            console.log('✅ 提取Claude CLI JSON包装格式的result字段')
            resolve(wrapper.result) // 返回AI的实际输出
          } else {
            resolve(output)
          }
        } catch (e) {
          // 不是JSON包装，原样返回
          resolve(output)
        }
      }
    })

    claude.on('error', (error) => {
      clearInterval(timeoutCheck)
      reject(new Error(`无法启动 Claude CLI: ${error.message}\n请确保已安装 Claude Code CLI`))
    })
  })
}

/**
 * 调用 Claude Code CLI 获取纯文本响应（用于评分等任务）
 * 不使用 --output-format json,返回AI的原始文本输出
 */
async function callClaudeCLIRaw(prompt, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const timeoutMinutes = Math.round(timeout / 60000)
    console.log(`🤖 调用 Claude Code CLI (raw mode)（超时：${timeoutMinutes}分钟）...`)

    // 🔧 上下文隔离: 在提示词前添加明确指令，避免继承当前会话上下文
    const isolatedPrompt = `<SYSTEM_RESET>
You are starting a COMPLETELY NEW conversation. IGNORE ALL previous messages and context.

This is a standalone task with NO relation to any prior discussion.

</SYSTEM_RESET>

${prompt}`

    // 不使用 --output-format json,获取原始AI文本响应
    const claude = spawn('claude', ['-p', isolatedPrompt], {
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
        // 🔧 解析 --output-format json 的包装格式
        try {
          const wrapper = JSON.parse(output)
          if (wrapper.type === 'result' && wrapper.result) {
            console.log('✅ 提取Claude CLI JSON包装格式的result字段 (Raw)')
            resolve(wrapper.result) // 返回AI的实际输出
          } else {
            resolve(output)
          }
        } catch (e) {
          // 不是JSON包装，原样返回
          resolve(output)
        }
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
      console.log(`   提取后输出长度: ${output.length} 字符`)
      console.log(`   提取后输出开头: ${output.substring(0, 200).replace(/\n/g, '\\n')}`)

      // 🔧 如果提取的 result 已经是 JSON 对象,直接返回
      if (typeof output === 'object') {
        console.log('   ✅ result 已是 JSON 对象,直接返回')
        return output
      }
    }
  } catch (e) {
    // 不是JSON包装格式,继续使用原输出
    console.log('   策略0跳过: 不是JSON包装格式')
  }

  // 策略1: 优先直接解析整个输出（如果输出本身就是JSON）
  try {
    const trimmed = output.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      console.log('   策略1: 检测到输出是纯JSON，直接解析...')
      const parsed = JSON.parse(trimmed)
      console.log('   ✅ 策略1成功: 直接解析完成')
      return parsed
    }
  } catch (e) {
    console.log(`   策略1失败: ${e.message}，继续尝试其他策略...`)
  }

  // 策略2: 优先尝试匹配 Markdown 代码块中的JSON (最可靠)
  let jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    console.log('   策略2: 找到 ```json 代码块')
    try {
      return JSON.parse(jsonMatch[1].trim())
    } catch (e) {
      console.log(`   策略2解析失败: ${e.message}，继续尝试其他策略...`)
    }
  }

  // 策略3: 尝试匹配普通代码块 (无json标记)
  jsonMatch = output.match(/```\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    console.log('   策略3: 找到 ``` 代码块')
    try {
      return JSON.parse(jsonMatch[1].trim())
    } catch (e) {
      console.log(`   策略3解析失败: ${e.message}，继续尝试其他策略...`)
    }
  }

  // 如果代码块提取失败，尝试清理说明文字后再解析
  console.log('   代码块提取失败，尝试清理说明文字...')

  const explanationPatterns = [
    // Markdown 标题格式（最常见！）
    /^[\s\S]*?##\s*[📊✅🎯💡🔍]\s*[\s\S]*?(?=\{)/,  // "## 📊 分析完成" / "## ✅ 评分完成"
    /^[\s\S]*?###\s*[\s\S]*?(?=\{)/,                 // "### 标题"
    /^[\s\S]*?##\s+[\w\s]+\n[\s\S]*?(?=\{)/,         // "## 任意标题\n..."

    // 中文说明文字
    /^[\s\S]*?我已经完成[\s\S]*?(?=\{)/,   // "我已经完成了深度的SEO分析"
    /^[\s\S]*?我已完成[\s\S]*?(?=\{)/,     // "我已完成..."
    /^[\s\S]*?我注意到[\s\S]*?(?=\{)/,     // "我注意到..."
    /^[\s\S]*?已完成生成[\s\S]*?(?=\{)/,   // "已完成生成..."
    /^[\s\S]*?这是生成的[\s\S]*?(?=\{)/,   // "这是生成的..."
    /^[\s\S]*?以下是[\s\S]*?(?=\{)/,       // "以下是..."
    /^[\s\S]*?我已经[\s\S]*?(?=\{)/,       // "我已经..."
    /^[\s\S]*?根据您的[\s\S]*?(?=\{)/,     // "根据您的..."
    /^[\s\S]*?分析完成[\s\S]*?(?=\{)/,     // "分析完成"
    /^[\s\S]*?评分完成[\s\S]*?(?=\{)/,     // "评分完成"
    /^[\s\S]*?\*\*总分[:：][\s\S]*?(?=\{)/, // "**总分：83/100**"

    // 英文说明文字
    /^[\s\S]*?I have completed[\s\S]*?(?=\{)/,  // "I have completed..."
    /^[\s\S]*?Here is the[\s\S]*?(?=\{)/,       // "Here is the..."
    /^[\s\S]*?Analysis complete[\s\S]*?(?=\{)/  // "Analysis complete..."
  ]

  let cleanedOutput = output
  for (const pattern of explanationPatterns) {
    if (pattern.test(cleanedOutput)) {
      console.log(`   检测到说明文字,正在移除...`)
      cleanedOutput = cleanedOutput.replace(pattern, '')
      console.log(`   清理后开头: ${cleanedOutput.substring(0, 100).replace(/\n/g, '\\n')}`)
      break
    }
  }

  output = cleanedOutput

  // 策略4: 查找第一个 { 到最后一个 } (最激进的方法)
  const firstBrace = output.indexOf('{')
  const lastBrace = output.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    console.log(`   策略4: 提取 JSON 对象 (位置 ${firstBrace} 到 ${lastBrace})`)
    const jsonContent = output.substring(firstBrace, lastBrace + 1)

    try {
      const parsed = JSON.parse(jsonContent)
      console.log('   ✅ 策略4成功: JSON解析完成')
      return parsed
    } catch (error) {
      // 如果直接解析失败，尝试清理内容
      console.log('   策略4失败，尝试清理后再解析...')
      console.log(`   JSON解析错误: ${error.message}`)
      console.log(`   错误位置: ${error.message.match(/position (\d+)/) ? error.message.match(/position (\d+)/)[1] : '未知'}`)
      console.log(`   提取内容长度: ${jsonContent.length}`)
      console.log(`   提取内容的开头: ${jsonContent.substring(0, 300)}`)

      // 🔧 策略4.1: 尝试逐字符找到合法的JSON结束位置
      // 有时AI会在JSON后面添加说明文字,我们需要精确找到JSON的真实结束位置
      let validJsonEnd = -1
      let braceCount = 0
      let bracketCount = 0
      let inString = false
      let escapeNext = false

      for (let i = 0; i < jsonContent.length; i++) {
        const char = jsonContent[i]

        if (escapeNext) {
          escapeNext = false
          continue
        }

        if (char === '\\') {
          escapeNext = true
          continue
        }

        if (char === '"' && !escapeNext) {
          inString = !inString
          continue
        }

        if (!inString) {
          if (char === '{') {
            braceCount++
          } else if (char === '}') {
            braceCount--
            if (braceCount === 0 && bracketCount === 0) {
              // 找到完整的JSON对象结束位置（所有括号都闭合）
              validJsonEnd = i + 1
              break
            }
          } else if (char === '[') {
            bracketCount++
          } else if (char === ']') {
            bracketCount--
          }
        }
      }

      if (validJsonEnd > 0 && validJsonEnd < jsonContent.length) {
        const trimmedJson = jsonContent.substring(0, validJsonEnd)
        console.log(`   策略4.1: 截取到有效JSON结束位置 (${validJsonEnd}字符)`)
        console.log(`   丢弃的内容: ${jsonContent.substring(validJsonEnd, Math.min(validJsonEnd + 100, jsonContent.length))}`)

        try {
          return JSON.parse(trimmedJson)
        } catch (thirdError) {
          console.log(`   策略4.1失败: ${thirdError.message}`)
        }
      }

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

  // 策略5: 尝试直接解析整个输出（最后的fallback）
  console.log('   策略5: 尝试直接解析整个输出')
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

  // 通用 AI 调用端点 (用于 EEAT 评分等)
  if (req.url === '/call-ai' && req.method === 'POST') {
    let body = ''

    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body)

        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            success: false,
            error: 'Missing prompt parameter'
          }))
          return
        }

        console.log(`[/call-ai] 收到通用 AI 调用请求, prompt 长度: ${prompt.length}`)

        // 调用 Claude Code CLI (原始文本模式,不使用JSON包装)
        const result = await callClaudeCLIRaw(prompt)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: result
        }))
      } catch (error) {
        console.error('[/call-ai] 处理失败:', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error.message
        }))
      }
    })
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

        // 🔧 绝对JSON输出约束（必须放在开头！）
        const jsonConstraint = `⚠️⚠️⚠️ CRITICAL OUTPUT FORMAT REQUIREMENT (HIGHEST PRIORITY):

你的输出必须是**纯JSON对象**，不能包含任何其他文字！

**ABSOLUTE RULES**:
1. 输出必须直接以 { 开始，以 } 结束
2. { 之前和 } 之后不能有任何字符（包括空格、换行、解释文字）
3. **绝对禁止**在JSON之前或之后添加任何说明，例如:
   ❌ "我已经完成了深度的SEO分析"
   ❌ "## ✅ 评分完成"
   ❌ 任何形式的解释、评论、总结、markdown标题
4. **绝对禁止**使用markdown代码块:
   ❌ \`\`\`json ... \`\`\`
   ❌ \`\`\` ... \`\`\`
5. 必须是合法的JSON格式，所有字符串正确转义

✅ CORRECT: {"overall_score":85,"dimension_scores":{...},"actionable_recommendations":[...]}
❌ WRONG: 我已完成分析\\n{"overall_score":85,...}
❌ WRONG: \`\`\`json\\n{"overall_score":85,...}\\n\`\`\`

---

`

        // ✅ 使用统一的提示词配置（从数据库加载）
        const prompt = await buildSEOScorePrompt({
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

        // 🔧 将JSON约束放在提示词开头（AI更重视开头）
        const enhancedPrompt = jsonConstraint + prompt

        // 调用 Claude CLI (深度评分需要详细分析,设置8分钟超时)
        console.log('🧠 调用 Claude AI 进行深度分析...')
        const output = await callClaudeCLI(enhancedPrompt, 480000) // 8分钟超时
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

⚠️⚠️⚠️ CRITICAL OUTPUT REQUIREMENT (最高优先级 - 必须严格遵守):

1. 你必须只返回纯JSON对象,不能有任何其他文字
2. 绝对禁止添加任何中文或英文的说明文字,例如:
   ❌ "我注意到您提供的内容"
   ❌ "已完成生成"
   ❌ "这是生成的内容"
   ❌ "## ✅ SEO指南已完成生成"
   ❌ 任何形式的解释、总结、评论
3. 绝对禁止使用markdown代码块包裹JSON:
   ❌ \`\`\`json
   ❌ \`\`\`
4. 输出必须直接以 { 开始,以 } 结束
5. 不能在 { 之前或 } 之后有任何字符(包括空格、换行)
6. 必须是合法的JSON格式,所有字段都要正确转义

正确示例:
{"title":"文章标题","meta_title":"SEO标题","guide_content":"# Introduction\\n\\n内容...","faq_items":[{"question":"问题1","answer":"答案1"}],"secondary_keywords":["词1","词2"]}

错误示例:
我已经生成了内容:\\n{"title":"..."}  ← 这是错误的!
\`\`\`json\\n{"title":"..."}\\n\`\`\`  ← 这是错误的!

⚠️ 请立即开始输出JSON,不要有任何其他文字!`

        // 调用 Claude CLI
        console.log('🤖 调用 Claude CLI...')
        const output = await callClaudeCLI(fullPrompt, 300000) // 5分钟超时
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

        // 🔧 绝对JSON输出约束（必须放在开头！）
        const jsonConstraint = `⚠️⚠️⚠️ CRITICAL OUTPUT FORMAT REQUIREMENT (HIGHEST PRIORITY):

你的输出必须是**纯JSON对象**，不能包含任何其他文字！

**ABSOLUTE RULES**:
1. 输出必须直接以 { 开始，以 } 结束
2. { 之前和 } 之后不能有任何字符（包括空格、换行、解释文字）
3. **绝对禁止**在JSON之前或之后添加任何说明，例如:
   ❌ "我已经完成了优化"
   ❌ "## ✅ 优化完成"
   ❌ 任何形式的解释、评论、总结、markdown标题
4. **绝对禁止**使用markdown代码块:
   ❌ \`\`\`json ... \`\`\`
   ❌ \`\`\` ... \`\`\`
5. 必须是合法的JSON格式，所有字符串正确转义

✅ CORRECT: {"optimized_meta_title":"...","optimized_meta_description":"...","improvements_summary":[...]}
❌ WRONG: 我已完成优化\\n{"optimized_meta_title":"...",...}
❌ WRONG: \`\`\`json\\n{"optimized_meta_title":"...",...}\\n\`\`\`

---

`

        // ✅ 使用统一的提示词配置（从数据库加载）
        const prompt = await buildOptimizePrompt({
          languageName,
          languageCode: targetLanguage,
          currentScore: requestBody.seo_score || 0,
          metaTitle: requestBody.meta_title || '',
          metaDescription: requestBody.meta_description || '',
          metaKeywords: requestBody.meta_keywords || '',
          targetKeyword: requestBody.target_keyword || '',
          longTailKeywords: requestBody.long_tail_keywords || [],
          secondaryKeywords: requestBody.secondary_keywords || [],
          guideIntro: requestBody.guide_intro || '',
          guideContent: requestBody.guide_content || '',
          faqItems: requestBody.faq_items || [],
          recommendations: requestBody.seo_recommendations || []
        })

        // 🔧 将JSON约束放在提示词开头（AI更重视开头）
        const enhancedPrompt = jsonConstraint + prompt

        // 调用 Claude CLI (一键优化需要更长时间,设置10分钟超时)
        console.log('🧠 调用 Claude AI 进行深度优化...')
        console.log(`   目标语言: ${languageName} (${targetLanguage})`)
        console.log(`   当前评分: ${requestBody.seo_score || 0}分`)
        console.log(`   建议数量: ${(requestBody.seo_recommendations || []).length}条`)

        const output = await callClaudeCLI(enhancedPrompt, 600000) // 10分钟超时
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
