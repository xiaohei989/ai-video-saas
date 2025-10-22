/**
 * 关键词任务分配算法 v3.0
 *
 * 核心功能:
 * - 将抽象的"密度2.0%"转换为精确的"插入X次于Y位置"
 * - 根据文章字数和章节结构,自动计算每个位置的关键词插入次数
 * - 生成AI可执行的任务清单
 *
 * 设计原则:
 * 1. 精确计算 - 不依赖AI的数学能力
 * 2. 位置级指令 - 明确到"首句"、"中间段落"、"H2标题"
 * 3. 强制性语言 - 使用"必须"、"务必",不用"建议"
 * 4. 可验证性 - 提供清单格式,AI可自我检查
 */

import type { SectionStructure } from './promptBuilderService'

/**
 * 关键词任务分配结果
 */
export interface KeywordTaskAllocation {
  // 总体目标
  totalTarget: number           // 总目标次数 (如30次)
  targetDensity: number         // 目标密度 (如2.0%)
  wordCount: number             // 预计字数

  // Tier 1: Meta信息 (固定2次)
  tier1_meta: {
    metaTitle: {
      count: number              // 1次
      position: string           // "前30字符内"
      mandatory: boolean         // true
      example: string            // 示例
    }
    metaDescription: {
      count: number              // 1次
      position: string           // "自然融入"
      mandatory: boolean         // true
      example: string
    }
  }

  // Tier 2: 结构性标题 (H2标题,3-4次)
  tier2_structure: {
    h2Titles: Array<{
      title: string              // "What is {keyword}?"
      count: number              // 1次 (标题本身)
      mandatory: boolean         // true
      order: number              // 第几个H2
    }>
    totalCount: number
  }

  // Tier 3: 正文段落 (按章节分配,占60-70%)
  tier3_content: {
    sections: Array<{
      name: string               // "Introduction"
      h2Title: string            // 实际的H2标题
      totalCount: number         // 该章节总次数 (如3次)
      wordTarget: number         // 该章节目标字数
      distribution: {
        firstSentence: number    // 首句插入次数 (通常1次)
        middleParagraphs: number // 中间段落次数
        lastSentence: number     // 尾句插入次数
      }
      instructions: string       // 详细执行指南
      example: string            // 示例句子
    }>
    totalCount: number
  }

  // Tier 4: FAQ (固定比例,3-5次)
  tier4_faq: {
    minFaqWithKeyword: number    // 至少3个FAQ包含关键词
    totalCount: number           // FAQ中总共出现次数
    distribution: string         // "Q1问题1次, Q3答案1次, Q5问题1次"
  }
}

/**
 * 关键词任务分配器配置
 */
export interface KeywordTaskAllocatorConfig {
  targetDensity: number          // 目标密度 (默认2.0%)
  minDensity: number             // 最小密度 (默认1.5%)
  maxDensity: number             // 最大密度 (默认2.5%)

  tier1Weight: number            // Tier1占比 (默认固定2次)
  tier2Weight: number            // Tier2占比 (默认10-15%)
  tier3Weight: number            // Tier3占比 (默认60-70%)
  tier4Weight: number            // Tier4占比 (默认15-20%)

  h2KeywordRatio: number         // H2标题包含关键词比例 (默认50%)
  faqKeywordRatio: number        // FAQ包含关键词比例 (默认40%)

