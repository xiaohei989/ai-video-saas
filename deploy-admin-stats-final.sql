-- 最终版本：排除管理员数据的统计函数部署
-- 此文件包含所有修复，确保统计数据排除管理员用户

-- 删除现有函数
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS get_sales_trends(integer);
DROP FUNCTION IF EXISTS get_subscription_distribution();
DROP FUNCTION IF EXISTS get_user_registration_trends(integer);
DROP FUNCTION IF EXISTS get_video_generation_trends(integer);

-- 1. 主要仪表板统计函数（排除管理员）
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE(
  total_users bigint,
  new_users_today bigint,
  new_users_this_week bigint,
  new_users_this_month bigint,
  total_revenue numeric,
  revenue_today numeric,
  revenue_this_week numeric,
  revenue_this_month numeric,
  active_subscriptions bigint,
  total_videos bigint,
  videos_today bigint,
  pending_tickets bigint,
  banned_users bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      -- 总用户数（排除管理员）
      COUNT(CASE WHEN p.role IS NULL OR p.role NOT IN ('admin', 'super_admin') THEN 1 END) AS total_users,
      -- 今日新用户（排除管理员）
      COUNT(CASE WHEN p.created_at >= CURRENT_DATE AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN 1 END) AS new_users_today,
      -- 本周新用户（排除管理员）
      COUNT(CASE WHEN p.created_at >= date_trunc('week', CURRENT_DATE) AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN 1 END) AS new_users_this_week,
      -- 本月新用户（排除管理员）
      COUNT(CASE WHEN p.created_at >= date_trunc('month', CURRENT_DATE) AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN 1 END) AS new_users_this_month,
      -- 被封用户（排除管理员）
      COUNT(CASE WHEN p.is_banned = true AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN 1 END) AS banned_users
    FROM profiles p
  ),
  revenue_stats AS (
    SELECT
      -- 总收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN p.role IS NULL OR p.role NOT IN ('admin', 'super_admin') THEN py.amount ELSE 0 END), 0) AS total_revenue,
      -- 今日收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN py.created_at >= CURRENT_DATE AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN py.amount ELSE 0 END), 0) AS revenue_today,
      -- 本周收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN py.created_at >= date_trunc('week', CURRENT_DATE) AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN py.amount ELSE 0 END), 0) AS revenue_this_week,
      -- 本月收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN py.created_at >= date_trunc('month', CURRENT_DATE) AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN py.amount ELSE 0 END), 0) AS revenue_this_month
    FROM payments py
    LEFT JOIN profiles p ON p.id = py.user_id
    WHERE py.status = 'succeeded'
  ),
  subscription_stats AS (
    SELECT
      -- 活跃订阅数（排除管理员）
      COUNT(*) AS active_subscriptions
    FROM subscriptions s
    LEFT JOIN profiles p ON p.id = s.user_id
    WHERE s.status = 'active' AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin'))
  ),
  video_stats AS (
    SELECT
      -- 总视频数（排除管理员）
      COUNT(*) AS total_videos,
      -- 今日视频（排除管理员）
      COUNT(CASE WHEN v.created_at >= CURRENT_DATE THEN 1 END) AS videos_today
    FROM videos v
    LEFT JOIN profiles p ON p.id = v.user_id
    WHERE p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')
  ),
  ticket_stats AS (
    SELECT
      COUNT(*) AS pending_tickets
    FROM support_tickets
    WHERE status = 'open'
  )
  SELECT 
    u.total_users,
    u.new_users_today,
    u.new_users_this_week,
    u.new_users_this_month,
    r.total_revenue,
    r.revenue_today,
    r.revenue_this_week,
    r.revenue_this_month,
    s.active_subscriptions,
    v.total_videos,
    v.videos_today,
    t.pending_tickets,
    u.banned_users
  FROM user_stats u
  CROSS JOIN revenue_stats r
  CROSS JOIN subscription_stats s
  CROSS JOIN video_stats v
  CROSS JOIN ticket_stats t;
END;
$$ LANGUAGE plpgsql;

-- 2. 销售趋势函数（排除管理员）
CREATE OR REPLACE FUNCTION get_sales_trends(days_back integer DEFAULT 30)
RETURNS TABLE(
  payment_date date,
  daily_revenue numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    py.created_at::date as payment_date,
    SUM(py.amount) as daily_revenue
  FROM payments py
  LEFT JOIN profiles p ON p.id = py.user_id
  WHERE py.status = 'succeeded'
    AND py.created_at >= (CURRENT_DATE - INTERVAL '1 day' * days_back)
    AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin'))
  GROUP BY py.created_at::date
  ORDER BY payment_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. 订阅分布函数（排除管理员）
CREATE OR REPLACE FUNCTION get_subscription_distribution()
RETURNS TABLE(
  tier text,
  user_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH subscription_tiers AS (
    SELECT 
      CASE 
        WHEN s.tier IS NULL THEN 'free'
        ELSE s.tier::text
      END as tier,
      COUNT(*) as user_count
    FROM profiles p
    LEFT JOIN subscriptions s ON p.id = s.user_id AND s.status = 'active'
    WHERE p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')
    GROUP BY 
      CASE 
        WHEN s.tier IS NULL THEN 'free'
        ELSE s.tier::text
      END
  )
  SELECT st.tier, st.user_count
  FROM subscription_tiers st
  ORDER BY st.user_count DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. 用户注册趋势函数（排除管理员）
CREATE OR REPLACE FUNCTION get_user_registration_trends(days_back integer DEFAULT 30)
RETURNS TABLE(
  registration_date date,
  user_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.created_at::date as registration_date,
    COUNT(*) as user_count
  FROM profiles p
  WHERE p.created_at >= (CURRENT_DATE - INTERVAL '1 day' * days_back)
    AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin'))
  GROUP BY p.created_at::date
  ORDER BY registration_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 5. 视频生成趋势函数（排除管理员）
CREATE OR REPLACE FUNCTION get_video_generation_trends(days_back integer DEFAULT 30)
RETURNS TABLE(
  video_date date,
  video_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.created_at::date as video_date,
    COUNT(*) as video_count
  FROM videos v
  LEFT JOIN profiles p ON p.id = v.user_id
  WHERE v.created_at >= (CURRENT_DATE - INTERVAL '1 day' * days_back)
    AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin'))
  GROUP BY v.created_at::date
  ORDER BY video_date DESC;
END;
$$ LANGUAGE plpgsql;