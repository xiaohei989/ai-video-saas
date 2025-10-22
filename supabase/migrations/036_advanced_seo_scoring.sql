-- 高级SEO评分系统 - 数据库迁移
-- 支持算法+AI+验证三层架构
-- 创建时间: 2025-10-20

-- ============================================
-- 1. 添加新的评分字段
-- ============================================

ALTER TABLE public.template_seo_guides
  -- 5个维度的分数字段 (100分制)
  ADD COLUMN IF NOT EXISTS meta_quality_score INTEGER DEFAULT 0 CHECK (meta_quality_score >= 0 AND meta_quality_score <= 20),
  ADD COLUMN IF NOT EXISTS keyword_density_score INTEGER DEFAULT 0 CHECK (keyword_density_score >= 0 AND keyword_density_score <= 10),

  -- 详细breakdown (JSONB存储)
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}',
  -- 格式: {
  --   "meta_quality": {"base_score": 17, "title_appeal": 2, "description_persuasion": -1, "reason": "..."},
  --   "content_quality": {"base_score": 16, "originality_depth": 8, ...},
  --   ...
  -- }

  -- 置信度评分 (0-100)
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  ADD COLUMN IF NOT EXISTS dimension_confidence JSONB DEFAULT '{}',
  -- 格式: {"meta_quality": 95, "content_quality": 88, ...}

  -- 冲突记录
  ADD COLUMN IF NOT EXISTS score_conflicts JSONB DEFAULT '[]',
  -- 格式: [{"dimension": "meta_quality", "algorithm_suggests": 17, "ai_score": 15, ...}]

  -- 验证警告
  ADD COLUMN IF NOT EXISTS validation_warnings TEXT[] DEFAULT '{}',

  -- 优势和问题
  ADD COLUMN IF NOT EXISTS top_strengths TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS critical_issues JSONB DEFAULT '[]',

  -- 性能数据
  ADD COLUMN IF NOT EXISTS scoring_performance JSONB DEFAULT '{}',
  -- 格式: {"facts_calculation_ms": 150, "ai_analysis_ms": 23000, ...}

  -- 人工复核标记
  ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_review_notes TEXT,

  -- SEO事实数据（算法计算结果）
  ADD COLUMN IF NOT EXISTS seo_facts JSONB DEFAULT '{}';
  -- 格式: {"meta": {...}, "content": {...}, "keywords": {...}, ...}

-- ============================================
-- 2. 字段注释
-- ============================================

COMMENT ON COLUMN public.template_seo_guides.meta_quality_score IS 'Meta信息质量分 (0-20分)';
COMMENT ON COLUMN public.template_seo_guides.content_quality_score IS '内容质量分 (0-30分)';
COMMENT ON COLUMN public.template_seo_guides.keyword_optimization_score IS '关键词优化分 (0-20分)';
COMMENT ON COLUMN public.template_seo_guides.readability_score IS '可读性分 (0-20分)';
COMMENT ON COLUMN public.template_seo_guides.keyword_density_score IS '关键词密度分 (0-10分)';

COMMENT ON COLUMN public.template_seo_guides.score_breakdown IS '详细评分breakdown (JSONB格式)';
COMMENT ON COLUMN public.template_seo_guides.confidence_score IS '总体置信度 (0-100)';
COMMENT ON COLUMN public.template_seo_guides.dimension_confidence IS '各维度置信度 (JSONB格式)';
COMMENT ON COLUMN public.template_seo_guides.score_conflicts IS '评分冲突记录 (JSONB数组)';
COMMENT ON COLUMN public.template_seo_guides.validation_warnings IS '验证警告 (文本数组)';
COMMENT ON COLUMN public.template_seo_guides.top_strengths IS '内容优势列表 (文本数组)';
COMMENT ON COLUMN public.template_seo_guides.critical_issues IS '关键问题列表 (JSONB数组)';
COMMENT ON COLUMN public.template_seo_guides.scoring_performance IS '评分性能数据 (JSONB格式)';
COMMENT ON COLUMN public.template_seo_guides.requires_manual_review IS '是否需要人工复核';
COMMENT ON COLUMN public.template_seo_guides.seo_facts IS 'SEO算法事实数据 (JSONB格式)';

-- ============================================
-- 3. 删除旧字段（如果存在）
-- ============================================

-- 删除旧的performance_score字段（已被新的5维度替代）
ALTER TABLE public.template_seo_guides
  DROP COLUMN IF EXISTS performance_score;

-- ============================================
-- 4. 更新现有记录的seo_score
-- ============================================

