-- 重命名 primary_keyword 为 target_keyword (单关键词SEO优化策略)
-- Migration: Rename primary_keyword to target_keyword in template_seo_guides table

-- 1. 重命名列
ALTER TABLE template_seo_guides
RENAME COLUMN primary_keyword TO target_keyword;

-- 2. 添加列注释
COMMENT ON COLUMN template_seo_guides.target_keyword IS '目标关键词（单关键词SEO优化策略）';

-- 3. 重建唯一索引（如果存在基于 primary_keyword 的唯一约束）
-- 注意：template_seo_guides_template_id_language_key 不包含 primary_keyword，无需修改

-- 4. 检查是否有其他依赖 primary_keyword 的索引或约束
-- (从表结构看，没有其他基于 primary_keyword 的索引需要重建)

-- Migration completed successfully
