/**
 * AI Content Service
 * 使用APICore的大模型API为视频自动生成标题和简介
 */

import i18n from '@/i18n/config'

export interface VideoMetadata {
  title: string
  description: string
}

export interface GenerateVideoMetadataRequest {
  templateName: string
  prompt: string
  parameters: Record<string, any>
  userLanguage?: string
}

export interface AIModelResponse {
  title?: string
  description?: string
  error?: string
}

class AIContentService {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly primaryModel = 'claude-3-5-haiku-20241022'
  private readonly fallbackModel = 'gpt-3.5-turbo-0125'
  // private readonly maxRetries = 2 // unused
  private readonly timeout = 10000

  constructor() {
    this.apiKey = import.meta.env.VITE_APICORE_API_KEY || ''
    this.endpoint = import.meta.env.VITE_APICORE_ENDPOINT || 'https://api.apicore.ai'
    
    if (!this.apiKey) {
      console.warn('[AI CONTENT SERVICE] APICore API key not configured')
    }
  }

  /**
   * 生成视频标题和简介
   */
  async generateVideoMetadata(request: GenerateVideoMetadataRequest): Promise<VideoMetadata> {
    if (!this.apiKey) {
      console.warn('[AI CONTENT SERVICE] API key not available, using fallback')
      return this.generateFallbackMetadata(request)
    }

    console.log('[AI CONTENT SERVICE] 开始生成视频标题和简介:', {
      templateName: request.templateName,
      userLanguage: request.userLanguage || 'zh-CN',
      promptLength: request.prompt.length
    })

    // 首先尝试主模型
    try {
      const result = await this.callAIModel(request, this.primaryModel)
      if (result.title && result.description) {
        console.log('[AI CONTENT SERVICE] ✅ 使用主模型生成成功')
        return {
          title: result.title,
          description: result.description
        }
      }
    } catch (error) {
      console.warn('[AI CONTENT SERVICE] 主模型调用失败，尝试备用模型:', error)
    }

    // 尝试备用模型
    try {
      const result = await this.callAIModel(request, this.fallbackModel)
      if (result.title && result.description) {
        console.log('[AI CONTENT SERVICE] ✅ 使用备用模型生成成功')
        return {
          title: result.title,
          description: result.description
        }
      }
    } catch (error) {
      console.error('[AI CONTENT SERVICE] 备用模型调用也失败:', error)
    }

    // 所有模型都失败，使用回退方案
    console.warn('[AI CONTENT SERVICE] 所有AI模型调用失败，使用回退方案')
    return this.generateFallbackMetadata(request)
  }

  /**
   * 调用AI模型生成内容
   */
  private async callAIModel(request: GenerateVideoMetadataRequest, model: string): Promise<AIModelResponse> {
    const prompt = this.buildPrompt(request)
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }

