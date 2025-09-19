/**
 * Template Translation Service
 * 基于APICore的模板翻译服务
 */

import { 
  TranslationRequest, 
  TranslationResponse, 
  BatchTranslationRequest,
  BatchTranslationResponse,
  TemplateTranslationJob,
  TranslationField,
  SupportedLanguageCode,
  TranslationConfig,
  StructuredTranslationData,
  BatchTranslationAPIRequest,
  BatchTranslationAPIResponse
} from '@/types/translation'

export interface AITranslationResponse {
  translated_text?: string
  error?: string
}

class TemplateTranslationService {
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly primaryModel = 'gpt-3.5-turbo-0125'
  private readonly fallbackModel = 'claude-3-5-haiku-20241022'
  private readonly timeout = 15000
  private readonly maxRetries = 2

  constructor() {
    this.apiKey = import.meta.env.VITE_APICORE_API_KEY || ''
    this.endpoint = import.meta.env.VITE_APICORE_ENDPOINT || 'https://api.apicore.ai'
    
    if (!this.apiKey) {
      console.warn('[TRANSLATION SERVICE] APICore API key not configured')
    }
  }

  /**
   * 翻译单个文本
   */
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.apiKey) {
      throw new Error('APICore API key not configured')
    }

    console.log('[TRANSLATION SERVICE] 开始翻译文本:', {
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      textLength: request.text.length
    })

    // 首先尝试主模型
    try {
      const result = await this.callTranslationAPI(request, this.primaryModel)
      if (result.translated_text) {
        console.log('[TRANSLATION SERVICE] ✅ 使用主模型翻译成功')
        return {
          translatedText: result.translated_text,
          sourceText: request.text,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage
        }
      }
    } catch (error) {
      console.warn('[TRANSLATION SERVICE] 主模型翻译失败，尝试备用模型:', error)
    }

    // 尝试备用模型
    try {
      const result = await this.callTranslationAPI(request, this.fallbackModel)
      if (result.translated_text) {
        console.log('[TRANSLATION SERVICE] ✅ 使用备用模型翻译成功')
        return {
          translatedText: result.translated_text,
          sourceText: request.text,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage
        }
      }
    } catch (error) {
      console.error('[TRANSLATION SERVICE] 备用模型翻译也失败:', error)
    }

    throw new Error('所有翻译模型调用失败')
  }

  /**
   * 批量翻译文本
   */
  async translateBatch(request: BatchTranslationRequest): Promise<BatchTranslationResponse> {
    const translations: TranslationResponse[] = []
    const errors: string[] = []

    console.log('[TRANSLATION SERVICE] 开始批量翻译:', {
      textsCount: request.texts.length,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage
    })

    for (let i = 0; i < request.texts.length; i++) {
      const text = request.texts[i]
      
      try {
        const translation = await this.translateText({
          text,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage,
          context: request.context
        })
        translations.push(translation)
      } catch (error) {
        const errorMsg = `翻译第${i + 1}项失败: ${error instanceof Error ? error.message : '未知错误'}`
        console.error('[TRANSLATION SERVICE]', errorMsg)
        errors.push(errorMsg)
        
        // 添加失败的占位符
        translations.push({
          translatedText: text, // 翻译失败时保持原文
          sourceText: text,
          sourceLanguage: request.sourceLanguage,
          targetLanguage: request.targetLanguage
        })
      }

      // 添加延迟避免API限频
      if (i < request.texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return { translations, errors }
  }

  /**
   * 翻译整个模板（批量优化版本）
   */
  async translateTemplate(
    template: any, 
    config: TranslationConfig,
    onProgress?: (progress: number, currentField?: string) => void
  ): Promise<TemplateTranslationJob> {
    const job: TemplateTranslationJob = {
      templateId: template.id,
      templateName: template.name?.en || template.slug,
      sourceLanguage: config.sourceLanguage,
      targetLanguages: config.targetLanguages,
      fields: [],
      status: 'in_progress',
      progress: 0,
      errors: [],
      createdAt: new Date()
    }

    console.log('[TRANSLATION SERVICE] 开始批量翻译模板:', {
      templateId: job.templateId,
      templateName: job.templateName,
      sourceLanguage: config.sourceLanguage,
      targetLanguages: config.targetLanguages
    })

    try {
      // 提取所有需要翻译的字段
      const fields = this.extractTranslatableFields(template, config)
      job.fields = fields

      // 使用批量翻译优化性能
      await this.batchTranslateTemplate(template, config, job, onProgress)

      job.status = job.errors.length === 0 ? 'completed' : 'completed'
      job.completedAt = new Date()
      
      console.log('[TRANSLATION SERVICE] 批量翻译完成:', {
        templateId: job.templateId,
        progress: job.progress,
        errors: job.errors.length,
        apiCallsSaved: Math.max(0, (fields.length * config.targetLanguages.length) - config.targetLanguages.length)
      })

    } catch (error) {
      job.status = 'failed'
      job.errors.push(`模板翻译失败: ${error instanceof Error ? error.message : '未知错误'}`)
      console.error('[TRANSLATION SERVICE] 模板翻译失败:', error)
    }

    return job
  }

  /**
   * 批量翻译模板的核心方法
   */
  private async batchTranslateTemplate(
    template: any,
    config: TranslationConfig,
    job: TemplateTranslationJob,
    onProgress?: (progress: number, currentField?: string) => void
  ): Promise<void> {
    // 构建结构化翻译数据
    const structuredData = this.buildStructuredTranslationData(template, config)
    
    let completedLanguages = 0
    const totalLanguages = config.targetLanguages.filter(lang => lang !== config.sourceLanguage).length
    
    // 对每种目标语言进行批量翻译
    for (const targetLang of config.targetLanguages) {
      if (targetLang === config.sourceLanguage) {
        continue // 跳过源语言
      }

      try {
        if (onProgress) {
          onProgress(Math.round((completedLanguages / totalLanguages) * 90), `批量翻译到 ${targetLang}`)
        }

        const batchRequest: BatchTranslationAPIRequest = {
          sourceLanguage: config.sourceLanguage,
          targetLanguage: targetLang,
          templateData: structuredData,
          context: `模板: ${job.templateName} (${template.id})`
        }

        const batchResponse = await this.callBatchTranslationAPI(batchRequest)
        
        // 应用批量翻译结果到字段
        this.applyBatchTranslationResults(job.fields, batchResponse, targetLang)
        
        completedLanguages++
        job.progress = Math.round((completedLanguages / totalLanguages) * 100)
        
        if (onProgress) {
          onProgress(job.progress, `完成 ${targetLang} 翻译`)
        }

        console.log(`[TRANSLATION SERVICE] ✅ 批量翻译完成: ${targetLang} (${job.progress}%)`)
        
        // 短暂延迟避免API限频
        if (completedLanguages < totalLanguages) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

      } catch (error) {
        const errorMsg = `批量翻译失败 (${targetLang}): ${error instanceof Error ? error.message : '未知错误'}`
        job.errors.push(errorMsg)
        console.error('[TRANSLATION SERVICE]', errorMsg)
        
        // 翻译失败时保持原文
        this.applyFallbackTranslations(job.fields, targetLang)
      }
    }
  }

  /**
   * 构建结构化翻译数据
   */
  private buildStructuredTranslationData(template: any, config: TranslationConfig): StructuredTranslationData {
    const data: StructuredTranslationData = {
      templateInfo: {},
      parameters: {}
    }

    // 添加模板信息
    if (config.includeTemplateNames && template.name?.[config.sourceLanguage]) {
      data.templateInfo.name = template.name[config.sourceLanguage]
    }
    
    if (config.includeDescriptions && template.description?.[config.sourceLanguage]) {
      data.templateInfo.description = template.description[config.sourceLanguage]
    }

    // 添加参数信息
    if (template.params) {
      for (const [paramKey, paramValue] of Object.entries(template.params)) {
        if (!paramValue || typeof paramValue !== 'object') continue
        
        const param = paramValue as any
        data.parameters[paramKey] = {}

        // 参数标签
        if (config.includeParameterLabels && param.label?.[config.sourceLanguage]) {
          data.parameters[paramKey].label = param.label[config.sourceLanguage]
        }

        // 选项标签
        if (config.includeOptionLabels && param.options && Array.isArray(param.options)) {
          data.parameters[paramKey].options = param.options
            .map((option: any, index: number) => {
              if (option.label?.[config.sourceLanguage]) {
                return option.label[config.sourceLanguage]
              }
              return null
            })
            .filter(Boolean)
        }
      }
    }

    return data
  }

  /**
   * 调用批量翻译API
   */
  private async callBatchTranslationAPI(request: BatchTranslationAPIRequest): Promise<BatchTranslationAPIResponse> {
    const prompt = this.buildBatchTranslationPrompt(request)
    
    const requestBody = {
      model: this.primaryModel,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    }

    console.log(`[TRANSLATION SERVICE] 批量翻译 ${request.sourceLanguage} → ${request.targetLanguage}`)

    // 首先尝试主模型
    try {
      const result = await this.executeBatchTranslationAPI(requestBody)
      console.log('[TRANSLATION SERVICE] ✅ 主模型批量翻译成功')
      return result
    } catch (error) {
      console.warn('[TRANSLATION SERVICE] 主模型失败，尝试备用模型:', error)
    }

    // 尝试备用模型
    requestBody.model = this.fallbackModel
    const result = await this.executeBatchTranslationAPI(requestBody)
    console.log('[TRANSLATION SERVICE] ✅ 备用模型批量翻译成功')
    return result
  }

  /**
   * 执行批量翻译API调用
   */
  private async executeBatchTranslationAPI(requestBody: any): Promise<BatchTranslationAPIResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2) // 批量翻译需要更长时间

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
        throw new Error(`批量翻译API调用失败 (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error('批量翻译API响应格式不正确')
      }

      const content = result.choices[0].message.content
      
      try {
        const parsed = JSON.parse(content)
        return parsed
      } catch (parseError) {
        console.error('[TRANSLATION SERVICE] 批量翻译结果解析失败:', parseError)
        throw new Error('批量翻译结果解析失败')
      }

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('批量翻译请求超时')
      }
      
      throw error
    }
  }

  /**
   * 构建批量翻译提示词
   */
  private buildBatchTranslationPrompt(request: BatchTranslationAPIRequest): string {
    const sourceLanguageNames: Record<string, string> = {
      'en': 'English',
      'zh': 'Chinese (Simplified)',
      'ja': 'Japanese',
      'ko': 'Korean',
      'es': 'Spanish',
      'de': 'German',
      'fr': 'French',
      'ar': 'Arabic'
    }

    const sourceLangName = sourceLanguageNames[request.sourceLanguage] || request.sourceLanguage
    const targetLangName = sourceLanguageNames[request.targetLanguage] || request.targetLanguage

    let prompt = `Please translate the following video template content from ${sourceLangName} to ${targetLangName}.

**IMPORTANT REQUIREMENTS:**
1. Maintain exact JSON structure - do not add or remove fields
2. Preserve all emojis exactly as they appear 
3. Keep the translation natural and appropriate for UI/UX
4. For parameter labels and options, use terms suitable for video creation interface
5. Maintain consistency across related terms within the template
6. Return the result in the exact same JSON structure

**Template Data to Translate:**
\`\`\`json
${JSON.stringify(request.templateData, null, 2)}
\`\`\`

**Context:** ${request.context}

**Response Format:**
Return a JSON object with the exact same structure as the input, but with all text values translated to ${targetLangName}.

For "options" arrays, translate only the "text" field of each option object, maintaining the original structure.

Example structure (do not change field names):
\`\`\`json
{
  "templateInfo": {
    "name": "translated name",
    "description": "translated description"
  },
  "parameters": {
    "paramName": {
      "label": "translated label",
      "options": ["translated option 1", "translated option 2"]
    }
  }
}
\`\`\``

    return prompt
  }

  /**
   * 应用批量翻译结果到字段
   */
  private applyBatchTranslationResults(
    fields: TranslationField[], 
    batchResponse: BatchTranslationAPIResponse, 
    targetLanguage: string
  ): void {
    // 应用模板信息翻译
    if (batchResponse.templateInfo?.name) {
      const nameField = fields.find(f => f.path === 'name')
      if (nameField) {
        nameField.translatedTexts[targetLanguage] = batchResponse.templateInfo.name
        nameField.isTranslated = true
      }
    }

    if (batchResponse.templateInfo?.description) {
      const descField = fields.find(f => f.path === 'description')
      if (descField) {
        descField.translatedTexts[targetLanguage] = batchResponse.templateInfo.description
        descField.isTranslated = true
      }
    }

    // 应用参数翻译
    for (const [paramKey, paramData] of Object.entries(batchResponse.parameters)) {
      // 参数标签
      if (paramData.label) {
        const labelField = fields.find(f => f.path === `params.${paramKey}.label`)
        if (labelField) {
          labelField.translatedTexts[targetLanguage] = paramData.label
          labelField.isTranslated = true
        }
      }

      // 选项标签
      if (paramData.options && Array.isArray(paramData.options)) {
        paramData.options.forEach((translatedOption: string, index: number) => {
          const optionField = fields.find(f => f.path === `params.${paramKey}.options[${index}].label`)
          if (optionField) {
            optionField.translatedTexts[targetLanguage] = translatedOption
            optionField.isTranslated = true
          }
        })
      }
    }
  }

  /**
   * 应用失败回退翻译（保持原文）
   */
  private applyFallbackTranslations(fields: TranslationField[], targetLanguage: string): void {
    for (const field of fields) {
      if (!field.translatedTexts[targetLanguage]) {
        field.translatedTexts[targetLanguage] = field.originalText
      }
    }
  }

  /**
   * 应用翻译结果到模板
   */
  applyTranslationToTemplate(template: any, job: TemplateTranslationJob): any {
    const translatedTemplate = JSON.parse(JSON.stringify(template))

    for (const field of job.fields) {
      for (const [language, translatedText] of Object.entries(field.translatedTexts)) {
        this.setValueByPath(translatedTemplate, `${field.path}.${language}`, translatedText)
      }
    }

    return translatedTemplate
  }

  /**
   * 调用翻译API
   */
  private async callTranslationAPI(request: TranslationRequest, model: string): Promise<AITranslationResponse> {
    const prompt = this.buildTranslationPrompt(request)
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    }

    console.log(`[TRANSLATION SERVICE] 调用 ${model} 模型进行翻译...`)

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
        const parsed = JSON.parse(content)
        console.log(`[TRANSLATION SERVICE] ${model} 翻译结果:`, {
          translatedText: parsed.translated_text?.substring(0, 100) + '...',
          originalLength: request.text.length,
          translatedLength: parsed.translated_text?.length
        })
        
        return parsed
      } catch (parseError) {
        console.error('[TRANSLATION SERVICE] 解析翻译结果失败:', parseError)
        throw new Error('翻译结果解析失败')
      }

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('翻译请求超时')
      }
      
      throw error
    }
  }

  /**
   * 构建翻译提示词
   */
  private buildTranslationPrompt(request: TranslationRequest): string {
    const sourceLanguageNames: Record<string, string> = {
      'en': 'English',
      'zh': 'Chinese (Simplified)',
      'ja': 'Japanese',
      'ko': 'Korean',
      'es': 'Spanish',
      'de': 'German',
      'fr': 'French',
      'ar': 'Arabic'
    }

    const sourceLangName = sourceLanguageNames[request.sourceLanguage] || request.sourceLanguage
    const targetLangName = sourceLanguageNames[request.targetLanguage] || request.targetLanguage

    let prompt = `Please translate the following text from ${sourceLangName} to ${targetLangName}.

Requirements:
1. Maintain the original meaning and tone
2. Preserve any emojis and special characters
3. Keep the translation natural and fluent
4. If the text contains UI labels or technical terms, translate appropriately for the target audience
5. Return the result in JSON format with the key "translated_text"

Text to translate: "${request.text}"`

    if (request.context) {
      prompt += `\n\nContext: ${request.context}`
    }

    prompt += `\n\nPlease respond with a JSON object containing only the "translated_text" field.`

    return prompt
  }

  /**
   * 提取模板中所有可翻译的字段
   */
  private extractTranslatableFields(template: any, config: TranslationConfig): TranslationField[] {
    const fields: TranslationField[] = []

    // 提取模板名称
    if (config.includeTemplateNames && template.name && typeof template.name === 'object') {
      const sourceText = template.name[config.sourceLanguage]
      if (sourceText) {
        fields.push({
          path: 'name',
          originalText: sourceText,
          translatedTexts: {},
          isTranslated: false,
          fieldType: 'name'
        })
      }
    }

    // 提取描述
    if (config.includeDescriptions && template.description && typeof template.description === 'object') {
      const sourceText = template.description[config.sourceLanguage]
      if (sourceText) {
        fields.push({
          path: 'description',
          originalText: sourceText,
          translatedTexts: {},
          isTranslated: false,
          fieldType: 'description'
        })
      }
    }

    // 提取参数相关字段
    if (template.params) {
      this.extractFieldsFromParams(template.params, fields, config, 'params')
    }

    return fields
  }

  /**
   * 从参数对象中提取可翻译字段
   */
  private extractFieldsFromParams(params: any, fields: TranslationField[], config: TranslationConfig, basePath: string) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      if (!paramValue || typeof paramValue !== 'object') continue

      const param = paramValue as any
      const currentPath = `${basePath}.${paramKey}`

      // 提取参数标签
      if (config.includeParameterLabels && param.label && typeof param.label === 'object') {
        const sourceText = param.label[config.sourceLanguage]
        if (sourceText) {
          fields.push({
            path: `${currentPath}.label`,
            originalText: sourceText,
            translatedTexts: {},
            isTranslated: false,
            fieldType: 'label'
          })
        }
      }

      // 提取选项标签
      if (config.includeOptionLabels && param.options && Array.isArray(param.options)) {
        param.options.forEach((option: any, index: number) => {
          if (option.label && typeof option.label === 'object') {
            const sourceText = option.label[config.sourceLanguage]
            if (sourceText) {
              fields.push({
                path: `${currentPath}.options[${index}].label`,
                originalText: sourceText,
                translatedTexts: {},
                isTranslated: false,
                fieldType: 'option'
              })
            }
          }
        })
      }
    }
  }

  /**
   * 根据路径设置值
   */
  private setValueByPath(obj: any, path: string, value: any) {
    const keys = path.split('.')
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      
      // 处理数组索引
      if (key.includes('[') && key.includes(']')) {
        const [arrayKey, indexStr] = key.split('[')
        const index = parseInt(indexStr.replace(']', ''))
        
        if (!current[arrayKey]) {
          current[arrayKey] = []
        }
        
        if (!current[arrayKey][index]) {
          current[arrayKey][index] = {}
        }
        
        current = current[arrayKey][index]
      } else {
        if (!current[key]) {
          current[key] = {}
        }
        current = current[key]
      }
    }

    const lastKey = keys[keys.length - 1]
    current[lastKey] = value
  }
}

export default new TemplateTranslationService()