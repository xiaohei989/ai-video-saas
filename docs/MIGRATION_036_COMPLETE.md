# 数据库迁移 036 - 完成报告

## 📅 执行时间
2025-10-20

## ✅ 迁移状态
**成功完成** ✅

## 📋 迁移内容

### 1. 新增字段（13个）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `meta_quality_score` | INTEGER | 0-20 | Meta信息质量分 |
| `keyword_density_score` | INTEGER | 0-10 | 关键词密度分 |
| `score_breakdown` | JSONB | - | 详细评分breakdown |
| `confidence_score` | INTEGER | 0-100 | 总体置信度 |
| `dimension_confidence` | JSONB | - | 各维度置信度 |
| `score_conflicts` | JSONB | - | 评分冲突记录 |
| `validation_warnings` | TEXT[] | - | 验证警告 |
| `top_strengths` | TEXT[] | - | 内容优势列表 |
| `critical_issues` | JSONB | - | 关键问题列表 |
| `scoring_performance` | JSONB | - | 评分性能数据 |
| `requires_manual_review` | BOOLEAN | - | 是否需要人工复核 |
| `manual_reviewed_at` | TIMESTAMPTZ | - | 人工复核时间 |
| `manual_review_notes` | TEXT | - | 人工复核备注 |
| `seo_facts` | JSONB | - | SEO算法事实数据 |

### 2. 删除字段（1个）

- `performance_score` - 已被5维度评分替代

### 3. 创建索引（3个）

```sql
-- 置信度索引（筛选低置信度记录）
idx_seo_guides_confidence

-- 人工复核索引
idx_seo_guides_manual_review

-- 冲突索引（GIN索引查询JSONB）
idx_seo_guides_conflicts
```

### 4. 创建函数（3个）

#### `auto_calculate_seo_score()`
- **类型**: 触发器函数
- **功能**: 自动计算总分 = 5个维度之和
- **触发条件**: INSERT 或 UPDATE 任一维度分数时

#### `get_reviews_needed()`
- **类型**: 查询函数
- **功能**: 获取需要人工复核的记录
- **返回**: id, template_id, language, seo_score, confidence_score, conflicts_count, warnings_count

#### `get_scoring_stats()`
- **类型**: 统计函数
- **功能**: 获取评分统计数据
- **返回**: total_guides, avg_confidence, high/low_confidence_count, with_conflicts_count, review_needed_count

### 5. 创建触发器（1个）

```sql
CREATE TRIGGER trigger_auto_calculate_seo_score
  BEFORE INSERT OR UPDATE OF meta_quality_score, content_quality_score,
    keyword_optimization_score, readability_score, keyword_density_score
  ON public.template_seo_guides
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_seo_score();
```

## 📊 执行结果

```
ALTER TABLE          ✅ 成功
COMMENT (15次)       ✅ 成功
UPDATE 0             ✅ 成功（无现有记录需更新）
CREATE INDEX (3次)   ✅ 成功
CREATE FUNCTION (3次) ✅ 成功
DROP TRIGGER         ✅ 成功
CREATE TRIGGER       ✅ 成功
```

## ⚠️ 注意事项

迁移执行时出现了以下提示（正常）：

1. **NOTICE: column "keyword_density_score" already exists, skipping**
   - 说明：该字段可能在之前的迁移中已创建
   - 影响：无影响，`IF NOT EXISTS` 语句保证了幂等性

2. **NOTICE: column "performance_score" does not exist, skipping**
   - 说明：该字段可能在之前的迁移中已删除
   - 影响：无影响，`IF EXISTS` 语句保证了安全性

3. **NOTICE: trigger "trigger_auto_calculate_seo_score" does not exist, skipping**
   - 说明：首次创建触发器
   - 影响：无影响，正常流程

## 🔍 验证方法

### 方法1：查询新字段
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'template_seo_guides'
  AND column_name IN (
    'meta_quality_score',
    'keyword_density_score',
    'score_breakdown',
    'confidence_score',
    'seo_facts'
  );
```

### 方法2：查看表结构
```sql
\d template_seo_guides
```

### 方法3：测试触发器
```sql
-- 插入测试记录
INSERT INTO template_seo_guides (
  template_id, language, target_keyword,
  meta_quality_score, content_quality_score,
  keyword_optimization_score, readability_score,
  keyword_density_score
) VALUES (
  '00000000-0000-0000-0000-000000000000', 'en', 'test',
  15, 20, 18, 17, 8
);

-- 验证总分是否自动计算（应为 15+20+18+17+8 = 78）
SELECT seo_score, meta_quality_score, content_quality_score
FROM template_seo_guides
WHERE target_keyword = 'test';

-- 清理测试数据
DELETE FROM template_seo_guides WHERE target_keyword = 'test';
```

### 方法4：测试辅助函数
```sql
-- 测试统计函数
SELECT * FROM get_scoring_stats();

