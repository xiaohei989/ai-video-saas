-- ============================================
-- Template SEO Guides System - Safe Version
-- Version: 022 (Safe)
-- Description: SEO优化的模板用户指南系统（安全版本，避免重复创建）
-- ============================================

-- 创建 template_seo_guides 表
CREATE TABLE IF NOT EXISTS public.template_seo_guides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL, -- en, zh, ja, ko, es, de, fr, ar

  -- 长尾关键词（JSON数组）
  long_tail_keywords JSONB DEFAULT '[]',
  -- 示例: ["asmr food videos", "food asmr videos no talking", "how to make asmr food videos"]

  -- 主要关键词（用于页面标题和H1）
  primary_keyword TEXT,
  secondary_keywords TEXT[] DEFAULT '{}', -- 次要关键词数组

  -- Meta标签优化
  meta_title TEXT, -- 建议55-60字符
  meta_description TEXT, -- 建议150-155字符
  meta_keywords TEXT, -- 逗号分隔的关键词

  -- 用户指南内容（Markdown格式）
  guide_content TEXT,
  guide_intro TEXT, -- 简介段落（前100-150字）

  -- FAQ内容（用于Schema.org FAQPage）
  faq_items JSONB DEFAULT '[]',
  -- 示例: [{"question": "What are ASMR food videos?", "answer": "ASMR food videos..."}]

  -- SEO评分和统计
  seo_score INTEGER DEFAULT 0, -- 0-100分
  keyword_density JSONB DEFAULT '{}', -- 关键词密度统计
  content_quality_score INTEGER DEFAULT 0, -- 内容质量评分
  readability_score INTEGER DEFAULT 0, -- 可读性评分

  -- 页面访问统计
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_on_page INTEGER DEFAULT 0, -- 秒
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0, -- 转化率（访问者->使用模板）

  -- 搜索引擎数据
  google_indexed BOOLEAN DEFAULT false,
  google_indexed_at TIMESTAMPTZ,
  current_rank JSONB DEFAULT '{}', -- 各关键词当前排名 {"keyword": rank}

  -- 生成和更新信息
  generated_by VARCHAR(50), -- 'ai', 'manual', 'hybrid'
  ai_model VARCHAR(50), -- 使用的AI模型名称
  last_seo_audit_at TIMESTAMPTZ,
  last_optimized_at TIMESTAMPTZ,

  -- 内容版本控制
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES public.template_seo_guides(id),

  -- 发布控制
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  unpublished_at TIMESTAMPTZ,

  -- 审核状态
  review_status VARCHAR(20) DEFAULT 'draft', -- draft, pending_review, approved, rejected
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'template_seo_guides_template_id_language_key'
  ) THEN
    ALTER TABLE public.template_seo_guides
    ADD CONSTRAINT template_seo_guides_template_id_language_key
    UNIQUE(template_id, language);
  END IF;
END $$;

-- ============================================
-- 创建索引优化查询性能（安全版本）
-- ============================================

