# 验证 SEO 提示词更新成功

## 🔍 验证步骤

### 1. 检查提示词是否保存成功

在 **Supabase Dashboard → SQL Editor** 中执行：

```sql
SELECT
  name,
  display_name,
  category,
  version,
  is_active,
  LENGTH(prompt_template) as template_length,
  created_at,
  updated_at
FROM ai_prompt_templates
WHERE name = 'seo-score'
ORDER BY version DESC
LIMIT 3;
```

**预期结果**：
- `name`: `seo-score`
- `display_name`: `SEO深度评分 v2.0 (算法+AI+验证)`
- `category`: `seo`
- `version`: 应该是最新版本号（比之前的+1）
- `is_active`: `true`
- `template_length`: 约 **15,000-20,000** 字符
- `updated_at`: 刚才的执行时间

### 2. 检查提示词内容预览

```sql
SELECT
  LEFT(prompt_template, 200) as preview,
  RIGHT(prompt_template, 200) as ending
FROM ai_prompt_templates
WHERE name = 'seo-score' AND is_active = true
LIMIT 1;
```

**预期开头**：
```
# SEO内容深度分析系统 v2.0

你是拥有15年经验的SEO专家，精通Google算法和E-E-A-T标准。

## 📊 客观数据（算法已计算）
...
```

**预期结尾**：
```
...
请只返回纯JSON，不要添加任何说明文字或Markdown代码块标记。
```

### 3. 检查关键变量是否存在

```sql
SELECT
  name,
  (prompt_template LIKE '%{{metaTitle}}%') as has_meta_title,
  (prompt_template LIKE '%{{totalWords}}%') as has_total_words,
  (prompt_template LIKE '%{{fleschScore}}%') as has_flesch_score,
  (prompt_template LIKE '%{{metaBaseScore}}%') as has_meta_base_score,
  (prompt_template LIKE '%{{contentBaseScore}}%') as has_content_base_score,
  (prompt_template LIKE '%{{keywordBaseScore}}%') as has_keyword_base_score
FROM ai_prompt_templates
WHERE name = 'seo-score' AND is_active = true;
```

**预期结果**：所有变量检查都应该是 `true`

### 4. 统计变量数量

```sql
SELECT
  name,
  LENGTH(prompt_template) - LENGTH(REPLACE(prompt_template, '{{', '')) as variable_count,
  (SELECT COUNT(*) FROM regexp_matches(prompt_template, '\{\{[^}]+\}\}', 'g')) as unique_variables
FROM ai_prompt_templates
WHERE name = 'seo-score' AND is_active = true;
```

**预期结果**：
- `variable_count`: 应该 > 70 （40+个变量，每个用2次 `{{`）
- `unique_variables`: 应该约 35-45 个

## ✅ 成功标志

如果看到以下结果，说明更新成功：

1. ✅ 提示词长度 15,000-20,000 字符
2. ✅ `display_name` 包含 "v2.0"
3. ✅ 所有关键变量都存在
4. ✅ 提示词开头是 "# SEO内容深度分析系统 v2.0"
5. ✅ `is_active` = true

## 🧪 功能测试

### 测试提示词构建（前端代码）

在浏览器控制台或代码中测试：

```typescript
import { promptTemplateService } from '@/services/promptTemplateService'

// 测试加载提示词
const prompt = await promptTemplateService.buildPrompt('seo-score', {
  metaTitle: "Test Title",
  titleLength: 60,
  targetKeyword: "test keyword",
  titleKeywordPosition: 5,
  metaDescription: "Test description",
  descLength: 155,
  descHasKeyword: "是",
  descHasCTA: "是 (discover)",
  totalWords: 1500,
  h1Count: 1,
  h2Count: 8,
  h3Count: 12,
  paragraphCount: 24,
  avgParagraphLength: 63,
  maxParagraphLength: 142,
  listCount: 5,
  codeBlockCount: 0,
  quoteBlockCount: 1,
  keywordCount: 18,
  keywordDensity: 1.8,
  keywordInTitle: "标题✓",
  keywordInFirstParagraph: "首段✓",
  keywordInLastParagraph: "尾段✗",
  keywordInH2Count: 3,
  keywordInH3Count: 2,
  fleschScore: 72.5,
  avgSentenceLength: 15.2,
  avgWordLength: 5.3,
  complexWordCount: 142,
  complexWordRatio: 18.5,
  faqCount: 5,
  faqAvgQuestionLength: 45,
  faqAvgAnswerLength: 128,
  internalLinkCount: 3,
  externalLinkCount: 2,
  metaBaseScore: 17,
  contentBaseScore: 16,
  keywordBaseScore: 18,
  readabilityBaseScore: 15,
  uxBaseScore: 9,
  languageName: "English",
  guideIntro: "ASMR videos have become...",
  guideContent: "## What Are ASMR Videos...",
  faqItems: "Q1: ...\nA1: ..."
})

console.log('✅ 提示词长度:', prompt.length)
console.log('✅ 包含基础分:', prompt.includes('当前基础分'))
console.log('✅ 包含变量替换测试:', prompt.includes('Test Title'))
```

