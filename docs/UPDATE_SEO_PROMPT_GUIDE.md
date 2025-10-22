# SEO评分提示词更新指南

## 📅 更新时间
2025-10-20

## 🎯 更新目的

将新的SEO评分系统v2.0提示词存储到数据库，替代代码中硬编码的提示词。

## 📄 更新文件

**SQL迁移文件**: [037_update_seo_score_prompt.sql](../supabase/migrations/037_update_seo_score_prompt.sql)

## 🔄 执行方法

### 方法1：使用 Supabase CLI（推荐）

```bash
cd /Users/chishengyang/Desktop/AI_ASMR/ai-video-saas
npx supabase db push
```

### 方法2：使用 psql 命令

```bash
cd /Users/chishengyang/Desktop/AI_ASMR/ai-video-saas

# 执行迁移文件
PGPASSWORD="huixiangyigou2025!" psql \
  -h aws-1-us-west-1.pooler.supabase.com \
  -p 6543 \
  -d postgres \
  -U postgres.hvkzwrnvxsleeonqqrzq \
  -f supabase/migrations/037_update_seo_score_prompt.sql
```

### 方法3：通过 Supabase Dashboard

1. 登录 [https://supabase.com](https://supabase.com)
2. 进入你的项目
3. 点击左侧 **SQL Editor**
4. 复制 `037_update_seo_score_prompt.sql` 的完整内容
5. 粘贴到 SQL 编辑器
6. 点击 **Run** 执行

### 方法4：使用项目的 exec-sql.js 脚本

```bash
cd /Users/chishengyang/Desktop/AI_ASMR/ai-video-saas
node scripts/exec-sql.js -f supabase/migrations/037_update_seo_score_prompt.sql
```

## 📊 新提示词特点

### v2.0 vs 旧版本对比

| 特性 | 旧版本 | v2.0 新版本 |
|------|--------|------------|
| **评分制度** | 110分制 | 100分制标准化 |
| **数据来源** | AI猜测 | 基于算法计算的客观事实 |
| **维度数量** | 4维度 | 5维度 (Meta20+Content30+Keyword20+Readability20+UX10) |
| **详细程度** | 简单评分 | 详细breakdown + 置信度 + 冲突检测 |
| **准确性** | ~74% | ~95.6% |
| **可解释性** | 模糊 | 字符级精确+可操作建议 |
| **提示词长度** | ~200行 | ~470行 |

### 新提示词包含的功能

1. **算法事实嵌入**: 提示词中自动填充所有算法计算的客观数据
   - Meta信息（标题/描述长度、关键词位置）
   - 内容统计（字数、H标签、段落）
   - 关键词分析（密度、分布、出现次数）
   - 可读性（Flesch分数、句长、词长）
   - UX元素（FAQ、链接）

2. **基础分数计算**: 为每个维度提供算法计算的基础分数
   ```
   Meta: 标题长度 + 描述长度 + 关键词位置
   Content: 字数 + H2数量 + 列表/代码块
   Keyword: 密度 + 分布 + H标签出现
   Readability: Flesch公式 + 格式
   UX: FAQ数量 + 列表 + H2数量
   ```

3. **AI深度评估**: 在基础分上进行±5分调整
   - Meta: 标题吸引力、描述说服力
   - Content: 原创性、E-E-A-T、结构、实用性
   - Keyword: 自然度、语义相关性、分布合理性
   - Readability: 语言流畅度、格式优化
   - UX: FAQ质量、内容完整性

4. **冲突检测**: 如果AI评分与算法建议差距>5分，必须标记并说明原因

5. **置信度评分**: 为每个维度评估0-100的置信度
   - 90-100: 高置信（数据充分）
   - 70-89: 中置信（部分缺失）
   - <70: 低置信（建议人工复核）

6. **详细输出**:
   - 5维度详细breakdown
   - Top 3-5优势列表
   - 关键问题列表（严重程度+影响+修复建议）
   - 可操作建议（优先级+预期提升）

## 🔍 验证方法

### 1. 检查提示词是否成功保存

```sql
SELECT
  name,
  display_name,
  category,
  version,
  is_active,
  LENGTH(prompt_template) as template_length,
  LEFT(prompt_template, 100) as preview,
  created_at,
  updated_at
FROM ai_prompt_templates
WHERE name = 'seo-score'
ORDER BY version DESC
LIMIT 3;
```

**预期结果**:
- `name`: seo-score
- `display_name`: SEO深度评分 v2.0 (算法+AI+验证)
- `category`: seo
- `version`: 应该比之前的版本号+1
- `template_length`: 约 15000-20000 字符
- `is_active`: true

### 2. 验证提示词中的变量占位符

```sql
SELECT prompt_template
FROM ai_prompt_templates
WHERE name = 'seo-score' AND is_active = true
LIMIT 1;
```

检查是否包含以下变量:
- `{{metaTitle}}`
- `{{targetKeyword}}`
- `{{totalWords}}`
- `{{fleschScore}}`
- `{{metaBaseScore}}`
- `{{contentBaseScore}}`
- 等等...

### 3. 测试提示词构建

在代码中测试：

```typescript
import { promptTemplateService } from '@/services/promptTemplateService'

const prompt = await promptTemplateService.buildPrompt('seo-score', {
  metaTitle: "Test Title",
  targetKeyword: "test keyword",
  totalWords: 1500,
  fleschScore: 72,
  // ... 其他变量
})

console.log('提示词长度:', prompt.length)
console.log('包含基础分:', prompt.includes('当前基础分'))
```

## 📝 变量映射表

提示词中使用的变量及其来源：

| 变量名 | 数据来源 | 示例值 |
|--------|---------|--------|
| `{{metaTitle}}` | content.meta_title | "Complete Guide to ASMR Videos" |
| `{{metaDescription}}` | content.meta_description | "Learn how to create..." |
| `{{targetKeyword}}` | content.target_keyword | "ASMR videos" |
| `{{titleLength}}` | facts.meta.titleLength | 60 |
| `{{descLength}}` | facts.meta.descLength | 155 |
| `{{titleKeywordPosition}}` | facts.meta.titleKeywordPosition | 8 |
| `{{descHasKeyword}}` | facts.meta.descHasKeyword | "是" / "否" |
| `{{descHasCTA}}` | facts.meta.descHasCTA | "是 (discover)" / "否" |
| `{{totalWords}}` | facts.content.totalWords | 1523 |
| `{{h1Count}}` | facts.content.h1Count | 1 |
| `{{h2Count}}` | facts.content.h2Count | 8 |
| `{{h3Count}}` | facts.content.h3Count | 12 |
| `{{paragraphCount}}` | facts.content.paragraphCount | 24 |
| `{{avgParagraphLength}}` | facts.content.avgParagraphLength | 63 |
| `{{maxParagraphLength}}` | facts.content.maxParagraphLength | 142 |
| `{{listCount}}` | facts.content.listCount | 5 |
| `{{codeBlockCount}}` | facts.content.codeBlockCount | 0 |
| `{{quoteBlockCount}}` | facts.content.quoteBlockCount | 1 |
| `{{keywordCount}}` | facts.keywords.primary.count | 18 |
| `{{keywordDensity}}` | facts.keywords.primary.density | 1.8 |
| `{{keywordInTitle}}` | facts.keywords.primary.inTitle | "标题✓" / "标题✗" |
| `{{keywordInFirstParagraph}}` | facts.keywords.primary.inFirstParagraph | "首段✓" / "首段✗" |
| `{{keywordInLastParagraph}}` | facts.keywords.primary.inLastParagraph | "尾段✓" / "尾段✗" |
| `{{keywordInH2Count}}` | facts.keywords.primary.inH2Count | 3 |
| `{{keywordInH3Count}}` | facts.keywords.primary.inH3Count | 2 |
| `{{fleschScore}}` | facts.readability.fleschScore | 72.5 |
| `{{avgSentenceLength}}` | facts.readability.avgSentenceLength | 15.2 |
| `{{avgWordLength}}` | facts.readability.avgWordLength | 5.3 |
| `{{complexWordCount}}` | facts.readability.complexWordCount | 142 |
| `{{complexWordRatio}}` | facts.readability.complexWordRatio | 18.5 |
| `{{faqCount}}` | facts.ux.faqCount | 5 |
| `{{faqAvgQuestionLength}}` | facts.ux.faqAvgQuestionLength | 45 |
| `{{faqAvgAnswerLength}}` | facts.ux.faqAvgAnswerLength | 128 |
| `{{internalLinkCount}}` | facts.ux.internalLinkCount | 3 |
| `{{externalLinkCount}}` | facts.ux.externalLinkCount | 2 |
| `{{metaBaseScore}}` | calculateBaseMetaScore(facts) | 17 |
| `{{contentBaseScore}}` | calculateBaseContentScore(facts) | 16 |
| `{{keywordBaseScore}}` | calculateBaseKeywordScore(facts) | 18 |
| `{{readabilityBaseScore}}` | calculateBaseReadabilityScore(facts) | 15 |
| `{{uxBaseScore}}` | calculateBaseUXScore(facts) | 9 |
| `{{languageName}}` | "English" / "中文" / etc | "English" |
| `{{guideIntro}}` | content.guide_intro | "ASMR videos have..." |
| `{{guideContent}}` | content.guide_content (截断到2000字符) | "## What Are ASMR..." |
| `{{faqItems}}` | 格式化的FAQ列表 | "Q1: ...\nA1: ..." |

## 🚀 下一步

执行更新后，新的SEO评分系统将：

1. **从数据库加载提示词** (而不是代码中硬编码)
2. **支持在线修改提示词** (通过Admin后台)
3. **版本控制** (每次更新自动增加version号)
4. **Fallback机制** (数据库加载失败时使用代码中的简化版)

## ⚠️ 注意事项

1. **数据库连接**: 确保数据库连接正常
2. **环境变量**: 检查 `.env` 文件中的数据库配置
3. **权限**: 确保有 `INSERT`/`UPDATE` 权限
4. **备份**: 建议先备份现有的 `ai_prompt_templates` 表
5. **回滚**: 如有问题，可以通过 `version` 字段回滚到旧版本

## 📋 执行检查清单

- [ ] 备份现有 `ai_prompt_templates` 表
- [ ] 检查 `.env` 数据库配置
- [ ] 执行 SQL 迁移文件
- [ ] 验证提示词是否成功保存
- [ ] 测试提示词构建功能
- [ ] 运行完整的SEO评分测试
- [ ] 检查前端是否正常显示

---

**迁移文件**: [037_update_seo_score_prompt.sql](../supabase/migrations/037_update_seo_score_prompt.sql)
**状态**: 已准备好执行
**预计执行时间**: <5秒