-- 如果有现有记录，确保seo_score是各维度之和
UPDATE public.template_seo_guides
SET seo_score = COALESCE(meta_quality_score, 0)
              + COALESCE(content_quality_score, 0)
              + COALESCE(keyword_optimization_score, 0)
              + COALESCE(readability_score, 0)
              + COALESCE(keyword_density_score, 0)
WHERE seo_score IS NULL OR seo_score = 0;

-- ============================================
-- 5. 创建索引（优化查询性能）
-- ============================================

-- 置信度索引（用于筛选低置信度记录）
CREATE INDEX IF NOT EXISTS idx_seo_guides_confidence
  ON public.template_seo_guides(confidence_score DESC)
  WHERE confidence_score < 80;

-- 人工复核索引
CREATE INDEX IF NOT EXISTS idx_seo_guides_manual_review
  ON public.template_seo_guides(requires_manual_review, confidence_score)
  WHERE requires_manual_review = TRUE;

-- 冲突数量索引（使用GIN索引查询JSONB数组）
CREATE INDEX IF NOT EXISTS idx_seo_guides_conflicts
  ON public.template_seo_guides USING GIN(score_conflicts)
  WHERE score_conflicts != '[]'::JSONB;

-- ============================================
-- 6. 创建辅助函数
-- ============================================

-- 函数：获取需要人工复核的记录
CREATE OR REPLACE FUNCTION get_reviews_needed()
RETURNS TABLE (
  id UUID,
  template_id UUID,
  language VARCHAR(10),
  seo_score INTEGER,
  confidence_score INTEGER,
  conflicts_count INTEGER,
  warnings_count INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    id,
    template_id,
    language,
    seo_score,
    confidence_score,
    jsonb_array_length(COALESCE(score_conflicts, '[]'::JSONB)) AS conflicts_count,
    array_length(validation_warnings, 1) AS warnings_count
  FROM template_seo_guides
  WHERE requires_manual_review = TRUE
  ORDER BY confidence_score ASC, seo_score DESC;
$$;

COMMENT ON FUNCTION get_reviews_needed IS '获取需要人工复核的SEO指南';

-- 函数：获取评分统计
CREATE OR REPLACE FUNCTION get_scoring_stats()
RETURNS TABLE (
  total_guides INTEGER,
  avg_confidence NUMERIC,
  high_confidence_count INTEGER,
  low_confidence_count INTEGER,
  with_conflicts_count INTEGER,
  review_needed_count INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    COUNT(*)::INTEGER AS total_guides,
    ROUND(AVG(confidence_score), 2) AS avg_confidence,
    COUNT(*) FILTER (WHERE confidence_score >= 80)::INTEGER AS high_confidence_count,
    COUNT(*) FILTER (WHERE confidence_score < 70)::INTEGER AS low_confidence_count,
    COUNT(*) FILTER (WHERE score_conflicts != '[]'::JSONB)::INTEGER AS with_conflicts_count,
    COUNT(*) FILTER (WHERE requires_manual_review = TRUE)::INTEGER AS review_needed_count
  FROM template_seo_guides
  WHERE seo_score IS NOT NULL AND seo_score > 0;
$$;

COMMENT ON FUNCTION get_scoring_stats IS '获取SEO评分统计数据';

-- ============================================
-- 7. 创建触发器（自动计算总分）
-- ============================================

CREATE OR REPLACE FUNCTION auto_calculate_seo_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 自动计算总分 = 5个维度之和
  NEW.seo_score := COALESCE(NEW.meta_quality_score, 0)
                 + COALESCE(NEW.content_quality_score, 0)
                 + COALESCE(NEW.keyword_optimization_score, 0)
                 + COALESCE(NEW.readability_score, 0)
                 + COALESCE(NEW.keyword_density_score, 0);

  -- 确保总分不超过100
  IF NEW.seo_score > 100 THEN
    NEW.seo_score := 100;
  END IF;

  RETURN NEW;
END;
$$;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_auto_calculate_seo_score ON public.template_seo_guides;

-- 创建新触发器
CREATE TRIGGER trigger_auto_calculate_seo_score
  BEFORE INSERT OR UPDATE OF meta_quality_score, content_quality_score, keyword_optimization_score, readability_score, keyword_density_score
  ON public.template_seo_guides
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_seo_score();

COMMENT ON TRIGGER trigger_auto_calculate_seo_score ON public.template_seo_guides IS '自动计算SEO总分';

-- ============================================
-- 8. 权限设置（继承现有表权限）
-- ============================================

-- 新字段继承表的RLS策略，无需额外设置

-- ============================================
-- 完成
-- ============================================
