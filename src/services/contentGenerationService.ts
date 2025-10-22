/**
 * 内容生成服务
 * 整合关键词分析、Prompt构建和AI内容生成
 * 负责生成、验证、评分和保存SEO页面内容
 */

import { createClient } from '@supabase/supabase-js'
import keywordAnalysisService, { type KeywordAnalysisResult, type DifferentiationFactors } from './keywordAnalysisService'
import promptBuilderService, { type GeneratedPrompt, type PromptBuildOptions } from './promptBuilderService'
import { calculateKeywordDensity, extractFullContent } from './seoScoreCalculator'
import { seoImageGenerationService } from './seoImageGenerationService'

// 兼容Vite和Node环境
const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || ''
  }
  return process.env[key] || ''
}

// 懒加载Supabase客户端
let _supabase: any = null
function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = getEnv('VITE_SUPABASE_URL')
    const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY')
    _supabase = createClient(supabaseUrl, supabaseKey)
  }
  return _supabase
}

export interface GenerateContentRequest {
  templateId: string                // 视频模板ID
  targetKeyword: string             // 目标长尾关键词
  language: string                  // 语言代码
  contentTemplateSlug?: string      // 内容模板slug（可选，如不提供则自动推荐）
  aiModel?: 'claude' | 'gpt' | 'gemini'  // AI模型选择
  userId?: string                   // 用户ID（用于RLS）
}

export interface GeneratedContent {
  title: string                     // H1标题
  meta_title: string                // Meta标题
  meta_description: string          // Meta描述
  meta_keywords: string             // Meta关键词
  guide_content: string             // Markdown正文
  faq_items: Array<{
    question: string
    answer: string
  }>
  secondary_keywords: string[]      // 次要关键词
}

export interface ContentQualityMetrics {
  wordCount: number                 // 总字数
  keywordDensity: Record<string, number>  // 关键词密度
  seoScore: number                  // SEO总分
  contentQualityScore: number       // 内容质量分
  keywordOptimizationScore: number  // 关键词优化分
  readabilityScore: number          // 可读性分
  keywordDensityScore: number       // 关键词密度分
  hasH1: boolean
  h2Count: number
  h3Count: number
  paragraphCount: number
  listCount: number
}

export interface GenerateContentResult {
  pageVariantId: string             // 生成的seo_page_variants记录ID
  content: GeneratedContent
  analysis: KeywordAnalysisResult
  metrics: ContentQualityMetrics
  differentiationFactors: DifferentiationFactors
  promptUsed: GeneratedPrompt
  estimatedTokensUsed: number
}

class ContentGenerationService {
  private apiKey: string | null = null
  private endpoint: string | null = null
  private readonly timeout = 180000 // 3分钟超时（生成长文需要更多时间）

  constructor() {
    // 构造函数
  }

  private getAPIKey(): string {
    if (!this.apiKey) {
      this.apiKey = getEnv('VITE_APICORE_SEO_API_KEY') || getEnv('VITE_APICORE_API_KEY')
    }
    return this.apiKey
  }

  private getEndpoint(): string {
    if (!this.endpoint) {
      this.endpoint = getEnv('VITE_APICORE_ENDPOINT') || 'https://api.apicore.ai'
    }
    return this.endpoint
  }

