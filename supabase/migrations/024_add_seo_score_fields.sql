-- 为template_seo_guides表添加详细的SEO评分字段
-- 创建时间: 2025-10-12

-- 添加评分详情字段
ALTER TABLE public.template_seo_guides
ADD COLUMN IF NOT EXISTS content_quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS keyword_optimization_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS readability_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS performance_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS keyword_density JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS seo_recommendations TEXT[] DEFAULT '{}';

-- 添加字段注释
COMMENT ON COLUMN public.template_seo_guides.content_quality_score IS '内容质量评分 (0-40分)';
COMMENT ON COLUMN public.template_seo_guides.keyword_optimization_score IS '关键词优化评分 (0-30分)';
COMMENT ON COLUMN public.template_seo_guides.readability_score IS '可读性评分 (0-20分)';
COMMENT ON COLUMN public.template_seo_guides.performance_score IS '用户表现评分 (0-10分)';
COMMENT ON COLUMN public.template_seo_guides.keyword_density IS '关键词密度JSON对象 {keyword: density%}';
COMMENT ON COLUMN public.template_seo_guides.seo_recommendations IS 'SEO优化建议数组';
