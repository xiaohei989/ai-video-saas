/**
 * SEO AI 提示词配置中心 (JavaScript版本)
 * 统一管理所有SEO相关的AI提示词
 *
 * ✅ 新架构：提示词从数据库 ai_prompt_templates 表加载
 * - 提示词模板: ai_prompt_templates.prompt_template (name='seo-score')
 * - 支持在线编辑和版本管理
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: join(__dirname, '../.env') })

// 初始化 Supabase 客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量: VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 内存缓存（避免每次都查询数据库）
let promptTemplateCache = null
let cacheTimestamp = 0
const CACHE_TTL = 60000 // 1分钟缓存

/**
 * 从数据库加载SEO评分提示词模板
 */
async function loadPromptTemplate() {
  // 检查缓存
  if (promptTemplateCache && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return promptTemplateCache
  }

  try {
    const { data, error } = await supabase
      .from('ai_prompt_templates')
      .select('prompt_template, version, display_name')
      .eq('name', 'seo-score')
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('[seoPrompts] ❌ 数据库加载失败:', error.message)
      // 回退到文件系统
      console.log('[seoPrompts] 🔄 回退到本地MD文件')
      return readFileSync(join(__dirname, '../prompts/seo-score-prompt-simple.md'), 'utf-8')
    }

    if (!data?.prompt_template) {
      throw new Error('模板内容为空')
    }

    console.log(`[seoPrompts] ✅ 从数据库加载SEO评分模板 - ${data.display_name} (v${data.version})`)
    promptTemplateCache = data.prompt_template
    cacheTimestamp = Date.now()
    return promptTemplateCache
  } catch (err) {
    console.error('[seoPrompts] ❌ 加载异常:', err.message)
    // 回退到文件系统
    console.log('[seoPrompts] 🔄 回退到本地MD文件')
    return readFileSync(join(__dirname, '../prompts/seo-score-prompt-simple.md'), 'utf-8')
  }
}

/**
 * 填充提示词模板
 * @param {string} templateContent - Markdown模板内容
 * @param {Object} variables - 要替换的变量对象
 * @returns {string} 填充后的提示词
 */
function fillPromptTemplate(templateContent, variables) {
  let result = templateContent

  // 替换所有 {{variableName}} 格式的变量
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    const replacement = value !== undefined && value !== null ? String(value) : ''
    result = result.replaceAll(placeholder, replacement)
  })

  return result
}

/**
 * SEO评分提示词专用加载器
 * @param {Object} params - 参数对象
 * @returns {Promise<string>} 填充后的提示词
 */