  /**
   * 生成SEO页面内容（主入口）
   */
  async generateContent(request: GenerateContentRequest): Promise<GenerateContentResult> {
    console.log(`\n[ContentGen] 🚀 开始生成内容...`)
    console.log(`[ContentGen] 关键词: "${request.targetKeyword}"`)
    console.log(`[ContentGen] 语言: ${request.language}`)

    // 1. 分析关键词
    console.log(`[ContentGen] 📊 分析关键词...`)
    const analysis = keywordAnalysisService.analyzeKeyword(request.targetKeyword)
    console.log(`[ContentGen] ✅ 分析完成:`, {
      推荐模板: analysis.recommendedTemplateSlug,
      置信度: analysis.confidence,
      平台: analysis.differentiationFactors.platform || '无',
      意图: analysis.differentiationFactors.searchIntent
    })

    // 2. 确定内容模板
    const contentTemplateSlug = request.contentTemplateSlug || analysis.recommendedTemplateSlug
    console.log(`[ContentGen] 📝 使用内容模板: ${contentTemplateSlug}`)

    // 3. 从数据库加载内容模板
    const contentTemplate = await this.loadContentTemplate(contentTemplateSlug)
    console.log(`[ContentGen] ✅ 已加载模板: ${contentTemplate.name}`)

    // 4. 构建Prompt
    console.log(`[ContentGen] 🔨 构建Prompt...`)
    const promptOptions: PromptBuildOptions = {
      templateSlug: contentTemplateSlug,
      targetKeyword: request.targetKeyword,
      differentiationFactors: analysis.differentiationFactors,
      language: request.language,
      structureSchema: contentTemplate.structure_schema,
      recommendedWordCount: contentTemplate.recommended_word_count,
      keywordDensityTargets: contentTemplate.keyword_density_targets
    }

    const prompt = await promptBuilderService.buildPrompt(promptOptions)
    console.log(`[ContentGen] ✅ Prompt已生成:`, {
      系统提示词长度: prompt.systemPrompt.length,
      用户提示词长度: prompt.userPrompt.length,
      约束条件数: prompt.constraints.length,
      预期章节数: prompt.expectedStructure.length
    })

    // 5. 调用AI生成内容
    console.log(`[ContentGen] 🤖 调用AI生成内容...`)
    console.log(`[ContentGen] 使用模型: ${request.aiModel || 'claude'}`)
    const generatedContent = await this.callAIForContent(
      prompt,
      request.aiModel || 'claude'
    )

    // 验证生成的内容
    if (!generatedContent) {
      throw new Error('AI生成内容失败: 返回值为空')
    }
    if (!generatedContent.guide_content) {
      console.error('[ContentGen] ❌ 生成的内容缺少 guide_content 字段')
      console.error('[ContentGen] 实际字段:', Object.keys(generatedContent))
      throw new Error('AI生成内容失败: 缺少 guide_content 字段')
    }

    console.log(`[ContentGen] ✅ AI生成完成: ${generatedContent.guide_content.length}字符`)

    // 6. 计算质量指标
    console.log(`[ContentGen] 📈 计算质量指标...`)
    const metrics = this.calculateQualityMetrics(
      generatedContent,
      request.targetKeyword,
      contentTemplate.keyword_density_targets
    )
    console.log(`[ContentGen] ✅ 质量评估:`, {
      总字数: metrics.wordCount,
      SEO得分: metrics.seoScore,
      H2数量: metrics.h2Count,
      FAQ数量: generatedContent.faq_items.length
    })

    // 7. 保存到数据库
    console.log(`[ContentGen] 💾 保存到数据库...`)
    const pageVariantId = await this.saveToDatabase({
      templateId: request.templateId,
      contentTemplateId: contentTemplate.id,
      targetKeyword: request.targetKeyword,
      keywordSlug: analysis.keywordSlug,
      language: request.language,
      content: generatedContent,
      metrics: metrics,
      differentiationFactors: analysis.differentiationFactors,
      userId: request.userId
    })
    console.log(`[ContentGen] ✅ 已保存: ${pageVariantId}`)

    // 8. 🔥 异步生成 SEO 图片 (已禁用 - 2025-01-22)
    // console.log(`[ContentGen] 🎨 启动异步图片生成...`)
    // seoImageGenerationService.generateImagesForArticle({
    //   pageVariantId,
    //   markdown: generatedContent.guide_content,
    //   slug: analysis.keywordSlug,
    //   targetKeyword: request.targetKeyword
    // })
    //   .then(result => {
    //     console.log(`[ContentGen] 🖼️  图片生成完成: ${result.generatedCount}/${result.totalCount} 张成功`)
    //   })
    //   .catch(err => {
    //     console.warn(`[ContentGen] ⚠️  图片生成失败:`, err)
    //     // 不影响主流程,仅记录错误
    //   })

    console.log(`[ContentGen] 🎉 内容生成完成！\n`)

    return {
      pageVariantId,
      content: generatedContent,
      analysis,
      metrics,
      differentiationFactors: analysis.differentiationFactors,
      promptUsed: prompt,
      estimatedTokensUsed: Math.ceil(
        (prompt.systemPrompt.length + prompt.userPrompt.length + generatedContent.guide_content.length) / 3.5
      )
    }
  }

