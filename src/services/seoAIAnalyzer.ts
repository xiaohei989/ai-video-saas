/**
 * SEO AI深度分析层
 * 基于算法事实进行语义理解和质量判断
 *
 * 核心原则：
 * - 接收算法计算的客观事实
 * - 进行深度语义分析
 * - 返回详细的评分breakdown和建议
 */

import type { SEOFacts, SEOContent } from './seoFactsCalculator'

export interface AIAnalysisResult {
  total_score: number // 0-100
  dimension_scores: {
    meta_quality: number // 0-20
    content_quality: number // 0-30
    keyword_optimization: number // 0-20
    readability: number // 0-20
    ux: number // 0-10
  }
  detailed_breakdown: {
    meta_quality: MetaQualityBreakdown
    content_quality: ContentQualityBreakdown
    keyword_optimization: KeywordOptimizationBreakdown
    readability: ReadabilityBreakdown
    ux: UXBreakdown
  }
  top_strengths: string[]
  critical_issues: Array<{
    severity: 'high' | 'medium' | 'low'
    dimension: string
    issue: string
    impact: string
    fix: string
  }>
  actionable_recommendations: string[]
  confidence: number // 0-100
  conflicts: Array<{
    dimension: string
    algorithm_suggests: number
    ai_score: number
    reason: string
    confidence: 'high' | 'medium' | 'low'
  }>
}

interface MetaQualityBreakdown {
  base_score: number
  title_appeal: number
  description_persuasion: number
  reason: string
}

interface ContentQualityBreakdown {
  base_score: number
  originality_depth: number
  eeat: number
  structure_flow: number
  practicality: number
  highlights: string[]
  issues: string[]
}

interface KeywordOptimizationBreakdown {
  base_score: number
  naturalness_penalty: number
  semantic_relevance: number
  distribution: number
  issues: string[]
}

interface ReadabilityBreakdown {
  flesch_base: number
  language_fluency: number
  format_optimization: number
  visual_friendliness: number
  issues: string[]
}

interface UXBreakdown {
  base_score: number
  faq_quality: number
  completeness: number
  issues: string[]
}

/**
 * 构建超详细的AI提示词
 */
