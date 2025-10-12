/**
 * SEO AI内容生成服务
 * 使用APICore调用大模型自动生成SEO优化的用户指南内容
 */

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
  primaryKeyword: string
  longTailKeywords: string[]
  targetLanguage: string
  aiModel: 'claude' | 'gpt'
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
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly timeout = 120000 // 120秒超时，SEO内容生成需要更长时间（生成1500-2000字内容）

  constructor() {
    // 使用 APICore API Key（与 veo3Service 保持一致）
    this.apiKey = import.meta.env.VITE_APICORE_API_KEY || import.meta.env.VITE_DEEPSEEK_API_KEY || ''
    this.endpoint = import.meta.env.VITE_APICORE_ENDPOINT || import.meta.env.VITE_DEEPSEEK_ENDPOINT || 'https://api.apicore.ai'

    if (!this.apiKey) {
      console.warn('[SEOAIService] No API key configured')
    } else {
      console.log('[SEOAIService] API service initialized')
    }
  }

  /**
   * 调用APICore大模型（直接调用）
   */
  private async callAI(
    prompt: string,
    model: 'claude' | 'gpt' = 'claude'
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API密钥未配置')
    }

    const modelName = model === 'claude'
      ? 'claude-opus-4-1-20250805'
      : 'gpt-4-gizmo-g-Ln4nsMLEy'

    console.log(`[SEOAIService] 调用 ${modelName} 模型...`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 4000
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API调用失败 (${response.status}): ${errorText}`)
      }

      const data = await response.json()

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('API响应格式不正确')
      }

      return data.choices[0].message.content
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${modelName} 调用超时（${this.timeout / 1000}秒）`)
      }
      console.error('[SEOAIService] APICore调用错误:', error)
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
- 主关键词: ${request.primaryKeyword}
- 长尾关键词: ${request.longTailKeywords.join(', ')}

## 目标语言
请用 **${languageName}** 编写所有内容。

## 输出要求
请生成以下内容，必须严格按照JSON格式返回：

\`\`\`json
{
  "meta_title": "页面标题（55-60字符，包含主关键词）",
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
1. 自然地融入所有长尾关键词到内容中（密度1-2%）
2. 使用清晰的标题层级（H2、H3）
3. 段落长度适中（3-5句话）
4. 使用过渡词汇使内容流畅
5. 包含实用的、可操作的建议
6. FAQ部分至少5-8个问答对

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
      meta_title: `${request.primaryKeyword} - Complete Guide`,
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
        message: 'APICore API密钥未配置。请在环境变量中设置VITE_DEEPSEEK_API_KEY或VITE_APICORE_API_KEY'
      }
    }
    return {
      valid: true,
      message: 'API配置正常'
    }
  }
}

export const seoAIService = new SEOAIService()
export default seoAIService