DO $$
BEGIN
  -- 普通索引
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_template_id') THEN
    CREATE INDEX idx_seo_guides_template_id ON public.template_seo_guides(template_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_language') THEN
    CREATE INDEX idx_seo_guides_language ON public.template_seo_guides(language);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_published') THEN
    CREATE INDEX idx_seo_guides_published ON public.template_seo_guides(is_published, published_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_seo_score') THEN
    CREATE INDEX idx_seo_guides_seo_score ON public.template_seo_guides(seo_score DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_review_status') THEN
    CREATE INDEX idx_seo_guides_review_status ON public.template_seo_guides(review_status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_page_views') THEN
    CREATE INDEX idx_seo_guides_page_views ON public.template_seo_guides(page_views DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_template_lang') THEN
    CREATE INDEX idx_seo_guides_template_lang ON public.template_seo_guides(template_id, language);
  END IF;

  -- GIN索引
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_keywords_gin') THEN
    CREATE INDEX idx_seo_guides_keywords_gin ON public.template_seo_guides USING GIN(long_tail_keywords);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_guides_faq_gin') THEN
    CREATE INDEX idx_seo_guides_faq_gin ON public.template_seo_guides USING GIN(faq_items);
  END IF;
END $$;

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

ALTER TABLE public.template_seo_guides ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Published guides are viewable by everyone" ON public.template_seo_guides;
DROP POLICY IF EXISTS "Admins can view all guides" ON public.template_seo_guides;
DROP POLICY IF EXISTS "Admins can create guides" ON public.template_seo_guides;
DROP POLICY IF EXISTS "Admins can update guides" ON public.template_seo_guides;
DROP POLICY IF EXISTS "Admins can delete guides" ON public.template_seo_guides;

-- 公开发布的指南所有人可见
CREATE POLICY "Published guides are viewable by everyone" ON public.template_seo_guides
  FOR SELECT USING (is_published = true);

-- 管理员可以查看所有指南
CREATE POLICY "Admins can view all guides" ON public.template_seo_guides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以创建指南
CREATE POLICY "Admins can create guides" ON public.template_seo_guides
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以更新指南
CREATE POLICY "Admins can update guides" ON public.template_seo_guides
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 管理员可以删除指南
CREATE POLICY "Admins can delete guides" ON public.template_seo_guides
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 触发器
-- ============================================

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS update_seo_guides_updated_at ON public.template_seo_guides;
DROP TRIGGER IF EXISTS trigger_increment_seo_guide_version ON public.template_seo_guides;

-- 更新 updated_at 字段
CREATE TRIGGER update_seo_guides_updated_at
  BEFORE UPDATE ON public.template_seo_guides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 自动增加版本号
CREATE OR REPLACE FUNCTION increment_seo_guide_version()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果内容被修改，增加版本号
  IF OLD.guide_content IS DISTINCT FROM NEW.guide_content
     OR OLD.long_tail_keywords IS DISTINCT FROM NEW.long_tail_keywords THEN
    NEW.version = OLD.version + 1;
    NEW.last_optimized_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_seo_guide_version
  BEFORE UPDATE ON public.template_seo_guides
  FOR EACH ROW
  EXECUTE FUNCTION increment_seo_guide_version();

-- ============================================
-- 辅助函数
-- ============================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_template_seo_guide(UUID, VARCHAR);
DROP FUNCTION IF EXISTS get_seo_guides_stats();
DROP FUNCTION IF EXISTS record_guide_page_view(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS update_seo_score(UUID, INTEGER, INTEGER, INTEGER);

-- 获取模板的SEO指南（指定语言）
CREATE OR REPLACE FUNCTION get_template_seo_guide(
  p_template_id UUID,
  p_language VARCHAR(10) DEFAULT 'en'
)
RETURNS TABLE (
  id UUID,
  template_id UUID,
  template_name TEXT,
  template_slug VARCHAR(100),
  language VARCHAR(10),
  primary_keyword TEXT,
  long_tail_keywords JSONB,
  meta_title TEXT,
  meta_description TEXT,
  guide_content TEXT,
  guide_intro TEXT,
  faq_items JSONB,
  seo_score INTEGER,
  is_published BOOLEAN,
  page_views INTEGER,
  template JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sg.id,
    sg.template_id,
    t.name as template_name,
    t.slug as template_slug,
    sg.language,
    sg.primary_keyword,
    sg.long_tail_keywords,
    sg.meta_title,
    sg.meta_description,
    sg.guide_content,
    sg.guide_intro,
    sg.faq_items,
    sg.seo_score,
    sg.is_published,
    sg.page_views,
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'slug', t.slug,
      'thumbnail_url', t.thumbnail_url,
      'description', t.description,
      'category', t.category
    ) as template
  FROM public.template_seo_guides sg
  JOIN public.templates t ON t.id = sg.template_id
  WHERE sg.template_id = p_template_id
    AND sg.language = p_language
    AND sg.is_published = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 获取所有模板的SEO指南统计
CREATE OR REPLACE FUNCTION get_seo_guides_stats()
RETURNS TABLE (
  total_guides BIGINT,
  published_guides BIGINT,
  draft_guides BIGINT,
  avg_seo_score NUMERIC,
  total_page_views BIGINT,
  guides_by_language JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_guides,
    COUNT(*) FILTER (WHERE is_published = true)::BIGINT as published_guides,
    COUNT(*) FILTER (WHERE review_status = 'draft')::BIGINT as draft_guides,
    ROUND(AVG(seo_score), 2) as avg_seo_score,
    SUM(page_views)::BIGINT as total_page_views,
    jsonb_object_agg(language, count) as guides_by_language
  FROM (
    SELECT
      language,
      COUNT(*)::INTEGER as count
    FROM public.template_seo_guides
    GROUP BY language
  ) lang_counts;
END;
$$ LANGUAGE plpgsql;

-- 记录页面访问
CREATE OR REPLACE FUNCTION record_guide_page_view(
  p_guide_id UUID,
  p_is_unique_visitor BOOLEAN DEFAULT false
)
RETURNS void AS $$
BEGIN
  UPDATE public.template_seo_guides
  SET
    page_views = page_views + 1,
    unique_visitors = CASE
      WHEN p_is_unique_visitor THEN unique_visitors + 1
      ELSE unique_visitors
    END
  WHERE id = p_guide_id;
END;
$$ LANGUAGE plpgsql;

-- 更新SEO评分
CREATE OR REPLACE FUNCTION update_seo_score(
  p_guide_id UUID,
  p_keyword_density_score INTEGER,
  p_content_quality_score INTEGER,
  p_readability_score INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_total_score INTEGER;
BEGIN
  -- 计算总分（加权平均）
  v_total_score := ROUND(
    (p_keyword_density_score * 0.3 +
     p_content_quality_score * 0.4 +
     p_readability_score * 0.3)::NUMERIC
  );

  -- 更新数据库
  UPDATE public.template_seo_guides
  SET
    seo_score = v_total_score,
    content_quality_score = p_content_quality_score,
    readability_score = p_readability_score,
    last_seo_audit_at = NOW()
  WHERE id = p_guide_id;

  RETURN v_total_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 创建视图：热门SEO指南
-- ============================================

DROP VIEW IF EXISTS popular_seo_guides;

CREATE OR REPLACE VIEW popular_seo_guides AS
SELECT
  sg.id,
  sg.template_id,
  t.name as template_name,
  t.slug as template_slug,
  t.thumbnail_url,
  sg.language,
  sg.primary_keyword,
  sg.meta_title,
  sg.seo_score,
  sg.page_views,
  sg.unique_visitors,
  sg.conversion_rate,
  sg.published_at,
  -- 计算综合人气分数
  (sg.page_views * 0.4 + sg.unique_visitors * 0.3 + sg.seo_score * 0.3) as popularity_score
FROM public.template_seo_guides sg
JOIN public.templates t ON t.id = sg.template_id
WHERE sg.is_published = true
ORDER BY popularity_score DESC;

-- ============================================
-- 添加注释
-- ============================================

COMMENT ON TABLE public.template_seo_guides IS 'SEO优化的模板用户指南系统 - 存储多语言指南、关键词和Meta标签';
COMMENT ON COLUMN public.template_seo_guides.long_tail_keywords IS '长尾关键词JSON数组，用于SEO优化';
COMMENT ON COLUMN public.template_seo_guides.guide_content IS 'Markdown格式的用户指南内容';
COMMENT ON COLUMN public.template_seo_guides.faq_items IS 'FAQ问答对JSON数组，用于Schema.org FAQPage';
COMMENT ON COLUMN public.template_seo_guides.seo_score IS 'SEO综合评分 0-100，基于关键词密度、内容质量、可读性';

-- ============================================
-- 完成
-- ============================================
