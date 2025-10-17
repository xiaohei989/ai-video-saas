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
import { calculateKeywordDensity, extractFullContent } from './seoScoreCalculator'
import { buildSEOScorePrompt } from '@/config/seoPrompts'

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
   * 调用APICore大模型（直接调用API）
   */
  private async callAI(
    prompt: string,
    model: 'claude' | 'gpt' | 'gemini' = 'claude'
  ): Promise<string> {
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
      response_format: { type: 'json_object' }
    })
    const bodySizeKB = (new Blob([requestBody]).size / 1024).toFixed(2)

    console.log(`[SEOAIService] 调用 ${modelName} 模型 (直接调用APICore)...`)
    console.log(`[SEOAIService] 📊 请求信息: prompt长度=${prompt.length}字符, 请求体大小=${bodySizeKB}KB`)

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
      const response = await this.callAI(prompt, request.aiModel)

      // 提取JSON内容
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/```\n([\s\S]*?)\n```/) ||
                       [null, response]

      let jsonContent = jsonMatch[1] || response
      jsonContent = jsonContent.trim()

      // 尝试解析JSON
      const parsedContent = JSON.parse(jsonContent)

      console.log('[SEOAIService] 内容生成成功')
      return parsedContent as GeneratedSEOContent
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

    // 收集所有关键词
    const allKeywords = [
      ...(data.target_keyword ? [data.target_keyword] : []),
      ...(data.long_tail_keywords || []),
      ...(data.secondary_keywords || [])
    ].filter(Boolean)

    // 计算关键词密度
    const keywordDensity = calculateKeywordDensity(fullContent, allKeywords)

    const prompt = buildSEOScorePrompt({
      languageName,
      languageCode: data.language || 'en',
      targetKeyword: data.target_keyword || '',
      metaTitle: data.meta_title || '',
      metaDescription: data.meta_description || '',
      metaKeywords: data.meta_keywords || '',
      longTailKeywords: data.long_tail_keywords || [],
      secondaryKeywords: data.secondary_keywords || [],
      keywordDensity,
      guideIntro: data.guide_intro || '',
      guideContent: data.guide_content || '',
      faqItems: data.faq_items || []
    })


    try {
      console.log('[SEO AI Score] 开始在线AI评分...')
      const response = await this.callAI(prompt, model)

      // 提取JSON内容
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/```\n([\s\S]*?)\n```/) ||
                       [null, response]

      let jsonContent = jsonMatch[1] || response
      jsonContent = jsonContent.trim()

      // 尝试解析JSON
      const parsedContent = JSON.parse(jsonContent)

      console.log('[SEO AI Score] AI评分完成:', {
        total: parsedContent.total_score,
        recommendations: parsedContent.recommendations?.length || 0
      })

      // ✅ 使用确定性算法重新计算关键词密度（替代AI估算）
      const fullContent = extractFullContent(data)
      const allKeywords = [
        ...(data.target_keyword ? [data.target_keyword] : []),
        ...(data.long_tail_keywords || []),
        ...(data.secondary_keywords || [])
      ].filter(Boolean)

      const accurateKeywordDensity = calculateKeywordDensity(fullContent, allKeywords)

      console.log('[SEO AI Score] 使用算法重新计算密度:', {
        keywords: allKeywords.length,
        aiDensity: Object.keys(parsedContent.keyword_density || {}).length,
        algorithmDensity: Object.keys(accurateKeywordDensity).length
      })

      return {
        total_score: parsedContent.total_score || 0,
        content_quality_score: parsedContent.content_quality_score || 0,
        keyword_optimization_score: parsedContent.keyword_optimization_score || 0,
        readability_score: parsedContent.readability_score || 0,
        keyword_density_score: parsedContent.keyword_density_score || 0,
        keyword_density: accurateKeywordDensity, // 使用算法计算的密度，不是AI估算的
        recommendations: parsedContent.recommendations || []
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

      const response = await this.callAI(prompt, model)

      // 提取JSON内容
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/```\n([\s\S]*?)\n```/) ||
                       [null, response]

      let jsonContent = jsonMatch[1] || response
      jsonContent = jsonContent.trim()

      // 尝试解析JSON
      const parsedContent = JSON.parse(jsonContent)

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
   * AI 内容优化 - 在线版本（一键优化）
   * 使用 APICore 调用大模型进行内容优化
   */
  async optimizeSEOContent(
    request: SEOOptimizeRequest,
    model: 'claude' | 'gpt' | 'gemini' = 'claude'
  ): Promise<SEOOptimizeResult> {
    const languageName = this.getLanguageName(request.language || 'en')
    const recommendations = request.seo_recommendations || []

    const prompt = `你是一位拥有10年经验的资深 SEO 专家和内容创作大师。

⚠️ CRITICAL LANGUAGE REQUIREMENT - 语言一致性要求（最重要！）
目标语言: ${languageName} (${request.language})

**这是最关键的要求，必须严格遵守：**
1. ALL content MUST be written ENTIRELY in ${languageName}
2. 所有优化后的内容必须 100% 使用 ${languageName}
3. DO NOT mix any other languages - 绝对不能混用其他语言

## 当前状态分析

**当前评分**: ${request.seo_score}/100分

**主要问题和改进建议**:
${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

---

## 优化任务

请对内容进行全面优化：

1. **Meta 标题优化** (必须 ${languageName}, 55-60字符, 主关键词前置)
2. **Meta 描述优化** (必须 ${languageName}, 150-155字符, 包含CTA)
3. **Meta 关键词优化** (必须 ${languageName}, 5-8个关键词)
4. **引言优化** (必须 ${languageName}, 100-150字, 第一句话吸引注意力)
5. **正文内容优化** (必须 ${languageName}, 1500-2000字, Markdown格式, 清晰结构)
   - **⚠️ 长尾关键词密度优化（最高优先级）**：
     * **逐个检查每个长尾关键词**：${(request.long_tail_keywords || []).join(', ')}
     * 确保每个长尾关键词至少出现2-3次
     * 主关键词密度：2-3%
     * 每个长尾关键词密度：1-2%（至少出现2-3次）
     * 在Introduction、How to Use、Best Practices、Troubleshooting、Creative Ideas、Conclusion等各部分自然融入
     * 避免关键词堆砌，要在完整句子中自然使用
6. **FAQ 优化** (必须 ${languageName}, 5-7个问题, 每个回答80-150字)
   - **在问题和答案中自然融入长尾关键词**，特别是那些在正文中密度不足的关键词
7. **次要关键词优化** (必须 ${languageName}, 5-8个相关关键词)

## 输出格式

\`\`\`json
{
  "optimized_content": {
    "meta_title": "优化后的Meta标题（55-60字符，${languageName}）",
    "meta_description": "优化后的Meta描述（150-155字符，${languageName}）",
    "meta_keywords": "关键词1, 关键词2, 关键词3（${languageName}）",
    "guide_intro": "优化后的引言（100-150字，${languageName}）",
    "guide_content": "优化后的完整Markdown正文（1500-2000字，${languageName}）",
    "faq_items": [
      {"question": "问题1（${languageName}）", "answer": "回答1（80-150字，${languageName}）"}
    ],
    "secondary_keywords": ["关键词1", "关键词2"（${languageName}）]
  },
  "optimization_summary": "本次优化的核心改进点和策略（100-150字）",
  "key_improvements": [
    "改进点1：具体说明",
    "改进点2：具体说明"
  ]
}
\`\`\`

⚠️ 记住：100% ${languageName}！请只返回 JSON，不要添加任何其他说明文字。`

    try {
      console.log('[SEO AI Optimize] 开始在线AI优化...')
      const response = await this.callAI(prompt, model)

      // 提取JSON内容
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/```\n([\s\S]*?)\n```/) ||
                       [null, response]

      let jsonContent = jsonMatch[1] || response
      jsonContent = jsonContent.trim()

      // 尝试解析JSON
      const parsedContent = JSON.parse(jsonContent)

      console.log('[SEO AI Optimize] 优化完成:', {
        improvements: parsedContent.key_improvements?.length || 0
      })

      return parsedContent as SEOOptimizeResult
    } catch (error) {
      console.error('[SEO AI Optimize] 优化失败:', error)
      throw new Error('AI优化失败，请检查API配置或重试')
    }
  }

  /**
   * AI 智能评分 - 本地版本
   * 通过本地 3030 端口服务调用 Claude Code CLI
   */
  private async calculateSEOScoreLocal(data: SEOGuideData): Promise<SEOScoreResult> {
    console.log('[SEO AI Score] 使用本地 Claude Code CLI 评分...')

    try {
      // 提取完整内容用于关键词密度计算
      const fullContent = extractFullContent(data)

      // 收集所有关键词
      const allKeywords = [
        ...(data.target_keyword ? [data.target_keyword] : []),
        ...(data.long_tail_keywords || []),
        ...(data.secondary_keywords || [])
      ].filter(Boolean)

      // 计算关键词密度
      const keywordDensity = calculateKeywordDensity(fullContent, allKeywords)

      // 调用本地 3030 端口服务
      const response = await fetch('http://localhost:3030/calculate-seo-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          keyword_density: keywordDensity
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `本地服务返回错误: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success || !result.data) {
        throw new Error('本地服务返回数据格式错误')
      }

      console.log('[SEO AI Score] 本地评分完成:', {
        total: result.data.total_score,
        recommendations: result.data.recommendations?.length || 0
      })

      return result.data as SEOScoreResult

    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        throw new Error('无法连接到本地服务器 (http://localhost:3030)。\n请确保:\n1. 已运行 npm run seo:server 启动本地服务\n2. 本地服务器正在 3030 端口运行\n3. 没有防火墙阻止连接')
      }
      console.error('[SEO AI Score] 本地评分失败:', error)
      throw error
    }
  }
}

export const seoAIService = new SEOAIService()
export default seoAIService