export function buildAIAnalysisPrompt(
  content: SEOContent,
  facts: SEOFacts
): string {
  const languageNames: Record<string, string> = {
    en: 'English',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    es: 'Español'
  }

  const languageName = languageNames[content.language || 'en'] || 'English'

  return `# SEO内容深度分析系统 v2.0

你是拥有15年经验的SEO专家，精通Google算法和E-E-A-T标准。

## 📊 客观数据（算法已计算）

### Meta信息
- **标题**: "${content.meta_title}" (${facts.meta.titleLength}字符)
- 关键词"${content.target_keyword}"在标题第${facts.meta.titleKeywordPosition !== -1 ? facts.meta.titleKeywordPosition : '未找到'}字符出现
- **描述**: "${content.meta_description}" (${facts.meta.descLength}字符)
- 描述包含关键词: ${facts.meta.descHasKeyword ? '是' : '否'}
- 描述包含CTA: ${facts.meta.descHasCTA ? `是 (${facts.meta.ctaType})` : '否'}

### 内容统计
- 总字数: ${facts.content.totalWords}
- H1: ${facts.content.h1Count}个, H2: ${facts.content.h2Count}个, H3: ${facts.content.h3Count}个
- 段落数: ${facts.content.paragraphCount}，平均${facts.content.avgParagraphLength}字/段
- 最长段落: ${facts.content.maxParagraphLength}字
- 列表: ${facts.content.listCount}个，代码块: ${facts.content.codeBlockCount}个，引用块: ${facts.content.quoteBlockCount}个

### 关键词分析
- 主关键词"${content.target_keyword}": 出现${facts.keywords.primary.count}次，密度${facts.keywords.primary.density}%
- 分布: ${facts.keywords.primary.inTitle ? '标题✓' : '标题✗'}, ${facts.keywords.primary.inFirstParagraph ? '首段✓' : '首段✗'}, ${facts.keywords.primary.inLastParagraph ? '尾段✓' : '尾段✗'}
- H2中出现${facts.keywords.primary.inH2Count}次，H3中出现${facts.keywords.primary.inH3Count}次

### 可读性
- Flesch可读性: ${facts.readability.fleschScore}分 (0-100, 越高越易读)
- 平均句长: ${facts.readability.avgSentenceLength}词/句
- 平均词长: ${facts.readability.avgWordLength}字符/词
- 复杂词数: ${facts.readability.complexWordCount} (占${facts.readability.complexWordRatio}%)

### 用户体验
- FAQ: ${facts.ux.faqCount}个
- FAQ平均问题长度: ${facts.ux.faqAvgQuestionLength}字
- FAQ平均答案长度: ${facts.ux.faqAvgAnswerLength}字
- 内部链接: ${facts.ux.internalLinkCount}个
- 外部链接: ${facts.ux.externalLinkCount}个

---

## 🎯 你的任务：5维度深度评分（总100分）

### 1. Meta信息质量 (0-20分)

**基础分数（参考算法数据）：**
\`\`\`
标题长度评分:
  50-60字符: 10分
  45-49或61-65字符: 7分
  其他: 3分

描述长度评分:
  150-160字符: 7分
  140-149或161-170字符: 5分
  其他: 2分

关键词优化:
  标题包含关键词: +2分
  描述包含关键词: +1分
\`\`\`

当前基础分 = ${calculateBaseMetaScore(facts)}分

**AI深度评估（调整±5分）：**

请评估以下方面，可在基础分上加减分：

1. **标题吸引力** (-3 to +3分)
   - 是否有情感触发词？(如"Ultimate", "Essential", "Complete", "完整", "必备")
   - 是否传递明确价值？(如"Save 50% Time", "提升2倍效率")
   - 是否有独特卖点？(vs 通用标题)
   - 关键词位置是否靠前？(前40字符内理想)

2. **描述说服力** (-2 to +2分)
   - CTA是否有吸引力？("Learn more" vs "Start creating now")
   - 是否展示了核心利益？
   - 长度是否充分利用？(不要浪费字符)
   - 是否有紧迫感或独特价值？

**输出格式：**
\`\`\`json
{
  "meta_quality_score": 18,
  "breakdown": {
    "base_score": 17,
    "title_appeal": +2,
    "description_persuasion": -1,
    "reason": "标题有情感词'Complete'且关键词在前20字符(+2分)，但描述CTA'Learn more'不够强可改为'Start now'(-1分)"
  }
}
\`\`\`

---

### 2. 内容质量 (0-30分)

**基础分数（参考算法数据）：**
\`\`\`
字数评分:
  ≥1500: 8分
  1000-1499: 5分
  <1000: 2分

结构评分:
  H2≥3个: 5分, H2≥5个: 7分
  有列表/代码块/引用: +3分
\`\`\`

当前基础分 = ${calculateBaseContentScore(facts)}分

**AI深度评估（核心维度，0-20分）：**

#### 2.1 原创性与深度 (0-10分)
请仔细阅读以下内容，判断：

**引言：**
${content.guide_intro || '未提供'}

**正文：**
${content.guide_content.substring(0, 2000)}${content.guide_content.length > 2000 ? '...(内容被截断)' : ''}

评估标准：
- **原创见解** (0-4分): 有独特观点、案例、数据？还是常识堆砌？
- **内容深度** (0-3分): 深入分析主题？还是浅尝辄止？
- **信息密度** (0-3分): 每段都有价值？还是废话连篇？

#### 2.2 E-E-A-T (0-8分)
- **Experience** (0-2分): 展示实际操作经验？还是纸上谈兵？
- **Expertise** (0-2分): 体现专业知识？还是外行描述？
- **Authoritativeness** (0-2分): 引用权威来源？还是主观臆断？
- **Trustworthiness** (0-2分): 准确可靠？还是误导性内容？

#### 2.3 结构与流畅度 (0-7分)
算法数据：${facts.content.h2Count}个H2, ${facts.content.h3Count}个H3
- **逻辑结构** (0-4分): 引言→正文→结论清晰？还是跳跃？
- **过渡流畅** (0-3分): 段落间连贯？还是生硬拼接？

#### 2.4 实用性 (0-5分)
- **可操作性** (0-3分): 具体步骤？还是泛泛而谈？
- **完整性** (0-2分): 覆盖用户所有疑问？还是留下疑问？

---

### 3. 关键词优化 (0-20分)

**基础分数（算法精确计算）：**
\`\`\`
密度评分:
  1.0-2.0%: 15分
  0.5-0.9%或2.1-3.0%: 10分
  其他: 5分

分布评分:
  在标题: +2分
  在首段: +1分
  在尾段: +1分
  H2中≥2次: +1分
\`\`\`

当前基础分 = ${calculateBaseKeywordScore(facts)}分

**AI验证与调整（±5分）：**

#### 3.1 自然度检查 (-5 to 0分)

请检测以下关键词堆砌迹象：
- 是否在同一句重复关键词？
- 是否强行插入导致语句不通？
- 是否在不必要的地方使用？

示例：
✅ 自然: "Creating ASMR food videos requires careful attention."
❌ 堆砌: "ASMR food videos are popular. ASMR food videos creators make ASMR food videos daily."

请检查正文中是否有类似堆砌现象。

#### 3.2 语义相关性 (0 to +3分)
- 是否使用了LSI关键词？(语义相关词)
- 是否覆盖了用户搜索意图的变体？
- 是否建立了主题权威？

#### 3.3 分布合理性 (0 to +2分)
算法数据：密度${facts.keywords.primary.density}%，出现${facts.keywords.primary.count}次
- 分布是否均匀？(不要前半部分密集，后半部分稀疏)
- 是否在关键位置？(已有算法数据)

---

### 4. 可读性 (0-20分)

**基础分数（算法Flesch公式）：**
\`\`\`
Flesch分数评分:
  ≥70: 10分 (易读)
  60-69: 7分 (较易读)
  50-59: 5分 (一般)
  <50: 2分 (难读)

格式评分:
  平均段落50-100字: 5分
  有列表/引用/代码块: 5分
\`\`\`

当前基础分 = ${calculateBaseReadabilityScore(facts)}分

**AI流畅度评估（±10分）：**

#### 4.1 语言流畅度 (0-5分)
请阅读内容，评估：
- 句子是否自然流畅？
- 是否有语法错误或不通顺？
- 专业术语是否有解释？
- 目标语言是否纯正？(当前: ${languageName})

#### 4.2 格式优化 (0-3分)
算法数据：平均段落${facts.content.avgParagraphLength}字，最长${facts.content.maxParagraphLength}字
- 段落长度是否适中？(50-100字理想)
- 是否有超长段落影响阅读？(>150字)

#### 4.3 视觉友好度 (0-2分)
算法数据：列表${facts.content.listCount}个，代码块${facts.content.codeBlockCount}个
- 列表/引用/代码块使用是否恰当？
- 标题层级是否清晰？

---

### 5. 用户体验 (0-10分)

**基础分数（参考算法数据）：**
\`\`\`
FAQ评分:
  ≥5个: 5分
  3-4个: 3分
  <3个: 1分

内容增强:
  有列表: +2分
  H2≥3个: +2分
  内容≥1500字: +1分
\`\`\`

当前基础分 = ${calculateBaseUXScore(facts)}分

**AI实用性评估（±3分）：**

#### 5.1 FAQ质量 (-2 to +2分)

算法数据：${facts.ux.faqCount}个FAQ，平均答案${facts.ux.faqAvgAnswerLength}字

**FAQ内容：**
${content.faq_items?.map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n') || '未提供'}

评估：
- FAQ是否回答了用户真正关心的问题？
- 答案是否详细充分？(理想80-150字)
- 是否有敷衍的FAQ？

#### 5.2 内容完整性 (0 to +1分)
- 是否有明显遗漏？
- 用户看完后是否还有疑问？

---

## 🔍 交叉验证（准确性保障）

**冲突检测：**
如果你的评分与算法数据明显冲突，请标记：
- 例如：密度1.85%在理想范围(算法建议15分)，但你发现堆砌现象(AI给10分)
- 必须在conflicts数组中说明原因

**置信度评分：**
为每个维度评估置信度(0-100)：
- 90-100: 高置信(数据充分，判断明确)
- 70-89: 中置信(部分信息缺失)
- <70: 低置信(数据不足，建议人工复核)

---

## 📤 输出格式

请严格按照以下JSON格式输出（不要添加任何Markdown标记）：

\`\`\`json
{
  "total_score": 88,
  "dimension_scores": {
    "meta_quality": 18,
    "content_quality": 26,
    "keyword_optimization": 18,
    "readability": 17,
    "ux": 9
  },
  "detailed_breakdown": {
    "meta_quality": {
      "base_score": 17,
      "title_appeal": 2,
      "description_persuasion": -1,
      "reason": "标题有'Complete'且关键词前置(+2)，描述CTA弱(-1)"
    },
    "content_quality": {
      "base_score": 16,
      "originality_depth": 8,
      "eeat": 6,
      "structure_flow": 5,
      "practicality": 4,
      "highlights": ["第3段展示实际案例(Experience+2)", "引用3个权威来源(Authority+2)"],
      "issues": ["第7-9段重复观点(-1)", "缺少具体数据(-1)"]
    },
    "keyword_optimization": {
      "base_score": 15,
      "naturalness_penalty": -1,
      "semantic_relevance": 3,
      "distribution": 1,
      "issues": ["第12段同句重复2次(-1)", "LSI词丰富(+3)"]
    },
    "readability": {
      "flesch_base": 10,
      "language_fluency": 4,
      "format_optimization": 2,
      "visual_friendliness": 1,
      "issues": ["第5段150字过长(-1)", "2处术语未解释(-1)"]
    },
    "ux": {
      "base_score": 8,
      "faq_quality": 2,
      "completeness": -1,
      "issues": ["FAQ#3仅35字(-1)", "FAQ覆盖核心问题(+2)"]
    }
  },
  "top_strengths": [
    "E-E-A-T评分优秀，引用3个权威来源(+2分)",
    "LSI关键词覆盖全面(+3分)",
    "Flesch可读性72分，易读(+10分)"
  ],
  "critical_issues": [
    {
      "severity": "high",
      "dimension": "keyword_optimization",
      "issue": "第12段同一句出现2次关键词",
      "impact": "-1分",
      "fix": "将第二次出现改为代词'it'"
    },
    {
      "severity": "medium",
      "dimension": "readability",
      "issue": "第5段150字过长",
      "impact": "-1分",
      "fix": "在第75字处拆分为两段"
    }
  ],
  "actionable_recommendations": [
    "【高优先级】修复第12段关键词堆砌，预计+1分",
    "【中优先级】拆分第5段，预计+1分",
    "【低优先级】扩充FAQ#3到80字，预计+1分"
  ],
  "confidence": 92,
  "conflicts": []
}
\`\`\`

**重要提示：**
1. 必须基于算法数据，不要猜测
2. 解释所有加减分和具体位置
3. 提供可操作建议
4. 标注置信度
5. 检测冲突

请只返回纯JSON，不要添加任何说明文字或Markdown代码块标记。`
}

