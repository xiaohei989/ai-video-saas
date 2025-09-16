-- 更新管理员统计函数，分离订阅收入和积分购买收入
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();

CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE(
  total_users bigint,
  new_users_today bigint,
  new_users_this_week bigint,
  new_users_this_month bigint,
  total_revenue numeric,
  subscription_revenue numeric,
  credit_purchase_revenue numeric,
  revenue_today numeric,
  subscription_revenue_today numeric,
  credit_purchase_revenue_today numeric,
  revenue_this_week numeric,
  subscription_revenue_this_week numeric,
  credit_purchase_revenue_this_week numeric,
  revenue_this_month numeric,
  subscription_revenue_this_month numeric,
  credit_purchase_revenue_this_month numeric,
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
      
      -- 订阅收入（总计）
      COALESCE(SUM(CASE 
        WHEN (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) 
             AND (py.description = '订阅支付' OR py.metadata->>'type' = 'subscription')
        THEN py.amount ELSE 0 END), 0) AS subscription_revenue,
      
      -- 积分购买收入（总计）
      COALESCE(SUM(CASE 
        WHEN (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) 
             AND (py.description = '积分购买' OR py.metadata->>'type' = 'credit_purchase')
        THEN py.amount ELSE 0 END), 0) AS credit_purchase_revenue,
      
      -- 今日收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN py.created_at >= CURRENT_DATE AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN py.amount ELSE 0 END), 0) AS revenue_today,
      
      -- 今日订阅收入
      COALESCE(SUM(CASE 
        WHEN py.created_at >= CURRENT_DATE 
             AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) 
             AND (py.description = '订阅支付' OR py.metadata->>'type' = 'subscription')
        THEN py.amount ELSE 0 END), 0) AS subscription_revenue_today,
      
      -- 今日积分购买收入
      COALESCE(SUM(CASE 
        WHEN py.created_at >= CURRENT_DATE 
             AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) 
             AND (py.description = '积分购买' OR py.metadata->>'type' = 'credit_purchase')
        THEN py.amount ELSE 0 END), 0) AS credit_purchase_revenue_today,
      
      -- 本周收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN py.created_at >= date_trunc('week', CURRENT_DATE) AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN py.amount ELSE 0 END), 0) AS revenue_this_week,
      
      -- 本周订阅收入
      COALESCE(SUM(CASE 
        WHEN py.created_at >= date_trunc('week', CURRENT_DATE) 
             AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) 
             AND (py.description = '订阅支付' OR py.metadata->>'type' = 'subscription')
        THEN py.amount ELSE 0 END), 0) AS subscription_revenue_this_week,
      
      -- 本周积分购买收入
      COALESCE(SUM(CASE 
        WHEN py.created_at >= date_trunc('week', CURRENT_DATE) 
             AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) 
             AND (py.description = '积分购买' OR py.metadata->>'type' = 'credit_purchase')
        THEN py.amount ELSE 0 END), 0) AS credit_purchase_revenue_this_week,
      
      -- 本月收入（排除管理员支付）
      COALESCE(SUM(CASE WHEN py.created_at >= date_trunc('month', CURRENT_DATE) AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) THEN py.amount ELSE 0 END), 0) AS revenue_this_month,
      
      -- 本月订阅收入
      COALESCE(SUM(CASE 
        WHEN py.created_at >= date_trunc('month', CURRENT_DATE) 
             AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) 
             AND (py.description = '订阅支付' OR py.metadata->>'type' = 'subscription')
        THEN py.amount ELSE 0 END), 0) AS subscription_revenue_this_month,
      
      -- 本月积分购买收入
      COALESCE(SUM(CASE 
        WHEN py.created_at >= date_trunc('month', CURRENT_DATE) 
             AND (p.role IS NULL OR p.role NOT IN ('admin', 'super_admin')) 
             AND (py.description = '积分购买' OR py.metadata->>'type' = 'credit_purchase')
        THEN py.amount ELSE 0 END), 0) AS credit_purchase_revenue_this_month
      
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
    r.subscription_revenue,
    r.credit_purchase_revenue,
    r.revenue_today,
    r.subscription_revenue_today,
    r.credit_purchase_revenue_today,
    r.revenue_this_week,
    r.subscription_revenue_this_week,
    r.credit_purchase_revenue_this_week,
    r.revenue_this_month,
    r.subscription_revenue_this_month,
    r.credit_purchase_revenue_this_month,
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