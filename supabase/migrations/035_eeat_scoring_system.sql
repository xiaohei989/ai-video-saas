-- ============================================
-- E-E-A-T 评分系统 (Google 2025 标准)
-- Version: 035
-- Description: 新增 E-E-A-T 评分字段，完全独立于旧的 SEO 评分系统
-- ============================================

-- ============================================
-- 1. 扩展 seo_page_variants 表
-- ============================================

ALTER TABLE public.seo_page_variants
  ADD COLUMN IF NOT EXISTS eeat_total_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_trustworthiness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_authoritativeness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_expertise_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_comprehensiveness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_information_gain_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_structured_quality_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_engagement_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_readability_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_keyword_optimization_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_keyword_density_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_recommendations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eeat_last_scored_at TIMESTAMPTZ;

-- ============================================
-- 2. 添加字段注释
-- ============================================

COMMENT ON COLUMN public.seo_page_variants.eeat_total_score IS 'E-E-A-T总分 (0-100, Google 2025标准)';
COMMENT ON COLUMN public.seo_page_variants.eeat_trustworthiness_score IS '可信度评分 (0-15分)';
COMMENT ON COLUMN public.seo_page_variants.eeat_authoritativeness_score IS '权威性评分 (0-10分)';
COMMENT ON COLUMN public.seo_page_variants.eeat_expertise_score IS '专业性评分 (0-10分)';

COMMENT ON COLUMN public.seo_page_variants.eeat_comprehensiveness_score IS '内容全面性评分 (0-12分)';
COMMENT ON COLUMN public.seo_page_variants.eeat_information_gain_score IS '信息增益/原创性评分 (0-10分)';
COMMENT ON COLUMN public.seo_page_variants.eeat_structured_quality_score IS '结构化质量评分 (0-8分)';

COMMENT ON COLUMN public.seo_page_variants.eeat_engagement_score IS '用户参与度评分 (0-12分, 基于 page_views/avg_time_on_page/bounce_rate/conversion_rate 自动计算)';
COMMENT ON COLUMN public.seo_page_variants.eeat_readability_score IS '可读性评分 (0-8分)';

COMMENT ON COLUMN public.seo_page_variants.eeat_keyword_optimization_score IS '关键词优化评分 (0-8分)';
COMMENT ON COLUMN public.seo_page_variants.eeat_keyword_density_score IS '关键词密度评分 (0-7分, 自动计算)';

COMMENT ON COLUMN public.seo_page_variants.eeat_recommendations IS 'E-E-A-T 专属优化建议列表';
COMMENT ON COLUMN public.seo_page_variants.eeat_last_scored_at IS '最后E-E-A-T评分时间';

-- ============================================
-- 3. 扩展 template_seo_guides 表 (保持一致性)
-- ============================================

ALTER TABLE public.template_seo_guides
  ADD COLUMN IF NOT EXISTS eeat_total_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_trustworthiness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_authoritativeness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_expertise_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_comprehensiveness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_information_gain_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_structured_quality_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_engagement_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_readability_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_keyword_optimization_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_keyword_density_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eeat_recommendations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eeat_last_scored_at TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN public.template_seo_guides.eeat_total_score IS 'E-E-A-T总分 (0-100, Google 2025标准)';
COMMENT ON COLUMN public.template_seo_guides.eeat_recommendations IS 'E-E-A-T 专属优化建议列表';

-- ============================================
-- 4. 创建索引 (优化查询性能)
-- ============================================

-- E-E-A-T 评分索引
CREATE INDEX IF NOT EXISTS idx_page_variants_eeat_score ON public.seo_page_variants(eeat_total_score DESC);
CREATE INDEX IF NOT EXISTS idx_page_variants_eeat_scored_at ON public.seo_page_variants(eeat_last_scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_guides_eeat_score ON public.template_seo_guides(eeat_total_score DESC);
CREATE INDEX IF NOT EXISTS idx_seo_guides_eeat_scored_at ON public.template_seo_guides(eeat_last_scored_at DESC);

-- ============================================
-- 5. 辅助函数：获取 E-E-A-T 评分摘要
-- ============================================

CREATE OR REPLACE FUNCTION get_eeat_score_summary(
  p_variant_id UUID
)
RETURNS TABLE (
  id UUID,
  total_score INTEGER,
  trustworthiness_score INTEGER,
  authoritativeness_score INTEGER,
  expertise_score INTEGER,
  comprehensiveness_score INTEGER,
  information_gain_score INTEGER,
  structured_quality_score INTEGER,
  engagement_score INTEGER,
  readability_score INTEGER,
  keyword_optimization_score INTEGER,
  keyword_density_score INTEGER,
  recommendations_count INTEGER,
  last_scored_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.id,
    pv.eeat_total_score as total_score,
    pv.eeat_trustworthiness_score as trustworthiness_score,
    pv.eeat_authoritativeness_score as authoritativeness_score,
    pv.eeat_expertise_score as expertise_score,
    pv.eeat_comprehensiveness_score as comprehensiveness_score,
    pv.eeat_information_gain_score as information_gain_score,
    pv.eeat_structured_quality_score as structured_quality_score,
    pv.eeat_engagement_score as engagement_score,
    pv.eeat_readability_score as readability_score,
    pv.eeat_keyword_optimization_score as keyword_optimization_score,
    pv.eeat_keyword_density_score as keyword_density_score,
    COALESCE(array_length(pv.eeat_recommendations, 1), 0) as recommendations_count,
    pv.eeat_last_scored_at as last_scored_at
  FROM public.seo_page_variants pv
  WHERE pv.id = p_variant_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_eeat_score_summary IS '获取指定页面变体的 E-E-A-T 评分摘要';

-- ============================================
-- 6. 视图：E-E-A-T 评分排行榜
-- ============================================

CREATE OR REPLACE VIEW public.eeat_score_leaderboard AS
SELECT
  pv.id,
  pv.template_id,
  t.name as template_name,
  t.slug as template_slug,
  pv.language,
  pv.target_keyword,
  pv.eeat_total_score,
  pv.eeat_trustworthiness_score,
  pv.eeat_authoritativeness_score,
  pv.eeat_expertise_score,
  pv.eeat_last_scored_at,
  pv.page_views,
  pv.avg_time_on_page,
  pv.bounce_rate,
  pv.conversion_rate,
  pv.is_published
FROM public.seo_page_variants pv
JOIN public.templates t ON t.id = pv.template_id
WHERE pv.eeat_total_score > 0
ORDER BY pv.eeat_total_score DESC, pv.page_views DESC;

COMMENT ON VIEW public.eeat_score_leaderboard IS 'E-E-A-T 评分排行榜 - 显示所有已评分的页面';

-- ============================================
-- 完成
-- ============================================

-- 显示创建的字段
SELECT
  'E-E-A-T fields added successfully' as message,
  COUNT(*) FILTER (WHERE column_name LIKE 'eeat_%') as eeat_fields_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('seo_page_variants', 'template_seo_guides')
  AND column_name LIKE 'eeat_%';
