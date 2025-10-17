/**
 * SEO 评分计算器 - AI 智能评分版本
 * 使用 Claude CLI (SEO 专家角色) 进行智能评分
 * 完全替换基于规则的评分系统
 */

import {
  generateContentHash,
  getCachedScore,
  setCachedScore
} from '@/utils/seoScoreCache'

// 动态导入 Node.js 模块（仅在服务端可用）
let execAsync: any = null
if (typeof window === 'undefined') {
  // 服务端环境
  import('child_process').then(({ exec }) => {
    import('util').then(({ promisify }) => {
      execAsync = promisify(exec)
    })
  })
}

export interface SEOGuideData {
  meta_title?: string
  meta_description?: string
  meta_keywords?: string
  guide_content?: string
  guide_intro?: string
  target_keyword?: string // 目标关键词（单关键词优化）
  long_tail_keywords?: string[]
  secondary_keywords?: string[]
  faq_items?: Array<{ question: string; answer: string }>
  page_views?: number
  avg_time_on_page?: number
  bounce_rate?: number
  conversion_rate?: number
}

export interface SEOScoreResult {
  total_score: number // 总分 0-100
  content_quality_score: number // 内容质量分 0-40
  keyword_optimization_score: number // 关键词优化分 0-30
  readability_score: number // 可读性分 0-20
  keyword_density_score: number // 关键词密度分 0-10
  keyword_density: Record<string, number> // 关键词密度
  recommendations: string[] // 优化建议
}

/**
 * 构建 SEO 专家系统 Prompt
 */
function buildSEOExpertPrompt(data: SEOGuideData): string {
  const prompt = `你是一位拥有10年经验的资深 SEO 专家。请对以下 SEO 用户指南内容进行专业、详细的评分和分析。

## 评分维度（总分100分）

1. **内容质量** (0-40分)
   - 内容原创性和深度
   - 信息价值和实用性
   - 内容结构和组织
   - Meta信息质量（标题、描述）

2. **关键词优化** (0-30分)
   - 主关键词密度（理想1-3%）
   - 长尾关键词覆盖度
   - 关键词分布的自然度
   - 语义相关性

3. **可读性** (0-20分)
   - 段落结构（理想100-300字/段）
   - 标题层级（H1/H2/H3）使用
   - 语言流畅度和逻辑
   - 用户友好性

4. **关键词密度** (0-10分)
   - 主关键词理想范围：1.5% ≤ 密度 ≤ 2.5%
   - 长尾/次要关键词理想范围：0.5% ≤ 密度 ≤ 1.5% (更宽松标准)
   - 根据达标率评分：≥90%=10分，≥80%=9分，≥50%=8分（及格线）

## 待评分内容

### Meta 信息
- **Meta 标题**: ${data.meta_title || '未提供'}
- **Meta 描述**: ${data.meta_description || '未提供'}
- **Meta 关键词**: ${data.meta_keywords || '未提供'}

### 关键词策略
- **目标关键词**: ${data.target_keyword || '未提供'}
- **长尾关键词**: ${data.long_tail_keywords?.join(', ') || '未提供'}
- **次要关键词**: ${data.secondary_keywords?.join(', ') || '未提供'}

### 内容
**引言部分**:
${data.guide_intro || '未提供'}

**正文内容**:
${data.guide_content || '未提供'}

**FAQ**:
${data.faq_items?.map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n') || '未提供'}

### 用户数据
- 页面浏览量: ${data.page_views || 0}
- 平均停留时间: ${data.avg_time_on_page || 0} 秒
- 跳出率: ${data.bounce_rate || 0}%
- 转化率: ${data.conversion_rate || 0}%

## 输出要求

请严格按照以下 JSON 格式返回评分结果：

\`\`\`json
{
  "total_score": 85,
  "content_quality_score": 36,
  "keyword_optimization_score": 27,
  "readability_score": 17,
  "keyword_density_score": 5,
  "keyword_density": {
    "主关键词1": 2.5,
    "长尾关键词1": 1.8,
    "长尾关键词2": 1.2
  },
  "recommendations": [
    "Meta标题建议改为：'...'（当前缺少主关键词）",
    "第3段过长（450字），建议拆分为两个段落，提升可读性",
    "长尾关键词'tutorial for beginners'仅出现1次，建议在FAQ中自然融入2-3次",
    "建议在引言部分增加一个具体的使用场景案例，提升内容实用性",
    "Meta描述建议改为：'...'（增加行动号召CTA）",
    "正文缺少H2级标题，建议在第500字处添加小节标题",
    "FAQ第2个问题的回答过于简短（仅30字），建议扩展到80-100字",
    "关键词'video template'密度过高（5.2%），有关键词堆砌风险，建议降至3%以内"
  ]
}
\`\`\`

## 评分和建议要求

1. **评分要严格但公正**：基于SEO最佳实践标准
2. **建议要具体可操作**：
   - 明确指出问题位置（第几段、第几个FAQ等）
   - 给出具体修改示例（不要泛泛而谈）
   - 优先级排序（最重要的问题放前面）
3. **关键词密度**：以百分比表示，精确到小数点后1位
4. **建议数量**：5-10条，覆盖各个维度
5. **语言**：使用中文

请只返回 JSON，不要添加任何其他说明文字。`

  return prompt
}

