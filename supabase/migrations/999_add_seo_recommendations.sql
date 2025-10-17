-- 添加 seo_recommendations 字段到 seo_page_variants 表
-- 用于存储 AI 评分后的改进建议

ALTER TABLE seo_page_variants
ADD COLUMN IF NOT EXISTS seo_recommendations jsonb DEFAULT '[]'::jsonb;

-- 添加注释
COMMENT ON COLUMN seo_page_variants.seo_recommendations IS 'AI评分后的改进建议列表';