/**
 * 计算基础Meta分数（供AI参考）
 */
function calculateBaseMetaScore(facts: SEOFacts): number {
  let score = 0

  // 标题长度
  const titleLen = facts.meta.titleLength
  if (titleLen >= 50 && titleLen <= 60) score += 10
  else if (titleLen >= 45 && titleLen <= 65) score += 7
  else score += 3

  // 描述长度
  const descLen = facts.meta.descLength
  if (descLen >= 150 && descLen <= 160) score += 7
  else if (descLen >= 140 && descLen <= 170) score += 5
  else score += 2

  // 关键词优化
  if (facts.meta.titleHasKeyword) score += 2
  if (facts.meta.descHasKeyword) score += 1

  return score
}

/**
 * 计算基础内容分数（供AI参考）
 */
function calculateBaseContentScore(facts: SEOFacts): number {
  let score = 0

  // 字数
  const words = facts.content.totalWords
  if (words >= 1500) score += 8
  else if (words >= 1000) score += 5
  else score += 2

  // H2数量
  const h2Count = facts.content.h2Count
  if (h2Count >= 5) score += 7
  else if (h2Count >= 3) score += 5

  // 列表/代码块/引用
  if (facts.content.listCount > 0 || facts.content.codeBlockCount > 0 || facts.content.quoteBlockCount > 0) {
    score += 3
  }

  return score
}

