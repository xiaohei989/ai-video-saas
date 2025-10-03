-- ============================================
-- 修复网站访问统计函数 - 移除 time_on_page 字段引用
-- ============================================

DROP FUNCTION IF EXISTS get_website_analytics(integer);

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
    -- 总浏览量（排除管理员）
    (SELECT COUNT(*)
     FROM public.page_views pv
     LEFT JOIN public.profiles p ON pv.user_id = p.id
     WHERE pv.created_at >= NOW() - (days_back || ' days')::INTERVAL
       AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
    ) as total_page_views,

    -- 独立访客（排除管理员）
    (SELECT COUNT(DISTINCT COALESCE(pv.user_id::text, pv.session_id))
     FROM public.page_views pv
     LEFT JOIN public.profiles p ON pv.user_id = p.id
     WHERE pv.created_at >= NOW() - (days_back || ' days')::INTERVAL
       AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
    ) as unique_visitors,

    -- 总会话数（排除管理员）
    (SELECT COUNT(DISTINCT pv.session_id)
     FROM public.page_views pv
     LEFT JOIN public.profiles p ON pv.user_id = p.id
     WHERE pv.created_at >= NOW() - (days_back || ' days')::INTERVAL
       AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
    ) as total_sessions,

    -- 平均访问时长（从 user_sessions 表获取）
    (SELECT COALESCE(AVG(session_duration), 0)
     FROM public.user_sessions us
     LEFT JOIN public.profiles p ON us.user_id = p.id
     WHERE us.started_at >= NOW() - (days_back || ' days')::INTERVAL
       AND us.session_duration IS NOT NULL
       AND (us.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
    ) as avg_session_duration,

    -- 跳出率（排除管理员）
    (SELECT
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE (COUNT(*) FILTER (WHERE page_count = 1)::NUMERIC / COUNT(*)::NUMERIC * 100)
      END
     FROM (
       SELECT pv.session_id, COUNT(*) as page_count
       FROM public.page_views pv
       LEFT JOIN public.profiles p ON pv.user_id = p.id
       WHERE pv.created_at >= NOW() - (days_back || ' days')::INTERVAL
         AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
       GROUP BY pv.session_id
     ) session_counts
    ) as bounce_rate,

    -- 今日浏览量（排除管理员）
    (SELECT COUNT(*)
     FROM public.page_views pv
     LEFT JOIN public.profiles p ON pv.user_id = p.id
     WHERE DATE(pv.created_at) = CURRENT_DATE
       AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
    ) as page_views_today,

    -- 今日独立访客（排除管理员）
    (SELECT COUNT(DISTINCT COALESCE(pv.user_id::text, pv.session_id))
     FROM public.page_views pv
     LEFT JOIN public.profiles p ON pv.user_id = p.id
     WHERE DATE(pv.created_at) = CURRENT_DATE
       AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
    ) as unique_visitors_today,

    -- 本周浏览量（排除管理员）
    (SELECT COUNT(*)
     FROM public.page_views pv
     LEFT JOIN public.profiles p ON pv.user_id = p.id
     WHERE pv.created_at >= DATE_TRUNC('week', NOW())
       AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
    ) as page_views_this_week,

    -- 本周独立访客（排除管理员）
    (SELECT COUNT(DISTINCT COALESCE(pv.user_id::text, pv.session_id))
     FROM public.page_views pv
     LEFT JOIN public.profiles p ON pv.user_id = p.id
     WHERE pv.created_at >= DATE_TRUNC('week', NOW())
       AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
    ) as unique_visitors_this_week;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 修复热门页面函数 - 移除 time_on_page 字段引用
-- ============================================

DROP FUNCTION IF EXISTS get_popular_pages(integer, integer);

CREATE OR REPLACE FUNCTION get_popular_pages(
  days_back INTEGER DEFAULT 30,
  page_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  page_path TEXT,
  view_count BIGINT,
  unique_visitors BIGINT,
  avg_time_on_page NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.page_path,
    COUNT(*) as view_count,
    COUNT(DISTINCT COALESCE(pv.user_id::text, pv.session_id)) as unique_visitors,
    -- 使用 0 作为默认值，因为表中没有 time_on_page 字段
    0::NUMERIC as avg_time_on_page
  FROM public.page_views pv
  LEFT JOIN public.profiles p ON pv.user_id = p.id
  WHERE pv.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
  GROUP BY pv.page_path
  ORDER BY view_count DESC
  LIMIT page_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
