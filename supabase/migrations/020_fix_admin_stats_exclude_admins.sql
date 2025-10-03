-- ============================================
-- 修复管理员统计函数 - 排除管理员和超级管理员
-- ============================================

-- 1. 删除所有旧函数
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS get_user_registration_trends(integer);
DROP FUNCTION IF EXISTS get_video_generation_trends(integer);
DROP FUNCTION IF EXISTS get_country_distribution();
DROP FUNCTION IF EXISTS get_subscription_distribution();
DROP FUNCTION IF EXISTS get_website_analytics(integer);

-- 2. 重新创建基础统计函数，排除管理员
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_users BIGINT,
  new_users_today BIGINT,
  new_users_this_week BIGINT,
  new_users_this_month BIGINT,
  total_revenue DECIMAL,
  subscription_revenue DECIMAL,
  credit_purchase_revenue DECIMAL,
  revenue_today DECIMAL,
  subscription_revenue_today DECIMAL,
  credit_purchase_revenue_today DECIMAL,
  revenue_this_week DECIMAL,
  subscription_revenue_this_week DECIMAL,
  credit_purchase_revenue_this_week DECIMAL,
  revenue_this_month DECIMAL,
  subscription_revenue_this_month DECIMAL,
  credit_purchase_revenue_this_month DECIMAL,
  active_subscriptions BIGINT,
  total_videos BIGINT,
  videos_today BIGINT,
  pending_tickets BIGINT,
  banned_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- 排除管理员和超级管理员
    (SELECT COUNT(*) FROM public.profiles WHERE role NOT IN ('admin', 'super_admin')) as total_users,
    (SELECT COUNT(*) FROM public.profiles WHERE role NOT IN ('admin', 'super_admin') AND DATE(created_at) = CURRENT_DATE) as new_users_today,
    (SELECT COUNT(*) FROM public.profiles WHERE role NOT IN ('admin', 'super_admin') AND created_at >= DATE_TRUNC('week', NOW())) as new_users_this_week,
    (SELECT COUNT(*) FROM public.profiles WHERE role NOT IN ('admin', 'super_admin') AND created_at >= DATE_TRUNC('month', NOW())) as new_users_this_month,

    -- 总收入
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded') as total_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND payment_type = 'subscription') as subscription_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND payment_type = 'credit_purchase') as credit_purchase_revenue,

    -- 今日收入
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND DATE(created_at) = CURRENT_DATE) as revenue_today,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND payment_type = 'subscription' AND DATE(created_at) = CURRENT_DATE) as subscription_revenue_today,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND payment_type = 'credit_purchase' AND DATE(created_at) = CURRENT_DATE) as credit_purchase_revenue_today,

    -- 本周收入
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('week', NOW())) as revenue_this_week,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND payment_type = 'subscription' AND created_at >= DATE_TRUNC('week', NOW())) as subscription_revenue_this_week,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND payment_type = 'credit_purchase' AND created_at >= DATE_TRUNC('week', NOW())) as credit_purchase_revenue_this_week,

    -- 本月收入
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('month', NOW())) as revenue_this_month,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND payment_type = 'subscription' AND created_at >= DATE_TRUNC('month', NOW())) as subscription_revenue_this_month,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND payment_type = 'credit_purchase' AND created_at >= DATE_TRUNC('month', NOW())) as credit_purchase_revenue_this_month,

    -- 其他统计
    (SELECT COUNT(*) FROM public.subscriptions s JOIN public.profiles p ON s.user_id = p.id WHERE s.status = 'active' AND p.role NOT IN ('admin', 'super_admin')) as active_subscriptions,
    (SELECT COUNT(*) FROM public.videos v JOIN public.profiles p ON v.user_id = p.id WHERE v.is_deleted = false AND p.role NOT IN ('admin', 'super_admin')) as total_videos,
    (SELECT COUNT(*) FROM public.videos v JOIN public.profiles p ON v.user_id = p.id WHERE v.is_deleted = false AND p.role NOT IN ('admin', 'super_admin') AND DATE(v.created_at) = CURRENT_DATE) as videos_today,
    (SELECT COALESCE(COUNT(*), 0) FROM public.support_tickets WHERE status IN ('open', 'in_progress')) as pending_tickets,
    (SELECT COUNT(*) FROM public.profiles WHERE is_banned = true AND role NOT IN ('admin', 'super_admin')) as banned_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 重新创建用户注册趋势函数，排除管理员
CREATE OR REPLACE FUNCTION get_user_registration_trends(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  registration_date DATE,
  user_count BIGINT,
  country TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as registration_date,
    COUNT(*) as user_count,
    COALESCE(registration_country, 'Unknown') as country
  FROM public.profiles
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND role NOT IN ('admin', 'super_admin')
  GROUP BY DATE(created_at), registration_country
  ORDER BY registration_date DESC, user_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 重新创建视频生成趋势函数，排除管理员
CREATE OR REPLACE FUNCTION get_video_generation_trends(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  video_date DATE,
  video_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(v.created_at) as video_date,
    COUNT(*) as video_count,
    COUNT(*) FILTER (WHERE v.status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE v.status = 'failed') as failed_count
  FROM public.videos v
  JOIN public.profiles p ON v.user_id = p.id
  WHERE v.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND v.is_deleted = false
    AND p.role NOT IN ('admin', 'super_admin')
  GROUP BY DATE(v.created_at)
  ORDER BY video_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 重新创建国家分布函数，排除管理员
CREATE OR REPLACE FUNCTION get_country_distribution()
RETURNS TABLE (
  country TEXT,
  user_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(registration_country, 'Unknown') as country,
    COUNT(*) as user_count
  FROM public.profiles
  WHERE role NOT IN ('admin', 'super_admin')
  GROUP BY registration_country
  ORDER BY user_count DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 重新创建订阅分布函数，排除管理员
CREATE OR REPLACE FUNCTION get_subscription_distribution()
RETURNS TABLE (
  tier TEXT,
  user_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(s.tier, 'free') as tier,
    COUNT(DISTINCT p.id) as user_count
  FROM public.profiles p
  LEFT JOIN public.subscriptions s ON p.id = s.user_id AND s.status = 'active'
  WHERE p.role NOT IN ('admin', 'super_admin')
  GROUP BY COALESCE(s.tier, 'free')
  ORDER BY user_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 重新创建网站访问统计函数，排除管理员访问
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

    -- 平均访问时长（排除管理员）
    (SELECT COALESCE(AVG(pv.time_on_page), 0)
     FROM public.page_views pv
     LEFT JOIN public.profiles p ON pv.user_id = p.id
     WHERE pv.created_at >= NOW() - (days_back || ' days')::INTERVAL
       AND pv.time_on_page IS NOT NULL
       AND (pv.user_id IS NULL OR p.role NOT IN ('admin', 'super_admin'))
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
