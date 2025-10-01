-- ============================================
-- 网站访问统计系统
-- Version: 017
-- Description: 添加网站访问统计功能
-- ============================================

-- ============================================
-- 1. 创建页面访问记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  device_type TEXT, -- mobile, tablet, desktop
  browser TEXT,
  os TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON public.page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON public.page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_path ON public.page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_country ON public.page_views(country);

-- ============================================
-- 2. 创建用户会话表
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  country TEXT,
  first_page TEXT,
  last_page TEXT,
  page_count INTEGER DEFAULT 0,
  session_duration INTEGER DEFAULT 0, -- seconds
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON public.user_sessions(started_at DESC);

-- ============================================
-- 3. 获取网站访问统计函数
-- ============================================
CREATE OR REPLACE FUNCTION get_website_analytics(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_page_views BIGINT,
  unique_visitors BIGINT,
  total_sessions BIGINT,
  avg_session_duration NUMERIC,
  bounce_rate NUMERIC,
  page_views_today BIGINT,
  unique_visitors_today BIGINT,
  page_views_this_week BIGINT,
  unique_visitors_this_week BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- 总页面浏览量
    (SELECT COUNT(*) FROM public.page_views WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL) as total_page_views,

    -- 独立访客数（基于session_id）
    (SELECT COUNT(DISTINCT session_id) FROM public.page_views WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL) as unique_visitors,

    -- 总会话数
    (SELECT COUNT(*) FROM public.user_sessions WHERE started_at >= NOW() - (days_back || ' days')::INTERVAL) as total_sessions,

    -- 平均会话时长（秒）
    (SELECT COALESCE(AVG(session_duration), 0) FROM public.user_sessions WHERE started_at >= NOW() - (days_back || ' days')::INTERVAL AND session_duration > 0) as avg_session_duration,

    -- 跳出率（只访问一个页面的会话比例）
    (SELECT
      CASE
        WHEN COUNT(*) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE page_count = 1)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        ELSE 0
      END
    FROM public.user_sessions
    WHERE started_at >= NOW() - (days_back || ' days')::INTERVAL) as bounce_rate,

    -- 今日页面浏览量
    (SELECT COUNT(*) FROM public.page_views WHERE DATE(created_at) = CURRENT_DATE) as page_views_today,

    -- 今日独立访客数
    (SELECT COUNT(DISTINCT session_id) FROM public.page_views WHERE DATE(created_at) = CURRENT_DATE) as unique_visitors_today,

    -- 本周页面浏览量
    (SELECT COUNT(*) FROM public.page_views WHERE created_at >= DATE_TRUNC('week', NOW())) as page_views_this_week,

    -- 本周独立访客数
    (SELECT COUNT(DISTINCT session_id) FROM public.page_views WHERE created_at >= DATE_TRUNC('week', NOW())) as unique_visitors_this_week;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. 获取页面访问趋势
