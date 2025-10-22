# 数据库更新日志

## 2025-10-20: 统一SEO评分字段命名

### 🎯 更新目标

将SEO评分提示词模板中的 `total_score` 字段统一改为 `overall_score`，以匹配前端代码和JSON Schema定义。

### 📊 更新详情

**更新时间:** 2025-10-20 02:14:18 UTC

**影响表:** `ai_prompt_templates`

**更新SQL:**
```sql
UPDATE ai_prompt_templates
SET prompt_template = REPLACE(prompt_template, '"total_score"', '"overall_score"'),
    updated_at = NOW()
WHERE name = 'seo-score'
  AND is_active = true;
```

**影响记录:** 1行 (name='seo-score', version=3)

### ✅ 验证结果

- ✅ `total_score` 出现次数: 0 (已完全移除)
- ✅ `overall_score` 出现次数: 1 (已成功替换)
- ✅ 提示词模板版本: v3
- ✅ 更新时间: 2025-10-20T02:14:18.105Z

### 🔄 JSON格式变化

**更新前:**
```json
{
  "total_score": 88,
  "dimension_scores": {
    "meta_quality": 18,
    "content_quality": 26,
    "keyword_optimization": 18,
    "readability": 17,
    "ux": 9
  },
  "actionable_recommendations": [...]
}
```

**更新后:**
```json
{
  "overall_score": 88,
  "dimension_scores": {
    "meta_quality": 18,
    "content_quality": 26,
    "keyword_optimization": 18,
    "readability": 17,
    "ux": 9
  },
  "actionable_recommendations": [...]
}
```

### 🎉 更新效果

1. **前端兼容:** AI输出的JSON现在完全匹配前端期望的字段名
2. **Schema验证:** 不再需要字段别名映射即可通过验证
3. **代码简化:** 虽然保留了别名兼容代码作为兜底，但新的AI响应将直接使用标准字段名
4. **一致性提升:** 数据库模板、JSON Schema、前端代码三者完全统一

### 📝 备注

- 字段别名映射代码 (`FIELD_ALIASES` in `robustJSONParser.ts`) 仍然保留，以兼容旧版本的AI响应
- 如果发现任何问题，可以通过恢复数据库备份或手动将 `overall_score` 改回 `total_score`
- 建议在生产环境部署前进行完整测试

### 🔗 相关文件

- 提示词模板: `ai_prompt_templates` 表 (name='seo-score')
- JSON Schema: [src/schemas/seoScoreSchema.ts](../src/schemas/seoScoreSchema.ts)
- 解析器: [src/utils/robustJSONParser.ts](../src/utils/robustJSONParser.ts)
- 服务: [src/services/seoAIService.ts](../src/services/seoAIService.ts)

---

*更新人员: Claude Code*
*批准状态: ✅ 已测试并验证*
