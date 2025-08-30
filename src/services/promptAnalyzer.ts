import { TemplateParameter } from '@/types/template'

export interface AnalyzedParameter {
  key: string
  label: string
  type: TemplateParameter['type']
  defaultValue?: any
  options?: Array<{ value: string; label: string }>
  required?: boolean
  min?: number
  max?: number
  step?: number
  description?: string
}

export interface PromptAnalysisResult {
  originalPrompt: string
  extractedParameters: AnalyzedParameter[]
  templatePrompt: string
  suggestedName?: string
  suggestedDescription?: string
  suggestedTags?: string[]
  category?: string
  creditsRequired?: number
}

export class PromptAnalyzer {
  // 常见的参数模式和对应的参数类型
  private static readonly PARAMETER_PATTERNS = [
    // 颜色相关
    {
      patterns: [/\b(red|blue|green|yellow|purple|orange|pink|black|white|gray|brown|vivid|deep|bright|dark|light)\s+\w+/gi],
      type: 'select' as const,
      key: 'color',
      label: '颜色',
      extractOptions: true,
      commonOptions: [
        'vivid red', 'deep blue', 'bright green', 'golden yellow',
        'royal purple', 'bright orange', 'rose pink', 'pure black',
        'pure white', 'neutral gray', 'earth brown'
      ]
    },
    // 材质相关
    {
      patterns: [/\b(glass|crystal|metal|wood|plastic|ceramic|stone|fabric|leather|paper|rubber|marble|ice|jelly|candy)\b/gi],
      type: 'select' as const,
      key: 'material',
      label: '材质',
      extractOptions: true
    },
    // 光照相关
    {
      patterns: [/\b(soft|harsh|dramatic|natural|studio|ambient|backlit|side)\s*(light|lighting)\b/gi],
      type: 'select' as const,
      key: 'lighting',
      label: '光照',
      extractOptions: true
    },
    // 数字相关（如尺寸、数量等）
    {
      patterns: [/\b(\d+)\s*(mm|cm|meters?|inches?|feet|seconds?|minutes?)\b/gi],
      type: 'slider' as const,
      key: 'size',
      label: '尺寸',
      extractRange: true
    },
    // 风格相关
    {
      patterns: [/\b(realistic|cartoon|anime|photorealistic|artistic|abstract|minimalist|detailed|cinematic|surreal)\b/gi],
      type: 'select' as const,
      key: 'style',
      label: '风格',
      extractOptions: true
    },
    // 动作相关
    {
      patterns: [/\b(walking|running|jumping|sitting|standing|flying|swimming|dancing|cutting|slicing|flowing|moving)\b/gi],
      type: 'select' as const,
      key: 'action',
      label: '动作',
      extractOptions: true
    },
    // 相机角度
    {
      patterns: [/\b(close-up|wide shot|medium shot|aerial view|bird's eye|worm's eye|dutch angle|overhead|low angle)\b/gi],
      type: 'select' as const,
      key: 'camera_angle',
      label: '相机角度',
      extractOptions: true
    },
    // 时间相关
    {
      patterns: [/\b(morning|afternoon|evening|night|dawn|dusk|sunset|sunrise|midday|midnight)\b/gi],
      type: 'select' as const,
      key: 'time_of_day',
      label: '时间',
      extractOptions: true
    },
    // 天气相关
    {
      patterns: [/\b(sunny|cloudy|rainy|snowy|foggy|stormy|clear|overcast|windy)\b/gi],
      type: 'select' as const,
      key: 'weather',
      label: '天气',
      extractOptions: true
    },
    // 物体/对象相关
    {
      patterns: [/\b(knife|blade|sword|tool|brush|pen|pencil)\b/gi],
      type: 'select' as const,
      key: 'tool',
      label: '工具',
      extractOptions: true
    },
    // 水果相关
    {
      patterns: [/\b(apple|orange|banana|strawberry|grape|watermelon|peach|pear|cherry|mango|kiwi|lemon)\b/gi],
      type: 'select' as const,
      key: 'fruit',
      label: '水果',
      extractOptions: true
    }
  ]

