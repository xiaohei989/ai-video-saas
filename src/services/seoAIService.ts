/**
 * SEO AI内容生成服务
 * 使用APICore调用大模型自动生成SEO优化的用户指南内容
 * 支持内容生成、智能评分和内容优化
 */

import type {
  SEOGuideData,
  SEOScoreResult,
  SEOOptimizeRequest,
  SEOOptimizeResult,
  KeywordDensityOptimizeRequest,
  KeywordDensityOptimizeResult
} from '@/types/seo'
// 🔥 修复循环依赖：从 seoUtils 导入而不是 seoScoreCalculator
import { calculateKeywordDensity, extractFullContent, calculateKeywordDensityScore } from './seoUtils'
import { buildSEOScorePrompt, buildOptimizePrompt } from '@/config/seoPrompts'
import {
  SEO_SCORE_JSON_SCHEMA,
  SEO_CONTENT_JSON_SCHEMA,
  SEO_OPTIMIZE_JSON_SCHEMA,
  KEYWORD_DENSITY_OPTIMIZE_SCHEMA
} from '@/schemas/seoScoreSchema'
import { robustJSONParse, robustJSONParseWithValidation } from '@/utils/robustJSONParser'

interface APIResponse {
  success: boolean
  data?: any
  error?: string
}

interface GenerateSEOContentRequest {
  templateName: string
  templateDescription: string
  templateCategory: string
  templateTags: string[]
  targetKeyword: string // 目标关键词（单关键词优化）
  longTailKeywords: string[]
  targetLanguage: string
  aiModel: 'claude' | 'gpt' | 'gemini'
}

interface GeneratedSEOContent {
  meta_title: string
  meta_description: string
  meta_keywords: string
  guide_intro: string
  guide_content: string
  faq_items: Array<{
    question: string
    answer: string
  }>
  secondary_keywords: string[]
}

class SEOAIService {
  private readonly timeout = 120000 // 120秒超时，SEO内容生成需要更长时间（生成1500-2000字内容）

  private readonly apiKey: string
  private readonly endpoint: string

  constructor() {
    // 优先使用SEO专用API Key，否则fallback到通用API Key
    this.apiKey = import.meta.env.VITE_APICORE_SEO_API_KEY || import.meta.env.VITE_APICORE_API_KEY || ''
    this.endpoint = import.meta.env.VITE_APICORE_ENDPOINT || 'https://api.apicore.ai'

    if (!this.apiKey) {
      console.warn('[SEOAIService] 警告: 未配置VITE_APICORE_SEO_API_KEY或VITE_APICORE_API_KEY')
    } else {
      const keySource = import.meta.env.VITE_APICORE_SEO_API_KEY ? 'SEO专用Key' : '通用Key'
      console.log(`[SEOAIService] SEO AI service initialized (使用${keySource}, 直接调用APICore API)`)
    }
  }

