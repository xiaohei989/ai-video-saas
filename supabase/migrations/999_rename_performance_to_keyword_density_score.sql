-- 将 performance_score 字段重命名为 keyword_density_score
-- 这个字段用于存储关键词密度评分（0-10分）

-- 重命名字段
ALTER TABLE template_seo_guides
RENAME COLUMN performance_score TO keyword_density_score;

-- 添加注释说明新字段的用途
COMMENT ON COLUMN template_seo_guides.keyword_density_score IS '关键词密度评分（0-10分），基于关键词密度达标率计算';
