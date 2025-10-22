/**
 * Prompt构建服务
 * 负责根据内容模板和关键词分析结果，构建AI生成内容的Prompt
 *
 * v3.0 更新:
 * - 集成 keywordTaskAllocator 算法化关键词分配
 * - 生成精确的位置级任务清单
 * - 替换抽象的"密度2.0%"为具体的"插入X次"
 */

import type { DifferentiationFactors } from './keywordAnalysisService'
import { supabase } from '@/lib/supabase'
import { loadContentGenerationPrompt } from '@/utils/promptLoader'
import {
  calculateKeywordTaskAllocation,
  formatKeywordTaskChecklist,
  generateTaskSummary,
  type KeywordTaskAllocation
} from './keywordTaskAllocator'

export interface PromptBuildOptions {
  templateSlug: string              // how-to, alternatives, platform-specific
  targetKeyword: string             // 目标长尾关键词
  differentiationFactors: DifferentiationFactors
  language: string                  // en, zh, ja, ko, es, de, fr, ar
  structureSchema: any              // 从数据库加载的模板结构JSON
  recommendedWordCount: number      // 推荐字数
  keywordDensityTargets: any        // 关键词密度目标
}

export interface GeneratedPrompt {
  systemPrompt: string              // 系统提示词
  userPrompt: string                // 用户提示词
  constraints: string[]             // 约束条件列表
  expectedStructure: SectionStructure[]  // 预期的文章结构
  metadata: PromptMetadata
}

export interface SectionStructure {
  sectionName: string
  h2Title: string
  minWords: number
  maxWords: number
  keywordMentions: Record<string, string | number>
  contentRequirements: string[]
  subsections?: SubsectionStructure[]
}

export interface SubsectionStructure {
  level: string
  pattern: string
  count: string
  minWords?: number
  maxWords?: number
}

export interface PromptMetadata {
  templateType: string
  targetKeyword: string
  language: string
  wordCountTarget: number
  estimatedTokens: number
}

class PromptBuilderService {

  /**
   * 从数据库加载内容模板（包含prompt_template）
   */
  private async loadContentTemplateFromDB(slug: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('seo_content_templates')
        .select('prompt_template')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error(`[PromptBuilder] 加载内容模板失败 (${slug}):`, error)
        return null
      }

      if (!data?.prompt_template || data.prompt_template === 'TEMPLATE_PLACEHOLDER') {
        console.error(`[PromptBuilder] 模板内容为空或占位符 (${slug})`)
        return null
      }