  /**
   * 从数据库加载内容模板
   */
  private async loadContentTemplate(slug: string) {
    const { data, error } = await getSupabase()
      .from('seo_content_templates')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      throw new Error(`内容模板不存在: ${slug}`)
    }

    return data
  }

  /**
   * 调用本地AI（Claude Code CLI）生成内容
   * 通过本地 3030 端口服务器调用 Claude CLI
   */
  private async callLocalAIForContent(prompt: GeneratedPrompt): Promise<GeneratedContent> {
    console.log('[ContentGen AI] 使用本地 Claude Code CLI 模型...')
    console.log('[ContentGen AI] 通过本地服务器 (http://localhost:3030) 调用...')

    // 在浏览器环境，通过 HTTP 调用本地 3030 端口服务器
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('http://localhost:3030/generate-seo-from-prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            systemPrompt: prompt.systemPrompt,
            userPrompt: prompt.userPrompt,
            targetKeyword: prompt.metadata.targetKeyword,
            language: prompt.metadata.language
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `本地服务器返回错误: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success || !result.data) {
          throw new Error(result.error || '本地服务器返回错误')
        }

        console.log('[ContentGen AI] ✅ 本地 Claude CLI 调用成功')
        console.log('[ContentGen AI] 返回数据字段:', Object.keys(result.data))

        const data = result.data

        // 验证必要字段
        if (!data.guide_content) {
          console.error('[ContentGen AI] ❌ 返回数据缺少 guide_content 字段')
          console.error('[ContentGen AI] 实际字段:', Object.keys(data))
          console.error('[ContentGen AI] 数据示例:', JSON.stringify(data).substring(0, 500))
          throw new Error('服务器返回的数据缺少 guide_content 字段')
        }

        // 返回标准的 GeneratedContent 格式
        const generatedContent: GeneratedContent = {
          title: data.title || data.meta_title || prompt.metadata.targetKeyword,
          meta_title: data.meta_title || '',
          meta_description: data.meta_description || '',
          meta_keywords: data.meta_keywords || '',
          guide_content: data.guide_content,
          faq_items: data.faq_items || [],
          secondary_keywords: data.secondary_keywords || []
        }

        // 验证meta_description长度
        if (generatedContent.meta_description && generatedContent.meta_description.length > 155) {
          console.warn(`[ContentGen AI] ⚠️ Meta描述过长: ${generatedContent.meta_description.length}字符 (建议150-155)`)
          console.warn(`[ContentGen AI] 内容: "${generatedContent.meta_description.substring(0, 100)}..."`)
        }

        console.log('[ContentGen AI] 数据转换完成:', {
          title: generatedContent.title,
          meta_title: generatedContent.meta_title,
          meta_description_length: generatedContent.meta_description.length,
          guide_content_length: generatedContent.guide_content.length,
          faq_count: generatedContent.faq_items.length
        })

        return generatedContent

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Failed to fetch')) {
            throw new Error('无法连接到本地服务器 (http://localhost:3030)。\n请确保:\n1. 已运行 npm run seo:server 启动本地服务\n2. 本地服务器正在 3030 端口运行\n3. 没有防火墙阻止连接')
          }
        }
        throw error
      }
    }

    const fullPrompt = `${prompt.systemPrompt}\n\n${prompt.userPrompt}`

    try {
      // 动态导入Node.js模块
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // 使用Claude CLI执行内容生成
      console.log('[ContentGen AI] 正在调用本地Claude CLI...')

      // 将prompt写入临时文件
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')

      const tmpDir = os.tmpdir()
      const promptFile = path.join(tmpDir, `seo-prompt-${Date.now()}.txt`)

      await fs.promises.writeFile(promptFile, fullPrompt, 'utf-8')

      // 调用Claude CLI
      const command = `cat "${promptFile}" | claude --no-stream`

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 180000 // 3分钟超时
      })

      // 清理临时文件
      await fs.promises.unlink(promptFile).catch(() => {})

      if (stderr) {
        console.warn('[ContentGen AI] Claude CLI stderr:', stderr)
      }

      const content = stdout.trim()

      if (!content || content.length < 100) {
        throw new Error('Claude CLI 返回的内容过短或为空')
      }

      console.log(`[ContentGen AI] ✅ Claude CLI 调用成功`)
      console.log(`[ContentGen AI] 📝 生成内容长度: ${content.length} 字符`)

      // 解析Markdown内容
      return this.parseMarkdownContent(content, prompt.metadata.targetKeyword)

    } catch (error) {
      console.error('[ContentGen AI] Claude CLI 调用失败:', error)

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('Claude CLI 调用超时（3分钟），请稍后重试')
        }
        if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
          throw new Error('Claude CLI 未安装或不在PATH中，请先安装Claude CLI或选择其他AI模型')
        }
      }

      throw error
    }
  }

  /**
   * 调用AI生成内容
   */
  private async callAIForContent(
    prompt: GeneratedPrompt,
    model: 'claude' | 'gpt' | 'gemini' | 'claude-code-cli' = 'claude'
  ): Promise<GeneratedContent> {
    // 如果是claude-code-cli（Claude Code CLI），使用本地服务器逻辑
    if (model === 'claude-code-cli') {
      return this.callLocalAIForContent(prompt)
    }

    const apiKey = this.getAPIKey()
    const endpoint = this.getEndpoint()

    if (!apiKey) {
      throw new Error('未配置API Key')
    }

    const modelName =
      model === 'claude' ? 'claude-opus-4-1-20250805' :
      model === 'gemini' ? 'gemini-2.5-pro' :
      'gpt-4.1-2025-04-14'

    const maxTokens = model === 'gemini' ? 6000 : 8000

    const fullPrompt = `${prompt.systemPrompt}\n\n${prompt.userPrompt}`

    console.log(`[ContentGen AI] 调用 ${modelName} 模型...`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'user',
              content: fullPrompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
          stream: true // 启用流式响应
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API调用失败 (${response.status}): ${errorText}`)
      }

      // 处理流式响应
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const decoder = new TextDecoder()
      let content = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一个不完整的行

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6)
              const data = JSON.parse(jsonStr)
              const delta = data.choices?.[0]?.delta?.content
              if (delta) {
                content += delta
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      if (!content || content.trim() === '') {
        throw new Error('API返回的内容为空')
      }

      console.log(`[ContentGen AI] ✅ ${modelName} 调用成功`)
      console.log(`[ContentGen AI] 📝 生成内容长度: ${content.length} 字符`)

      // 解析Markdown内容
      return this.parseMarkdownContent(content, prompt.metadata.targetKeyword)

    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${modelName} 调用超时（${this.timeout / 1000}秒）`)
      }

      console.error('[ContentGen AI] 调用失败:', error)
      throw error
    }
  }

  /**
   * 解析AI生成的Markdown内容
   */
  private parseMarkdownContent(
    rawContent: string,
    targetKeyword: string
  ): GeneratedContent {
    // 提取H1标题
    const h1Match = rawContent.match(/^#\s+(.+)$/m)
    const title = h1Match ? h1Match[1].trim() : targetKeyword

    // 提取Meta信息（如果AI在内容开头包含了frontmatter）
    const year = new Date().getFullYear()
    let meta_title = title
    let meta_description = this.generateSmartMetaDescription(targetKeyword, year)
    let meta_keywords = targetKeyword

    // 尝试从内容中提取meta信息（YAML frontmatter格式）
    const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1]
      const titleMatch = frontmatter.match(/title:\s*["']?(.+?)["']?\n/)
      const descMatch = frontmatter.match(/description:\s*["']?(.+?)["']?\n/)
      const keywordsMatch = frontmatter.match(/keywords:\s*["']?(.+?)["']?\n/)

      if (titleMatch) meta_title = titleMatch[1].trim()
      if (descMatch) meta_description = descMatch[1].trim()
      if (keywordsMatch) meta_keywords = keywordsMatch[1].trim()

      // 移除frontmatter
      rawContent = rawContent.replace(frontmatterMatch[0], '').trim()
    }

    // 提取FAQ（寻找FAQ章节）
    const faqItems: Array<{ question: string; answer: string }> = []
    const faqMatch = rawContent.match(/##\s+(FAQ|Frequently Asked Questions|常见问题)[\s\S]*?(?=\n##\s+|\n#\s+|$)/i)

    if (faqMatch) {
      const faqSection = faqMatch[0]

      // 匹配各种FAQ格式
      // 格式1: **Q: xxx** A: xxx
      const format1Matches = faqSection.matchAll(/\*\*Q\d*:?\s*(.+?)\*\*\s*A\d*:?\s*(.+?)(?=\n\*\*Q|\n##|\n#|$)/gis)
      for (const match of format1Matches) {
        faqItems.push({
          question: match[1].trim(),
          answer: match[2].trim()
        })
      }

      // 格式2: ### Q: xxx 后面跟段落
      if (faqItems.length === 0) {
        const format2Matches = faqSection.matchAll(/###\s+Q\d*:?\s*(.+?)\n+([\s\S]+?)(?=\n###|\n##|\n#|$)/gi)
        for (const match of format2Matches) {
          faqItems.push({
            question: match[1].trim(),
            answer: match[2].trim()
          })
        }
      }

      // 格式3: **Q1. xxx** 或 **1. xxx**
      if (faqItems.length === 0) {
        const format3Matches = faqSection.matchAll(/\*\*(?:Q?\d+\.)\s*(.+?)\*\*\s*\n+([\s\S]+?)(?=\n\*\*(?:Q?\d+\.)|\n##|\n#|$)/gi)
        for (const match of format3Matches) {
          faqItems.push({
            question: match[1].trim(),
            answer: match[2].trim()
          })
        }
      }
    }

    // 移除FAQ章节，保留其他内容作为guide_content
    let guide_content = rawContent
    if (faqMatch) {
      guide_content = rawContent.replace(faqMatch[0], '').trim()
    }

    // 提取次要关键词（从内容中自动提取）
    const secondary_keywords = this.extractSecondaryKeywords(guide_content, targetKeyword)

    // 智能截断meta_description到155字符
    let finalMetaDesc = meta_description
    if (finalMetaDesc.length > 155) {
      console.warn(`[ContentGeneration] Meta描述过长(${finalMetaDesc.length}字符),截断到155字符`)
      // 尝试在最后一个完整句子或词处截断
      const truncated = finalMetaDesc.substring(0, 155)
      const lastPeriod = truncated.lastIndexOf('.')
      const lastSpace = truncated.lastIndexOf(' ')

      if (lastPeriod > 140) {
        finalMetaDesc = truncated.substring(0, lastPeriod + 1)
      } else if (lastSpace > 140) {
        finalMetaDesc = truncated.substring(0, lastSpace) + '...'
      } else {
        finalMetaDesc = truncated + '...'
      }
    }

    return {
      title,
      meta_title: meta_title.slice(0, 60), // 限制长度
      meta_description: finalMetaDesc,
      meta_keywords: meta_keywords.slice(0, 200),
      guide_content,
      faq_items: faqItems.length > 0 ? faqItems : this.generateDefaultFAQ(targetKeyword),
      secondary_keywords
    }
  }

  /**
   * 从内容中提取次要关键词
   */
  private extractSecondaryKeywords(content: string, mainKeyword: string): string[] {
    const keywords: string[] = []
    const words = content.toLowerCase().split(/\s+/)
    const wordFreq: Record<string, number> = {}

    // 统计词频
    for (const word of words) {
      const cleaned = word.replace(/[^\w]/g, '')
      if (cleaned.length > 3 && cleaned !== mainKeyword.toLowerCase()) {
        wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1
      }
    }

    // 提取频率最高的5-8个词
    const sorted = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word)

    return sorted
  }

  /**
   * 智能生成Meta Description（150-155字符，包含USP、数字、年份、CTA）
   */
  private generateSmartMetaDescription(keyword: string, year: number): string {
    const templates = [
      `Master ${keyword} with our ${year} guide. Learn proven techniques and expert tips to achieve professional results. Perfect for all levels!`,
      `Discover how to excel at ${keyword} in ${year}. Get actionable insights and proven strategies for success. Start creating today!`,
      `Complete ${keyword} guide for ${year}. Learn proven methods and pro techniques to get results fast. Ideal for creators of all levels!`,
      `Learn ${keyword} with our ${year} expert guide. Step-by-step instructions and insider tips to create amazing content. Get started now!`,
      `Ultimate ${keyword} tutorial for ${year}. Master techniques, avoid mistakes, and create professional results. Perfect for beginners!`
    ]

    // 随机选择一个模板以增加多样性
    const selected = templates[Math.floor(Math.random() * templates.length)]

    // 确保长度在150-155字符（不截断句子）
    if (selected.length > 155) {
      // 找到最后一个完整句子
      const lastPeriod = selected.substring(0, 155).lastIndexOf('.')
      if (lastPeriod > 140) {
        return selected.substring(0, lastPeriod + 1)
      }
      // 如果找不到合适的句子结束位置,在空格处截断并加省略号
      const lastSpace = selected.substring(0, 152).lastIndexOf(' ')
      return selected.substring(0, lastSpace) + '...'
    }

    return selected
  }

  /**
   * 生成默认FAQ（当AI没有生成时）
   */
  private generateDefaultFAQ(keyword: string): Array<{ question: string; answer: string }> {
    return [
      {
        question: `What is ${keyword}?`,
        answer: `${keyword} is a powerful tool that helps you create professional content quickly and efficiently.`
      },
      {
        question: `How do I get started with ${keyword}?`,
        answer: `Getting started is easy. Simply follow the step-by-step guide above to begin using ${keyword} effectively.`
      },
      {
        question: `Is ${keyword} suitable for beginners?`,
        answer: `Yes, ${keyword} is designed to be user-friendly and accessible for users of all skill levels.`
      }
    ]
  }

  /**
   * 计算内容质量指标
   */
  private calculateQualityMetrics(
    content: GeneratedContent,
    targetKeyword: string,
    densityTargets: any
  ): ContentQualityMetrics {
    const fullText = `${content.title} ${content.meta_description} ${content.guide_content} ${content.faq_items.map(f => f.question + ' ' + f.answer).join(' ')}`

    // 字数统计
    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length

    // 关键词密度
    const allKeywords = [targetKeyword, ...content.secondary_keywords]
    const keywordDensity = calculateKeywordDensity(fullText, allKeywords)

    // 结构分析
    const hasH1 = /^#\s+/m.test(content.guide_content)
    const h2Count = (content.guide_content.match(/^##\s+/gm) || []).length
    const h3Count = (content.guide_content.match(/^###\s+/gm) || []).length
    const paragraphCount = content.guide_content.split(/\n\n+/).filter(p => p.trim().length > 50).length
    const listCount = (content.guide_content.match(/^[-*]\s+/gm) || []).length

    // 计算各项得分
    const contentQualityScore = this.scoreContentQuality(content, hasH1, h2Count, paragraphCount)
    const keywordOptimizationScore = this.scoreKeywordOptimization(keywordDensity, targetKeyword, densityTargets)
    const readabilityScore = this.scoreReadability(wordCount, paragraphCount, h2Count, h3Count)
    const keywordDensityScore = this.scoreKeywordDensity(keywordDensity, targetKeyword, densityTargets)

    const seoScore = Math.round(
      contentQualityScore +
      keywordOptimizationScore +
      readabilityScore +
      keywordDensityScore
    )

    return {
      wordCount,
      keywordDensity,
      seoScore: Math.min(100, seoScore),
      contentQualityScore,
      keywordOptimizationScore,
      readabilityScore,
      keywordDensityScore,
      hasH1,
      h2Count,
      h3Count,
      paragraphCount,
      listCount
    }
  }

  private scoreContentQuality(content: GeneratedContent, hasH1: boolean, h2Count: number, paragraphCount: number): number {
    let score = 0

    // H1标题 (10分)
    if (hasH1) score += 10

    // H2章节数量 (10分)
    if (h2Count >= 5) score += 10
    else if (h2Count >= 3) score += 7
    else score += 4

    // FAQ质量 (10分)
    if (content.faq_items.length >= 5) score += 10
    else if (content.faq_items.length >= 3) score += 7
    else score += 4

    // 段落数量 (10分)
    if (paragraphCount >= 10) score += 10
    else if (paragraphCount >= 6) score += 7
    else score += 4

    return score
  }

  private scoreKeywordOptimization(density: Record<string, number>, target: string, targets: any): number {
    const targetDensity = density[target.toLowerCase()] || 0
    const ideal = targets?.target_keyword?.ideal || 2.5
    const min = targets?.target_keyword?.min || 2.0
    const max = targets?.target_keyword?.max || 3.0

    let score = 0

    // 主关键词密度 (30分)
    if (targetDensity >= min && targetDensity <= max) {
      score = 30
    } else if (targetDensity >= ideal * 0.8 && targetDensity <= max * 1.2) {
      score = 25
    } else if (targetDensity > 0) {
      score = 15
    }

    return score
  }

  private scoreReadability(wordCount: number, paragraphCount: number, h2Count: number, h3Count: number): number {
    let score = 0

    // 字数 (10分)
    if (wordCount >= 1200 && wordCount <= 2200) score += 10
    else if (wordCount >= 800) score += 7
    else score += 4

    // 结构层次 (10分)
    if (h2Count >= 4 && h3Count >= 6) score += 10
    else if (h2Count >= 3) score += 7
    else score += 4

    return score
  }

  private scoreKeywordDensity(density: Record<string, number>, target: string, targets: any): number {
    const targetDensity = density[target.toLowerCase()] || 0
    const ideal = targets?.target_keyword?.ideal || 2.5

    if (Math.abs(targetDensity - ideal) < 0.3) return 10
    if (Math.abs(targetDensity - ideal) < 0.7) return 8
    if (targetDensity > 0) return 5
    return 0
  }

  /**
   * 保存到数据库
   */
  private async saveToDatabase(data: {
    templateId: string
    contentTemplateId: string
    targetKeyword: string
    keywordSlug: string
    language: string
    content: GeneratedContent
    metrics: ContentQualityMetrics
    differentiationFactors: DifferentiationFactors
    userId?: string
  }): Promise<string> {
    // 使用 upsert 来插入或更新记录
    const { data: result, error } = await getSupabase()
      .from('seo_page_variants')
      .upsert({
        template_id: data.templateId,
        content_template_id: data.contentTemplateId,
        language: data.language,
        target_keyword: data.targetKeyword,
        keyword_slug: data.keywordSlug,
        differentiation_factors: data.differentiationFactors,
        title: data.content.title,
        meta_title: data.content.meta_title,
        meta_description: data.content.meta_description,
        meta_keywords: data.content.meta_keywords,
        guide_content: data.content.guide_content,
        faq_items: data.content.faq_items,
        secondary_keywords: data.content.secondary_keywords,
        // 不保存评分，等待用户手动触发批量评分
        seo_score: null,
        content_quality_score: null,
        keyword_optimization_score: null,
        readability_score: null,
        keyword_density_score: null,
        keyword_density: null,
        word_count: data.metrics.wordCount,
        is_published: false, // 默认未发布，需要人工审核
        created_by: data.userId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'template_id,language,target_keyword' // 指定冲突时使用的唯一约束
      })
      .select('id')
      .single()

    if (error) {
      console.error('[ContentGen DB] 保存失败:', error)
      throw new Error(`保存到数据库失败: ${error.message}`)
    }

    return result.id
  }

  /**
   * 批量生成内容
   */
  async generateBatch(
    requests: GenerateContentRequest[]
  ): Promise<GenerateContentResult[]> {
    console.log(`\n[ContentGen Batch] 🚀 开始批量生成 ${requests.length} 个页面...`)

    const results: GenerateContentResult[] = []
    const errors: Array<{ keyword: string; error: string }> = []

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i]
      console.log(`\n[ContentGen Batch] 处理 ${i + 1}/${requests.length}: ${request.targetKeyword}`)

      try {
        const result = await this.generateContent(request)
        results.push(result)
        console.log(`[ContentGen Batch] ✅ 成功 ${i + 1}/${requests.length}`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误'
        console.error(`[ContentGen Batch] ❌ 失败 ${i + 1}/${requests.length}:`, errorMsg)
        errors.push({ keyword: request.targetKeyword, error: errorMsg })
      }

      // 延迟，避免API限流
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`\n[ContentGen Batch] 📊 批量生成完成:`)
    console.log(`[ContentGen Batch] ✅ 成功: ${results.length}`)
    console.log(`[ContentGen Batch] ❌ 失败: ${errors.length}`)

    if (errors.length > 0) {
      console.log(`[ContentGen Batch] 失败列表:`)
      errors.forEach(e => console.log(`  - ${e.keyword}: ${e.error}`))
    }

    return results
  }

  /**
   * 验证API配置
   */
  validateAPIConfig(): { valid: boolean; message: string } {
    const apiKey = this.getAPIKey()

    if (!apiKey) {
      return {
        valid: false,
        message: '未配置API Key'
      }
    }

    return {
      valid: true,
      message: 'API配置正常'
    }
  }
}

export const contentGenerationService = new ContentGenerationService()
export default contentGenerationService