/**
 * 计算基础关键词分数（供AI参考）
 */
function calculateBaseKeywordScore(facts: SEOFacts): number {
  let score = 0
  const density = facts.keywords.primary.density

  // 密度评分
  if (density >= 1.0 && density <= 2.0) score += 15
  else if ((density >= 0.5 && density < 1.0) || (density > 2.0 && density <= 3.0)) score += 10
  else score += 5

  // 分布评分
  if (facts.keywords.primary.inTitle) score += 2
  if (facts.keywords.primary.inFirstParagraph) score += 1
  if (facts.keywords.primary.inLastParagraph) score += 1
  if (facts.keywords.primary.inH2Count >= 2) score += 1

  return Math.min(score, 20)
}

/**
 * 计算基础可读性分数（供AI参考）
 */
function calculateBaseReadabilityScore(facts: SEOFacts): number {
  let score = 0
  const flesch = facts.readability.fleschScore

  // Flesch分数
  if (flesch >= 70) score += 10
  else if (flesch >= 60) score += 7
  else if (flesch >= 50) score += 5
  else score += 2

  // 段落长度
  const avgPara = facts.content.avgParagraphLength
  if (avgPara >= 50 && avgPara <= 100) score += 5

  // 列表/引用/代码块
  if (facts.content.listCount > 0 || facts.content.codeBlockCount > 0 || facts.content.quoteBlockCount > 0) {
    score += 5
  }

  return Math.min(score, 20)
}

/**
 * 计算基础UX分数（供AI参考）
 */
function calculateBaseUXScore(facts: SEOFacts): number {
  let score = 0

  // FAQ数量
  const faqCount = facts.ux.faqCount
  if (faqCount >= 5) score += 5
  else if (faqCount >= 3) score += 3
  else if (faqCount > 0) score += 1

  // 列表
  if (facts.content.listCount > 0) score += 2

  // H2数量
  if (facts.content.h2Count >= 3) score += 2

  // 字数
  if (facts.content.totalWords >= 1500) score += 1

  return Math.min(score, 10)
}
