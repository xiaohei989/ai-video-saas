-- ============================================
-- Programmatic SEO System
-- Version: 033
-- Description: 完整的Programmatic SEO系统，支持多模板、多关键词、独立页面生成
-- ============================================

-- ============================================
-- 1. SEO内容模板表（存储模板定义）
-- ============================================
CREATE TABLE IF NOT EXISTS public.seo_content_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,                    -- How To Tutorial
  slug VARCHAR(100) UNIQUE NOT NULL,             -- how-to
  description TEXT,                               -- 模板说明
  template_type VARCHAR(50) NOT NULL,            -- how-to, alternatives, platform-specific

  -- 内容结构定义
  structure_schema JSONB NOT NULL,               -- 详细结构定义（章节、字数要求等）
  prompt_template TEXT NOT NULL,                 -- AI生成提示词模板

  -- 配置
  recommended_word_count INTEGER DEFAULT 1500,   -- 推荐字数
  min_word_count INTEGER DEFAULT 1000,
  max_word_count INTEGER DEFAULT 2500,

  -- 关键词配置
  keyword_density_targets JSONB,                 -- 各类型关键词的密度目标

  -- 元数据
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.seo_content_templates IS 'SEO内容模板定义 - 存储不同类型内容的生成规则';
COMMENT ON COLUMN public.seo_content_templates.structure_schema IS '内容结构定义（章节、字数、关键词分布等）';
COMMENT ON COLUMN public.seo_content_templates.prompt_template IS 'AI生成的提示词模板';

-- ============================================
-- 2. SEO页面变体表（每个关键词一个页面）
-- ============================================
CREATE TABLE IF NOT EXISTS public.seo_page_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 关联关系
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  content_template_id UUID NOT NULL REFERENCES public.seo_content_templates(id),
  language VARCHAR(10) NOT NULL,

  -- 关键词信息
  target_keyword TEXT NOT NULL,                  -- 完整的长尾关键词
  keyword_slug VARCHAR(200) NOT NULL,            -- URL友好的slug
  keyword_type VARCHAR(50),                      -- 关键词类型（从关键词推断）
  keyword_intent VARCHAR(50),                    -- 搜索意图（informational/commercial/transactional）

  -- 差异化信息（从关键词提取）
  differentiation_factors JSONB,                 -- {scenario, audience, platform, device}

  -- Meta信息
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  canonical_url TEXT,                            -- 规范URL

  -- 内容
  guide_intro TEXT,
  guide_content TEXT,                            -- Markdown格式
  faq_items JSONB DEFAULT '[]',

  -- 结构化数据
  schema_markup JSONB,                           -- Schema.org标记

  -- SEO评分
  seo_score INTEGER DEFAULT 0,
  keyword_density_score INTEGER DEFAULT 0,
  content_quality_score INTEGER DEFAULT 0,
  readability_score INTEGER DEFAULT 0,

  -- 去重检测
  content_similarity_score DECIMAL(5,2),         -- 与其他页面的相似度
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES public.seo_page_variants(id),

  -- 统计数据
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_on_page INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,

  -- 生成信息
  generated_by VARCHAR(50),                      -- ai, manual, hybrid
  ai_model VARCHAR(50),
  generation_metadata JSONB,                     -- 生成时的参数和配置

  -- 发布控制
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  unpublished_at TIMESTAMPTZ,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束：每个模板+语言+关键词只能有一个变体
  UNIQUE(template_id, language, target_keyword),

  -- 约束：同一模板+语言下，keyword_slug唯一
  UNIQUE(template_id, language, keyword_slug)
);

COMMENT ON TABLE public.seo_page_variants IS 'SEO页面变体 - 每个长尾关键词独立页面';
COMMENT ON COLUMN public.seo_page_variants.target_keyword IS '目标长尾关键词';
COMMENT ON COLUMN public.seo_page_variants.differentiation_factors IS '差异化因子：平台、受众、设备、场景等';
COMMENT ON COLUMN public.seo_page_variants.content_similarity_score IS '与其他页面的内容相似度（用于去重）';

-- 索引优化
CREATE INDEX idx_page_variants_template_lang ON public.seo_page_variants(template_id, language);
CREATE INDEX idx_page_variants_keyword_slug ON public.seo_page_variants(keyword_slug);
CREATE INDEX idx_page_variants_published ON public.seo_page_variants(is_published, published_at DESC);
CREATE INDEX idx_page_variants_seo_score ON public.seo_page_variants(seo_score DESC);
CREATE INDEX idx_page_variants_content_template ON public.seo_page_variants(content_template_id);
CREATE INDEX idx_page_variants_similarity ON public.seo_page_variants(content_similarity_score);
CREATE INDEX idx_page_variants_duplicate ON public.seo_page_variants(is_duplicate) WHERE is_duplicate = true;

