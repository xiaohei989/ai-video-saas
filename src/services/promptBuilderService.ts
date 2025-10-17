/**
 * Prompt构建服务
 * 负责根据内容模板和关键词分析结果，构建AI生成内容的Prompt
 */

import type { DifferentiationFactors } from './keywordAnalysisService'

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
   * 构建AI Prompt（主入口）
   */
  buildPrompt(options: PromptBuildOptions): GeneratedPrompt {
    const { templateSlug } = options

    switch (templateSlug) {
      case 'how-to':
        return this.buildHowToPrompt(options)
      case 'alternatives':
        return this.buildAlternativesPrompt(options)
      case 'platform-specific':
        return this.buildPlatformSpecificPrompt(options)
      default:
        throw new Error(`Unknown template slug: ${templateSlug}`)
    }
  }

  /**
   * 构建How-To模板的Prompt
   */
  private buildHowToPrompt(options: PromptBuildOptions): GeneratedPrompt {
    const {
      targetKeyword,
      differentiationFactors,
      language,
      structureSchema,
      recommendedWordCount,
      keywordDensityTargets
    } = options

    // 提取required_sections
    const sections = structureSchema.required_sections || []
    const faqConfig = structureSchema.faq_config || {}

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(language, 'how-to')

    // 构建用户提示词
    const userPrompt = `
# 任务：生成SEO优化的How-To教程

## 目标关键词
"${targetKeyword}"

## 文章要求

### 1. Meta信息

Meta信息将包含在最终的 JSON 输出中（见最后的输出格式）

**Meta Title要求**：
- 必须包含"${targetKeyword}"
- 添加修饰语（如"Ultimate Guide", "Complete Tutorial", "Best Tips", "Step-by-Step"）
- 包含年份"2025"提升时效性
- 总长度50-60字符
- 首字母大写，专业格式
- 示例："The Ultimate Guide to ${targetKeyword} for ${differentiationFactors.platform || 'TikTok'} (2025)"

**Meta Description要求**：
- **必须150-160字符**（充分利用Google展示空间）
- 必须包含"${targetKeyword}"
- 突出独特卖点（如"proven tips", "step-by-step", "professional results", "for beginners"）
- 包含数字（如"10+ tips", "5 simple steps", "3x faster"）
- 包含明确CTA（如"Learn how", "Discover", "Master", "Get started"）
- 包含情感词（如"easy", "proven", "effective", "professional", "complete"）
- 首字母大写，专业格式
- 示例："Master ${targetKeyword} with our complete 2025 guide. Learn 10+ proven techniques, step-by-step tutorials, and expert tips to create professional results in minutes. Perfect for beginners!"

### 2. 内容结构
请严格按照以下结构编写文章：

${sections.map((section: any, index: number) => `
#### 第${index + 1}部分：${section.name}
- **H2标题**：${this.replaceKeywordPlaceholder(section.h2_title, targetKeyword, differentiationFactors)}
- **字数要求**：${section.min_words}-${section.max_words}字
- **关键词提及**：${JSON.stringify(section.keyword_mentions)}
- **内容要点**：
${Array.isArray(section.content_requirements) && section.content_requirements.length > 0
  ? section.content_requirements.map((req: string) => `  - ${req}`).join('\n')
  : '  - 提供详细实用的内容'}

${section.subsections ? `**子章节结构**：
${section.subsections.map((sub: any) => `  - ${sub.level}标题：${this.replaceKeywordPlaceholder(sub.pattern, targetKeyword, differentiationFactors)}
  - 数量：${sub.count}个
  ${sub.each_subsection ? `- 每个子章节${sub.each_subsection.min_words}-${sub.each_subsection.max_words}字` : ''}`).join('\n')}
` : ''}
`).join('\n')}

### 2. FAQ部分
- **数量**：${faqConfig.min_items}-${faqConfig.max_items}个问答
- **问题类型参考**：
${faqConfig.question_patterns?.map((pattern: string) => `  - ${this.replaceKeywordPlaceholder(pattern, targetKeyword, differentiationFactors)}`).join('\n') || ''}

### 3. SEO要求

⚠️ **重要**：本页面采用单关键词优化策略，只关注"${targetKeyword}"的密度优化。

- **总字数**：约${recommendedWordCount}字（最少${recommendedWordCount * 0.8}字，最多${recommendedWordCount * 1.2}字）
- **目标关键词密度**：1.5-2.5%（理想：2.0%）
  - 只针对主关键词"${targetKeyword}"进行优化
  - **不要刻意堆砌关键词**，保持自然流畅
  - 关键词必须自然出现在以下位置：
    * H1标题（1次）
    * 第一段前100字内（1次）
    * 至少3个H2标题中
    * 每个主要章节的内容中（均匀分布）
    * 最后一段结论中（1次）
  - 使用语义变体和同义词增加自然度
    * 例如："${targetKeyword} tutorial", "${targetKeyword} guide", "how to ${targetKeyword}"
    * 避免机械重复同一个词组

### 4. 差异化因子
请根据以下因子定制内容：
${this.formatDifferentiationFactors(differentiationFactors)}

### 5. 内容深度与质量标准

#### 必须包含的元素：
- ✅ **实用步骤**：每个步骤详细且可执行，包含具体参数和设置
- ✅ **具体示例**：至少2-3个真实场景或用例
- ✅ **数据支持**：包含统计数据、最佳实践标准、行业基准
  - 例："Studies show that videos with ${targetKeyword} get 3x more engagement"
  - 例："The ideal ${differentiationFactors.platform || 'TikTok'} video length is 15-60 seconds for maximum reach"
- ✅ **成功案例**：提及成功的创作者或品牌案例（可匿名化）
  - 例："Many TikTok creators report 300%+ view increase after mastering ${targetKeyword}"
- ✅ **2025趋势**：在引言或相关章节包含最新趋势
  - 必须提到"as of 2025"或"in 2025"至少1次
  - 引用最新的平台算法变化或功能更新
  - 例："As of 2025, ${differentiationFactors.platform || 'TikTok'} algorithm prioritizes..."
- ✅ **常见错误**：专门章节或段落列出"Common Mistakes to Avoid"
  - 列出3-5个常见错误
  - 说明为什么这是错误
  - 提供正确的解决方法

#### 写作技巧：
- ✅ 解释"为什么"而不只是"怎么做"
- ✅ 使用"you"和"your"增加亲和力
- ✅ 每段100-150字，保持可读性
- ✅ 使用过渡词连接段落（However, Moreover, Therefore, Additionally）
- ✅ 适当使用emoji增加视觉吸引力（但不过度，仅在重要提示处如💡 🎯 ⚠️）
- ✅ 语言清晰易懂，适合${differentiationFactors.audience || '普通用户'}
- ✅ 避免空洞的泛泛之谈，提供可执行的建议

### 6. 技术SEO要素

#### 6.1 目录导航（TOC）
在文章开头（定义部分之后）添加目录：
\`\`\`markdown
## 📋 Table of Contents
- [What is ${targetKeyword}?](#what-is)
- [Why Use ${targetKeyword}?](#why-use)
- [Step-by-Step Guide](#guide)
- [Best Practices](#best-practices)
- [Common Mistakes](#mistakes)
- [FAQ](#faq)
\`\`\`

#### 6.2 内部链接占位符
在适当位置添加3-5个内部链接占位符：
- 格式：\`[Related: ${differentiationFactors.platform || 'Platform'} video templates](#internal-link)\`
- 位置：每个主要章节末尾或相关提示处
- 类型：相关教程、工具推荐、模板链接

#### 6.3 图片Alt Text占位符
为应该配图的位置添加图片占位符（至少3-5个）：
\`\`\`markdown
![${targetKeyword} step 1 tutorial screenshot - setting up equipment](image-placeholder-1.jpg)
\`\`\`
注意：Alt text必须描述图片内容并包含关键词

#### 6.4 CTA行动召唤
在以下位置添加CTA：
- **文章开头**（引言之后）：
  \`> 💡 **Ready to get started?** [Try our ${targetKeyword} template](#cta-link) and create professional videos in minutes!\`

- **教程部分之后**：
  \`> 🎯 **Start creating now!** [Use our ${targetKeyword} tool](#cta-link) to put these tips into practice.\`

- **文章结尾**（结论中）：
  \`> ✨ **Take action today!** [Get started with ${targetKeyword}](#cta-link) and see results fast!\`

### 7. 格式要求
- 使用Markdown格式
- H1标题仅出现1次（文章标题）
- H2、H3层级清晰
- 适当使用列表、粗体、斜体
- 每段100-150字
- 使用blockquote (\`>\`) 突出重要提示和CTA
- 使用代码块突出技术参数或设置

## 输出格式

⚠️ **CRITICAL**: You MUST return ONLY valid JSON in the following format. NO explanations, NO markdown code blocks, NO additional text!

\`\`\`json
{
  "title": "H1标题（包含关键词）",
  "meta_title": "SEO优化的标题（50-60字符）",
  "meta_description": "SEO优化的描述（150-160字符）",
  "meta_keywords": "关键词1, 关键词2, 关键词3",
  "guide_content": "完整的Markdown格式正文内容（包含所有章节、H2/H3标题、列表、代码块等）",
  "faq_items": [
    {"question": "问题1？", "answer": "详细回答1"},
    {"question": "问题2？", "answer": "详细回答2"},
    {"question": "问题3？", "answer": "详细回答3"},
    {"question": "问题4？", "answer": "详细回答4"},
    {"question": "问题5？", "answer": "详细回答5"}
  ],
  "secondary_keywords": ["相关关键词1", "相关关键词2", "相关关键词3"]
}
\`\`\`

**重要提醒**：
- guide_content 字段包含完整的 Markdown 格式正文
- 从 H1 标题开始，包含所有章节内容
- 保持 Markdown 格式：H2标题用 ##，H3标题用 ###，列表、粗体、代码块等
- FAQ 单独作为 JSON 数组，不要放在 guide_content 中
- 只返回 JSON 对象，不要有任何其他文字
    `.trim()

    // 构建约束条件
    const constraints = [
      `文章必须围绕关键词"${targetKeyword}"展开`,
      `总字数控制在${recommendedWordCount * 0.8}-${recommendedWordCount * 1.2}字`,
      `主关键词密度${keywordDensityTargets.target_keyword?.min || 2.0}%-${keywordDensityTargets.target_keyword?.max || 3.0}%`,
      `必须包含${sections.length}个主要章节`,
      `必须包含${faqConfig.min_items}-${faqConfig.max_items}个FAQ`,
      `内容必须具有实用性和可操作性`,
      `语言风格适配${language}语言习惯`
    ]

    // 提取预期结构
    const expectedStructure: SectionStructure[] = sections.map((section: any) => ({
      sectionName: section.name,
      h2Title: this.replaceKeywordPlaceholder(section.h2_title, targetKeyword, differentiationFactors),
      minWords: section.min_words,
      maxWords: section.max_words,
      keywordMentions: section.keyword_mentions,
      contentRequirements: section.content_requirements,
      subsections: section.subsections
    }))

    return {
      systemPrompt,
      userPrompt,
      constraints,
      expectedStructure,
      metadata: {
        templateType: 'how-to',
        targetKeyword,
        language,
        wordCountTarget: recommendedWordCount,
        estimatedTokens: Math.ceil(recommendedWordCount * 1.5) // 粗略估算token数
      }
    }
  }

  /**
   * 构建Alternatives模板的Prompt
   */
  private buildAlternativesPrompt(options: PromptBuildOptions): GeneratedPrompt {
    const {
      targetKeyword,
      differentiationFactors,
      language,
      structureSchema,
      recommendedWordCount,
      keywordDensityTargets
    } = options

    const sections = structureSchema.required_sections || []
    const faqConfig = structureSchema.faq_config || {}
    const competitorsSchema = structureSchema.competitors_schema || {}

    const systemPrompt = this.buildSystemPrompt(language, 'alternatives')

    const userPrompt = `
# 任务：生成SEO优化的Alternatives对比文章

## 目标关键词
"${targetKeyword}"

## 文章要求

### 1. 内容结构
请严格按照以下结构编写文章：

${sections.map((section: any, index: number) => `
#### 第${index + 1}部分：${section.name}
- **H2标题**：${this.replaceKeywordPlaceholder(section.h2_title, targetKeyword, differentiationFactors)}
${section.min_words ? `- **字数要求**：${section.min_words}-${section.max_words}字` : ''}
${section.keyword_mentions ? `- **关键词提及**：${JSON.stringify(section.keyword_mentions)}` : ''}
${section.content_type ? `- **内容类型**：${section.content_type}` : ''}
- **内容要点**：
${Array.isArray(section.content_requirements) && section.content_requirements.length > 0
  ? section.content_requirements.map((req: string) => `  - ${req}`).join('\n')
  : '  - 提供详细实用的内容'}

${section.subsections ? `**子章节结构**：
${section.subsections.map((sub: any) => `  - ${sub.level}标题模式：${this.replaceKeywordPlaceholder(sub.pattern, targetKeyword, differentiationFactors)}
  - 数量：${sub.count}个
  ${sub.each_subsection ? `- 每个子章节内容：
${sub.each_subsection.structure?.map((item: string) => `    * ${item}`).join('\n') || ''}
  - 每个子章节${sub.each_subsection.min_words}-${sub.each_subsection.max_words}字` : ''}`).join('\n')}
` : ''}
`).join('\n')}

### 2. 竞品对比要求
- **竞品数量**：${competitorsSchema.min_competitors}-${competitorsSchema.max_competitors}个
- **每个竞品必须包含**：
  - 名称和简介
  - 评分（1-5分）
  - 定价信息（是否有免费版，起始价格）
  - 3-5个核心功能
  - 2-3个优点
  - 1-2个缺点
  - 最适合的用户类型

- **竞品对比表格**：
  - 必须包含对比维度：价格、功能、易用性、评分
  - 表格后需要200-300字的总结分析

### 3. FAQ部分
- **数量**：${faqConfig.min_items}-${faqConfig.max_items}个问答
- **问题类型参考**：
${faqConfig.question_patterns?.map((pattern: string) => `  - ${this.replaceKeywordPlaceholder(pattern, targetKeyword, differentiationFactors)}`).join('\n') || ''}

### 4. SEO要求
- **总字数**：约${recommendedWordCount}字
- **主关键词密度**：${keywordDensityTargets.target_keyword?.ideal || 2.2}%
- **竞品名称密度**：${keywordDensityTargets.competitor_names?.ideal || 0.8}%

### 5. 差异化因子
${this.formatDifferentiationFactors(differentiationFactors)}

### 6. 内容质量标准
- ✅ 提供客观、公正的对比分析
- ✅ 每个竞品的信息准确具体
- ✅ 避免过度推销某个产品
- ✅ 给出明确的选择建议
- ✅ 适配目标受众（${differentiationFactors.audience || '普通用户'}）

## 输出格式
请直接输出完整的Markdown格式文章，无需任何前言或解释。
    `.trim()

    const constraints = [
      `文章必须围绕关键词"${targetKeyword}"展开`,
      `总字数控制在${recommendedWordCount * 0.8}-${recommendedWordCount * 1.2}字`,
      `必须包含${competitorsSchema.min_competitors}-${competitorsSchema.max_competitors}个竞品对比`,
      `必须包含对比表格`,
      `内容必须客观公正`,
      `给出明确的选择建议`
    ]

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
        templateType: 'alternatives',
        targetKeyword,
        language,
        wordCountTarget: recommendedWordCount,
        estimatedTokens: Math.ceil(recommendedWordCount * 1.5)
      }
    }
  }

  /**
   * 构建Platform-Specific模板的Prompt
   */
  private buildPlatformSpecificPrompt(options: PromptBuildOptions): GeneratedPrompt {
    const {
      targetKeyword,
      differentiationFactors,
      language,
      structureSchema,
      recommendedWordCount,
      keywordDensityTargets
    } = options

    const sections = structureSchema.required_sections || []
    const faqConfig = structureSchema.faq_config || {}
    const platformSpecs = structureSchema.platform_specs_schema || {}

    const platformName = differentiationFactors.platform || 'Platform'
    const platformNameCapitalized = platformName.charAt(0).toUpperCase() + platformName.slice(1)

    const systemPrompt = this.buildSystemPrompt(language, 'platform-specific')

    const userPrompt = `
# 任务：生成SEO优化的Platform-Specific指南

## 目标关键词
"${targetKeyword}"

## 目标平台
${platformNameCapitalized}

## 文章要求

### 1. 内容结构
请严格按照以下结构编写文章：

${sections.map((section: any, index: number) => `
#### 第${index + 1}部分：${section.name}
- **H2标题**：${this.replaceKeywordPlaceholder(section.h2_title, targetKeyword, differentiationFactors)}
${section.min_words ? `- **字数要求**：${section.min_words}-${section.max_words}字` : ''}
${section.keyword_mentions ? `- **关键词提及**：${JSON.stringify(section.keyword_mentions)}` : ''}
${section.special_format ? `- **特殊格式**：${section.special_format}` : ''}
- **内容要点**：
${Array.isArray(section.content_requirements) && section.content_requirements.length > 0
  ? section.content_requirements.map((req: string) => `  - ${req}`).join('\n')
  : '  - 提供详细实用的内容'}

${Array.isArray(section.subsections) && section.subsections.length > 0 ? `**子章节结构**：
${section.subsections.map((sub: any) => `  - ${sub.level}标题模式：${this.replaceKeywordPlaceholder(sub.pattern, targetKeyword, differentiationFactors)}
  - 数量：${sub.count}个
  ${sub.each_subsection ? `- 每个子章节${sub.each_subsection.min_words}-${sub.each_subsection.max_words}字` : ''}`).join('\n')}
` : ''}
`).join('\n')}

### 2. 平台规格要求
必须包含${platformNameCapitalized}平台的详细技术规格：
- **视频格式要求**：支持的格式、编码器
- **分辨率要求**：推荐分辨率、宽高比
- **时长限制**：最小/最大时长
- **文件大小限制**：最大文件大小
- **其他技术要求**

以清晰的表格或列表形式呈现。

### 3. 平台优化建议
针对${platformNameCapitalized}平台的算法和用户行为，提供：
- 内容策略建议
- 发布时间建议
- 标题和描述优化技巧
- 标签/话题标签使用建议
- 互动策略（如何提高点赞、评论、分享）

### 4. FAQ部分
- **数量**：${faqConfig.min_items}-${faqConfig.max_items}个问答
- **问题类型参考**：
${faqConfig.question_patterns?.map((pattern: string) => `  - ${this.replaceKeywordPlaceholder(pattern, targetKeyword, differentiationFactors)}`).join('\n') || ''}

### 5. SEO要求
- **总字数**：约${recommendedWordCount}字
- **主关键词密度**：${keywordDensityTargets.target_keyword?.ideal || 2.5}%
- **平台名称密度**：${keywordDensityTargets.platform_name?.ideal || 2.0}%

### 6. 差异化因子
${this.formatDifferentiationFactors(differentiationFactors)}

### 7. 内容质量标准
- ✅ 提供平台专属的实用建议
- ✅ 技术信息准确且最新
- ✅ 包含具体的优化案例
- ✅ 解释平台算法的工作原理
- ✅ 适配目标受众（${differentiationFactors.audience || '普通用户'}）

## 输出格式
请直接输出完整的Markdown格式文章，无需任何前言或解释。
    `.trim()

    const constraints = [
      `文章必须围绕关键词"${targetKeyword}"展开`,
      `必须针对${platformNameCapitalized}平台`,
      `总字数控制在${recommendedWordCount * 0.8}-${recommendedWordCount * 1.2}字`,
      `必须包含平台技术规格表`,
      `必须包含平台专属优化建议`,
      `内容必须准确且最新`
    ]

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
        templateType: 'platform-specific',
        targetKeyword,
        language,
        wordCountTarget: recommendedWordCount,
        estimatedTokens: Math.ceil(recommendedWordCount * 1.5)
      }
    }
  }

  /**
   * 构建系统提示词（根据语言和模板类型）
   */
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

Output ONLY the article content in Markdown format. Do NOT include any meta-commentary, explanations, or additional text outside the article itself.`
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
}

export const promptBuilderService = new PromptBuilderService()
export default promptBuilderService
