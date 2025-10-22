#!/usr/bin/env node
/**
 * 更新 SEO Optimize v2.1 提示词模板
 * 核心改进: 位置清单法 + 具体任务 (可落地实施)
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '../.env') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 错误: 缺少环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// v2.1 提示词模板 - 位置清单法
const PROMPT_TEMPLATE_V21 = `你是一位拥有10年经验的**资深SEO专家和内容创作大师**。

你深刻理解2025年的SEO最佳实践:
- ✅ Google关注**语义理解**和**主题覆盖深度**
- ✅ 关键词密度推荐1.5-2.5%
- ✅ **用户体验优先**,内容自然流畅
- ✅ **语义SEO**:使用同义词、变体、相关术语

# ⚠️ CRITICAL LANGUAGE REQUIREMENT

**目标语言**: {{languageName}} ({{languageCode}})

**绝对要求**: ALL content MUST be 100% {{languageName}}, NO mixed languages!

---

# 📊 当前内容分析

## 当前SEO评分: {{currentScore}}/100分

## Meta信息
- Meta标题 ({{metaTitleLength}}字符): {{metaTitle}}
- Meta描述 ({{metaDescriptionLength}}字符): {{metaDescription}}

## 关键词
- **🎯 目标关键词**: {{targetKeyword}}
- **当前出现**: {{currentKeywordCount}}次
- **当前密度**: {{currentDensityPercent}}%

## 当前内容
### 引言 ({{guideIntroLength}}字符)
{{guideIntro}}

### 正文 ({{guideContentLength}}字符)
{{guideContent}}

### FAQ ({{faqCount}}个)
{{faqItems}}

## AI改进建议
{{recommendations}}

---

# 🎯 关键词插入任务清单 (必须逐项完成!)

⚠️ **这不是建议,是必须执行的任务!**

请在优化内容时,按照以下清单**逐项插入**关键词 "{{targetKeyword}}":

{{taskChecklist}}

## ⚠️ 重要提醒

1. **这是具体任务,不是密度目标**
   - ❌ 不要想"我要达到2%密度" (太抽象)
   - ✅ 要想"我要在Meta标题插入1次,在How to Use插入5次..." (具体)

2. **完成清单=自动达标**
   - 完成所有任务后,密度将自动达到1.5-2.5%
   - 不需要自己计算密度

3. **每个位置都很重要**
   - Tier 1(Meta)是搜索引擎第一印象
   - Tier 2(H2标题)是内容结构支柱
   - Tier 3(正文)是关键词主要来源
   - Tier 4(FAQ)是补充覆盖

4. **自然融入技巧**
   - 在完整句子中使用关键词
   - 不要在同一句重复
   - 结合上下文自然表达

---

# 🌐 语义SEO优化 (保底策略)

除了精确匹配的 "{{targetKeyword}}", 还要使用**语义变体**:

## 60/40法则
- **60% 精确匹配**: 按清单插入 "{{targetKeyword}}"
- **40% 语义变体**: 使用同义词、改写、相关术语

## 为什么需要语义变体?
1. **避免过度重复** - 提升可读性
2. **符合2025年SEO** - Google理解语义关系
3. **保底策略** - 如果精确匹配不够,变体补充密度

## 如何创造语义变体?
- 同义词: "{{targetKeyword}}" → "this technique" / "this method"
- 改写: 用不同方式表达相同概念
- 相关术语: 主题相关的专业词汇

**建议**: 创造3-5个语义变体,分散使用10-15次

---

# ✍️ 内容优化要求

### 1. Meta标题 (55-60字符,{{languageName}})
- 关键词在前30字符内
- 吸引点击,传递价值

### 2. Meta描述 (150-155字符,{{languageName}})
- 包含CTA
- 自然融入关键词

### 3. Meta关键词 (5-8个,{{languageName}})
- 主关键词 + 语义变体

### 4. 引言 (100-150词,{{languageName}})
- 首句吸引注意力
- 按清单插入关键词

### 5. 正文 (1500-2000词,Markdown,{{languageName}})
结构:
- ## Introduction
- ## Key Features
- ## How to Use
- ## Best Practices
- ## Troubleshooting
- ## Creative Ideas
- ## Conclusion

**按清单在每个章节插入关键词!**

### 6. FAQ (5-7个,{{languageName}})
- 按清单至少N个问答包含关键词
- 其他问答可使用语义变体

---

# 📋 输出格式

返回JSON格式 (所有内容{{languageName}}):

\`\`\`json
{
  "optimized_content": {
    "meta_title": "优化后标题",
    "meta_description": "优化后描述",
    "meta_keywords": "关键词1, 关键词2, ...",
    "guide_intro": "优化后引言",
    "guide_content": "优化后正文(Markdown)",
    "faq_items": [{"question": "问题", "answer": "答案"}],
    "secondary_keywords": ["语义变体1", "相关术语1", ...]
  },
  "optimization_summary": "本次优化核心改进(150词)",
  "key_improvements": [
    "Meta标题: 关键词前置到前X字符",
    "关键词分布: 按清单在X个位置插入",
    "语义优化: 新增X个变体",
    "FAQ: 在第X,X,X个问答插入关键词"
  ],
  "keyword_density_verification": {
    "target_keyword": "{{targetKeyword}}",
    "task_completion": "已完成清单中X/Y项任务"
  }
}
\`\`\`

---

# 🚨 最重要的原则

1. **按清单执行,不要自己判断**
   - 清单说插入3次,就插入3次
   - 不要想"这样会不会太多"
   - 相信清单的设计(已基于最佳实践)

2. **任务优先级**
   - Tier 1 > Tier 2 > Tier 3 > Tier 4
   - 如果时间/空间有限,优先完成前面的Tier

3. **语义变体是加分项**
   - 精确匹配是基础(60%)
   - 语义变体是提升(40%)

4. **100% {{languageName}}**
   - 所有内容必须纯净的{{languageName}}
   - 发现语言混用必须修复

**只返回JSON,不要其他文字。现在开始按清单优化!** 🚀`

async function main() {
  console.log('\n🚀 开始更新 SEO Optimize v2.1 提示词模板...\n')

  const templateData = {
    name: 'seo-optimize',
    display_name: 'SEO内容一键优化 v2.1 - 位置清单法',
    description: '使用位置清单法解决密度问题,AI执行具体任务而非抽象目标。基于LLM实际能力设计,可落地实施。',
    category: 'seo',
    prompt_template: PROMPT_TEMPLATE_V21,
    required_variables: [
      "languageName", "languageCode", "currentScore",
      "metaTitle", "metaTitleLength", "metaDescription", "metaDescriptionLength",
      "targetKeyword", "guideIntro", "guideIntroLength",
      "guideContent", "guideContentLength", "faqItems", "faqCount",
      "recommendations", "taskChecklist", "taskTotalCount",
      "currentKeywordCount", "currentDensityPercent"
    ],
    optional_variables: [],
    expected_output_format: 'json',
    version: 3,
    is_active: true,
    created_by: 'system'
  }

  console.log(`✅ 提示词长度: ${PROMPT_TEMPLATE_V21.length} 字符`)
  console.log(`✅ 必需变量: ${templateData.required_variables.length} 个\n`)

  // 更新数据库
  console.log('📝 更新数据库中的 seo-optimize 模板...\n')

  const { error } = await supabase
    .from('ai_prompt_templates')
    .update({
      prompt_template: templateData.prompt_template,
      display_name: templateData.display_name,
      description: templateData.description,
      required_variables: templateData.required_variables,
      version: 3,
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('name', 'seo-optimize')

  if (error) {
    console.error('❌ 更新失败:', error.message)
    process.exit(1)
  }

  console.log('✅ 成功升级到 v2.1!')

  // 验证
  const { data: templates } = await supabase
    .from('ai_prompt_templates')
    .select('version, display_name, is_active, updated_at')
    .eq('name', 'seo-optimize')
    .order('version', { ascending: false })

  console.log('\n📊 当前模板状态:')
  console.table(templates)

  console.log('\n✅ SEO Optimize v2.1 部署成功!\n')
  console.log('核心改进:')
  console.log('  1. ✅ 位置清单法 - AI执行具体任务')
  console.log('  2. ✅ 动态生成清单 - 基于文章长度')
  console.log('  3. ✅ 语义变体保底 - 60/40法则')
  console.log('  4. ✅ 可落地实施 - 基于LLM实际能力\n')
  console.log('预期效果:')
  console.log('  - 关键词密度稳定在 1.5-2.5%')
  console.log('  - 成功率从30%提升到70%+')
  console.log('  - 不再出现0.6%的低密度情况\n')
}

main().catch(error => {
  console.error('❌ 执行失败:', error.message)
  process.exit(1)
})