-- GIN索引用于JSONB字段
CREATE INDEX idx_page_variants_diff_factors_gin ON public.seo_page_variants USING GIN(differentiation_factors);
CREATE INDEX idx_page_variants_faq_gin ON public.seo_page_variants USING GIN(faq_items);
CREATE INDEX idx_page_variants_schema_gin ON public.seo_page_variants USING GIN(schema_markup);
CREATE INDEX idx_page_variants_generation_meta_gin ON public.seo_page_variants USING GIN(generation_metadata);

-- ============================================
-- 3. 关键词库表（统一管理所有关键词）
-- ============================================
CREATE TABLE IF NOT EXISTS public.seo_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,

  -- 关键词信息
  keyword TEXT NOT NULL,
  keyword_slug VARCHAR(200) NOT NULL,

  -- 分析数据（可从第三方API获取）
  search_volume INTEGER,                         -- 月搜索量
  competition_level VARCHAR(20),                 -- low, medium, high
  keyword_difficulty INTEGER,                    -- 0-100
  cpc DECIMAL(10,2),                            -- 点击成本

  -- 关键词分类
  keyword_type VARCHAR(50),                      -- 从关键词推断的类型
  search_intent VARCHAR(50),                     -- informational, commercial, transactional

  -- 推荐的内容模板
  recommended_template_id UUID REFERENCES public.seo_content_templates(id),

  -- 差异化因子（自动提取）
  detected_scenario VARCHAR(100),                -- youtube, tiktok, instagram等
  detected_audience VARCHAR(100),                -- beginners, professionals等
  detected_platform VARCHAR(100),
  detected_device VARCHAR(100),

  -- 状态
  is_processed BOOLEAN DEFAULT false,            -- 是否已生成页面
  page_variant_id UUID REFERENCES public.seo_page_variants(id),

  -- 优先级
  priority INTEGER DEFAULT 0,                    -- 生成优先级（数字越大优先级越高）

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_id, language, keyword)
);

COMMENT ON TABLE public.seo_keywords IS '关键词库 - 统一管理所有待处理的长尾关键词';
COMMENT ON COLUMN public.seo_keywords.recommended_template_id IS '自动推荐的内容模板ID';
COMMENT ON COLUMN public.seo_keywords.is_processed IS '是否已生成对应的页面变体';

CREATE INDEX idx_keywords_template_lang ON public.seo_keywords(template_id, language);
CREATE INDEX idx_keywords_processed ON public.seo_keywords(is_processed);
CREATE INDEX idx_keywords_priority ON public.seo_keywords(priority DESC);
CREATE INDEX idx_keywords_recommended_template ON public.seo_keywords(recommended_template_id);

-- ============================================
-- 4. 批量生成任务表
-- ============================================
CREATE TABLE IF NOT EXISTS public.seo_batch_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 任务配置
  template_id UUID NOT NULL REFERENCES public.templates(id),
  content_template_id UUID NOT NULL REFERENCES public.seo_content_templates(id),
  language VARCHAR(10) NOT NULL,

  -- 关键词列表
  keywords TEXT[],                               -- 要处理的关键词列表

  -- 任务状态
  status VARCHAR(50) DEFAULT 'pending',          -- pending, processing, completed, failed, cancelled
  total_keywords INTEGER,
  processed_keywords INTEGER DEFAULT 0,
  successful INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,

  -- 配置
  config JSONB,                                  -- 生成配置（auto_publish, min_score等）

  -- 错误记录
  errors JSONB,

  -- 时间追踪
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.seo_batch_jobs IS '批量生成任务 - 追踪批量生成SEO页面的任务状态';
COMMENT ON COLUMN public.seo_batch_jobs.config IS '生成配置：{auto_publish, min_seo_score_to_publish, enable_duplicate_detection}';

CREATE INDEX idx_batch_jobs_status ON public.seo_batch_jobs(status);
CREATE INDEX idx_batch_jobs_template ON public.seo_batch_jobs(template_id);
CREATE INDEX idx_batch_jobs_created ON public.seo_batch_jobs(created_at DESC);

-- ============================================
-- 触发器
-- ============================================

-- 更新 updated_at 字段
CREATE TRIGGER update_content_templates_updated_at
  BEFORE UPDATE ON public.seo_content_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_page_variants_updated_at
  BEFORE UPDATE ON public.seo_page_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON public.seo_keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_batch_jobs_updated_at
  BEFORE UPDATE ON public.seo_batch_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- seo_content_templates: 所有人可查看，管理员可管理
