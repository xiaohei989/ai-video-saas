/**
 * SEO AI 提示词配置中心
 * 统一管理所有SEO相关的AI提示词
 *
 * ✅ 新架构：提示词优先从数据库加载，支持在线管理
 * - 主数据源: ai_prompt_templates 数据库表
 * - 加载服务: services/promptTemplateService.ts
 * - Fallback: 如果数据库加载失败，使用 Markdown 文件作为备份
 */

import { promptTemplateService } from '@/services/promptTemplateService'
import { loadSEOScorePrompt, type SEOScorePromptParams } from '@/utils/promptLoader'
import { calculateSEOFacts, calculateBaseScores } from '@/services/seoFactsCalculator'

// ⚠️ 注意：这是旧系统的提示词配置，新系统请使用 seoAIAnalyzer.ts
// Fallback 提示词模板（当数据库加载失败时使用）
const promptTemplate = `# SEO内容评分任务

请根据以下SEO内容进行评分（总分100分）：

## 评分维度
- Meta信息质量: 0-20分
- 内容质量: 0-30分
- 关键词优化: 0-20分
- 可读性: 0-20分
- 用户体验: 0-10分

## 内容信息
**语言**: {{languageName}} ({{languageCode}})
**目标关键词**: {{targetKeyword}}
**Meta标题**: {{metaTitle}}
**Meta描述**: {{metaDescription}}

**关键词密度**:
{{keywordDensity}}

**导言**:
{{guideIntro}}

**正文**:
{{guideContent}}

**FAQ**:
{{faq}}

{{noKeywordWarning}}

请以JSON格式返回评分结果：
\`\`\`json
{
  "dimension_scores": {
    "meta_info_quality": 0-20,
    "content_quality": 0-30,
    "keyword_optimization": 0-20,
    "readability": 0-20,
    "ux": 0-10
  },
  "suggestions": ["建议1", "建议2", ...]
}
\`\`\`
`

interface SEOScorePromptInputParams {
  languageName: string
  languageCode: string
  targetKeyword: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  longTailKeywords: string[]
  secondaryKeywords: string[]
  keywordDensity: Record<string, number>
  guideIntro: string
  guideContent: string
  faqItems: Array<{ question: string; answer: string }>
  pageViews?: number
  avgTimeOnPage?: number
  bounceRate?: number
  conversionRate?: number
}

/**
 * 构建SEO评分提示词
 * ✅ 优先从数据库加载，失败时使用 Markdown 文件作为 Fallback
 */