    console.log(`[AI CONTENT SERVICE] 调用 ${model} 模型...`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API调用失败 (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error('API响应格式不正确')
      }

      const content = result.choices[0].message.content

      try {
        // 去除前后空格，避免解析失败
        const parsed = JSON.parse(content.trim())
        console.log(`[AI CONTENT SERVICE] ${model} 生成结果:`, {
          title: parsed.title?.substring(0, 50) + '...',
          descriptionLength: parsed.description?.length
        })

        return parsed
      } catch (parseError) {
        console.warn(`[AI CONTENT SERVICE] JSON解析失败，尝试文本解析: ${parseError}`)
        return this.parseTextResponse(content)
      }

    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${model} 调用超时`)
      }
      throw error
    }
  }

  /**
   * 构建AI提示词
   */
  private buildPrompt(request: GenerateVideoMetadataRequest): string {
    const language = request.userLanguage || i18n.language || 'zh-CN'
    const languageNames: Record<string, string> = {
      'zh-CN': '中文',
      'en': 'English',
      'ja': '日本語',
      'ko': '한국어',
      'es': 'Español',
      'fr': 'Français',
      'de': 'Deutsch',
      'ar': 'العربية'
    }

    // 格式化参数信息
    const formattedParams = Object.entries(request.parameters)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n')

    return `根据以下视频生成提示词，创建一个吸引人的标题和简介：

视频模板：${request.templateName}
视频提示词：${request.prompt}
参数：
${formattedParams}

要求：
1. 标题：15-30个字符，突出视频亮点和创意性
2. 简介：50-150个字符，描述视频内容、特色和吸引点
3. 语言：${languageNames[language] || language}
4. 风格：创意、有趣、吸引眼球，适合社交媒体分享
5. 避免使用特殊符号和表情符号

请严格按照以下JSON格式输出：
{
  "title": "生成的标题",
  "description": "生成的简介"
}`
  }

  /**
   * 解析文本响应（备用解析方案）
   */
  private parseTextResponse(content: string): AIModelResponse {
    try {
      // 尝试提取标题和描述
      const titleMatch = content.match(/["""]title["""]:\s*["""]([^"""]+)["""]/i)
      const descMatch = content.match(/["""]description["""]:\s*["""]([^"""]+)["""]/i)
      
      if (titleMatch && descMatch) {
        return {
          title: titleMatch[1].trim(),
          description: descMatch[1].trim()
        }
      }
      
      // 如果正则匹配失败，尝试简单的行解析
      const lines = content.split('\n').filter(line => line.trim())
      let title = ''
      let description = ''
      
      for (const line of lines) {
        if (line.includes('标题') || line.includes('title')) {
          title = line.replace(/.*[:：]\s*/, '').replace(/["""]/g, '').trim()
        } else if (line.includes('简介') || line.includes('description')) {
          description = line.replace(/.*[:：]\s*/, '').replace(/["""]/g, '').trim()
        }
      }
      
      if (title && description) {
        return { title, description }
      }
    } catch (error) {
      console.warn('[AI CONTENT SERVICE] 文本解析失败:', error)
    }
    
    return { error: '无法解析响应内容' }
  }

  /**
   * 生成回退标题和简介（当AI调用失败时使用）
   */
  private generateFallbackMetadata(request: GenerateVideoMetadataRequest): VideoMetadata {
    const language = request.userLanguage || i18n.language || 'zh-CN'
    
    // 基于模板名称生成基础标题
    const baseTitle = this.generateFallbackTitle(request.templateName, language)
    
    // 基于提示词生成简介
    const description = this.generateFallbackDescription(request.prompt, language)
    
    return {
      title: baseTitle,
      description: description
    }
  }

  /**
   * 生成回退标题
   */
  private generateFallbackTitle(templateName: string, language: string): string {
    const titleTemplates: Record<string, string[]> = {
      'zh-CN': [
        `精彩${templateName}视频`,
        `创意${templateName}内容`,
        `有趣的${templateName}`,
        `${templateName}精选`
      ],
      'en': [
        `Amazing ${templateName} Video`,
        `Creative ${templateName} Content`,
        `Interesting ${templateName}`,
        `${templateName} Highlights`
      ],
      'ja': [
        `素晴らしい${templateName}動画`,
        `クリエイティブな${templateName}`,
        `面白い${templateName}`,
        `${templateName}ハイライト`
      ]
    }
    
    const templates = titleTemplates[language] || titleTemplates['zh-CN']
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)]
    
    return randomTemplate
  }

  /**
   * 生成回退简介
   */
  private generateFallbackDescription(prompt: string, language: string): string {
    // 智能处理提示词长度
    let processedPrompt = prompt

    if (prompt.length > 150) {
      // 提取关键部分，而不是简单截断
      const sentences = prompt.split(/[,，.。;；]/).filter(s => s.trim())
      processedPrompt = sentences.slice(0, 2).join(', ')
      if (processedPrompt.length > 150) {
        processedPrompt = processedPrompt.substring(0, 147) + '...'
      }
    }

    const descriptions: Record<string, string> = {
      'zh-CN': `基于创意提示"${processedPrompt}"生成的精彩AI视频内容，展现独特的视觉效果和有趣的故事情节。`,
      'en': `Amazing AI-generated video based on the creative prompt "${processedPrompt}", featuring unique visual effects and interesting storylines.`,
      'ja': `「${processedPrompt}」というクリエイティブなプロンプトに基づいて生成された素晴らしいAI動画コンテンツです。`
    }

    return descriptions[language] || descriptions['zh-CN']
  }

  /**
   * 验证生成的内容质量 - 暂时未使用
   */
  // private validateMetadata(metadata: VideoMetadata): boolean {
  //   // 检查标题长度
  //   if (!metadata.title || metadata.title.length < 5 || metadata.title.length > 100) {
  //     return false
  //   }
  //   
  //   // 检查简介长度
  //   if (!metadata.description || metadata.description.length < 20 || metadata.description.length > 500) {
  //     return false
  //   }
  //   
  //   // 检查是否包含明显的错误内容
  //   const invalidContent = ['undefined', 'null', 'error', '错误']
  //   const combinedText = (metadata.title + metadata.description).toLowerCase()
  //   
  //   for (const invalid of invalidContent) {
  //     if (combinedText.includes(invalid)) {
  //       return false
  //     }
  //   }
  //   
  //   return true
  // }

  /**
   * 检查服务是否可用
   */
  async checkServiceHealth(): Promise<boolean> {
    if (!this.apiKey) {
      return false
    }
    
    try {
      const response = await fetch(`${this.endpoint}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(5000)
      })
      
      return response.ok
    } catch {
      return false
    }
  }
}

// 导出单例实例
export const aiContentService = new AIContentService()
export default aiContentService