**预期输出**：
- 提示词长度: 约 15,000-20,000 字符
- 包含基础分: true
- 包含变量替换测试: true

### 测试完整评分流程

```typescript
import { scoreSEOContent } from '@/services/seoScoringEngine'

const testContent = {
  meta_title: "Complete Guide to ASMR Videos",
  meta_description: "Learn how to create amazing ASMR videos...",
  guide_intro: "ASMR videos are...",
  guide_content: "## What is ASMR...",
  faq_items: [
    { question: "What is ASMR?", answer: "ASMR stands for..." }
  ],
  target_keyword: "ASMR videos",
  language: "en"
}

// 测试快速评分（不用AI）
const quickResult = await quickScoreSEO(testContent)
console.log('快速评分:', quickResult.total_score)

// 测试完整评分（使用AI）
const fullResult = await scoreSEOContent(testContent, {
  aiModel: 'claude',
  debug: true
})
console.log('完整评分:', fullResult.total_score)
console.log('置信度:', fullResult.confidence.overall)
```

## 📊 对比新旧提示词

### 长度对比

```sql
SELECT
  version,
  LENGTH(prompt_template) as length,
  LENGTH(prompt_template) - LAG(LENGTH(prompt_template)) OVER (ORDER BY version) as length_diff
FROM ai_prompt_templates
WHERE name = 'seo-score'
ORDER BY version DESC
LIMIT 5;
```

**预期**：v2.0 应该比旧版本长 10,000+ 字符

### 关键差异

| 特性 | 旧版本 | v2.0 新版本 |
|------|--------|------------|
| 长度 | ~5,000字符 | ~18,000字符 |
| 变量数量 | ~15个 | ~40个 |
| 评分维度 | 模糊 | 5维度明确 |
| 基础分数 | 无 | 每维度都有 |
| 冲突检测 | 无 | 有 |
| 置信度 | 无 | 0-100% |

## 🎯 使用新提示词

### 在代码中调用

旧方式（已自动转发到新系统）：
```typescript
import { calculateSEOScore } from '@/services/seoScoreCalculator'

const result = await calculateSEOScore(data)
// 内部会自动使用新提示词
```

新方式（推荐）：
```typescript
import { scoreSEOContent } from '@/services/seoScoringEngine'

const result = await scoreSEOContent(content, {
  aiModel: 'claude',
  skipAI: false  // 使用完整的AI+算法+验证
})
```

### Fallback 机制

如果数据库加载失败，系统会：
1. 尝试从数据库加载提示词
2. 如果失败，使用代码中的简化版本（`seoPrompts.ts`）
3. 记录警告日志

## 🐛 故障排除

### 问题1：提示词未更新

**检查**：
```sql
SELECT name, version, is_active, updated_at
FROM ai_prompt_templates
WHERE name = 'seo-score'
ORDER BY version DESC;
```

**解决**：确保 `is_active = true` 只有一条最新记录

### 问题2：变量未替换

**检查**：
```typescript
const prompt = await promptTemplateService.buildPrompt('seo-score', { ... })
console.log(prompt.includes('{{'))  // 应该是 false
```

**解决**：确保传入了所有需要的变量

### 问题3：AI返回错误

**检查**：
- 提示词是否正确（不包含 `{{` 占位符）
- JSON 格式是否正确
- 是否超出 AI token 限制

## 📝 回滚方法

如果需要回滚到旧版本：

```sql
-- 查看历史版本
SELECT version, display_name, created_at
FROM ai_prompt_templates
WHERE name = 'seo-score'
ORDER BY version DESC;

-- 停用当前版本
UPDATE ai_prompt_templates
SET is_active = false
WHERE name = 'seo-score' AND version = <最新版本号>;

-- 启用旧版本
UPDATE ai_prompt_templates
SET is_active = true
WHERE name = 'seo-score' AND version = <旧版本号>;
```

---

**验证完成清单**：
- [ ] 提示词长度正确（15,000-20,000字符）
- [ ] 版本号已更新
- [ ] 所有关键变量存在
- [ ] 测试代码可以成功加载提示词
- [ ] 变量正确替换（不含 `{{`）
- [ ] 完整评分流程正常工作

**状态**: 等待验证结果