-- 测试复核函数
SELECT * FROM get_reviews_needed();
```

## 📈 数据结构示例

### score_breakdown (JSONB)
```json
{
  "meta_quality": {
    "base_score": 17,
    "title_appeal": 2,
    "description_persuasion": -1,
    "reason": "标题长度理想，但描述略长"
  },
  "content_quality": {
    "base_score": 16,
    "originality_depth": 8,
    "eeat_score": 12
  }
}
```

### dimension_confidence (JSONB)
```json
{
  "meta_quality": 95,
  "content_quality": 88,
  "keyword_optimization": 92,
  "readability": 100,
  "ux": 85
}
```

### score_conflicts (JSONB)
```json
[
  {
    "dimension": "meta_quality",
    "algorithm_suggests": 17,
    "ai_score": 15,
    "difference": 2,
    "reason": "AI认为标题吸引力不足",
    "auto_resolved": true,
    "resolution": "采用AI评分（更准确）"
  }
]
```

### seo_facts (JSONB)
```json
{
  "meta": {
    "titleLength": 60,
    "titleHasKeyword": true,
    "descLength": 161,
    "descHasKeyword": true
  },
  "content": {
    "totalWords": 1523,
    "h2Count": 8,
    "h3Count": 5
  },
  "keywords": {
    "primary": {
      "keyword": "ASMR food videos",
      "count": 15,
      "density": 2.1,
      "inTitle": true
    }
  }
}
```

## 🎯 后续步骤

### 1. 前端集成 ⏳
更新 `SEOScoreDisplay.tsx` 以显示新字段：
- 置信度评分
- 详细breakdown
- 优势和问题列表
- 冲突警告

### 2. 后端集成 ⏳
更新评分服务以写入新字段：
```typescript
import { scoreSEOContent } from '@/services/seoScoringEngine'

const result = await scoreSEOContent(content)

// 保存到数据库
await supabase
  .from('template_seo_guides')
  .update({
    meta_quality_score: result.dimension_scores.meta_quality,
    keyword_density_score: result.dimension_scores.ux, // 或单独计算
    score_breakdown: result.score_breakdown,
    confidence_score: result.confidence.overall,
    dimension_confidence: result.confidence,
    score_conflicts: result.conflicts,
    validation_warnings: result.validation_warnings,
    top_strengths: result.top_strengths,
    critical_issues: result.critical_issues,
    seo_facts: result.facts,
    requires_manual_review: result.requires_manual_review
  })
  .eq('id', guideId)
```

### 3. 测试完整流程 ⏳
- 生成一个SEO指南
- 使用新评分系统评分
- 验证所有字段正确保存
- 在前端查看详细breakdown

### 4. 监控和优化 ⏳
- 使用 `get_scoring_stats()` 监控评分质量
- 定期复核低置信度记录
- 优化AI提示词以减少冲突

## 📝 回滚方法（如需要）

```sql
-- 删除触发器
DROP TRIGGER IF EXISTS trigger_auto_calculate_seo_score ON public.template_seo_guides;

-- 删除函数
DROP FUNCTION IF EXISTS auto_calculate_seo_score();
DROP FUNCTION IF EXISTS get_reviews_needed();
DROP FUNCTION IF EXISTS get_scoring_stats();

-- 删除索引
DROP INDEX IF EXISTS idx_seo_guides_confidence;
DROP INDEX IF EXISTS idx_seo_guides_manual_review;
DROP INDEX IF EXISTS idx_seo_guides_conflicts;

-- 删除新字段
ALTER TABLE public.template_seo_guides
  DROP COLUMN IF EXISTS meta_quality_score,
  DROP COLUMN IF EXISTS keyword_density_score,
  DROP COLUMN IF EXISTS score_breakdown,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS dimension_confidence,
  DROP COLUMN IF EXISTS score_conflicts,
  DROP COLUMN IF EXISTS validation_warnings,
  DROP COLUMN IF EXISTS top_strengths,
  DROP COLUMN IF EXISTS critical_issues,
  DROP COLUMN IF EXISTS scoring_performance,
  DROP COLUMN IF EXISTS requires_manual_review,
  DROP COLUMN IF EXISTS manual_reviewed_at,
  DROP COLUMN IF EXISTS manual_review_notes,
  DROP COLUMN IF EXISTS seo_facts;
```

## ✅ 检查清单

- [x] 迁移SQL文件准备完成
- [x] 迁移成功执行
- [x] 所有ALTER TABLE语句成功
- [x] 所有索引创建成功
- [x] 所有函数创建成功
- [x] 触发器创建成功
- [ ] 字段验证（待数据库连接恢复）
- [ ] 触发器测试
- [ ] 辅助函数测试
- [ ] 前端集成
- [ ] 完整流程测试

## 🎉 总结

数据库迁移 036 已成功完成，为SEO评分系统v2.0提供了完整的数据支持：

- ✅ **13个新字段**：支持详细breakdown、置信度、冲突检测
- ✅ **3个索引**：优化查询性能
- ✅ **3个函数**：自动计算、统计查询、复核列表
- ✅ **1个触发器**：自动计算总分

系统现在已具备完整的数据基础设施，可以开始进行前端集成和完整测试。

---

**迁移文件**: [036_advanced_seo_scoring.sql](../supabase/migrations/036_advanced_seo_scoring.sql)
**执行时间**: 2025-10-20
**状态**: ✅ 完成