      return data.prompt_template
    } catch (err) {
      console.error(`[PromptBuilder] 加载模板异常 (${slug}):`, err)
      return null
    }
  }

  /**
   * 填充提示词模板中的变量
   */
  private fillTemplate(template: string, variables: Record<string, any>): string {
    let result = template

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`
      const replacement = value !== undefined && value !== null ? String(value) : ''
      result = result.replaceAll(placeholder, replacement)
    })

    return result
  }

  /**
   * 构建AI Prompt（主入口）- 统一使用数据库模板
   */
  async buildPrompt(options: PromptBuildOptions): Promise<GeneratedPrompt> {
    const {
      templateSlug,
      targetKeyword,
      differentiationFactors,
      language,
      structureSchema,
      recommendedWordCount,
      keywordDensityTargets
    } = options

    // 从数据库加载模板
    const templateContent = await this.loadContentTemplateFromDB(templateSlug)

    if (!templateContent) {
      throw new Error(`[PromptBuilder] 无法加载模板: ${templateSlug}`)
    }

    console.log(`[PromptBuilder] ✅ 使用数据库模板: ${templateSlug}`)

    // 提取required_sections和faqConfig
    const sections = structureSchema.required_sections || []
    const faqConfig = structureSchema.faq_config || {}

    // 格式化章节信息（通用）
    const sectionsFormatted = this.formatSections(sections, targetKeyword, differentiationFactors)

    // 格式化FAQ模式
    const faqPatterns = faqConfig.question_patterns?.map((pattern: string) =>
      `  - ${this.replaceKeywordPlaceholder(pattern, targetKeyword, differentiationFactors)}`
    ).join('\n') || ''

    // ========== v3.0 新增: 计算关键词任务分配 ==========
    const keywordTasks = this.calculateKeywordTasks(
      recommendedWordCount,
      sections,
      targetKeyword,
      differentiationFactors,
      keywordDensityTargets
    )

    // 生成任务清单Markdown
    const keywordTaskChecklist = formatKeywordTaskChecklist(keywordTasks, targetKeyword)

    console.log(`[PromptBuilder] ✅ 关键词任务分配完成:`)
    console.log(generateTaskSummary(keywordTasks))

    // 准备模板变量
    const variables: Record<string, any> = {
      targetKeyword,
      platform: differentiationFactors.platform || 'TikTok',
      platformName: this.capitalizeFirstLetter(differentiationFactors.platform || 'TikTok'),
      audience: differentiationFactors.audience || '普通用户',
      recommendedWordCount,
      minWordCount: Math.floor(recommendedWordCount * 0.8),
      maxWordCount: Math.ceil(recommendedWordCount * 1.2),
      faqMinItems: faqConfig.min_items || 3,
      faqMaxItems: faqConfig.max_items || 5,
      faqPatterns,
      sections: sectionsFormatted,
      differentiationFactors: this.formatDifferentiationFactors(differentiationFactors),
      keywordDensityIdeal: keywordDensityTargets.target_keyword?.ideal || 2.0,
      competitorDensityIdeal: keywordDensityTargets.competitor_names?.ideal || 0.8,
      platformDensityIdeal: keywordDensityTargets.platform_name?.ideal || 2.0,
      minCompetitors: (structureSchema.competitors_schema?.min_competitors) || 5,
      maxCompetitors: (structureSchema.competitors_schema?.max_competitors) || 10,

      // ========== v3.0 新增变量 ==========
      keywordTotalTarget: keywordTasks.totalTarget,
      keywordTaskChecklist: keywordTaskChecklist,
      keywordTasks: keywordTasks, // 完整对象,供需要的模板使用
    }

    // 填充用户提示词
    const userPrompt = this.fillTemplate(templateContent, variables)

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(language, templateSlug)

    // 构建约束条件
    const constraints = this.buildConstraints(options)

    // 提取预期结构
    const expectedStructure: SectionStructure[] = sections.map((section: any) => ({
      sectionName: section.name,
      h2Title: this.replaceKeywordPlaceholder(section.h2_title, targetKeyword, differentiationFactors),
      minWords: section.min_words || 0,
      maxWords: section.max_words || 0,
      keywordMentions: section.keyword_mentions || {},
      contentRequirements: section.content_requirements,
      subsections: section.subsections
    }))

    return {
      systemPrompt,
      userPrompt,
      constraints,
      expectedStructure,
      metadata: {
        templateType: templateSlug,
        targetKeyword,
        language,
        wordCountTarget: recommendedWordCount,
        estimatedTokens: Math.ceil(recommendedWordCount * 1.5)
      }
    }
  }

  /**
   * 格式化章节信息（通用方法）
   */
  private formatSections(
    sections: any[],
    targetKeyword: string,
    differentiationFactors: DifferentiationFactors
  ): string {
    return sections.map((section: any, index: number) => {
      let formatted = `
#### 第${index + 1}部分：${section.name}
- **H2标题**：${this.replaceKeywordPlaceholder(section.h2_title, targetKeyword, differentiationFactors)}`

      if (section.min_words) {
        formatted += `\n- **字数要求**：${section.min_words}-${section.max_words}字`
      }

      if (section.keyword_mentions) {
        formatted += `\n- **关键词提及**：${JSON.stringify(section.keyword_mentions)}`
      }

      if (section.content_type) {
        formatted += `\n- **内容类型**：${section.content_type}`
      }

      if (section.special_format) {
        formatted += `\n- **特殊格式**：${section.special_format}`
      }

      formatted += `\n- **内容要点**：
${Array.isArray(section.content_requirements) && section.content_requirements.length > 0
  ? section.content_requirements.map((req: string) => `  - ${req}`).join('\n')
  : '  - 提供详细实用的内容'}`

      if (section.subsections && Array.isArray(section.subsections) && section.subsections.length > 0) {
        formatted += `\n\n**子章节结构**：
${section.subsections.map((sub: any) => {
  let subFormatted = `  - ${sub.level}标题模式：${this.replaceKeywordPlaceholder(sub.pattern, targetKeyword, differentiationFactors)}`
  subFormatted += `\n  - 数量：${sub.count}个`

  if (sub.each_subsection) {
    if (sub.each_subsection.structure) {
      subFormatted += `\n  - 每个子章节内容：\n${sub.each_subsection.structure.map((item: string) => `    * ${item}`).join('\n')}`
    }
    if (sub.each_subsection.min_words) {
      subFormatted += `\n  - 每个子章节${sub.each_subsection.min_words}-${sub.each_subsection.max_words}字`
    }
  }

  return subFormatted
}).join('\n')}`
      }

      return formatted
    }).join('\n\n')
  }

  /**
   * 构建约束条件（通用）
   */
  private buildConstraints(options: PromptBuildOptions): string[] {
    const { targetKeyword, templateSlug, recommendedWordCount, structureSchema, keywordDensityTargets } = options
    const sections = structureSchema.required_sections || []
    const faqConfig = structureSchema.faq_config || {}

    const constraints = [
      `文章必须围绕关键词"${targetKeyword}"展开`,
      `总字数控制在${Math.floor(recommendedWordCount * 0.8)}-${Math.ceil(recommendedWordCount * 1.2)}字`,
      `⚠️ 严格要求: 绝对不能超过${Math.ceil(recommendedWordCount * 1.2)}字的最大字数限制`
    ]

    if (templateSlug === 'how-to') {
      constraints.push(
        `主关键词密度${keywordDensityTargets.target_keyword?.min || 1.5}%-${keywordDensityTargets.target_keyword?.max || 2.5}%`,
        `必须包含${sections.length}个主要章节`,
        `必须包含${faqConfig.min_items}-${faqConfig.max_items}个FAQ`,
        `每个FAQ答案保持简洁: 中文150-250字符,英文80-120词`,
        `内容必须具有实用性和可操作性`
      )
    } else if (templateSlug === 'alternatives') {
      const competitorsSchema = structureSchema.competitors_schema || {}
      constraints.push(
        `必须包含${competitorsSchema.min_competitors || 5}-${competitorsSchema.max_competitors || 10}个竞品对比`,
        `必须包含对比表格`,
        `内容必须客观公正`,
        `给出明确的选择建议`,
        `每个FAQ答案保持简洁: 中文150-250字符,英文80-120词`
      )
    } else if (templateSlug === 'platform-specific') {
      constraints.push(
        `必须针对${options.differentiationFactors.platform || 'Platform'}平台`,
        `必须包含平台技术规格表`,
        `必须包含平台专属优化建议`,
        `内容必须准确且最新`,
        `每个FAQ答案保持简洁: 中文150-250字符,英文80-120词`
      )
    }

    return constraints
  }
  private buildSystemPrompt(language: string, templateType: string): string {
    const languageNames: Record<string, string> = {
      en: 'English',
      zh: 'Chinese (中文)',
      ja: 'Japanese (日本語)',
      ko: 'Korean (한국어)',
      es: 'Spanish (Español)',
      de: 'German (Deutsch)',
      fr: 'French (Français)',
      ar: 'Arabic (العربية)'
    }

    const templateDescriptions: Record<string, string> = {
      'how-to': 'Step-by-step tutorial content',
      'alternatives': 'Product/tool comparison and alternatives analysis',
      'platform-specific': 'Platform-optimized guide and best practices'
    }

    return `You are an expert SEO content writer specializing in ${templateDescriptions[templateType]}.

Your task is to generate high-quality, SEO-optimized content in ${languageNames[language] || language}.

Key requirements:
- Write in fluent, natural ${languageNames[language] || language}
- Follow SEO best practices for keyword density and placement
- Create unique, valuable content that serves user intent
- Structure content for readability and engagement
- Use proper Markdown formatting
- Ensure content is factually accurate and up-to-date
- Adapt tone and style to the target audience
- Focus on providing actionable insights and practical value

⚠️ CRITICAL LENGTH CONSTRAINTS:
- The user prompt specifies EXACT word count targets - YOU MUST STRICTLY FOLLOW THEM
- Do NOT exceed the maximum word count under any circumstances
- Meta description MUST be 145-160 characters (optimal for Google SERP display)
- Each FAQ answer should be concise: 150-250 characters for Chinese/Japanese/Korean, 80-120 words for English
- Keep content focused and avoid unnecessary verbosity

⚠️ CRITICAL OUTPUT FORMAT REQUIREMENT:
You MUST return ONLY a valid JSON object with the following structure:
{
  "title": "文章标题 (${languageNames[language] || language})",
  "meta_title": "SEO meta标题 (55-60字符, ${languageNames[language] || language})",
  "meta_description": "SEO meta描述 (145-160字符, ${languageNames[language] || language})",
  "meta_keywords": "关键词1, 关键词2, 关键词3 (${languageNames[language] || language})",
  "guide_content": "完整的Markdown格式文章内容 (${languageNames[language] || language})",
  "faq_items": [
    {"question": "问题1 (${languageNames[language] || language})", "answer": "答案1 - 简洁精炼,英文80-120词,中文150-250字符 (${languageNames[language] || language})"},
    {"question": "问题2 (${languageNames[language] || language})", "answer": "答案2 - 简洁精炼,英文80-120词,中文150-250字符 (${languageNames[language] || language})"}
  ],
  "secondary_keywords": ["关键词1", "关键词2", "关键词3 (${languageNames[language] || language})"]
}

⚠️ CRITICAL RULES:
1. Return ONLY the JSON object - NO explanations, NO commentary, NO additional text
2. Do NOT add phrases like "已完成生成", "我注意到", "这是内容" etc.
3. Do NOT wrap in markdown code blocks (\`\`\`json)
4. Start with { and end with } - nothing before or after
5. All content fields MUST be in ${languageNames[language] || language}
6. Ensure valid JSON syntax - properly escape quotes and special characters
7. STRICTLY adhere to word count limits specified in the user prompt`
  }

  /**
   * 替换模板中的关键词占位符
   */
  private replaceKeywordPlaceholder(
    template: string,
    keyword: string,
    factors: DifferentiationFactors
  ): string {
    return template
      .replace(/\{keyword\}/gi, keyword)
      .replace(/\{Keyword\}/g, this.capitalizeFirstLetter(keyword))
      .replace(/\{KEYWORD\}/g, keyword.toUpperCase())
      .replace(/\{Platform\}/g, this.capitalizeFirstLetter(factors.platform || 'Platform'))
      .replace(/\{platform\}/gi, factors.platform || 'platform')
      .replace(/\{number\}/g, '{number}') // 保留number占位符，供后续处理
      .replace(/\{action\}/g, '{action}')
      .replace(/\{Alternative Name\}/g, '{Alternative Name}')
      .replace(/\{Unique Selling Point\}/g, '{Unique Selling Point}')
      .replace(/\{use case\}/g, factors.useCase || 'various use cases')
  }

  /**
   * 格式化差异化因子为文本
   */
  private formatDifferentiationFactors(factors: DifferentiationFactors): string {
    const items: string[] = []

    if (factors.platform) {
      items.push(`- **目标平台**：${factors.platform}`)
    }
    if (factors.device) {
      items.push(`- **目标设备**：${factors.device}`)
    }
    if (factors.audience) {
      items.push(`- **目标受众**：${factors.audience}`)
    }
    if (factors.searchIntent) {
      items.push(`- **搜索意图**：${factors.searchIntent}`)
    }
    if (factors.scenario) {
      items.push(`- **使用场景**：${factors.scenario}`)
    }
    if (factors.useCase) {
      items.push(`- **用例**：${factors.useCase}`)
    }
    if (factors.keywordType) {
      items.push(`- **关键词类型**：${factors.keywordType}`)
    }

    return items.length > 0 ? items.join('\n') : '- 无特殊差异化因子'
  }

  /**
   * 首字母大写
   */
  private capitalizeFirstLetter(str: string): string {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * 验证生成的prompt是否完整
   */
  validatePrompt(prompt: GeneratedPrompt): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!prompt.systemPrompt || prompt.systemPrompt.length < 50) {
      errors.push('System prompt is too short or missing')
    }

    if (!prompt.userPrompt || prompt.userPrompt.length < 100) {
      errors.push('User prompt is too short or missing')
    }

    if (!prompt.constraints || prompt.constraints.length === 0) {
      errors.push('No constraints defined')
    }

    if (!prompt.expectedStructure || prompt.expectedStructure.length === 0) {
      errors.push('No expected structure defined')
    }

    if (!prompt.metadata || !prompt.metadata.targetKeyword) {
      errors.push('Missing metadata or target keyword')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 估算prompt的token数量（粗略估算）
   */
  estimateTokenCount(prompt: GeneratedPrompt): number {
    const totalText = prompt.systemPrompt + prompt.userPrompt
    // 粗略估算：英文约4字符=1token，中文约1.5字符=1token
    const avgCharsPerToken = 3.5
    return Math.ceil(totalText.length / avgCharsPerToken)
  }

  /**
   * v3.0 新增: 计算关键词任务分配
   *
   * 将章节结构转换为 SectionStructure 数组并调用 keywordTaskAllocator
   */
  private calculateKeywordTasks(
    wordCount: number,
    sections: any[],
    targetKeyword: string,
    differentiationFactors: DifferentiationFactors,
    keywordDensityTargets: any
  ): KeywordTaskAllocation {

    // 转换章节结构为 SectionStructure 格式
    const sectionStructures: SectionStructure[] = sections.map((section: any) => ({
      sectionName: section.name || 'Untitled Section',
      h2Title: this.replaceKeywordPlaceholder(
        section.h2_title || '',
        targetKeyword,
        differentiationFactors
      ),
      minWords: section.min_words || 100,
      maxWords: section.max_words || 300,
      keywordMentions: section.keyword_mentions || {},
      contentRequirements: section.content_requirements || [],
      subsections: section.subsections
    }))

    // 获取目标密度
    const targetDensity = keywordDensityTargets.target_keyword?.ideal || 2.0

    // 调用算法
    return calculateKeywordTaskAllocation(
      wordCount,
      sectionStructures,
      targetKeyword,
      { targetDensity }
    )
  }
}

export const promptBuilderService = new PromptBuilderService()
export default promptBuilderService