-- ============================================
CREATE OR REPLACE FUNCTION get_page_view_trends(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  view_date DATE,
  page_views BIGINT,
  unique_visitors BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as view_date,
    COUNT(*) as page_views,
    COUNT(DISTINCT session_id) as unique_visitors
  FROM public.page_views
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY view_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 获取热门页面统计
-- ============================================
CREATE OR REPLACE FUNCTION get_popular_pages(
  days_back INTEGER DEFAULT 7,
  page_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  page_path TEXT,
  page_title TEXT,
  view_count BIGINT,
  unique_visitors BIGINT,
  avg_time_on_page NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.page_path,
    MAX(pv.page_title) as page_title,
    COUNT(*) as view_count,
    COUNT(DISTINCT pv.session_id) as unique_visitors,
    COALESCE(AVG(EXTRACT(EPOCH FROM (
      LEAD(pv.created_at) OVER (PARTITION BY pv.session_id ORDER BY pv.created_at) - pv.created_at
    ))), 0) as avg_time_on_page
  FROM public.page_views pv
  WHERE pv.created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY pv.page_path
  ORDER BY view_count DESC
  LIMIT page_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 获取访客地理分布
-- ============================================
CREATE OR REPLACE FUNCTION get_visitor_geo_distribution(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  country TEXT,
  visitor_count BIGINT,
  page_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(country, 'Unknown') as country,
    COUNT(DISTINCT session_id) as visitor_count,
    COUNT(*) as page_views
  FROM public.page_views
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND country IS NOT NULL
  GROUP BY country
  ORDER BY visitor_count DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. 获取设备类型分布
-- ============================================
CREATE OR REPLACE FUNCTION get_device_distribution(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  device_type TEXT,
  visitor_count BIGINT,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH device_stats AS (
    SELECT
      COALESCE(device_type, 'Unknown') as device_type,
      COUNT(DISTINCT session_id) as visitor_count
    FROM public.page_views
    WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
    GROUP BY device_type
  ),
  total_visitors AS (
    SELECT SUM(visitor_count) as total FROM device_stats
  )
  SELECT
    ds.device_type,
    ds.visitor_count,
    ROUND((ds.visitor_count::NUMERIC / tv.total::NUMERIC) * 100, 2) as percentage
  FROM device_stats ds, total_visitors tv
  ORDER BY ds.visitor_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. 获取流量来源分布
-- ============================================
CREATE OR REPLACE FUNCTION get_traffic_sources(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  referrer_domain TEXT,
  visitor_count BIGINT,
  page_views BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
      ELSE SUBSTRING(referrer FROM '(?:https?://)?(?:www\.)?([^/]+)')
    END as referrer_domain,
    COUNT(DISTINCT session_id) as visitor_count,
    COUNT(*) as page_views
  FROM public.page_views
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY referrer_domain
  ORDER BY visitor_count DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. 记录页面访问的RPC函数
-- ============================================
CREATE OR REPLACE FUNCTION record_page_view(
  p_session_id TEXT,
  p_page_path TEXT,
  p_page_title TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_page_view_id UUID;
  v_user_id UUID;
BEGIN
  -- 获取当前用户ID（如果已登录）
  v_user_id := auth.uid();

  -- 插入页面访问记录
  INSERT INTO public.page_views (
    user_id,
    session_id,
    page_path,
    page_title,
    referrer,
    user_agent,
    ip_address,
    country,
    city,
    device_type,
    browser,
    os
  ) VALUES (
    v_user_id,
    p_session_id,
    p_page_path,
    p_page_title,
    p_referrer,
    p_user_agent,
    p_ip_address::INET,
    p_country,
    p_city,
    p_device_type,
    p_browser,
    p_os
  ) RETURNING id INTO v_page_view_id;

  -- 更新或创建会话记录
  INSERT INTO public.user_sessions (
    session_id,
    user_id,
    ip_address,
    user_agent,
    country,
    first_page,
    last_page,
    page_count,
    started_at
  ) VALUES (
    p_session_id,
    v_user_id,
    p_ip_address::INET,
    p_user_agent,
    p_country,
    p_page_path,
    p_page_path,
    1,
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    last_page = p_page_path,
    page_count = user_sessions.page_count + 1,
    ended_at = NOW(),
    session_duration = EXTRACT(EPOCH FROM (NOW() - user_sessions.started_at))::INTEGER;

  RETURN v_page_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. 设置RLS策略
-- ============================================

-- 页面访问记录表的RLS策略
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- 允许所有人插入（用于追踪）
CREATE POLICY "Allow insert for all" ON public.page_views
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- 只允许管理员查看所有记录
CREATE POLICY "Admin can view all" ON public.page_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 用户会话表的RLS策略
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 允许所有人插入和更新（用于追踪）
CREATE POLICY "Allow insert for all" ON public.user_sessions
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow update for all" ON public.user_sessions
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 只允许管理员查看所有记录
CREATE POLICY "Admin can view all" ON public.user_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 完成
-- ============================================