/**
 * 调用 Claude CLI 进行 AI 评分
 */
async function callClaudeAI(prompt: string): Promise<SEOScoreResult> {
  // 检查是否在浏览器环境
  if (typeof window !== 'undefined') {
    throw new Error('Claude CLI 只能在服务端运行')
  }

  // 检查 execAsync 是否可用
  if (!execAsync) {
    throw new Error('execAsync 未初始化')
  }

  const timeout = 60000 // 60秒超时

  try {
    console.log('[SEO AI] 调用 Claude CLI 进行智能评分...')

    // 写入临时文件（避免命令行长度限制）
    const tmpFile = `/tmp/seo-prompt-${Date.now()}.txt`
    const fs = await import('fs/promises')
    await fs.writeFile(tmpFile, prompt, 'utf-8')

    try {
      // 使用文件输入 + JSON 输出
      const { stdout, stderr } = await execAsync(
        `cat "${tmpFile}" | claude -p --output-format json`,
        {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout,
          env: { ...process.env },
          shell: '/bin/bash'
        }
      )

      if (stderr) {
        console.warn('[SEO AI] Claude CLI 警告:', stderr)
      }

      // 解析 Claude CLI 的包装响应
      const cliResponse = JSON.parse(stdout.trim())

      // 提取实际的 AI 响应
      let aiContent = cliResponse.result || stdout

      // 从 markdown 代码块中提取 JSON
      const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/) ||
                       aiContent.match(/```\n([\s\S]*?)\n```/)

      const jsonContent = jsonMatch ? jsonMatch[1] : aiContent
      const result = JSON.parse(jsonContent.trim())

      // 验证结果格式
      if (!result.total_score || !result.recommendations) {
        console.error('[SEO AI] 解析失败，响应:', stdout)
        throw new Error('AI 返回的评分格式不正确')
      }

      console.log('[SEO AI] 评分完成:', {
        total: result.total_score,
        recommendations: result.recommendations.length
      })

      return {
        total_score: result.total_score,
        content_quality_score: result.content_quality_score || 0,
        keyword_optimization_score: result.keyword_optimization_score || 0,
        readability_score: result.readability_score || 0,
        keyword_density_score: result.keyword_density_score || 0,
        keyword_density: result.keyword_density || {},
        recommendations: result.recommendations || []
      }
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(tmpFile)
      } catch (e) {
        // 忽略删除错误
      }
    }
  } catch (error) {
    console.error('[SEO AI] Claude CLI 调用失败:', error)
    throw error
  }
}

/**
 * 精确计算关键词密度 - 使用确定性算法
 *
 * @param content - 要分析的文本内容（包括 intro + content + FAQ）
 * @param keywords - 关键词列表
 * @returns 每个关键词的密度（百分比，保留1位小数）
 */