export async function buildSEOScorePrompt(params: SEOScorePromptInputParams): Promise<string> {
  // 步骤1: 计算所有算法事实
  const facts = calculateSEOFacts({
    meta_title: params.metaTitle,
    meta_description: params.metaDescription,
    meta_keywords: params.metaKeywords,
    guide_intro: params.guideIntro || '',
    guide_content: params.guideContent,
    faq_items: params.faqItems || [],
    target_keyword: params.targetKeyword,
    language: params.languageCode
  })

  // 步骤2: 计算基础分数
  const baseScores = calculateBaseScores(facts)

  // 步骤3: 格式化FAQ项
  const faqItemsText = params.faqItems && params.faqItems.length > 0
    ? params.faqItems
        .map((item, i) => `**Q${i + 1}**: ${item.question}\n**A${i + 1}**: ${item.answer}`)
        .join('\n\n')
    : '未提供FAQ'

  // 步骤4: 准备所有提示词变量（43个）
  const promptVariables = {
    // 语言信息
    languageName: params.languageName,
    languageCode: params.languageCode,

    // Meta信息
    metaTitle: params.metaTitle,
    titleLength: facts.meta.titleLength,
    titleKeywordPosition: facts.meta.titleKeywordPosition >= 0 ? facts.meta.titleKeywordPosition : '未包含',
    metaDescription: params.metaDescription,
    descLength: facts.meta.descLength,
    descHasKeyword: facts.meta.descHasKeyword ? '是' : '否',
    descHasCTA: facts.meta.descHasCTA ? `是 (${facts.meta.ctaType || ''})` : '否',

    // 内容统计
    totalWords: facts.content.totalWords,
    h1Count: facts.content.h1Count,
    h2Count: facts.content.h2Count,
    h3Count: facts.content.h3Count,
    paragraphCount: facts.content.paragraphCount,
    avgParagraphLength: Math.round(facts.content.avgParagraphLength),
    maxParagraphLength: facts.content.maxParagraphLength,
    listCount: facts.content.listCount,
    codeBlockCount: facts.content.codeBlockCount,
    quoteBlockCount: facts.content.quoteBlockCount,

    // 关键词分析
    targetKeyword: params.targetKeyword,
    keywordCount: facts.keywords.primary.count,
    keywordDensity: facts.keywords.primary.density.toFixed(2),
    keywordInTitle: facts.keywords.primary.inTitle ? '在标题中' : '不在标题中',
    keywordInFirstParagraph: facts.keywords.primary.inFirstParagraph ? '在首段' : '不在首段',
    keywordInLastParagraph: facts.keywords.primary.inLastParagraph ? '在尾段' : '不在尾段',
    keywordInH2Count: facts.keywords.primary.inH2Count,
    keywordInH3Count: facts.keywords.primary.inH3Count,

    // 可读性
    fleschScore: Math.round(facts.readability.fleschScore),
    avgSentenceLength: facts.readability.avgSentenceLength.toFixed(1),
    avgWordLength: facts.readability.avgWordLength.toFixed(1),
    complexWordCount: facts.readability.complexWordCount,
    complexWordRatio: facts.readability.complexWordRatio.toFixed(2),

    // 用户体验
    faqCount: facts.ux.faqCount,
    faqAvgQuestionLength: Math.round(facts.ux.faqAvgQuestionLength),
    faqAvgAnswerLength: Math.round(facts.ux.faqAvgAnswerLength),
    internalLinkCount: facts.ux.internalLinkCount,
    externalLinkCount: facts.ux.externalLinkCount,

    // 内容文本
    guideIntro: params.guideIntro || '未提供',
    guideContent: params.guideContent,
    faqItems: faqItemsText,
    faq: faqItemsText, // 兼容旧版变量名

    // 基础分数
    metaBaseScore: baseScores.metaBaseScore,
    contentBaseScore: baseScores.contentBaseScore,
    keywordBaseScore: baseScores.keywordBaseScore,
    readabilityBaseScore: baseScores.readabilityBaseScore,
    uxBaseScore: baseScores.uxBaseScore,

    // 其他
    noKeywordWarning: !params.targetKeyword ? '⚠️ **致命错误：未提供目标关键词**' : ''
  }

  try {
    // ✅ 优先从数据库加载提示词模板
    console.log('[SEO Prompts] 尝试从数据库加载 seo-score 提示词模板...')
    console.log('[SEO Prompts] 算法事实计算完成:', {
      meta: `标题${facts.meta.titleLength}字,描述${facts.meta.descLength}字`,
      content: `${facts.content.totalWords}词,H2×${facts.content.h2Count}`,
      keywords: `密度${facts.keywords.primary.density.toFixed(2)}%,出现${facts.keywords.primary.count}次`,
      scores: `Meta${baseScores.metaBaseScore}/20, Content${baseScores.contentBaseScore}/15, Keyword${baseScores.keywordBaseScore}/20`
    })

    const prompt = await promptTemplateService.buildPrompt('seo-score', promptVariables)

    console.log('[SEO Prompts] ✅ 成功从数据库加载提示词模板')
    return prompt

  } catch (error) {
    // ⚠️ Fallback: 使用简化的 Markdown 文件作为备份
    console.warn('[SEO Prompts] ⚠️ 数据库加载失败，使用 Markdown 文件作为 Fallback:', error)

    // 格式化关键词密度（旧版fallback格式）
    const keywordDensityText = `- **${params.targetKeyword}**: ${facts.keywords.primary.density.toFixed(2)}%`

    return loadSEOScorePrompt(promptTemplate, {
      languageName: params.languageName,
      languageCode: params.languageCode,
      targetKeyword: params.targetKeyword,
      metaTitle: params.metaTitle,
      metaDescription: params.metaDescription,
      keywordDensity: keywordDensityText,
      guideIntro: params.guideIntro || '',
      guideContent: params.guideContent,
      faq: faqItemsText,
      pageViews: params.pageViews,
      avgTimeOnPage: params.avgTimeOnPage,
      bounceRate: params.bounceRate,
      conversionRate: params.conversionRate,
      noKeywordWarning: !params.targetKeyword ? '⚠️ **致命错误：未提供目标关键词**' : ''
    })
  }
}

/**
 * 一键优化提示词参数接口
 */