ALTER TABLE public.seo_content_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Content templates are viewable by everyone"
  ON public.seo_content_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage content templates"
  ON public.seo_content_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- seo_page_variants: 已发布的公开可见，管理员可管理
ALTER TABLE public.seo_page_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published page variants are viewable by everyone"
  ON public.seo_page_variants
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can view all page variants"
  ON public.seo_page_variants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage page variants"
  ON public.seo_page_variants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- seo_keywords: 管理员可见和管理
ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage keywords"
  ON public.seo_keywords
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- seo_batch_jobs: 管理员可见和管理
ALTER TABLE public.seo_batch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage batch jobs"
  ON public.seo_batch_jobs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 辅助函数
-- ============================================

-- 获取模板的所有SEO页面变体
CREATE OR REPLACE FUNCTION get_template_page_variants(
  p_template_id UUID,
  p_language VARCHAR(10) DEFAULT 'en'
)
RETURNS TABLE (
  id UUID,
  template_id UUID,
  template_name TEXT,
  template_slug VARCHAR(100),
  content_template_id UUID,
  content_template_name VARCHAR(100),
  language VARCHAR(10),
  target_keyword TEXT,
  keyword_slug VARCHAR(200),
  meta_title TEXT,
  meta_description TEXT,
  seo_score INTEGER,
  page_views INTEGER,
  is_published BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.id,
    pv.template_id,
    t.name as template_name,
    t.slug as template_slug,
    pv.content_template_id,
    ct.name as content_template_name,
    pv.language,
    pv.target_keyword,
    pv.keyword_slug,
    pv.meta_title,
    pv.meta_description,
    pv.seo_score,
    pv.page_views,
    pv.is_published
  FROM public.seo_page_variants pv
  JOIN public.templates t ON t.id = pv.template_id
  JOIN public.seo_content_templates ct ON ct.id = pv.content_template_id
  WHERE pv.template_id = p_template_id
    AND pv.language = p_language
    AND pv.is_published = true
  ORDER BY pv.seo_score DESC, pv.page_views DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_template_page_variants IS '获取指定模板的所有已发布SEO页面变体';

-- 获取批量任务统计
CREATE OR REPLACE FUNCTION get_batch_job_stats(p_job_id UUID)
RETURNS TABLE (
  job_id UUID,
  status VARCHAR(50),
  total_keywords INTEGER,
  processed_keywords INTEGER,
  successful INTEGER,
  failed INTEGER,
  progress_percentage DECIMAL(5,2),
  estimated_remaining_seconds INTEGER
) AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_processed INTEGER;
  v_total INTEGER;
  v_elapsed_seconds INTEGER;
BEGIN
  SELECT
    bj.started_at,
    bj.processed_keywords,
    bj.total_keywords
  INTO v_started_at, v_processed, v_total
  FROM public.seo_batch_jobs bj
  WHERE bj.id = p_job_id;

  -- 计算已用时间（秒）
  v_elapsed_seconds := CASE
    WHEN v_started_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER
    ELSE 0
  END;

  RETURN QUERY
  SELECT
    bj.id as job_id,
    bj.status,
    bj.total_keywords,
    bj.processed_keywords,
    bj.successful,
    bj.failed,
    CASE
      WHEN bj.total_keywords > 0
      THEN ROUND((bj.processed_keywords::DECIMAL / bj.total_keywords) * 100, 2)
      ELSE 0
    END as progress_percentage,
    CASE
      WHEN v_processed > 0 AND v_elapsed_seconds > 0
      THEN ((v_total - v_processed) * (v_elapsed_seconds / v_processed))::INTEGER
      ELSE NULL
    END as estimated_remaining_seconds
  FROM public.seo_batch_jobs bj
  WHERE bj.id = p_job_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_batch_job_stats IS '获取批量任务的详细统计信息，包括进度百分比和预估剩余时间';

-- 记录页面访问（兼容新表）
CREATE OR REPLACE FUNCTION record_page_variant_view(
  p_variant_id UUID,
  p_is_unique_visitor BOOLEAN DEFAULT false
)
RETURNS void AS $$
BEGIN
  UPDATE public.seo_page_variants
  SET
    page_views = page_views + 1,
    unique_visitors = CASE
      WHEN p_is_unique_visitor THEN unique_visitors + 1
      ELSE unique_visitors
    END
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_page_variant_view IS '记录SEO页面变体的访问量';

-- ============================================
-- 初始化数据 - 插入3种内容模板定义
-- ============================================

-- 注意：实际的模板定义将在下一步单独插入
-- 这里只是创建表结构

-- ============================================
-- 完成
-- ============================================

-- 显示创建的表
SELECT
  'Table created: ' || table_name as message
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'seo_content_templates',
    'seo_page_variants',
    'seo_keywords',
    'seo_batch_jobs'
  );