export function calculateKeywordDensity(
  content: string,
  keywords: string[]
): Record<string, number> {
  if (!content || keywords.length === 0) {
    return {}
  }

  // 1. 文本预处理：转小写、移除多余空白
  const normalizedContent = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  // 2. 简单分词（按空格和标点符号分割）
  const words = normalizedContent.split(/[\s\p{P}]+/u).filter(w => w.length > 0)
  const totalWords = words.length

  if (totalWords === 0) {
    return {}
  }

  const density: Record<string, number> = {}

  // 3. 对每个关键词进行精确匹配计数
  keywords.forEach(keyword => {
    const normalizedKeyword = keyword.toLowerCase().trim()
    const keywordWords = normalizedKeyword.split(/\s+/)

    let count = 0

    // 滑动窗口匹配多词关键词
    if (keywordWords.length === 1) {
      // 单词关键词：直接计数
      count = words.filter(w => w === keywordWords[0]).length
    } else {
      // 多词关键词：使用滑动窗口
      for (let i = 0; i <= words.length - keywordWords.length; i++) {
        const match = keywordWords.every((kw, idx) => words[i + idx] === kw)
        if (match) {
          count++
        }
      }
    }

    // 4. 计算密度百分比（保留1位小数）
    const densityValue = (count / totalWords) * 100
    density[keyword] = parseFloat(densityValue.toFixed(1))
  })

  return density
}

/**
 * 精确计算关键词密度评分 (0-10分) - 单关键词优化版本
 *
 * ✅ 2024年SEO标准 - 针对单个目标关键词的密度评分：
 * - 目标关键词理想范围：1.5% ≤ 密度 ≤ 2.5% → 10分（完美）
 * - 可接受范围：1.0% ≤ 密度 < 1.5% 或 2.5% < 密度 ≤ 3.0% → 7-9分（良好）
 * - 需要优化：0.5% ≤ 密度 < 1.0% 或 3.0% < 密度 ≤ 4.0% → 4-6分（及格）
 * - 不合格：密度 < 0.5% 或 密度 > 4.0% → 0-3分（需要调整）
 *
 * @param keywordDensity - 关键词密度数据 { keyword: density% }
 * @param targetKeyword - 目标关键词
 * @returns 0-10分的整数评分
 */
export function calculateKeywordDensityScore(
  keywordDensity: Record<string, number>,
  targetKeyword?: string
): number {
  if (!targetKeyword || Object.keys(keywordDensity).length === 0) {
    return 0
  }

  // 获取目标关键词的密度（不区分大小写）
  const normalizedTarget = targetKeyword.toLowerCase().trim()
  let density = 0

  // 查找匹配的关键词密度
  for (const [keyword, value] of Object.entries(keywordDensity)) {
    if (keyword.toLowerCase().trim() === normalizedTarget) {
      density = value
      break
    }
  }

  // 如果找不到目标关键词，返回0分
  if (density === 0) {
    return 0
  }

  // ✅ 根据密度范围精确评分
  if (density >= 1.5 && density <= 2.5) {
    // 理想范围：10分（完美）
    return 10
  } else if (density >= 1.0 && density < 1.5) {
    // 偏低但可接受：7-9分
    // 1.4% → 9分，1.3% → 8分，1.0-1.2% → 7分
    if (density >= 1.4) return 9
    if (density >= 1.3) return 8
    return 7
  } else if (density > 2.5 && density <= 3.0) {
    // 偏高但可接受：7-9分
    // 2.6% → 9分，2.7% → 8分，2.8-3.0% → 7分
    if (density <= 2.6) return 9
    if (density <= 2.7) return 8
    return 7
  } else if (density >= 0.5 && density < 1.0) {
    // 偏低需要优化：4-6分
    // 0.9% → 6分，0.7-0.8% → 5分，0.5-0.6% → 4分
    if (density >= 0.9) return 6
    if (density >= 0.7) return 5
    return 4
  } else if (density > 3.0 && density <= 4.0) {
    // 偏高需要优化：4-6分
    // 3.1-3.3% → 6分，3.4-3.6% → 5分，3.7-4.0% → 4分
    if (density <= 3.3) return 6
    if (density <= 3.6) return 5
    return 4
  } else if (density < 0.5) {
    // 严重偏低：0-3分
    // 0.3-0.4% → 3分，0.2% → 2分，< 0.2% → 1分
    if (density >= 0.3) return 3
    if (density >= 0.2) return 2
    if (density > 0) return 1
    return 0
  } else {
    // 严重偏高 (> 4.0%)：0-3分
    // 4.1-5.0% → 3分，5.1-6.0% → 2分，> 6.0% → 1分
    if (density <= 5.0) return 3
    if (density <= 6.0) return 2
    return 1
  }
}