interface SEOOptimizePromptParams {
  languageName: string
  languageCode: string
  currentScore: number
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  targetKeyword: string
  longTailKeywords: string[]
  secondaryKeywords: string[]
  guideIntro: string
  guideContent: string
  faqItems: Array<{ question: string; answer: string }>
  recommendations: string[]
}

/**
 * 构建SEO一键优化提示词
 * ✅ 从数据库加载 seo-optimize 提示词模板
 * ✅ v2.0: 添加关键词密度动态计算
 */
export async function buildOptimizePrompt(params: SEOOptimizePromptParams): Promise<string> {
  // ========== 步骤1: 计算当前内容的关键词密度 ==========
  const fullContent = [params.guideIntro, params.guideContent]
    .filter(Boolean)
    .join('\n\n')

  // 简单的词数估算(英文按空格分,中文按字符数/2估算)
  const isAsian = ['zh', 'ja', 'ko'].includes(params.languageCode)
  const estimatedWordCount = isAsian
    ? Math.round(fullContent.length / 2) // 中日韩文: 字符数/2
    : fullContent.split(/\s+/).filter(w => w.length > 0).length // 英文: 按空格分词

  console.log(`[SEO Optimize] 估算字数: ${estimatedWordCount}词`)

  // ========== 步骤2: 计算理想关键词出现次数 ==========
  // 理想密度范围: 1.5% - 2.5%
  const minTargetCount = Math.max(1, Math.round(estimatedWordCount * 0.015)) // 1.5%
  const idealTargetCount = Math.max(2, Math.round(estimatedWordCount * 0.020)) // 2.0%
  const maxTargetCount = Math.max(3, Math.round(estimatedWordCount * 0.025)) // 2.5%

  console.log(`[SEO Optimize] 关键词目标次数: 最低${minTargetCount}, 理想${idealTargetCount}, 最高${maxTargetCount}`)

  // ========== 步骤3: 计算当前关键词密度(如果有关键词) ==========
  let currentDensity = 0
  let currentCount = 0
  let optimizationStrategy = ''

  if (params.targetKeyword && fullContent) {
    // 简单的关键词计数(不区分大小写)
    const keywordLower = params.targetKeyword.toLowerCase()
    const contentLower = fullContent.toLowerCase()

    // 计算出现次数(简化版,支持多词关键词)
    const keywordWords = keywordLower.split(/\s+/)
    if (keywordWords.length === 1) {
      // 单词关键词
      const words = contentLower.split(/[\s\p{P}]+/u).filter(w => w.length > 0)
      currentCount = words.filter(w => w === keywordWords[0]).length
    } else {
      // 多词关键词(使用正则匹配)
      const regex = new RegExp(`\\b${keywordLower.replace(/\s+/g, '\\s+')}\\b`, 'gi')
      const matches = contentLower.match(regex)
      currentCount = matches ? matches.length : 0
    }

    currentDensity = estimatedWordCount > 0 ? (currentCount / estimatedWordCount) * 100 : 0

    console.log(`[SEO Optimize] 当前关键词密度: ${currentDensity.toFixed(2)}% (${currentCount}次/${estimatedWordCount}词)`)

    // ========== 步骤4: 根据当前密度选择优化策略 ==========
    if (currentDensity < 1.0) {
      // 密度过低,需要大幅增加
      const needToAdd = idealTargetCount - currentCount
      optimizationStrategy = `
**🔴 当前密度严重偏低** (${currentDensity.toFixed(2)}%)

**诊断**:
- 当前出现次数: ${currentCount}次
- 目标出现次数: ${idealTargetCount}次
- **需要增加**: 约${needToAdd}次

**策略**: 🚨 大幅增加关键词密度
1. 按照"关键词分布黄金法则",在各个章节**均匀增加**关键词
2. 优先在以下位置增加:
   - Meta标题(如果没有,必须加上)
   - Meta描述(如果没有,必须加上)
   - 引言首句
   - 至少2个H2标题
   - How to Use章节(增加2-3次)
   - FAQ(增加2次)
3. 同时使用语义变体丰富内容
4. **确保最终密度达到1.5-2.5%**

⚠️ 重要: 这不是"轻微调整",而是"大幅优化"。必须真正增加${needToAdd}次左右!`

    } else if (currentDensity >= 1.0 && currentDensity <= 3.0) {
      // 密度合理,微调即可
      optimizationStrategy = `
**✅ 当前密度合理** (${currentDensity.toFixed(2)}%)

**诊断**:
- 当前出现次数: ${currentCount}次
- 目标范围: ${minTargetCount}-${maxTargetCount}次
- 当前状态: 密度在可接受范围内

**策略**: ✨ 优化分布和语义丰富度
1. **不要大幅改变关键词密度** - 当前密度已经合理!
2. 重点优化关键词**分布**:
   - 确保Meta标题包含关键词(前30字符内)
   - 确保引言首句包含关键词
   - 确保至少2个H2包含关键词
   - 确保FAQ中至少2个问答包含关键词
3. 增加**语义丰富度**:
   - 创造3-5个语义变体
   - 使用5-8个相关术语
   - 提升内容的主题覆盖深度
4. 如果需要微调密度:
   - 密度<1.5%: 可以增加1-2次
   - 密度>2.5%: 可以用语义变体替换1-2次精确匹配

⚠️ 重要: **不要为了"优化"而破坏已经合理的密度!** 保持在1.5-2.5%即可。`

    } else {
      // 密度过高,需要减少
      const needToRemove = currentCount - idealTargetCount
      optimizationStrategy = `
**⚠️ 当前密度过高** (${currentDensity.toFixed(2)}%)

**诊断**:
- 当前出现次数: ${currentCount}次
- 目标出现次数: ${idealTargetCount}次
- **需要减少**: 约${needToRemove}次

**策略**: 🔄 用语义变体替换部分精确匹配
1. **不要直接删除关键词** - 这会损失SEO价值
2. 改用**语义替换策略**:
   - 找出${needToRemove}处可以替换的关键词
   - 用语义变体替换(同义词、改写、不同表达)
   - 保持语义一致性
3. 优先替换以下位置的关键词:
   - 同一段落出现2次以上的(保留1次,其余替换)
   - 相邻句子都出现的(保留1处,其余替换)
   - 不在关键位置的(非标题、非首尾段)
4. 确保保留以下位置的关键词(不要替换):
   - Meta标题
   - 至少1个H2
   - 引言首句
   - 结尾段
5. **确保最终密度降到1.5-2.5%**

⚠️ 重要: 用语义变体替换,而不是删除!`
    }

  } else {
    // 没有关键词或内容,使用默认策略
    optimizationStrategy = `
**⚠️ 无法分析当前密度** (缺少关键词或内容)

**策略**: 按照标准SEO最佳实践优化
1. 确保关键词密度在1.5-2.5%
2. 遵循"关键词分布黄金法则"
3. 使用语义变体丰富内容`
  }

  // ========== 步骤5: 生成位置清单(v2.1核心改进) ==========
  // 动态分配关键词插入任务
  const h2TargetCount = Math.max(3, Math.min(Math.round(estimatedWordCount / 300), 6)) // 3-6个H2

  const taskAllocation = {
    // Tier 1: 固定位置
    metaTitle: 1,
    metaDesc: 1,
    introFirst: 1,

    // Tier 2: H2标题
    h2What: 1,
    h2HowTo: 1,
    h2BestPractices: 1,
    h2Additional: Math.max(0, h2TargetCount - 3), // 额外的H2

    // Tier 3: 内容分布(基于目标密度动态分配)
    introSection: Math.max(1, Math.round(idealTargetCount * 0.10)),
    featuresSection: Math.max(1, Math.round(idealTargetCount * 0.08)),
    howToSection: Math.max(2, Math.round(idealTargetCount * 0.25)), // 最长章节
    practicesSection: Math.max(1, Math.round(idealTargetCount * 0.12)),
    troubleshootingSection: Math.max(1, Math.round(idealTargetCount * 0.08)),
    ideasSection: Math.max(1, Math.round(idealTargetCount * 0.10)),
    conclusionSection: Math.max(1, Math.round(idealTargetCount * 0.08)),

    // Tier 4: FAQ
    faqMinCount: Math.max(3, Math.round((params.faqItems || []).length * 0.5))
  }

  const taskTotalCount = Object.values(taskAllocation).reduce((a, b) => a + b, 0)

  // 生成任务清单文本
  const taskChecklist = `
### Tier 1: Meta信息 (固定,必须100%完成)
- [ ] Meta标题中插入 ${taskAllocation.metaTitle} 次 (前30字符内)
- [ ] Meta描述中插入 ${taskAllocation.metaDesc} 次

### Tier 2: 结构性位置 (H2标题,必须)
- [ ] "What is {{targetKeyword}}?" 标题中插入 ${taskAllocation.h2What} 次
- [ ] "How to Use {{targetKeyword}}" 标题中插入 ${taskAllocation.h2HowTo} 次
- [ ] "Best Practices for {{targetKeyword}}" 标题中插入 ${taskAllocation.h2BestPractices} 次
${taskAllocation.h2Additional > 0 ? `- [ ] 其他H2标题中再插入 ${taskAllocation.h2Additional} 次` : ''}

### Tier 3: 正文段落 (按章节分配)
- [ ] Introduction段落: 插入 ${taskAllocation.introSection} 次 (首句必须包含1次)
- [ ] Key Features段落: 插入 ${taskAllocation.featuresSection} 次
- [ ] How to Use段落: 插入 ${taskAllocation.howToSection} 次 (最长章节,多插入)
- [ ] Best Practices段落: 插入 ${taskAllocation.practicesSection} 次
- [ ] Troubleshooting段落: 插入 ${taskAllocation.troubleshootingSection} 次
- [ ] Creative Ideas段落: 插入 ${taskAllocation.ideasSection} 次
- [ ] Conclusion段落: 插入 ${taskAllocation.conclusionSection} 次

### Tier 4: FAQ (必须)
- [ ] 至少 ${taskAllocation.faqMinCount} 个问答包含关键词 (建议在Q1, Q3, Q5, Q7中插入)

**✅ 完成以上所有任务,关键词将出现约 ${taskTotalCount} 次,密度将自动达到 ${(taskTotalCount / estimatedWordCount * 100).toFixed(1)}%**
`

  // ========== 步骤6: 准备所有提示词变量 ==========
  const promptVariables = {
    // 语言信息
    languageName: params.languageName,
    languageCode: params.languageCode,

    // 当前状态
    currentScore: params.currentScore,

    // Meta 信息
    metaTitle: params.metaTitle || '未提供',
    metaTitleLength: (params.metaTitle || '').length,
    metaDescription: params.metaDescription || '未提供',
    metaDescriptionLength: (params.metaDescription || '').length,
    metaKeywords: params.metaKeywords || '未提供',

    // 关键词
    targetKeyword: params.targetKeyword || '未提供',
    longTailKeywords: (params.longTailKeywords || []).join(', ') || '未提供',
    secondaryKeywords: (params.secondaryKeywords || []).join(', ') || '未提供',

    // 内容
    guideIntro: params.guideIntro || '未提供',
    guideIntroLength: (params.guideIntro || '').length,
    guideContent: params.guideContent || '未提供',
    guideContentLength: (params.guideContent || '').length,

    // FAQ
    faqCount: (params.faqItems || []).length,
    faqItems: (params.faqItems || []).length > 0
      ? params.faqItems.map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n')
      : '未提供',

    // 优化建议
    recommendations: (params.recommendations || [])
      .map((rec, i) => `${i + 1}. ${rec}`)
      .join('\n') || '无具体建议',

    // ========== v2.0 保留: 关键词密度计算变量 ==========
    estimatedWordCount: estimatedWordCount,
    minTargetCount: minTargetCount,
    idealTargetCount: idealTargetCount,
    maxTargetCount: maxTargetCount,
    optimizationStrategy: optimizationStrategy,

    // ========== v2.1 新增: 任务清单变量 ==========
    taskChecklist: taskChecklist,
    taskTotalCount: taskTotalCount,
    currentKeywordCount: currentCount,
    currentDensityPercent: currentDensity.toFixed(2)
  }

  try {
    // ✅ 从数据库加载提示词模板
    console.log('[SEO Prompts] 从数据库加载 seo-optimize v2.0 提示词模板...')
    const prompt = await promptTemplateService.buildPrompt('seo-optimize', promptVariables)

    console.log('[SEO Prompts] ✅ 成功从数据库加载一键优化提示词模板 v2.0')
    console.log('[SEO Prompts] 📊 密度目标:', {
      当前密度: currentDensity.toFixed(2) + '%',
      理想次数: idealTargetCount,
      策略: currentDensity < 1.0 ? '大幅增加' : currentDensity > 3.0 ? '语义替换' : '微调分布'
    })

    return prompt

  } catch (error) {
    console.error('[SEO Prompts] ❌ 数据库加载失败:', error)
    throw new Error('无法加载一键优化提示词模板，请检查数据库配置')
  }
}