  /**
   * 分析提示词并提取可配置参数
   */
  static analyzePrompt(prompt: string): PromptAnalysisResult {
    const extractedParameters: AnalyzedParameter[] = []
    let templatePrompt = prompt
    const foundValues: Map<string, Set<string>> = new Map()

    // 1. 识别并提取参数
    for (const paramPattern of this.PARAMETER_PATTERNS) {
      const matches = new Set<string>()
      
      for (const pattern of paramPattern.patterns) {
        const regex = new RegExp(pattern)
        let match
        while ((match = regex.exec(prompt)) !== null) {
          matches.add(match[0].toLowerCase().trim())
        }
      }

      if (matches.size > 0) {
        const parameter: AnalyzedParameter = {
          key: paramPattern.key,
          label: paramPattern.label,
          type: paramPattern.type,
          required: true
        }

        // 提取选项
        if (paramPattern.extractOptions && paramPattern.type === 'select') {
          const options = Array.from(matches).map(value => ({
            value: value,
            label: this.formatLabel(value)
          }))
          
          // 如果有预定义的常用选项，合并进去
          if (paramPattern.commonOptions) {
            const existingValues = new Set(options.map(o => o.value))
            paramPattern.commonOptions.forEach(commonOption => {
              if (!existingValues.has(commonOption.toLowerCase())) {
                options.push({
                  value: commonOption.toLowerCase(),
                  label: this.formatLabel(commonOption)
                })
              }
            })
          }

          parameter.options = options
          parameter.defaultValue = options[0]?.value
        }

        // 提取数值范围
        if (paramPattern.extractRange && paramPattern.type === 'slider') {
          const numbers = Array.from(matches).map(m => {
            const num = parseFloat(m.match(/\d+/)?.[0] || '0')
            return num
          }).filter(n => !isNaN(n))

          if (numbers.length > 0) {
            parameter.min = Math.min(...numbers) * 0.5
            parameter.max = Math.max(...numbers) * 2
            parameter.defaultValue = numbers[0]
            parameter.step = this.calculateStep(parameter.min, parameter.max)
          }
        }

        extractedParameters.push(parameter)
        foundValues.set(paramPattern.key, matches)
      }
    }

    // 2. 查找可能的自定义文本参数（引号内的内容）
    const quotedTexts = prompt.match(/"([^"]+)"|'([^']+)'/g)
    if (quotedTexts) {
      quotedTexts.forEach((quoted, index) => {
        const cleanText = quoted.slice(1, -1)
        const paramKey = `custom_text_${index + 1}`
        extractedParameters.push({
          key: paramKey,
          label: `自定义文本 ${index + 1}`,
          type: 'text',
          defaultValue: cleanText,
          required: false
        })
        foundValues.set(paramKey, new Set([cleanText]))
      })
    }

    // 3. 生成模板提示词（替换识别到的值为占位符）
    templatePrompt = this.generateTemplatePrompt(prompt, foundValues)

    // 4. 生成建议的元数据
    const suggestedTags = this.extractTags(prompt)
    const suggestedCategory = this.suggestCategory(prompt)
    const suggestedName = this.suggestTemplateName(prompt)
    const suggestedDescription = this.suggestDescription(prompt, extractedParameters)
    const creditsRequired = this.suggestCredits(extractedParameters)

