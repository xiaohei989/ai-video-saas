-- ==========================================
-- 管理后台功能函数集合
-- 包含统计、订单管理等管理功能
-- ==========================================

-- 1. 管理员仪表板统计函数（排除管理员数据）
-- 合并来源: final-admin-stats.sql, deploy-admin-stats-final.sql, exclude-admin-*.sql
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
      COALESCE(SUM(CASE WHEN p.role IS NULL OR p.role NOT IN ('admin', 'super_admin') THEN pm.amount_total / 100.0 ELSE 0 END), 0) AS total_revenue,
      -- 今日收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN pm.created_at >= CURRENT_DATE AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN pm.amount_total / 100.0 ELSE 0 END), 0) AS revenue_today,
      -- 本周收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN pm.created_at >= date_trunc('week', CURRENT_DATE) AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN pm.amount_total / 100.0 ELSE 0 END), 0) AS revenue_this_week,
      -- 本月收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN pm.created_at >= date_trunc('month', CURRENT_DATE) AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN pm.amount_total / 100.0 ELSE 0 END), 0) AS revenue_this_month
    FROM payment_records pm
    LEFT JOIN profiles p ON p.id = pm.user_id
    WHERE pm.status = 'succeeded'
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

-- 2. 订单管理函数
-- 来源: create-orders-functions.sql
CREATE OR REPLACE FUNCTION get_admin_orders(
  limit_count INT DEFAULT 50,
  offset_count INT DEFAULT 0,
  status_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  user_email TEXT,
  stripe_payment_intent_id TEXT,
  amount_total INTEGER,
  currency TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.user_id,
    p.email,
    pr.stripe_payment_intent_id,
    pr.amount_total,
    pr.currency,
    pr.status,
    pr.created_at,
    pr.updated_at
  FROM payment_records pr
  LEFT JOIN profiles p ON p.id = pr.user_id
  WHERE (status_filter IS NULL OR pr.status = status_filter)
    AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin'))
  ORDER BY pr.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- 3. 设置权限
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_orders(INT, INT, TEXT) TO authenticated;