export async function buildSEOScorePrompt(params) {
  const {
    languageName,
    languageCode,
    targetKeyword,
    metaTitle,
    metaDescription,
    metaKeywords,
    longTailKeywords = [],
    secondaryKeywords = [],
    keywordDensity = {},
    guideIntro,
    guideContent,
    faqItems = [],
    pageViews = 0,
    avgTimeOnPage = 0,
    bounceRate = 0,
    conversionRate = 0
  } = params

  // 从数据库加载模板
  const template = await loadPromptTemplate()

  // 格式化关键词密度
  const keywordDensityText = Object.entries(keywordDensity)
    .map(([kw, density]) => `- **${kw}**: ${density}%`)
    .join('\n') || '- 暂无密度数据'

  // 格式化FAQ
  const faqText = faqItems
    .map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`)
    .join('\n\n') || '未提供'

  // 无关键词警告
  const noKeywordWarning = !targetKeyword
    ? '⚠️ **致命错误：未提供目标关键词** - 无法进行SEO评分。'
    : ''

  // 使用数据库模板填充变量
  return fillPromptTemplate(template, {
    languageName,
    languageCode,
    targetKeyword: targetKeyword || '未提供',
    metaTitle: metaTitle || '未提供',
    metaDescription: metaDescription || '未提供',
    keywordDensity: keywordDensityText,
    guideIntro: guideIntro || '未提供',
    guideContent: guideContent || '未提供',
    faq: faqText,
    pageViews,
    avgTimeOnPage,
    bounceRate,
    conversionRate,
    noKeywordWarning
  })
}

/**
 * 从数据库加载一键优化提示词模板
 */
async function loadOptimizeTemplate() {
  try {
    const { data, error } = await supabase
      .from('ai_prompt_templates')
      .select('prompt_template, version, display_name')
      .eq('name', 'seo-optimize')
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('[seoPrompts] ❌ 加载 seo-optimize 模板失败:', error.message)
      throw new Error('无法加载一键优化模板')
    }

    if (!data?.prompt_template) {
      throw new Error('一键优化模板内容为空')
    }

    console.log(`[seoPrompts] ✅ 从数据库加载SEO一键优化模板 - ${data.display_name} (v${data.version})`)
    return data.prompt_template
  } catch (err) {
    console.error('[seoPrompts] ❌ 加载异常:', err.message)
    throw err
  }
}

/**
 * SEO一键优化提示词专用加载器
 * @param {Object} params - 参数对象
 * @returns {Promise<string>} 填充后的提示词
 */
export async function buildOptimizePrompt(params) {
  const {
    languageName,
    languageCode,
    currentScore = 0,
    metaTitle = '',
    metaDescription = '',
    metaKeywords = '',
    targetKeyword = '',
    longTailKeywords = [],
    secondaryKeywords = [],
    guideIntro = '',
    guideContent = '',
    faqItems = [],
    recommendations = []
  } = params

  // 从数据库加载模板
  const template = await loadOptimizeTemplate()

  // 格式化 FAQ
  const faqItemsText = faqItems && faqItems.length > 0
    ? faqItems.map((item, i) => `Q${i + 1}: ${item.question}\nA${i + 1}: ${item.answer}`).join('\n\n')
    : '未提供'

  // 格式化建议
  const recommendationsText = recommendations && recommendations.length > 0
    ? recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
    : '无具体建议'

  // ========== v2.1 新增: 计算关键词密度和生成任务清单 ==========

  // 1. 计算当前关键词密度
  const fullContent = `${metaTitle} ${metaDescription} ${guideIntro} ${guideContent} ${faqItemsText}`
  const normalizedContent = fullContent.toLowerCase()
  const normalizedKeyword = (targetKeyword || '').toLowerCase()

  // 计算总词数
  const words = fullContent.split(/[\s\p{P}]+/u).filter(w => w.length > 0)
  const totalWords = words.length || 1 // 避免除以0

  // 计算关键词出现次数
  let currentKeywordCount = 0
  if (normalizedKeyword) {
    const keywordWords = normalizedKeyword.split(/\s+/)
    if (keywordWords.length === 1) {
      // 单词关键词
      words.forEach(word => {
        if (word.toLowerCase() === keywordWords[0]) currentKeywordCount++
      })
    } else {
      // 多词关键词
      const regex = new RegExp(`\\b${normalizedKeyword.replace(/\s+/g, '\\s+')}\\b`, 'gi')
      currentKeywordCount = (fullContent.match(regex) || []).length
    }
  }

  // 计算当前密度
  const currentDensity = (currentKeywordCount / totalWords) * 100
  const currentDensityPercent = currentDensity.toFixed(2)

  // 2. 动态生成任务清单
  const estimatedWordCount = Math.max(totalWords, 1500) // 预估优化后字数
  const targetDensity = 2.0 // 目标密度 2.0%
  const idealTargetCount = Math.round((estimatedWordCount * targetDensity) / 100)

  // 任务分配策略
  const taskAllocation = {
    // Tier 1: 固定位置 (3次)
    metaTitle: 1,
    metaDesc: 1,
    introFirst: 1,

    // Tier 2: H2标题 (动态,约4-6次)
    h2What: 1,
    h2HowTo: 1,
    h2BestPractices: 1,
    h2Additional: Math.max(0, Math.round(estimatedWordCount / 300) - 3),

    // Tier 3: 正文内容分布 (动态,约15-25次)
    introSection: Math.max(1, Math.round(idealTargetCount * 0.10)),
    howToSection: Math.max(2, Math.round(idealTargetCount * 0.25)),
    practicesSection: Math.max(1, Math.round(idealTargetCount * 0.12)),
    troubleshootingSection: Math.max(1, Math.round(idealTargetCount * 0.10)),
    creativeSection: Math.max(1, Math.round(idealTargetCount * 0.08)),
    conclusionSection: Math.max(1, Math.round(idealTargetCount * 0.05)),

    // Tier 4: FAQ (动态,约3-5次)
    faqMinCount: Math.max(3, Math.round(faqItems.length * 0.5))
  }

  const taskTotalCount = Object.values(taskAllocation).reduce((a, b) => a + b, 0)

  // 生成任务清单文本
  const taskChecklist = `
### Tier 1: Meta信息 (固定,必须100%完成)
- [ ] Meta标题中插入 ${taskAllocation.metaTitle} 次
- [ ] Meta描述中插入 ${taskAllocation.metaDesc} 次
- [ ] 引言首句插入 ${taskAllocation.introFirst} 次

### Tier 2: 结构性位置 (H2标题)
- [ ] "What is ${targetKeyword}?" 标题中插入 ${taskAllocation.h2What} 次
- [ ] "How to Use ${targetKeyword}" 标题中插入 ${taskAllocation.h2HowTo} 次
- [ ] "Best Practices" 标题中插入 ${taskAllocation.h2BestPractices} 次
${taskAllocation.h2Additional > 0 ? `- [ ] 其他H2标题中插入 ${taskAllocation.h2Additional} 次` : ''}

### Tier 3: 正文内容分布 (自然融入)
- [ ] Introduction章节: ${taskAllocation.introSection} 次
- [ ] How to Use章节: ${taskAllocation.howToSection} 次
- [ ] Best Practices章节: ${taskAllocation.practicesSection} 次
- [ ] Troubleshooting章节: ${taskAllocation.troubleshootingSection} 次
- [ ] Creative Ideas章节: ${taskAllocation.creativeSection} 次
- [ ] Conclusion章节: ${taskAllocation.conclusionSection} 次

### Tier 4: FAQ (至少完成最低要求)
- [ ] 至少 ${taskAllocation.faqMinCount} 个FAQ问答包含关键词

**✅ 完成以上任务,关键词将出现约 ${taskTotalCount} 次,密度约${(taskTotalCount/estimatedWordCount*100).toFixed(1)}%**
`.trim()

  // ========== 填充所有变量 ==========

  // 使用数据库模板填充变量
  return fillPromptTemplate(template, {
    languageName,
    languageCode,
    currentScore,
    metaTitle: metaTitle || '未提供',
    metaTitleLength: metaTitle.length,
    metaDescription: metaDescription || '未提供',
    metaDescriptionLength: metaDescription.length,
    metaKeywords: metaKeywords || '未提供',
    targetKeyword: targetKeyword || '未提供',
    longTailKeywords: longTailKeywords.join(', ') || '未提供',
    secondaryKeywords: secondaryKeywords.join(', ') || '未提供',
    guideIntro: guideIntro || '未提供',
    guideIntroLength: guideIntro.length,
    guideContent: guideContent || '未提供',
    guideContentLength: guideContent.length,
    faqCount: faqItems.length,
    faqItems: faqItemsText,
    recommendations: recommendationsText,
    // v2.1 新增变量
    currentKeywordCount,
    currentDensityPercent,
    taskChecklist,
    taskTotalCount
  })
}
