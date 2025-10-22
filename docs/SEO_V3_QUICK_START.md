# SEO关键词分配 v3.0 - 快速开始指南

## 🚀 5分钟快速部署

### 步骤1: 应用数据库迁移 (必须!)

```bash
cd /Users/chishengyang/Desktop/AI_ASMR/ai-video-saas

# 方法1: 使用Supabase CLI (推荐)
npx supabase db push

# 方法2: 直接执行SQL
PGPASSWORD="huixiangyigou2025!" psql \
  -h aws-1-us-west-1.pooler.supabase.com \
  -p 6543 \
  -d postgres \
  -U postgres.hvkzwrnvxsleeonqqrzq \
  -f supabase/migrations/039_howto_section_structure_v3.sql
```

### 步骤2: 运行测试验证

```bash
npx tsx scripts/test-keyword-allocator.ts
```

**预期输出**:
```
✅ 所有测试用例完成!
核心指标验证:
1. ✅ 分配总数与目标误差 ≤ 3次
2. ✅ 密度在1.5-2.5%理想范围内
...
系统已就绪,可以开始生成SEO内容! 🚀
```

### 步骤3: 生成测试文章

```bash
# 如果有SEO内容生成脚本
npm run generate:seo -- --keyword "ASMR food videos" --template how-to

# 或者通过Admin后台UI操作
```

---

## 📊 验证关键词密度

生成文章后,验证关键词密度是否达标:

### 方法1: 使用脚本验证

```bash
# 假设已生成文章保存在 /tmp/article.md
node scripts/check-keyword-density.js /tmp/article.md "ASMR food videos"
```

### 方法2: 手动验证 (临时)

```bash
# 统计关键词出现次数
grep -o "ASMR food videos" /tmp/article.md | wc -l

# 统计总词数 (英文)
wc -w /tmp/article.md

# 计算密度
# 密度 = (关键词次数 / 总词数) × 100%
```

**预期结果**:
- 1600词文章: 32次关键词 (密度2.0%)
- 误差范围: ±2次 (30-34次均可接受)

---

## 🔍 问题排查

### 问题1: 测试脚本报错 "Cannot find module"

**原因**: TypeScript未编译

**解决**:
```bash
npm install
npx tsx scripts/test-keyword-allocator.ts
```

### 问题2: 数据库迁移失败

**检查**:
```bash
# 查看当前 how-to 模板结构
PGPASSWORD="huixiangyigou2025!" psql \
  -h aws-1-us-west-1.pooler.supabase.com \
  -p 6543 \
  -d postgres \
  -U postgres.hvkzwrnvxsleeonqqrzq \
  -c "SELECT slug, jsonb_array_length(structure_schema->'required_sections') as section_count FROM seo_content_templates WHERE slug = 'how-to';"
```

**预期输出**:
```
slug   | section_count
-------|---------------
how-to | 8
```

如果 `section_count` 为空或0,说明迁移未成功。

### 问题3: 生成的文章关键词密度不对

**检查步骤**:

1. **提示词模板是否使用了新版?**
   ```bash
   grep "keywordTaskChecklist" prompts/content-generation/how-to.md
   ```
   应该能找到 `{{keywordTaskChecklist}}` 占位符。

2. **promptBuilderService 是否注入了新变量?**
   ```bash
   grep "keywordTaskChecklist" src/services/promptBuilderService.ts
   ```
   应该能找到 `keywordTaskChecklist` 变量。

3. **数据库模板是否更新?**
   如果使用数据库存储的提示词模板,需要手动同步:
   ```sql
   UPDATE seo_content_templates
   SET prompt_template = (
     SELECT content FROM ... -- 读取Markdown文件内容
   )
   WHERE slug = 'how-to';
   ```

---

## 📖 API使用示例

### TypeScript代码示例

```typescript
import { promptBuilderService } from '@/services/promptBuilderService'
import { calculateKeywordTaskAllocation } from '@/services/keywordTaskAllocator'

// 示例1: 直接使用分配算法
const tasks = calculateKeywordTaskAllocation(
  1600, // 字数
  sections, // 章节结构
  'ASMR food videos', // 关键词
  { targetDensity: 2.0 } // 配置
)

console.log('总目标:', tasks.totalTarget) // 32次
console.log('Tier1:', tasks.tier1_meta)
console.log('Tier3:', tasks.tier3_content.sections)

// 示例2: 通过 promptBuilderService 生成完整提示词
const prompt = await promptBuilderService.buildPrompt({
  templateSlug: 'how-to',
  targetKeyword: 'ASMR food videos',
  differentiationFactors: {
    platform: 'TikTok',
    audience: 'beginners',
    searchIntent: 'informational'
  },
  language: 'en',
  structureSchema: {
    required_sections: [ /* 章节配置 */ ],
    faq_config: { /* FAQ配置 */ }
  },
  recommendedWordCount: 1600,
  keywordDensityTargets: {
    target_keyword: { ideal: 2.0, min: 1.5, max: 2.5 }
  }
})

// prompt.userPrompt 包含完整的任务清单
console.log(prompt.userPrompt)
```

---

## 🎯 配置选项

### 关键词密度配置

```typescript
interface KeywordTaskAllocatorConfig {
  targetDensity: number       // 目标密度 (默认2.0%)
  minDensity: number          // 最小密度 (默认1.5%)
  maxDensity: number          // 最大密度 (默认2.5%)

  h2KeywordRatio: number      // H2包含关键词比例 (默认50%)
  faqKeywordRatio: number     // FAQ包含关键词比例 (默认40%)

  maxConsecutive: number      // 最多连续几句包含关键词 (默认2)
  firstSentenceMandatory: boolean // 首句是否必须包含 (默认true)
}

// 使用自定义配置
const tasks = calculateKeywordTaskAllocation(
  1600,
  sections,
  keyword,
  {
    targetDensity: 1.8,    // 自定义密度
    h2KeywordRatio: 0.6    // 60%的H2包含关键词
  }
)
```

---

## 📋 检查清单

部署完成后,请逐项检查:

- [ ] 数据库迁移成功 (how-to模板有8个章节)
- [ ] 测试脚本全部通过
- [ ] `keywordTaskAllocator.ts` 文件存在
- [ ] `promptBuilderService.ts` 已导入 keywordTaskAllocator
- [ ] 3个提示词模板 (`how-to.md`, `alternatives.md`, `platform-specific.md`) 已更新
- [ ] 生成测试文章,关键词密度在1.9-2.1%范围内
- [ ] 关键词分布符合预期 (Meta标题、H2标题、首句等)

---

## 🆘 获取帮助

**文档**:
- 总结文档: `docs/SEO_KEYWORD_ALLOCATION_V3_SUMMARY.md`
- 快速开始: `docs/SEO_V3_QUICK_START.md`

**代码**:
- 核心算法: `src/services/keywordTaskAllocator.ts`
- 集成点: `src/services/promptBuilderService.ts`
- 测试: `scripts/test-keyword-allocator.ts`

**数据库**:
- 迁移脚本: `supabase/migrations/039_howto_section_structure_v3.sql`
- 表结构: `seo_content_templates`

---

**更新时间**: 2025-01-20
**版本**: v3.0