  maxConsecutive: number         // 最多连续几句包含关键词 (默认2)
  firstSentenceMandatory: boolean // 首句是否必须包含 (默认true)
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: KeywordTaskAllocatorConfig = {
  targetDensity: 2.0,
  minDensity: 1.5,
  maxDensity: 2.5,
  tier1Weight: 0,       // 固定2次,不参与比例计算
  tier2Weight: 0.12,    // 12%
  tier3Weight: 0.68,    // 68%
  tier4Weight: 0.20,    // 20%
  h2KeywordRatio: 0.5,
  faqKeywordRatio: 0.4,
  maxConsecutive: 2,
  firstSentenceMandatory: true
}

/**
 * 计算关键词任务分配
 *
 * @param wordCount 预计文章总字数
 * @param sections 章节结构数组
 * @param targetKeyword 目标关键词
 * @param config 配置 (可选)
 * @returns 详细的任务分配结果
 */
export function calculateKeywordTaskAllocation(
  wordCount: number,
  sections: SectionStructure[],
  targetKeyword: string,
  config: Partial<KeywordTaskAllocatorConfig> = {}
): KeywordTaskAllocation {

  const cfg = { ...DEFAULT_CONFIG, ...config }

  // ========== 防御: 检查空章节数组 ==========
  if (!sections || sections.length === 0) {
    console.error('[KeywordTaskAllocator] ❌ 错误: sections数组为空!')
    console.error('[KeywordTaskAllocator] 可能原因:')
    console.error('  1. 数据库迁移未执行 (039_howto_section_structure_v3.sql)')
    console.error('  2. structure_schema.required_sections 为空')
    console.error('  3. promptBuilderService 传递了空数组')

    throw new Error(
      '关键词分配失败: 章节结构为空。请确保已执行数据库迁移 039_howto_section_structure_v3.sql'
    )
  }

  // ========== 步骤1: 计算总目标次数 ==========
  const totalTarget = Math.round(wordCount * (cfg.targetDensity / 100))

  console.log(`[KeywordTaskAllocator] 总字数${wordCount}, 目标密度${cfg.targetDensity}%, 计算出总目标${totalTarget}次`)
  console.log(`[KeywordTaskAllocator] 收到 ${sections.length} 个章节结构`)

  // ========== 步骤2: 分配 Tier 1 (固定2次) ==========
  const tier1 = allocateTier1(targetKeyword)
  const tier1Count = tier1.metaTitle.count + tier1.metaDescription.count // 2次

  // ========== 步骤3: 分配 Tier 2 (H2标题) ==========
  const tier2 = allocateTier2(sections, targetKeyword, cfg)
  const tier2Count = tier2.totalCount

  // ========== 步骤4: 分配 Tier 4 (FAQ,先计算) ==========
  const tier4 = allocateTier4(totalTarget, cfg)
  const tier4Count = tier4.totalCount

  // ========== 步骤5: 分配 Tier 3 (正文,使用剩余预算) ==========
  const tier3Budget = totalTarget - tier1Count - tier2Count - tier4Count
  const tier3 = allocateTier3(sections, tier3Budget, targetKeyword, cfg)
  const tier3Count = tier3.totalCount

  // ========== 步骤6: 验证总数 ==========
  const actualTotal = tier1Count + tier2Count + tier3Count + tier4Count

  console.log(`[KeywordTaskAllocator] 分配结果: Tier1=${tier1Count}, Tier2=${tier2Count}, Tier3=${tier3Count}, Tier4=${tier4Count}, 总计=${actualTotal}`)

  if (Math.abs(actualTotal - totalTarget) > 3) {
    console.warn(`[KeywordTaskAllocator] ⚠️ 分配总数${actualTotal}与目标${totalTarget}差距较大 (>3)`)
  }

  return {
    totalTarget,
    targetDensity: cfg.targetDensity,
    wordCount,
    tier1_meta: tier1,
    tier2_structure: tier2,
    tier3_content: tier3,
    tier4_faq: tier4
  }
}

/**
 * 分配 Tier 1: Meta信息 (固定2次)
 */
function allocateTier1(targetKeyword: string): KeywordTaskAllocation['tier1_meta'] {
  return {
    metaTitle: {
      count: 1,
      position: '前30字符内',
      mandatory: true,
      example: `"${targetKeyword}: Complete Guide for Beginners (2025)"`
    },
    metaDescription: {
      count: 1,
      position: '自然融入,不要堆砌',
      mandatory: true,
      example: `"Learn how to master ${targetKeyword} with our comprehensive guide. Discover 10+ proven tips..."`
    }
  }
}

/**
 * 分配 Tier 2: H2标题
 *
 * 策略: 选择最重要的3-4个H2标题包含关键词
 */
function allocateTier2(
  sections: SectionStructure[],
  targetKeyword: string,
  config: KeywordTaskAllocatorConfig
): KeywordTaskAllocation['tier2_structure'] {

  // 筛选出H2级别的章节
  const h2Sections = sections.filter(s =>
    s.h2Title && s.h2Title.length > 0
  )

  // 根据h2KeywordRatio计算应该包含关键词的H2数量
  const targetH2Count = Math.max(
    3, // 至少3个
    Math.min(
      Math.round(h2Sections.length * config.h2KeywordRatio),
      h2Sections.length
    )
  )

  // 优先级规则: Introduction > How to Use > Best Practices > 其他
  const priorityOrder = [
    'introduction',
    'what is',
    'how to use',
    'step-by-step',
    'best practices',
    'tips',
    'conclusion'
  ]

  // 按优先级排序
  const sortedH2Sections = [...h2Sections].sort((a, b) => {
    const aName = a.sectionName.toLowerCase()
    const bName = b.sectionName.toLowerCase()

    const aPriority = priorityOrder.findIndex(p => aName.includes(p))
    const bPriority = priorityOrder.findIndex(p => bName.includes(p))

    // 优先级高的排前面
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority
    if (aPriority !== -1) return -1
    if (bPriority !== -1) return 1
    return 0
  })

  // 选择前N个H2
  const selectedH2s = sortedH2Sections.slice(0, targetH2Count).map((section, index) => ({
    title: section.h2Title,
    count: 1,
    mandatory: true,
    order: index + 1
  }))

  return {
    h2Titles: selectedH2s,
    totalCount: selectedH2s.length
  }
}

/**
 * 分配 Tier 3: 正文段落
 *
 * 策略: 根据章节字数比例分配关键词
 */
function allocateTier3(
  sections: SectionStructure[],
  budget: number,
  targetKeyword: string,
  config: KeywordTaskAllocatorConfig
): KeywordTaskAllocation['tier3_content'] {

  if (budget <= 0) {
    console.warn('[KeywordTaskAllocator] Tier3预算为0,跳过分配')
    return { sections: [], totalCount: 0 }
  }

  // 计算总字数 (用于权重计算)
  const totalWords = sections.reduce((sum, s) => sum + (s.maxWords || s.minWords || 200), 0)

  const allocatedSections: KeywordTaskAllocation['tier3_content']['sections'] = []
  let allocatedCount = 0

  for (const section of sections) {
    const sectionWords = section.maxWords || section.minWords || 200
    const weight = sectionWords / totalWords

    // 根据权重分配次数 (至少1次)
    let count = Math.max(1, Math.round(budget * weight))

    // 特殊章节加成
    const sectionNameLower = section.sectionName.toLowerCase()
    if (sectionNameLower.includes('how to') || sectionNameLower.includes('step')) {
      count = Math.max(count, Math.round(budget * 0.25)) // How to章节至少占25%
    }
    if (sectionNameLower.includes('introduction') || sectionNameLower.includes('what is')) {
      count = Math.max(count, 2) // Introduction至少2次
    }

    // 分配到段落内位置
    const distribution = distributeWithinSection(count, sectionWords, config)

    allocatedSections.push({
      name: section.sectionName,
      h2Title: section.h2Title,
      totalCount: count,
      wordTarget: sectionWords,
      distribution,
      instructions: generateSectionInstructions(section.sectionName, count, distribution, targetKeyword),
      example: generateSectionExample(section.sectionName, targetKeyword)
    })

    allocatedCount += count
  }

  // 如果分配总数与预算有差距,调整最长章节
  const diff = budget - allocatedCount
  if (diff !== 0 && allocatedSections.length > 0) {
    const longestSection = allocatedSections.reduce((max, s) =>
      s.wordTarget > max.wordTarget ? s : max
    )
    longestSection.totalCount += diff
    longestSection.distribution.middleParagraphs += diff
    allocatedCount += diff

    console.log(`[KeywordTaskAllocator] 调整最长章节"${longestSection.name}": ${diff > 0 ? '+' : ''}${diff}次`)
  }

  return {
    sections: allocatedSections,
    totalCount: allocatedCount
  }
}

/**
 * 在章节内分配关键词到具体位置
 *
 * @param count 该章节总次数
 * @param words 该章节字数
 * @param config 配置
 */
function distributeWithinSection(
  count: number,
  words: number,
  config: KeywordTaskAllocatorConfig
): { firstSentence: number; middleParagraphs: number; lastSentence: number } {

  if (count === 1) {
    return config.firstSentenceMandatory
      ? { firstSentence: 1, middleParagraphs: 0, lastSentence: 0 }
      : { firstSentence: 0, middleParagraphs: 1, lastSentence: 0 }
  }

  if (count === 2) {
    return { firstSentence: 1, middleParagraphs: 1, lastSentence: 0 }
  }

  if (count === 3) {
    return { firstSentence: 1, middleParagraphs: 1, lastSentence: 1 }
  }

  // count >= 4
  return {
    firstSentence: 1,
    middleParagraphs: count - 2,
    lastSentence: 1
  }
}

/**
 * 分配 Tier 4: FAQ
 */
function allocateTier4(
  totalTarget: number,
  config: KeywordTaskAllocatorConfig
): KeywordTaskAllocation['tier4_faq'] {

  const faqCount = Math.max(3, Math.round(totalTarget * config.tier4Weight))

  // 假设5-7个FAQ, 40%包含关键词
  const totalFaqItems = 6
  const minFaqWithKeyword = Math.max(3, Math.round(totalFaqItems * config.faqKeywordRatio))

  return {
    minFaqWithKeyword,
    totalCount: faqCount,
    distribution: `建议在Q1、Q3、Q5的问题或答案中各插入1次`
  }
}

/**
 * 生成章节执行指南
 */
function generateSectionInstructions(
  sectionName: string,
  totalCount: number,
  distribution: { firstSentence: number; middleParagraphs: number; lastSentence: number },
  targetKeyword: string
): string {
  const instructions: string[] = []

  if (distribution.firstSentence > 0) {
    instructions.push(`✅ 首句必须包含关键词 "${targetKeyword}"`)
  }

  if (distribution.middleParagraphs > 0) {
    instructions.push(`在中间段落自然融入 ${distribution.middleParagraphs} 次`)
    instructions.push(`⚠️ 不要连续2句都包含关键词`)
  }

  if (distribution.lastSentence > 0) {
    instructions.push(`结尾段落包含 ${distribution.lastSentence} 次`)
  }

  instructions.push(`💡 使用完整、有意义的句子,避免堆砌`)

  return instructions.join('\n  ')
}

/**
 * 生成章节示例
 */
function generateSectionExample(sectionName: string, targetKeyword: string): string {
  const examples: Record<string, string> = {
    'introduction': `"${targetKeyword} is a powerful tool that helps creators..."`,
    'how to use': `"To get started with ${targetKeyword}, follow these steps..."`,
    'best practices': `"When using ${targetKeyword}, remember to..."`,
    'conclusion': `"Now you're ready to master ${targetKeyword} and create..."`,
  }

  const key = Object.keys(examples).find(k => sectionName.toLowerCase().includes(k))
  return key ? examples[key] : `"This section covers ${targetKeyword} in detail..."`
}

/**
 * 格式化为Markdown任务清单
 *
 * 用于直接插入到提示词模板中
 */
export function formatKeywordTaskChecklist(
  tasks: KeywordTaskAllocation,
  targetKeyword: string
): string {

  let markdown = `#### 📊 目标数据
- **总字数**: ${tasks.wordCount}词
- **目标关键词**: "${targetKeyword}"
- **目标密度**: ${tasks.targetDensity}%
- **精确插入次数**: **${tasks.totalTarget}次** ⚠️

---

#### ✅ Tier 1: Meta信息 (固定位置,必须执行)

- [ ] **Meta标题**: 插入 **${tasks.tier1_meta.metaTitle.count}次**
  - 📍 位置要求: ${tasks.tier1_meta.metaTitle.position}
  - 💡 示例: ${tasks.tier1_meta.metaTitle.example}

- [ ] **Meta描述**: 插入 **${tasks.tier1_meta.metaDescription.count}次**
  - 📍 位置要求: ${tasks.tier1_meta.metaDescription.position}
  - 💡 示例: ${tasks.tier1_meta.metaDescription.example}

**完成进度: [0/2]**

---

#### ✅ Tier 2: 结构性标题 (H2标题,必须执行)

`

  tasks.tier2_structure.h2Titles.forEach((h2, index) => {
    markdown += `- [ ] **H2标题 ${h2.order}**: "${h2.title}"
  - 插入 **${h2.count}次** (标题本身必须包含关键词)

`
  })

  markdown += `**完成进度: [0/${tasks.tier2_structure.totalCount}]**

---

#### ✅ Tier 3: 正文段落 (按章节分配,核心任务)

`

  tasks.tier3_content.sections.forEach((section, index) => {
    markdown += `**${index + 1}. ${section.name}章节**: 总共插入 **${section.totalCount}次**

详细分配:
- 首句位置: ${section.distribution.firstSentence}次 ${section.distribution.firstSentence > 0 ? '⚠️ 必须' : ''}
- 中间段落: ${section.distribution.middleParagraphs}次 (自然融入)
- 尾句位置: ${section.distribution.lastSentence}次

📝 执行指南:
  ${section.instructions}

💡 示例: ${section.example}

---

`
  })

  markdown += `**完成进度: [0/${tasks.tier3_content.sections.length}]**

---

#### ✅ Tier 4: FAQ问答 (补充覆盖)

- [ ] 至少 **${tasks.tier4_faq.minFaqWithKeyword}个FAQ** 的问题或答案中包含关键词
- [ ] FAQ中关键词总出现次数: **${tasks.tier4_faq.totalCount}次**

**分配建议**: ${tasks.tier4_faq.distribution}

**完成进度: [0/${tasks.tier4_faq.minFaqWithKeyword}]**

---

#### 🔍 自我验证 (返回前必查!)

生成完成后,请逐项检查:

1. **总次数验证**:
   - [ ] 手动数一遍关键词"${targetKeyword}"出现次数
   - [ ] 期望: **${tasks.totalTarget}次** (误差±2次可接受)
   - [ ] 如果 < ${tasks.totalTarget - 3}: ❌ 不合格,必须补充关键词
   - [ ] 如果 > ${tasks.totalTarget + 3}: ❌ 不合格,必须删减或用语义变体替换

2. **分布验证**:
   - [ ] Meta标题包含关键词? ✅/❌
   - [ ] 至少${tasks.tier2_structure.totalCount}个H2包含关键词? ✅/❌
   - [ ] 各章节首句包含关键词? (检查${tasks.tier3_content.sections.filter(s => s.distribution.firstSentence > 0).length}个章节) ✅/❌
   - [ ] FAQ至少${tasks.tier4_faq.minFaqWithKeyword}个包含关键词? ✅/❌

3. **自然度验证**:
   - [ ] 没有连续两句都包含同一关键词? ✅/❌
   - [ ] 没有某一段集中出现3次以上? ✅/❌
   - [ ] 所有关键词都在完整、有意义的句子中? ✅/❌

⚠️ **如果以上任何一项为 ❌, 立即修改内容, 不要返回不合格的结果!**
`

  return markdown
}

/**
 * 生成简化版任务摘要 (用于日志或UI显示)
 */
export function generateTaskSummary(tasks: KeywordTaskAllocation): string {
  return `关键词任务分配:
- 总目标: ${tasks.totalTarget}次 (密度${tasks.targetDensity}%)
- Tier1 Meta: ${tasks.tier1_meta.metaTitle.count + tasks.tier1_meta.metaDescription.count}次
- Tier2 H2标题: ${tasks.tier2_structure.totalCount}次
- Tier3 正文: ${tasks.tier3_content.totalCount}次 (${tasks.tier3_content.sections.length}个章节)
- Tier4 FAQ: ${tasks.tier4_faq.totalCount}次
`
}