/**
 * 从 SEOGuideData 提取完整文本内容
 */
export function extractFullContent(data: SEOGuideData): string {
  const parts: string[] = []

  // Meta信息
  if (data.meta_title) parts.push(data.meta_title)
  if (data.meta_description) parts.push(data.meta_description)
  if (data.meta_keywords) parts.push(data.meta_keywords)

  // 主要内容
  if (data.guide_intro) parts.push(data.guide_intro)
  if (data.guide_content) parts.push(data.guide_content)

  // FAQ
  if (data.faq_items && data.faq_items.length > 0) {
    data.faq_items.forEach(item => {
      parts.push(item.question)
      parts.push(item.answer)
    })
  }

  return parts.join('\n\n')
}

/**
 * 降级评分方案（当 AI 不可用时）
 */
function getBasicScore(data: SEOGuideData): SEOScoreResult {
  const contentLength = (data.guide_content || '').length
  const hasKeyword = data.target_keyword &&
    (data.meta_title || '').toLowerCase().includes(data.target_keyword.toLowerCase())
  const faqCount = (data.faq_items || []).length

  // 简单的基础评分逻辑
  const contentScore = Math.min(Math.floor(contentLength / 50), 25)
  const keywordScore = hasKeyword ? 15 : 5
  const readabilityScore = contentLength > 500 ? 12 : 8
  const keywordDensityScore = 5

  const totalScore = contentScore + keywordScore + readabilityScore + keywordDensityScore

  return {
    total_score: totalScore,
    content_quality_score: contentScore,
    keyword_optimization_score: keywordScore,
    readability_score: readabilityScore,
    keyword_density_score: keywordDensityScore,
    keyword_density: {},
    recommendations: [
      '⚠️ AI 智能评分暂时不可用，当前为基础评分',
      `内容长度: ${contentLength} 字${contentLength < 1000 ? '（建议增加到1500字以上）' : ''}`,
      `Meta标题${hasKeyword ? '已包含' : '缺少'}主关键词`,
      `FAQ数量: ${faqCount} 个${faqCount < 5 ? '（建议增加到5个以上）' : ''}`,
      '💡 建议稍后使用"重新评分"功能获取详细的 AI 分析'
    ]
  }
}

/**
 * 主评分函数 - 使用 AI 智能评分
 */
export async function calculateSEOScore(data: SEOGuideData): Promise<SEOScoreResult> {
  try {
    // 1. 检查缓存
    const contentHash = generateContentHash(data)
    const cached = getCachedScore(contentHash)
    if (cached) {
      console.log('[SEO Score] 使用缓存结果')
      return cached
    }

    // 2. 调用 AI 评分
    const prompt = buildSEOExpertPrompt(data)
    const score = await callClaudeAI(prompt)

    // 3. 保存到缓存
    setCachedScore(contentHash, score)

    return score
  } catch (error) {
    console.error('[SEO Score] AI 评分失败，使用降级方案:', error)

    // 降级到基础评分
    return getBasicScore(data)
  }
}

/**
 * 获取评分等级
 */
export function getSEOScoreGrade(score: number): {
  grade: string
  color: 'success' | 'warning' | 'error'
  label: string
} {
  if (score >= 80) {
    return { grade: 'A', color: 'success', label: '优秀' }
  } else if (score >= 60) {
    return { grade: 'B', color: 'warning', label: '良好' }
  } else if (score >= 40) {
    return { grade: 'C', color: 'warning', label: '及格' }
  } else {
    return { grade: 'D', color: 'error', label: '差' }
  }
}
