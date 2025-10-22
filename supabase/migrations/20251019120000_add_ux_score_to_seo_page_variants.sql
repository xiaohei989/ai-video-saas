-- 添加 ux_score 字段到 seo_page_variants 表
-- SEO v2.0: 支持5维度评分系统 (Meta 20 + Content 30 + Keyword 20 + Readability 20 + UX 10 = 100分)
-- 创建时间: 2025-10-19

-- 添加 ux_score 列
ALTER TABLE seo_page_variants
ADD COLUMN IF NOT EXISTS ux_score INTEGER DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN seo_page_variants.ux_score IS 'SEO v2.0: 用户体验分数 (0-10分)';

-- 创建索引（可选，用于查询优化）
CREATE INDEX IF NOT EXISTS idx_seo_page_variants_ux_score
ON seo_page_variants(ux_score);