  /**
   * 调用AI大模型（支持在线和本地模型）
   * 支持的模型：
   * - claude: Claude Opus 4.1 (APICore)
   * - gpt: GPT-4 Omni (APICore)
   * - gemini: Gemini 2.5 Pro (APICore)
   * - claude-code-cli: 本地 Claude Code CLI (localhost:3030)
   *
   * @param prompt - 提示词
   * @param model - 模型名称
   * @param jsonSchema - 可选的JSON Schema，用于强制结构化输出（仅在线API支持）
   */
  async callAI(
    prompt: string,
    model: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli' = 'claude',
    jsonSchema?: {
      name: string
      strict: boolean
      schema: any
    }
  ): Promise<string> {
    // 如果是本地模型，调用本地服务
    if (model === 'claude-code-cli') {
      return this.callLocalAI(prompt)
    }

    // 在线模型需要 API Key
    if (!this.apiKey) {
      throw new Error('未配置APICore API Key')
    }

    const modelName =
      model === 'claude' ? 'claude-opus-4-1-20250805' :
      model === 'gemini' ? 'gemini-2.5-pro' :
      'gpt-4o'

    // 根据模型设置合适的 max_tokens
    // Claude/GPT-4o 支持 16K 输出，Gemini 支持 8K
    const maxTokens = model === 'gemini' ? 6000 : 8000

    // 🔧 构建 response_format 参数
    // 如果提供了 jsonSchema，使用 json_schema 模式（OpenAI/Anthropic Structured Output）
    // 否则使用传统的 json_object 模式
    const responseFormat = jsonSchema
      ? { type: 'json_schema' as const, json_schema: jsonSchema }
      : { type: 'json_object' as const }

    // 计算请求体大小用于诊断
    const requestBody = JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
      response_format: responseFormat
    })
    const bodySizeKB = (new Blob([requestBody]).size / 1024).toFixed(2)

    console.log(`[SEOAIService] 调用 ${modelName} 模型 (直接调用APICore)...`)
    console.log(`[SEOAIService] 📊 请求信息: prompt长度=${prompt.length}字符, 请求体大小=${bodySizeKB}KB`)
    if (jsonSchema) {
      console.log(`[SEOAIService] 🎯 使用 Structured Output (JSON Schema: ${jsonSchema.name})`)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      // 直接调用APICore chat completions API
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: requestBody,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`APICore调用失败 (${response.status}): ${errorText}`)
      }

      const data = await response.json()

      // 详细记录响应信息用于调试
      console.log(`[SEOAIService] API响应状态:`, {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length || 0,
        tokensUsed: data.usage?.total_tokens || 0,
        model: data.model
      })

      // 检查响应格式
      if (!data.choices || data.choices.length === 0) {
        // 特别处理 Gemini 模型返回空 choices 的情况
        if (model === 'gemini' && data.usage?.completion_tokens > 0) {
          console.error('[SEOAIService] Gemini模型返回空choices但消耗了tokens:', data.usage)
          throw new Error(
            `Gemini模型响应异常: 模型进行了推理(${data.usage.completion_tokens} tokens)但未返回内容。` +
            `这可能是APICore对Gemini模型的兼容性问题。请尝试使用Claude或GPT模型。`
          )
        }
        throw new Error('API响应中没有生成内容 (choices数组为空)')
      }

      if (!data.choices[0].message) {
        throw new Error('API响应格式不正确: choices[0].message 不存在')
      }

      const content = data.choices[0].message.content

      if (!content || content.trim() === '') {
        throw new Error('API返回的内容为空')
      }

      console.log(`[SEOAIService] ${modelName} 调用成功, 内容长度: ${content.length} 字符`)

      return content
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${modelName} 调用超时（${this.timeout / 1000}秒）`)
      }

      // 详细的错误诊断
      console.error('[SEOAIService] APICore调用错误:', error)

      if (error instanceof Error) {
        const errorMessage = error.message

        // 网络连接错误
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          console.error(`[SEOAIService] ❌ 网络连接失败`)
          console.error(`[SEOAIService] 📊 请求详情: ${bodySizeKB}KB`)

          // 如果请求体很大，提示可能的原因
          if (parseFloat(bodySizeKB) > 50) {
            throw new Error(
              `网络连接失败（请求体 ${bodySizeKB}KB 较大）。\n` +
              `建议：\n` +
              `1. 使用本地SEO服务器（运行 npm run seo:server 后切换到"本地模型"）\n` +
              `2. 如果内容超过3000字，考虑分段处理\n` +
              `3. 检查网络连接是否稳定`
            )
          } else {
            throw new Error(
              `网络连接失败，无法访问 APICore API。\n` +
              `建议：\n` +
              `1. 检查网络连接\n` +
              `2. 确认可以访问 ${this.endpoint}\n` +
              `3. 尝试使用本地SEO服务器（npm run seo:server）`
            )
          }
        }

        // 其他错误直接抛出
        throw error
      }

      throw error
    }
  }

  /**
   * 调用本地 Claude Code CLI (通用版本)
   * 通过 localhost:3030 调用本地 AI 服务
   */
  private async callLocalAI(prompt: string): Promise<string> {
    console.log('[SEOAIService] 使用本地 Claude Code CLI...')

    try {
      const response = await fetch('http://localhost:3030/call-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `本地服务返回错误: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success || !result.data) {
        throw new Error('本地服务返回数据格式错误')
      }

      // 如果返回的是对象格式(Claude Code CLI的响应格式),提取text字段
      let aiResponse = result.data

      console.log('[SEOAIService] 响应类型:', typeof aiResponse)
      console.log('[SEOAIService] 响应对象keys:', aiResponse && typeof aiResponse === 'object' ? Object.keys(aiResponse).join(', ') : 'N/A')

      if (typeof aiResponse === 'object' && aiResponse !== null) {
        if (aiResponse.text) {
          console.log('[SEOAIService] 提取text字段, 长度:', aiResponse.text.length)
          aiResponse = aiResponse.text
        } else {
          console.warn('[SEOAIService] 对象格式但没有text字段,可能是错误的响应格式')
          console.log('[SEOAIService] 响应内容:', JSON.stringify(aiResponse).substring(0, 500))
        }
      }

      console.log('[SEOAIService] 最终响应类型:', typeof aiResponse)
      console.log('[SEOAIService] 最终响应长度:', typeof aiResponse === 'string' ? aiResponse.length : 'N/A')

      return aiResponse

    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        throw new Error(
          '无法连接到本地服务器 (http://localhost:3030)。\n' +
          '请确保:\n' +
          '1. 已运行 npm run seo:server 启动本地服务\n' +
          '2. 本地服务器正在 3030 端口运行\n' +
          '3. 没有防火墙阻止连接'
        )
      }
      console.error('[SEOAIService] 本地 AI 调用失败:', error)
      throw error
    }
  }

  /**
   * 获取语言名称
   */
  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      en: 'English',
      zh: '中文',
      ja: '日本語',
      ko: '한국어',
      es: 'Español',
      de: 'Deutsch',
      fr: 'Français',
      ar: 'العربية'
    }
    return languages[code] || 'English'
  }

  /**
   * 生成完整的SEO内容
   */
  async generateSEOContent(
    request: GenerateSEOContentRequest
  ): Promise<GeneratedSEOContent> {
    const languageName = this.getLanguageName(request.targetLanguage)

    const prompt = `你是一位专业的SEO内容编写专家和视频教程作者。请为以下视频模板创建一份完整的、SEO优化的用户指南。

## 模板信息
- 模板名称: ${request.templateName}
- 模板描述: ${request.templateDescription}
- 分类: ${request.templateCategory}
- 标签: ${request.templateTags.join(', ')}

## SEO关键词
- 目标关键词: ${request.targetKeyword}
- 长尾关键词: ${request.longTailKeywords.join(', ')}

## 目标语言
请用 **${languageName}** 编写所有内容。

## 输出要求
请生成以下内容，必须严格按照JSON格式返回：

\`\`\`json
{
  "meta_title": "页面标题（55-60字符）",
  "meta_description": "页面描述（150-155字符，吸引点击）",
  "meta_keywords": "逗号分隔的关键词列表",
  "guide_intro": "引言段落（100-150字，吸引读者继续阅读）",
  "guide_content": "完整的用户指南内容（Markdown格式，1500-2000字）",
  "faq_items": [
    {
      "question": "常见问题1",
      "answer": "详细答案"
    },
    {
      "question": "常见问题2",
      "answer": "详细答案"
    }
  ],
  "secondary_keywords": ["次要关键词1", "次要关键词2", "次要关键词3"]
}
\`\`\`

## Meta 标题生成要求（重要！）

**Meta 标题**是最关键的SEO元素，必须精心设计：

1. **长度**：严格控制在55-60字符（中文约25-30字，英文约55-60字符）
2. **关键词位置**：主关键词必须在标题前半部分（理想是前10个字符内）
3. **吸引力**：标题必须能够吸引用户点击，传递明确的价值主张
4. **专业性**：体现专业水平，避免简单的关键词堆砌
5. **独特性**：与竞争对手区分开，突出独特卖点

**错误示例❌**：
- "asmr food video" （太简单，没有价值）
- "best asmr food video template" （生硬，不自然）
- "ASMR FOOD VIDEO - BEST TUTORIAL" （全大写，spam风格）

**优秀示例✅**：
- "Create Relaxing ASMR Food Videos: Complete Tutorial & Tips"
- "ASMR美食视频制作指南：从入门到精通的完整教程"
- "ASMRフードビデオ作成ガイド：初心者向けの詳しい手順"

**标题公式**：
- 英文：[动作词] + [主关键词] + [价值承诺/修饰词]
- 中文：[主关键词] + [用途/场景] + [价值承诺]
- 日文/韩文：类似中文结构

请根据目标语言和模板特点，创建一个专业、吸引人、SEO友好的标题！

## 用户指南内容结构（guide_content）
请使用Markdown格式编写，包含以下部分：

### 必须包含的章节：

1. **简介** (## Introduction / ## 简介)
   - 解释这个视频模板是什么
   - 它适合什么场景使用
   - 能解决什么问题

2. **功能特点** (## Key Features / ## 主要特点)
   - 列出3-5个核心功能
   - 每个功能用一个小段落说明

3. **使用步骤** (## How to Use / ## 使用教程)
   - 详细的分步骤说明
   - 每个步骤要清晰明确
   - 至少包含5-8个步骤
   - 使用编号列表

4. **最佳实践** (## Best Practices / ## 最佳实践)
   - 提供3-5个专业建议
   - 帮助用户获得更好的效果

5. **常见问题处理** (## Troubleshooting / ## 常见问题)
   - 列出2-3个可能遇到的问题及解决方案

6. **创意灵感** (## Creative Ideas / ## 创意建议)
   - 提供3-5个使用场景示例
   - 激发用户的创作灵感

7. **总结** (## Conclusion / ## 总结)
   - 简短总结要点
   - 鼓励用户开始创作

## SEO优化要求：

**⚠️ 长尾关键词密度优化（最高优先级）**：
- **必须逐个检查每个长尾关键词**：${request.longTailKeywords.join(', ')}
- **确保每个长尾关键词至少出现2-3次**
- 主关键词密度：2-3%
- 每个长尾关键词密度：1-2%（至少出现2-3次）
- 在Introduction、How to Use、Best Practices、Troubleshooting、Creative Ideas、Conclusion、FAQ等各部分自然融入
- 避免关键词堆砌，要在完整句子中自然使用

**其他优化要求**：
1. 使用清晰的标题层级（H2、H3）
2. 段落长度适中（3-5句话）
3. 使用过渡词汇使内容流畅
4. 包含实用的、可操作的建议
5. FAQ部分至少5-8个问答对，并在FAQ中自然融入长尾关键词

## 重要提示：
- 内容必须原创、有价值
- 避免营销话术，专注于教育
- 语气专业但友好
- 确保所有内容都是${languageName}语言

请严格按照JSON格式输出，不要添加额外的说明文字。`

    try {
      console.log('[SEOAIService] 开始生成内容...')
      const response = await this.callAI(prompt, request.aiModel, SEO_CONTENT_JSON_SCHEMA)

      // 🔧 使用健壮的JSON解析器
      const parsedContent = robustJSONParseWithValidation<GeneratedSEOContent>(
        response,
        ['meta_title', 'meta_description', 'guide_content', 'faq_items'],
        {
          logPrefix: '[SEOAIService]',
          verbose: false
        }
      )

      console.log('[SEOAIService] 内容生成成功')
      return parsedContent
    } catch (error) {
      console.error('[SEOAIService] 内容生成失败:', error)
      throw new Error('AI内容生成失败，请检查API配置或重试')
    }
  }

  /**
   * 生成示例内容（当AI服务不可用时的fallback）
   */
  generateFallbackContent(
    request: GenerateSEOContentRequest
  ): GeneratedSEOContent {
    return {
      meta_title: `${request.targetKeyword} - Complete Guide`,
      meta_description: `Learn how to use ${request.templateName} to create amazing videos. Step-by-step tutorial with tips and best practices.`,
      meta_keywords: request.longTailKeywords.join(', '),
      guide_intro: `Welcome to our comprehensive guide on ${request.templateName}. This powerful template helps you create professional videos quickly and easily.`,
      guide_content: `## Introduction

${request.templateName} is a versatile video template designed for ${request.templateCategory}. Whether you're a beginner or an experienced creator, this template provides all the tools you need.

## Key Features

- **Easy to Use**: Simple interface with intuitive controls
- **Professional Results**: High-quality output optimized for all platforms
- **Customizable**: Flexible parameters to match your creative vision

## How to Use

1. **Select the Template**: Choose ${request.templateName} from the template library
2. **Configure Parameters**: Adjust settings to match your requirements
3. **Generate Video**: Click the generate button to create your video
4. **Download**: Save your finished video in your preferred format

## Best Practices

- Start with default settings and adjust gradually
- Preview before final generation
- Use high-quality source materials

## Conclusion

${request.templateName} makes video creation simple and effective. Start creating today!`,
      faq_items: [
        {
          question: `What is ${request.templateName}?`,
          answer: `${request.templateName} is a video template that helps you create professional videos quickly.`
        },
        {
          question: 'How long does it take to generate a video?',
          answer: 'Video generation typically takes 2-5 minutes depending on complexity.'
        },
        {
          question: 'Can I customize the template?',
          answer: 'Yes, the template offers multiple customization options to match your needs.'
        }
      ],
      secondary_keywords: [
        `${request.templateName} tutorial`,
        `how to use ${request.templateName}`,
        `${request.templateName} guide`
      ]
    }
  }

  /**
   * 验证API配置
   */
  validateAPIConfig(): { valid: boolean; message: string } {
    if (!this.apiKey) {
      return {
        valid: false,
        message: '未配置VITE_APICORE_API_KEY环境变量'
      }
    }

    if (!this.endpoint) {
      return {
        valid: false,
        message: '未配置VITE_APICORE_ENDPOINT环境变量'
      }
    }

    return {
      valid: true,
      message: 'API配置正常（直接调用APICore API）'
    }
  }

  /**
   * AI 智能评分
   * 支持在线模型（claude/gpt/gemini）和本地模型（claude-code-cli）
   */
  async calculateSEOScore(
    data: SEOGuideData,
    model: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli' = 'claude'
  ): Promise<SEOScoreResult> {
    // 如果是 claude-code-cli，调用本地服务
    if (model === 'claude-code-cli') {
      return this.calculateSEOScoreLocal(data)
    }

    // ✅ 使用统一的提示词配置
    const languageName = this.getLanguageName(data.language || 'en')

    // 提取完整内容用于关键词密度计算
    const fullContent = extractFullContent(data)

    // 仅计算目标关键词密度（单关键词优化策略）
    const allKeywords = data.target_keyword ? [data.target_keyword] : []

    // 计算关键词密度
    const keywordDensity = calculateKeywordDensity(fullContent, allKeywords)

    const prompt = await buildSEOScorePrompt({
      languageName,
      languageCode: data.language || 'en',
      targetKeyword: data.target_keyword || '',
      metaTitle: data.meta_title || '',
      metaDescription: data.meta_description || '',
      metaKeywords: data.meta_keywords || '',
      longTailKeywords: data.long_tail_keywords || [],
      keywordDensity,
      guideIntro: data.guide_intro || '',
      guideContent: data.guide_content || '',
      faqItems: data.faq_items || []
    })


    try {
      console.log('[SEO AI Score] 开始在线AI评分...')
      const response = await this.callAI(prompt, model, SEO_SCORE_JSON_SCHEMA)

      // 🔧 使用健壮的JSON解析器
      const parsedContent = robustJSONParseWithValidation(
        response,
        ['overall_score', 'dimension_scores', 'actionable_recommendations'],
        {
          logPrefix: '[SEO AI Score]',
          verbose: false
        }
      )

      // 🔄 适配新的AI响应格式
      let metaInfoScore: number | undefined
      let contentQualityScore: number
      let keywordOptimizationScore: number
      let readabilityScore: number
      let recommendations: string[]

      if (parsedContent.dimension_scores) {
        // ✅ 新格式 (从数据库提示词模板): {dimension_scores: {...}, suggestions: [...]}
        console.log('[SEO AI Score] 检测到新格式响应 (dimension_scores)')

        metaInfoScore = parsedContent.dimension_scores.meta_info_quality || 0
        contentQualityScore = parsedContent.dimension_scores.content_quality || 0
        keywordOptimizationScore = parsedContent.dimension_scores.keyword_optimization || 0
        readabilityScore = parsedContent.dimension_scores.readability || 0

        // 转换suggestions对象数组为字符串数组
        const rawSuggestions = parsedContent.suggestions || []
        recommendations = rawSuggestions.map((sug: any) => {
          if (typeof sug === 'string') {
            return sug
          }
          // 新格式: {category, issue, suggestion, priority, expected_impact}
          return `【${sug.category}】${sug.issue}\n建议: ${sug.suggestion}\n预期效果: ${sug.expected_impact || '提升SEO分数'}`
        })
      } else {
        // ⚠️ 旧格式 (兼容性): {content_quality_score, keyword_optimization_score, ...}
        console.log('[SEO AI Score] 检测到旧格式响应 (直接字段)')

        metaInfoScore = undefined
        contentQualityScore = parsedContent.content_quality_score || 0
        keywordOptimizationScore = parsedContent.keyword_optimization_score || 0
        readabilityScore = parsedContent.readability_score || 0
        recommendations = parsedContent.recommendations || []
      }

      // ✅ 使用确定性算法重新计算关键词密度（替代AI估算）
      const accurateKeywordDensity = calculateKeywordDensity(fullContent, allKeywords)
      const densityScore = calculateKeywordDensityScore(accurateKeywordDensity, data.target_keyword)

      console.log('[SEO AI Score] 使用算法重新计算密度:', {
        keywords: allKeywords.length,
        algorithmDensity: Object.keys(accurateKeywordDensity).length,
        densityScore
      })

      // ✅ 直接使用AI原始评分，但限制最大值防止AI超出范围
      // AI标准: meta_info(30) + content(25) + keyword(25) + readability(20) + density(10) = 110分
      const cappedMetaInfoScore = metaInfoScore ? Math.min(metaInfoScore, 30) : undefined
      const cappedContentScore = Math.min(contentQualityScore, 25)
      const cappedKeywordScore = Math.min(keywordOptimizationScore, 25)
      const cappedReadabilityScore = Math.min(readabilityScore, 20)
      const cappedDensityScore = Math.min(densityScore, 10)

      const totalScore = (cappedMetaInfoScore || 0) + cappedContentScore + cappedKeywordScore + cappedReadabilityScore + cappedDensityScore

      console.log('[SEO AI Score] AI评分完成 (在线，含上限限制):', {
        原始: {
          meta_info: metaInfoScore,
          content: contentQualityScore,
          keyword: keywordOptimizationScore,
          readability: readabilityScore,
          density: densityScore
        },
        限制后: {
          meta_info: cappedMetaInfoScore,
          content: cappedContentScore,
          keyword: cappedKeywordScore,
          readability: cappedReadabilityScore,
          density: cappedDensityScore
        },
        总分: totalScore,
        recommendations: recommendations.length
      })

      return {
        total_score: totalScore,
        meta_info_quality_score: cappedMetaInfoScore, // 最大30分
        content_quality_score: cappedContentScore, // 最大25分
        keyword_optimization_score: cappedKeywordScore, // 最大25分
        readability_score: cappedReadabilityScore, // 最大20分
        keyword_density_score: cappedDensityScore, // 最大10分
        keyword_density: accurateKeywordDensity,
        recommendations: recommendations
      }
    } catch (error) {
      console.error('[SEO AI Score] 评分失败:', error)
      throw new Error('AI评分失败，请检查API配置或重试')
    }
  }

  /**
   * 优化关键词密度 - 全面升级版本
   * ✅ 支持所有类型关键词（主、长尾、次要）
   * ✅ 精确计算目标次数（基于实际字数）
   * ✅ 更强大的AI提示词
   */
  async optimizeKeywordDensity(
    request: KeywordDensityOptimizeRequest,
    model: 'claude' | 'gpt' | 'gemini' = 'claude'
  ): Promise<KeywordDensityOptimizeResult> {
    // ✅ 数据验证：确保必要字段存在
    if (!request.guide_content) {
      throw new Error('guide_content 字段缺失，无法进行关键词密度优化')
    }

    if (!request.faq_items || !Array.isArray(request.faq_items)) {
      console.warn('[SEO Keyword Density] faq_items 缺失或格式不正确，将使用空数组')
      request.faq_items = []
    }

    if (!request.keywords_to_optimize || request.keywords_to_optimize.length === 0) {
      throw new Error('没有需要优化的关键词')
    }

    const languageName = this.getLanguageName(request.language || 'en')

    // 构建详细的关键词优化任务清单
    const keywordTasks = request.keywords_to_optimize.map((k, i) => {
      const distributionPlan = k.action === 'increase' ? `
请在以下位置自然增加 "${k.keyword}"：
  - Introduction 段落：增加 ${Math.ceil(k.needToAdd * 0.2)} 次
  - How to Use 步骤：增加 ${Math.ceil(k.needToAdd * 0.3)} 次
  - Best Practices：增加 ${Math.ceil(k.needToAdd * 0.2)} 次
  - Troubleshooting：增加 ${Math.ceil(k.needToAdd * 0.1)} 次
  - Conclusion：增加 ${Math.ceil(k.needToAdd * 0.1)} 次
  - FAQ 问答：增加 ${Math.ceil(k.needToAdd * 0.1)} 次
` : `
请在正文中找到 "${k.keyword}" 的 ${k.needToRemove} 处不必要的重复，用同义词替换或删除冗余句子。
保留最自然、最有价值的提及。
`

      return `
### ${i + 1}. "${k.keyword}" ${k.isPrimary ? '【主关键词 - 最高优先级】' : ''}

**当前状态**：
- 出现次数：${k.currentCount} 次
- 当前密度：${k.currentDensity.toFixed(2)}%
- 问题：${k.reason}

**优化目标**：
- 目标次数：${k.targetCount} 次（${k.action === 'increase' ? `增加 ${k.needToAdd}` : `减少 ${k.needToRemove}`} 次）
- 目标密度：${k.targetDensity.toFixed(2)}%

**执行计划**：
${distributionPlan}`
    }).join('\n')

    // 优先级排序（主关键词最高）
    const priorityList = request.keywords_to_optimize
      .sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1
        if (!a.isPrimary && b.isPrimary) return 1
        return 0
      })
      .map((k, i) => `${i + 1}. ${k.keyword} ${k.isPrimary ? '【主关键词 - 必须优先达标】' : ''}`)
      .join('\n')

    const prompt = `🚨 CRITICAL TASK - 这是一个精确度要求极高的任务，必须严格执行！

你是专业的SEO内容优化专家。你的任务是**精确**地在内容中增加指定次数的关键词。

⚠️ 目标语言: ${languageName} (${request.language})
所有内容必须保持 ${languageName} 语言。

## 文章数据
- 当前总字数：${request.total_words} 字
- 需要优化的关键词数量：${request.keywords_to_optimize.length} 个

## ⚡ 核心任务规则（必须100%遵守）

1. **必须精确执行**：如果要求"增加 8 次"，你必须增加恰好 7-9 次（误差±1可接受）
2. **不允许偷懒**：不要只增加 1-2 次就认为完成了
3. **返回前必须自己验证**：在返回内容前，手动数一遍每个关键词是否真的增加了指定次数
4. **宁可不够自然，也要达到数量**：数量达标是第一优先级，自然度是第二优先级

## 关键词优化任务清单

${keywordTasks}

## 关键要求

### 1. 精确达标（🔴 最高优先级）
- ⚠️ **MUST EXACTLY MEET THE TARGET COUNT** ⚠️
- 如果要求增加 10 次，你必须增加 9-11 次（误差±1）
- 不要只增加 2-3 次就停止

### 2. 自然融入技巧
- 作为句子主语："${request.keywords_to_optimize[0]?.keyword} provides..."
- 作为宾语："Learn how to use ${request.keywords_to_optimize[0]?.keyword}..."
- 在问题中："What is ${request.keywords_to_optimize[0]?.keyword}?"
- 在列表项："Try ${request.keywords_to_optimize[0]?.keyword} for..."

### 3. 质量保证
- 每次提及都要在完整、有意义的句子中
- 不要在同一句子中重复相同关键词
- 保持内容的流畅性和专业性
- 不破坏原有内容结构

### 4. 优先级顺序（严格按照此顺序优化）
${priorityList}

### 5. 自我验证（🔴 返回前必须执行）

**在返回内容之前，你必须：**

1. **手动数一遍**：逐个关键词，在优化后的内容中搜索并数出现次数
2. **检查达标情况**：确认是否达到目标次数（误差±1可接受）
3. **如果不达标**：继续修改，直到达标

验证清单（请在心中完成，不要在返回内容中包含）：
${request.keywords_to_optimize.map(k => `- [ ] "${k.keyword}" 目标${k.targetCount}次，实际____次 (${k.action === 'increase' ? `需增加${k.needToAdd}` : `需减少${k.needToRemove}`})`).join('\n')}

⚠️ 如果你发现某个关键词没有达标，请立即修改内容，不要返回不达标的结果！

## 当前内容

### 正文内容 (${request.guide_content.length}字符，${request.total_words}字)
${request.guide_content}

### FAQ (${request.faq_items.length}个问题)
${request.faq_items.map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n')}

## 输出格式

请严格按照以下 JSON 格式返回优化结果：

\`\`\`json
{
  "optimized_guide_content": "优化后的正文（Markdown格式，${languageName}）",
  "optimized_faq_items": [
    {"question": "问题1（${languageName}）", "answer": "答案1（${languageName}）"}
  ],
  "key_improvements": [
    "为 '${request.keywords_to_optimize[0]?.keyword}' 在 Introduction 增加X次（第X-Y行）",
    "为 '${request.keywords_to_optimize[1]?.keyword}' 在 Best Practices 增加X次（第X-Y行）"
  ]
}
\`\`\`

⚠️ 重要提示（必须遵守）：
- 只返回 JSON，不要添加任何说明文字
- 内容必须是 ${languageName} 语言
- 保持原有内容结构，只做关键词密度优化
- key_improvements 必须详细列出每个关键词的优化位置
- 🔴 **最重要**：确保每个关键词都达到了目标次数（误差±1），不达标不要返回！

## ⚡ 最后确认

在点击"返回"之前，问自己：
1. 我是否真的增加了指定次数的关键词？（不是只增加1-2次）
2. 我是否手动验证过每个关键词的出现次数？
3. 达标率是否 >= 80%？

如果有任何一个答案是"否"，请立即修改内容！`

    try {
      console.log('[SEO Keyword Density] 🚀 开始全面优化关键词密度...')
      console.log(`[SEO Keyword Density] 📊 统计信息:`, {
        总字数: request.total_words,
        需优化关键词数: request.keywords_to_optimize.length,
        主关键词数: request.keywords_to_optimize.filter(k => k.isPrimary).length,
        需增加密度的: request.keywords_to_optimize.filter(k => k.action === 'increase').length,
        需减少密度的: request.keywords_to_optimize.filter(k => k.action === 'decrease').length
      })

      console.log('[SEO Keyword Density] 📋 优化列表:')
      request.keywords_to_optimize.forEach(k => {
        console.log(`  - ${k.keyword} ${k.isPrimary ? '【主】' : ''}:`,
          `${k.currentCount}次(${k.currentDensity.toFixed(2)}%) → ${k.targetCount}次(${k.targetDensity.toFixed(2)}%)`,
          `[${k.action === 'increase' ? `+${k.needToAdd}` : `-${k.needToRemove}`}]`
        )
      })

      const response = await this.callAI(prompt, model, KEYWORD_DENSITY_OPTIMIZE_SCHEMA)

      // 🔧 使用健壮的JSON解析器
      const parsedContent = robustJSONParseWithValidation<KeywordDensityOptimizeResult>(
        response,
        ['optimized_content', 'key_improvements'],
        {
          logPrefix: '[SEO Keyword Density]',
          verbose: false
        }
      )

      console.log('[SEO Keyword Density] ✅ 优化完成:', {
        改进项数量: parsedContent.key_improvements?.length || 0
      })

      return {
        optimized_guide_content: parsedContent.optimized_guide_content,
        optimized_faq_items: parsedContent.optimized_faq_items,
        key_improvements: parsedContent.key_improvements || [],
        verification: parsedContent.verification // AI自行验证的结果（可选）
      }
    } catch (error) {
      console.error('[SEO Keyword Density] ❌ 优化失败:', error)
      throw new Error('关键词密度优化失败，请检查API配置或重试')
    }
  }

  /**
   * 计算实际关键词密度（精确算法）
   */
  private calculateActualDensity(content: string, keyword: string): number {
    if (!content || !keyword) return 0

    const normalizedContent = content.toLowerCase()
    const normalizedKeyword = keyword.toLowerCase()

    // 计算总词数
    const words = content.split(/[\s\p{P}]+/u).filter(w => w.length > 0)
    const totalWords = words.length

    if (totalWords === 0) return 0

    // 计算关键词出现次数
    const keywordWords = normalizedKeyword.split(/\s+/)
    let count = 0

    if (keywordWords.length === 1) {
      // 单词关键词
      words.forEach(word => {
        if (word.toLowerCase() === keywordWords[0]) count++
      })
    } else {
      // 多词关键词(使用正则)
      const regex = new RegExp(`\\b${normalizedKeyword.replace(/\s+/g, '\\s+')}\\b`, 'gi')
      const matches = content.match(regex)
      count = matches ? matches.length : 0
    }

    const density = (count / totalWords) * 100
    return Math.round(density * 10) / 10
  }

  /**
   * AI 内容优化 - 在线版本（一键优化）
   * ✅ v2.1: 增加密度验证和自动重试机制
   */
  async optimizeSEOContent(
    request: SEOOptimizeRequest,
    model: 'claude' | 'gpt' | 'gemini' = 'claude'
  ): Promise<SEOOptimizeResult> {
    const languageName = this.getLanguageName(request.language || 'en')
    const MAX_RETRIES = 2 // 最多重试2次
    let attempt = 0
    let lastDensity = 0

    while (attempt < MAX_RETRIES) {
      attempt++

      console.log(`[SEO AI Optimize] 第${attempt}次尝试优化...`)

      // ✅ 使用统一的提示词配置（从数据库加载）
      const prompt = await buildOptimizePrompt({
        languageName,
        languageCode: request.language || 'en',
        currentScore: request.seo_score || 0,
        metaTitle: request.meta_title || '',
        metaDescription: request.meta_description || '',
        metaKeywords: request.meta_keywords || '',
        targetKeyword: request.target_keyword || '',
        longTailKeywords: request.long_tail_keywords || [],
        secondaryKeywords: request.secondary_keywords || [],
        guideIntro: request.guide_intro || '',
        guideContent: request.guide_content || '',
        faqItems: request.faq_items || [],
        recommendations: request.seo_recommendations || []
      })

      try {
        const response = await this.callAI(prompt, model, SEO_OPTIMIZE_JSON_SCHEMA)

        // 🔧 使用健壮的JSON解析器
        const parsedContent = robustJSONParseWithValidation<SEOOptimizeResult>(
          response,
          ['optimized_content', 'optimization_summary', 'key_improvements'],
          {
            logPrefix: '[SEO AI Optimize]',
            verbose: false
          }
        )

        // ========== v2.1 新增: 验证优化结果的密度 ==========
        const optimizedContent = parsedContent.optimized_content
        if (!optimizedContent || !optimizedContent.guide_content) {
          throw new Error('优化结果缺少必要字段')
        }

        // 拼接完整可索引内容计算密度（SEO标准：包含Meta+正文+FAQ）
        const faqText = optimizedContent.faq_items
          ? optimizedContent.faq_items.map((item: any) => `${item.question} ${item.answer}`).join(' ')
          : ''

        const fullContent = [
          optimizedContent.meta_title || '',      // ✅ Meta标题（最重要的SEO位置）
          optimizedContent.meta_description || '', // ✅ Meta描述（显示在搜索结果）
          optimizedContent.guide_intro || '',      // ✅ 引言
          optimizedContent.guide_content || '',    // ✅ 正文
          faqText                                  // ✅ FAQ（可显示为富摘要）
        ].filter(Boolean).join('\n\n')

        const actualDensity = this.calculateActualDensity(
          fullContent,
          request.target_keyword || ''
        )

        lastDensity = actualDensity

        console.log(`[SEO AI Optimize] 第${attempt}次尝试结果:`, {
          实际密度: `${actualDensity}%`,
          目标范围: '1.5-3.5%',
          improvements: parsedContent.key_improvements?.length || 0
        })

        // 密度检查（调整为1.5-3.5%，因为现在包含了所有可索引内容）
        if (actualDensity >= 1.5 && actualDensity <= 3.5) {
          console.log(`✅ 密度合格(${actualDensity}%), 接受结果`)

          // 在返回结果中增加实际密度信息
          if (!parsedContent.keyword_density_verification) {
            parsedContent.keyword_density_verification = {} as any
          }

          parsedContent.keyword_density_verification = {
            ...parsedContent.keyword_density_verification,
            actual_density: `${actualDensity}%`,
            density_status: 'optimal',
            attempts: attempt
          }

          return parsedContent
        }

        // 密度不合格
        if (attempt === MAX_RETRIES) {
          console.warn(`⚠️ 已达最大重试次数(${MAX_RETRIES}), 密度仍为${actualDensity}%, 接受当前结果`)

          if (!parsedContent.keyword_density_verification) {
            parsedContent.keyword_density_verification = {} as any
          }

          parsedContent.keyword_density_verification = {
            ...parsedContent.keyword_density_verification,
            actual_density: `${actualDensity}%`,
            density_status: actualDensity < 1.5 ? 'too_low' : 'too_high',
            attempts: attempt,
            warning: `密度${actualDensity}%不在理想范围(1.5-3.5%)`
          }

          return parsedContent
        }

        // 准备重试
        const densityIssue = actualDensity < 1.5 ? '过低' : '过高'
        console.log(`⚠️ 密度${densityIssue}(${actualDensity}%), 准备第${attempt + 1}次尝试...`)

        // 为下次尝试添加特殊指导
        if (actualDensity < 1.5) {
          // 密度过低,需要增加关键词
          request.seo_recommendations = [
            `🚨 上次优化失败: 全局关键词密度太低(${actualDensity}%, 包含Meta+正文+FAQ)`,
            '⚠️ 这次必须按照任务清单逐项执行,不要省略任何任务',
            '⚠️ 特别注意在Meta标题、Meta描述、FAQ中插入关键词',
            '⚠️ 如果不确定,宁可多插入也不要少插入',
            ...(request.seo_recommendations || [])
          ]
        } else {
          // 密度过高,需要用语义变体替换部分精确匹配
          request.seo_recommendations = [
            `🚨 上次优化失败: 全局关键词密度太高(${actualDensity}%, 包含Meta+正文+FAQ)`,
            '⚠️ 用语义变体替换部分精确匹配的关键词',
            '⚠️ 不要删除关键词,要用同义词替换',
            '⚠️ 保持60%精确匹配 + 40%语义变体的比例',
            ...(request.seo_recommendations || [])
          ]
        }

        // 继续下一次循环
        continue

      } catch (error) {
        console.error(`[SEO AI Optimize] 第${attempt}次尝试失败:`, error)

        if (attempt === MAX_RETRIES) {
          throw new Error('AI优化失败，请检查API配置或重试')
        }

        // 继续下一次尝试
        continue
      }
    }

    // 理论上不会到这里,但为了类型安全
    throw new Error('优化失败: 超出最大重试次数')
  }

  /**
   * AI 智能评分 - 本地版本
   * 通过本地 3030 端口服务调用 Claude Code CLI
   * ✅ 使用通用 /call-ai 端点,提示词由前端构建传递
   */
  private async calculateSEOScoreLocal(data: SEOGuideData): Promise<SEOScoreResult> {
    console.log('[SEO AI Score] 使用本地 Claude Code CLI 评分...')

    try {
      // 提取完整内容用于关键词密度计算
      const fullContent = extractFullContent(data)

      // 收集所有关键词
      // 仅计算目标关键词密度（单关键词优化策略）
      const allKeywords = data.target_keyword ? [data.target_keyword] : []

      // 计算关键词密度
      const keywordDensity = calculateKeywordDensity(fullContent, allKeywords)

      // ✅ 使用统一的提示词配置,从数据库读取
      const languageName = this.getLanguageName(data.language || 'en')
      const prompt = await buildSEOScorePrompt({
        languageName,
        languageCode: data.language || 'en',
        targetKeyword: data.target_keyword || '',
        metaTitle: data.meta_title || '',
        metaDescription: data.meta_description || '',
        metaKeywords: data.meta_keywords || '',
        longTailKeywords: data.long_tail_keywords || [],
        keywordDensity: keywordDensity,
        guideIntro: data.guide_intro || '',
        guideContent: data.guide_content || '',
        faqItems: data.faq_items || [],
        pageViews: data.page_views,
        avgTimeOnPage: data.avg_time_on_page,
        bounceRate: data.bounce_rate,
        conversionRate: data.conversion_rate
      })

      console.log('[SEO AI Score] 提示词已构建,长度:', prompt.length)

      // 调用通用 /call-ai 端点
      const aiResponse = await this.callLocalAI(prompt)

      // 🔧 使用健壮的JSON解析器，自动处理各种格式
      console.log('[SEO AI Score] 开始解析AI响应 (使用 robustJSONParser)...')
      const result = robustJSONParseWithValidation(
        aiResponse,
        ['overall_score', 'dimension_scores', 'actionable_recommendations'],
        {
          logPrefix: '[SEO AI Score]',
          verbose: true
        }
      )
      console.log('[SEO AI Score] ✅ JSON解析和验证成功')

      // 🔧 字段名标准化（兼容 total_score/overall_score）
      if ('total_score' in result && !('overall_score' in result)) {
        console.log('[SEO AI Score] 检测到 total_score 字段，转换为 overall_score')
        result.overall_score = result.total_score
      }

      // 🔄 适配新的AI响应格式
      // 新格式: {overall_score, dimension_scores: {meta_info_quality, keyword_optimization, content_quality, readability}, suggestions}
      // 旧格式: {content_quality_score, keyword_optimization_score, readability_score, recommendations}

      let metaInfoScore: number | undefined
      let contentQualityScore: number
      let keywordOptimizationScore: number
      let readabilityScore: number
      let uxScore: number
      let recommendations: any[]

      if (result.dimension_scores) {
        // ✅ 新格式 (从数据库提示词模板) - 5个AI维度
        console.log('[SEO AI Score] 检测到新格式响应 (dimension_scores)')

        // 支持两种字段名: meta_quality (v2.0提示词) 或 meta_info_quality (旧版)
        metaInfoScore = result.dimension_scores.meta_quality || result.dimension_scores.meta_info_quality || 0
        contentQualityScore = result.dimension_scores.content_quality || 0
        keywordOptimizationScore = result.dimension_scores.keyword_optimization || 0
        readabilityScore = result.dimension_scores.readability || 0
        uxScore = result.dimension_scores.ux || 0

        // 转换suggestions对象数组为字符串数组
        // 支持两种字段名: actionable_recommendations (v2.0) 或 suggestions (旧版)
        const rawSuggestions = result.actionable_recommendations || result.suggestions || []
        console.log('[SEO AI Score] 原始suggestions类型:', typeof rawSuggestions[0], '数量:', rawSuggestions.length)
        if (rawSuggestions.length > 0) {
          console.log('[SEO AI Score] 第一个suggestion:', rawSuggestions[0])
        }

        recommendations = rawSuggestions.map((sug: any) => {
          if (typeof sug === 'string') {
            console.log('[SEO AI Score] 发现字符串格式建议 (v2.0格式或旧格式)')
            return sug
          }
          // 旧对象格式: {category, issue, suggestion, priority, expected_impact}
          const formatted = `【${sug.category}】${sug.issue}\n建议: ${sug.suggestion}\n预期效果: ${sug.expected_impact || '提升SEO分数'}`
          console.log('[SEO AI Score] 转换对象为字符串:', formatted.substring(0, 100))
          return formatted
        })

        console.log('[SEO AI Score] 转换后recommendations类型:', typeof recommendations[0])

        console.log('[SEO AI Score] 新版5维度评分:', {
          meta_info_quality: metaInfoScore,
          content_quality: contentQualityScore,
          keyword_optimization: keywordOptimizationScore,
          readability: readabilityScore,
          ux: uxScore
        })
      } else {
        // ⚠️ 旧格式 (兼容性处理) - 3个AI维度
        console.log('[SEO AI Score] 检测到旧格式响应 (直接字段)')
        metaInfoScore = undefined // 旧格式没有这个字段
        contentQualityScore = result.content_quality_score || 0
        keywordOptimizationScore = result.keyword_optimization_score || 0
        readabilityScore = result.readability_score || 0
        uxScore = 0 // 旧格式没有这个字段
        recommendations = result.recommendations || []
      }

      // 验证必需字段
      if (
        typeof contentQualityScore !== 'number' ||
        typeof keywordOptimizationScore !== 'number' ||
        typeof readabilityScore !== 'number' ||
        typeof uxScore !== 'number'
      ) {
        console.error('[SEO AI Score] AI 返回格式不正确:', result)
        throw new Error('AI 返回的评分格式不正确')
      }

      // ✅ v2.0 标准: 100分制 (Meta20 + Content30 + Keyword20 + Readability20 + UX10)
      // 限制最大值防止AI超出范围
      const cappedMetaInfoScore = metaInfoScore ? Math.min(metaInfoScore, 20) : 0
      const cappedContentScore = Math.min(contentQualityScore, 30)
      const cappedKeywordScore = Math.min(keywordOptimizationScore, 20)
      const cappedReadabilityScore = Math.min(readabilityScore, 20)
      const cappedUxScore = Math.min(uxScore, 10)

      const totalScore = cappedMetaInfoScore + cappedContentScore + cappedKeywordScore + cappedReadabilityScore + cappedUxScore

      console.log('[SEO AI Score] AI原始评分（含上限限制）:', {
        原始: {
          meta_quality: metaInfoScore,
          content: contentQualityScore,
          keyword: keywordOptimizationScore,
          readability: readabilityScore,
          ux: uxScore
        },
        限制后: {
          meta_quality: cappedMetaInfoScore,
          content: cappedContentScore,
          keyword: cappedKeywordScore,
          readability: cappedReadabilityScore,
          ux: cappedUxScore
        },
        总分: totalScore
      })

      const scoreResult: SEOScoreResult = {
        total_score: totalScore,
        meta_info_quality_score: cappedMetaInfoScore, // v2.0: 最大20分
        content_quality_score: cappedContentScore, // v2.0: 最大30分
        keyword_optimization_score: cappedKeywordScore, // v2.0: 最大20分
        readability_score: cappedReadabilityScore, // v2.0: 最大20分
        ux_score: cappedUxScore, // v2.0: 最大10分
        keyword_density: keywordDensity,
        recommendations: recommendations
      }

      console.log('[SEO AI Score] 本地评分完成:', {
        total: scoreResult.total_score,
        recommendations: scoreResult.recommendations.length
      })

      return scoreResult

    } catch (error) {
      console.error('[SEO AI Score] 本地评分失败:', error)
      throw error
    }
  }
}

export const seoAIService = new SEOAIService()
export default seoAIService