    return {
      originalPrompt: prompt,
      extractedParameters,
      templatePrompt,
      suggestedName,
      suggestedDescription,
      suggestedTags,
      category: suggestedCategory,
      creditsRequired
    }
  }

  /**
   * 生成模板提示词
   */
  private static generateTemplatePrompt(
    prompt: string,
    foundValues: Map<string, Set<string>>
  ): string {
    let templatePrompt = prompt

    // 替换所有找到的值为占位符
    foundValues.forEach((values, key) => {
      values.forEach(value => {
        // 使用正则进行全词匹配替换
        const regex = new RegExp(`\\b${this.escapeRegex(value)}\\b`, 'gi')
        templatePrompt = templatePrompt.replace(regex, `{${key}}`)
      })
    })

    return templatePrompt
  }

  /**
   * 提取标签
   */
  private static extractTags(prompt: string): string[] {
    const tags = new Set<string>()
    
    // 提取关键词作为标签
    const keywords = [
      'asmr', 'satisfying', 'relaxing', 'cinematic', '4k', '8k', 'hd',
      'realistic', 'artistic', 'creative', 'beautiful', 'stunning',
      'professional', 'high quality', 'detailed', 'slow motion',
      'time lapse', 'macro', 'close-up', 'aerial', 'underwater'
    ]

    keywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword)) {
        tags.add(keyword.replace(/\s+/g, '_'))
      }
    })

    // 添加一些基于内容的标签
    if (prompt.match(/cut|slice|chop/i)) tags.add('cutting')
    if (prompt.match(/cook|bake|fry/i)) tags.add('cooking')
    if (prompt.match(/paint|draw|sketch/i)) tags.add('art')
    if (prompt.match(/nature|forest|ocean|mountain/i)) tags.add('nature')
    if (prompt.match(/city|urban|street/i)) tags.add('urban')

    return Array.from(tags).slice(0, 10) // 限制最多10个标签
  }

  /**
   * 建议分类
   */
  private static suggestCategory(prompt: string): string {
    const categories = [
      { keywords: ['asmr', 'satisfying', 'relaxing', 'calm'], category: 'ASMR' },
      { keywords: ['cook', 'food', 'recipe', 'kitchen', 'bake'], category: 'Cooking' },
      { keywords: ['nature', 'landscape', 'forest', 'ocean', 'mountain'], category: 'Nature' },
      { keywords: ['art', 'paint', 'draw', 'creative', 'design'], category: 'Art' },
      { keywords: ['tech', 'computer', 'code', 'digital', 'ai'], category: 'Technology' },
      { keywords: ['sport', 'fitness', 'exercise', 'game'], category: 'Sports' },
      { keywords: ['music', 'dance', 'sing', 'perform'], category: 'Entertainment' },
      { keywords: ['tutorial', 'learn', 'education', 'teach'], category: 'Education' }
    ]

    const promptLower = prompt.toLowerCase()
    for (const { keywords, category } of categories) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return category
      }
    }

    return 'General'
  }

  /**
   * 建议模板名称
   */
  private static suggestTemplateName(prompt: string): string {
    // 提取前几个关键词作为名称
    const words = prompt.split(/\s+/).slice(0, 5)
    const name = words
      .filter(word => word.length > 2 && !['the', 'and', 'or', 'in', 'on', 'at', 'with'].includes(word.toLowerCase()))
      .slice(0, 3)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    return name || 'Custom Video Template'
  }

  /**
   * 建议描述
   */
  private static suggestDescription(prompt: string, parameters: AnalyzedParameter[]): string {
    const paramCount = parameters.length
    const paramTypes = [...new Set(parameters.map(p => p.type))]
    
    let description = `可定制的视频模板，包含 ${paramCount} 个可配置参数`
    
    if (paramTypes.includes('select')) {
      description += '，支持多种预设选项'
    }
    if (paramTypes.includes('slider')) {
      description += '，可调节数值参数'
    }
    if (paramTypes.includes('text')) {
      description += '，可自定义文本内容'
    }

    return description
  }

  /**
   * 建议积分消耗
   */
  private static suggestCredits(parameters: AnalyzedParameter[]): number {
    // 基础积分
    let credits = 10
    
    // 根据参数复杂度增加积分
    if (parameters.length > 5) credits += 5
    if (parameters.length > 10) credits += 10
    
    // 如果有图片参数，增加积分
    if (parameters.some(p => p.type === 'image')) credits += 10
    
    return credits
  }

  /**
   * 格式化标签
   */
  private static formatLabel(value: string): string {
    return value
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  /**
   * 转义正则特殊字符
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 计算滑块步长
   */
  private static calculateStep(min: number, max: number): number {
    const range = max - min
    if (range <= 10) return 0.1
    if (range <= 100) return 1
    if (range <= 1000) return 10
    return 100
  }

  /**
   * 验证并优化分析结果
   */
  static optimizeAnalysisResult(result: PromptAnalysisResult): PromptAnalysisResult {
    // 去重参数
    const seen = new Set<string>()
    result.extractedParameters = result.extractedParameters.filter(param => {
      if (seen.has(param.key)) return false
      seen.add(param.key)
      return true
    })

    // 确保至少有一些基本参数
    if (result.extractedParameters.length === 0) {
      result.extractedParameters.push({
        key: 'custom_prompt',
        label: '自定义提示词',
        type: 'text',
        defaultValue: '',
        required: true,
        description: '输入您的自定义描述'
      })
    }

    // 添加标准控制参数
    result.extractedParameters.push({
      key: 'make_public',
      label: '公开视频',
      type: 'toggle',
      defaultValue: false,
      required: false,
      description: '是否将生成的视频设为公开'
    })

    return result
  }

  /**
   * 生成JSON格式的模板配置
   */
  static generateTemplateConfig(result: PromptAnalysisResult): object {
    const params: Record<string, any> = {}
    
    result.extractedParameters.forEach(param => {
      const paramConfig: any = {
        type: param.type,
        label: param.label,
        required: param.required !== false
      }

      if (param.defaultValue !== undefined) {
        paramConfig.default = param.defaultValue
      }

      if (param.options) {
        paramConfig.options = param.options
      }

      if (param.min !== undefined) {
        paramConfig.min = param.min
      }

      if (param.max !== undefined) {
        paramConfig.max = param.max
      }

      if (param.step !== undefined) {
        paramConfig.step = param.step
      }

      params[param.key] = paramConfig
    })

    return {
      id: `template-${Date.now()}`,
      name: result.suggestedName,
      description: result.suggestedDescription,
      category: result.category,
      tags: result.suggestedTags,
      credits: result.creditsRequired,
      promptTemplate: result.templatePrompt,
      params
    }
  }
}

export default PromptAnalyzer