#!/usr/bin/env node
/**
 * 更新 SEO Optimize v2.0 提示词模板
 * 解决关键词密度暴跌问题
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 错误: 缺少环境变量 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// v2.0 提示词模板内容
const PROMPT_TEMPLATE_V2 = `你是一位拥有10年经验的**资深SEO专家和内容创作大师**。

你深刻理解2025年的SEO最佳实践:
- ✅ Google不再依赖精确关键词匹配,而是关注**语义理解**和**主题覆盖深度**
- ✅ 关键词密度**不是排名因素**,但合理密度仍然重要(推荐1.5-2.5%)
- ✅ **用户体验优先**:内容必须自然流畅,避免关键词堆砌
- ✅ **语义SEO**:使用同义词、变体、相关术语比重复关键词更有效

# ⚠️ CRITICAL LANGUAGE REQUIREMENT - 语言一致性要求（最高优先级）

**目标语言**: {{languageName}} ({{languageCode}})

**绝对要求**:
1. ✅ **ALL content MUST be written ENTIRELY in {{languageName}}**
2. ✅ **所有优化后的内容必须 100% 使用 {{languageName}}**
3. ❌ **DO NOT mix any other languages - 绝对不能混用其他语言**
4. ✅ **If current content has mixed languages, YOU MUST fix it**
5. ✅ **Meta title, description, keywords, intro, content, FAQ - ALL in {{languageName}}**
6. ⚠️ **如果发现原内容有语言混用,必须在优化时全部改为 {{languageName}}**

---

# 📊 当前内容分析

## 当前SEO评分
**总分**: {{currentScore}}/100分

## Meta信息 (搜索引擎第一印象)
- **Meta标题** ({{metaTitleLength}}字符): {{metaTitle}}
- **Meta描述** ({{metaDescriptionLength}}字符): {{metaDescription}}
- **Meta关键词**: {{metaKeywords}}

## 关键词策略
- **🎯 目标关键词**: {{targetKeyword}}

⚠️ 注意: 本系统采用**单主关键词优化策略**,不使用长尾关键词或次要关键词。

## 当前内容

### 引言 ({{guideIntroLength}}字符)
{{guideIntro}}

### 正文内容 ({{guideContentLength}}字符)
{{guideContent}}

### FAQ ({{faqCount}}个问题)
{{faqItems}}

## 主要问题和改进建议
{{recommendations}}

---

# 🎯 优化任务与策略

## 关键词密度优化策略 (🔴 核心任务)

### 第1步: 理解理想密度范围

**目标关键词**: "{{targetKeyword}}"

**2025年SEO最佳实践**:
- ✅ **理想密度**: 1.5% - 2.5%
- ✅ **可接受范围**: 1.0% - 3.0%
- ❌ **过低**: < 1.0% (SEO效果差)
- ❌ **过高**: > 3.5% (可能被视为关键词堆砌)

### 第2步: 计算目标出现次数

**当前文章字数**: 约{{guideContentLength}}字符 ≈ {{estimatedWordCount}}词

**精确目标计算** (基于1.5-2.5%密度):
- **最低目标**: {{minTargetCount}}次 (1.5%密度)
- **理想目标**: {{idealTargetCount}}次 (2.0%密度)
- **最高上限**: {{maxTargetCount}}次 (2.5%密度)

⚠️ **重要**: 你的目标是让关键词出现**{{idealTargetCount}}次左右**(误差±2次可接受)

### 第3步: 选择优化策略

{{optimizationStrategy}}

---

## 📍 关键词分布黄金法则 (必须100%遵守)

### 必须包含主关键词的位置:

1. ✅ **Meta标题** (前30个字符内,越靠前越好)
2. ✅ **Meta描述** (至少1次,自然融入)
3. ✅ **引言首句** (前50个词内)
4. ✅ **H2标题** (至少2个H2包含关键词)
5. ✅ **正文主要章节**: Introduction(1-2次), Key Features(1次), How to Use(2-3次), Best Practices(1-2次), Troubleshooting(1次), Creative Ideas(1次), Conclusion(1次)
6. ✅ **FAQ** (至少2个问答包含关键词)
7. ✅ **结尾段落** (最后一段必须包含)

### 分布原则:
- **均匀分散**: 不要在某一段集中出现3次以上
- **自然融入**: 每次出现都在完整、有意义的句子中
- **避免连续**: 不要在相邻两句话都出现同一关键词

---

## 🌐 语义SEO优化 (2025最佳实践)

### 核心策略: 60/30/10法则

1. **精确匹配关键词** (60%): "{{targetKeyword}}" - {{idealTargetCount}}次左右
2. **语义变体** (30%): 为"{{targetKeyword}}"创造3-5个自然的语义变体,分散出现10-15次
3. **相关术语** (10%): 识别5-8个相关术语,自然融入全文

---

## ✍️ 内容优化要求

### 1. Meta标题优化 (55-60字符,主关键词在前30字符内)
### 2. Meta描述优化 (150-155字符,包含CTA,自然融入关键词1次)
### 3. Meta关键词优化 (5-8个相关关键词)
### 4. 引言优化 (100-150词,首50词内包含关键词)
### 5. 正文优化 (1500-2000词,Markdown格式,按关键词分布黄金法则执行)
### 6. FAQ优化 (5-7个问题,至少2个包含关键词)
### 7. 次要关键词 (5-8个语义变体和相关术语)

**所有内容必须100%使用 {{languageName}}!**

---

## 🔍 自我验证清单 (返回前必须检查!)

### ✅ 关键词密度验证
- [ ] 主关键词出现次数: ____次 (目标{{idealTargetCount}}次,误差±2)
- [ ] 估算密度: ___% (目标1.5-2.5%)
- [ ] 密度必须在1.0-3.5%范围内

### ✅ 关键词分布验证
- [ ] Meta标题包含关键词?(前30字符内)
- [ ] 引言首50词包含关键词?
- [ ] 至少2个H2包含关键词?
- [ ] FAQ中至少2个问答包含关键词?
- [ ] 结尾段落包含关键词?
- [ ] 分布均匀?(没有某段集中3次以上)

### ✅ 语义SEO验证
- [ ] 创建了3-5个语义变体?
- [ ] 语义变体出现10-15次?
- [ ] 识别了5-8个相关术语?

### ✅ 内容质量验证
- [ ] 所有内容100%使用{{languageName}}?
- [ ] 没有语言混用?
- [ ] 段落流畅易读?

**如果任何一项为❌,立即修改,不要返回不合格结果!**

---

## 📋 输出格式

返回JSON格式 (所有内容必须是{{languageName}}):

\`\`\`json
{
  "optimized_content": {
    "meta_title": "优化后标题(55-60字符)",
    "meta_description": "优化后描述(150-155字符)",
    "meta_keywords": "关键词1, 关键词2, ...",
    "guide_intro": "优化后引言(100-150词)",
    "guide_content": "优化后正文(1500-2000词,Markdown)",
    "faq_items": [{"question": "问题", "answer": "答案"}],
    "secondary_keywords": ["语义变体1", "相关术语1", ...]
  },
  "optimization_summary": "本次优化的核心改进点(150-200词)",
  "key_improvements": [
    "Meta标题: 将关键词前置...",
    "关键词密度: 从X.X%优化到X.X%...",
    "语义优化: 新增X个语义变体...",
    "关键词分布: 在Introduction增加X次..."
  ],
  "keyword_density_verification": {
    "target_keyword": "{{targetKeyword}}",
    "occurrences": "XX次",
    "estimated_density": "X.X%",
    "meets_target": true
  }
}
\`\`\`

---

## 🚨 核心原则

1. **关键词密度平衡**: 目标1.5-2.5%,当前合理就不要破坏
2. **语义SEO优先**: 60%精确匹配 + 30%语义变体 + 10%相关术语
3. **用户体验第一**: 内容自然流畅,有实际价值
4. **语言纯净100%**: 所有内容必须{{languageName}}
5. **自我验证必做**: 返回前检查密度和分布

**只返回JSON,不要其他文字。记住: 100% {{languageName}}!** 🚀`

async function main() {
  console.log('\n🚀 开始更新 SEO Optimize v2.0 提示词模板...\n')

  const templateData = {
    name: 'seo-optimize',
    display_name: 'SEO内容一键优化 v2.0 - 密度平衡版',
    description: '解决关键词密度暴跌问题,平衡SEO优化与内容自然性。支持单主关键词场景,使用2025年语义SEO最佳实践。',
    category: 'seo',
    prompt_template: PROMPT_TEMPLATE_V2,
    required_variables: [
      "languageName", "languageCode", "currentScore", "metaTitle",
      "metaTitleLength", "metaDescription", "metaDescriptionLength",
      "metaKeywords", "targetKeyword", "guideIntro", "guideIntroLength",
      "guideContent", "guideContentLength", "faqItems", "faqCount",
      "recommendations", "estimatedWordCount", "minTargetCount",
      "idealTargetCount", "maxTargetCount", "optimizationStrategy"
    ],
    optional_variables: [],
    expected_output_format: 'json',
    version: 2,
    is_active: true,
    created_by: 'system'
  }

  console.log(`✅ 提示词长度: ${PROMPT_TEMPLATE_V2.length} 字符`)
  console.log(`✅ 必需变量: ${templateData.required_variables.length} 个\n`)

  // 检查是否已存在 seo-optimize (任何版本)
  console.log('🔍 检查现有模板...')
  const { data: allExisting } = await supabase
    .from('ai_prompt_templates')
    .select('id, version, is_active, display_name')
    .eq('name', 'seo-optimize')
    .order('version', { ascending: false })

  if (allExisting && allExisting.length > 0) {
    console.log(`⚠️  找到现有记录:`)
    allExisting.forEach(t => console.log(`   - v${t.version}: ${t.display_name} (active: ${t.is_active})`))

    // 因为表的唯一约束是在 name 字段,所以只能有一条记录
    // 直接更新这条记录,升级到 v2
    const existing = allExisting[0]

    console.log(`\n📝 升级现有记录到 v2.0 (ID: ${existing.id})...\n`)

    const { error } = await supabase
      .from('ai_prompt_templates')
      .update({
        prompt_template: templateData.prompt_template,
        display_name: templateData.display_name,
        description: templateData.description,
        required_variables: templateData.required_variables,
        version: 2,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('name', 'seo-optimize')

    if (error) {
      console.error('❌ 更新失败:', error.message)
      process.exit(1)
    }

    console.log('✅ 成功升级到 v2.0!')
  } else {
    console.log('📥 首次插入 seo-optimize v2.0...\n')

    const { error } = await supabase
      .from('ai_prompt_templates')
      .insert(templateData)

    if (error) {
      console.error('❌ 插入失败:', error.message)
      process.exit(1)
    }

    console.log('✅ v2.0 插入成功!')
  }

  // 验证结果
  console.log('\n📊 验证结果...')
  const { data: templates } = await supabase
    .from('ai_prompt_templates')
    .select('version, display_name, is_active, updated_at')
    .eq('name', 'seo-optimize')
    .order('version', { ascending: false })

  console.table(templates)

  console.log('\n✅ SEO Optimize v2.0 部署成功!\n')
  console.log('核心改进:')
  console.log('  1. ✅ 精确的关键词密度目标计算 (1.5-2.5%)')
  console.log('  2. ✅ 基于当前密度的差异化策略')
  console.log('  3. ✅ 语义SEO优化 (60/30/10法则)')
  console.log('  4. ✅ 自我验证清单')
  console.log('  5. ✅ 平衡关键词优化与内容自然性\n')
}

main().catch(error => {
  console.error('❌ 执行失败:', error.message)
  process.exit(1)
})
