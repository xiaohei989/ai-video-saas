-- ============================================
-- 管理员统计功能补充
-- Version: 010
-- Description: 添加管理员统计所需的RPC函数
-- ============================================

-- ============================================
-- 1. 可疑IP检测函数
-- ============================================
CREATE OR REPLACE FUNCTION get_suspicious_ips(
  hours_back INTEGER DEFAULT 24,
  min_attempts INTEGER DEFAULT 5
)
RETURNS TABLE (
  ip_address INET,
  attempt_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ira.ip_address,
    COUNT(*) as attempt_count
  FROM public.ip_registration_attempts ira
  WHERE ira.created_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY ira.ip_address
  HAVING COUNT(*) >= min_attempts
  ORDER BY attempt_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. 积分异常检测函数
-- ============================================
CREATE OR REPLACE FUNCTION get_credit_anomalies(
  hours_back INTEGER DEFAULT 24,
  min_reward_amount INTEGER DEFAULT 1000
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  email TEXT,
  total_rewards BIGINT,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.user_id,
    p.username,
    p.email,
    SUM(CASE WHEN ct.type = 'reward' THEN ct.amount ELSE 0 END) as total_rewards,
    COUNT(*) as transaction_count
  FROM public.credit_transactions ct
  INNER JOIN public.profiles p ON p.id = ct.user_id
  WHERE ct.created_at >= NOW() - (hours_back || ' hours')::INTERVAL
  GROUP BY ct.user_id, p.username, p.email
  HAVING SUM(CASE WHEN ct.type = 'reward' THEN ct.amount ELSE 0 END) >= min_reward_amount
  ORDER BY total_rewards DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. 优化现有的管理员统计函数
-- ============================================
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_users BIGINT,
  new_users_today BIGINT,
  new_users_this_week BIGINT,
  new_users_this_month BIGINT,
  total_revenue DECIMAL,
  revenue_today DECIMAL,
  revenue_this_week DECIMAL,
  revenue_this_month DECIMAL,
  active_subscriptions BIGINT,
  total_videos BIGINT,
  videos_today BIGINT,
  pending_tickets BIGINT,
  banned_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles) as total_users,
    (SELECT COUNT(*) FROM public.profiles WHERE DATE(created_at) = CURRENT_DATE) as new_users_today,
    (SELECT COUNT(*) FROM public.profiles WHERE created_at >= DATE_TRUNC('week', NOW())) as new_users_this_week,
    (SELECT COUNT(*) FROM public.profiles WHERE created_at >= DATE_TRUNC('month', NOW())) as new_users_this_month,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded') as total_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND DATE(created_at) = CURRENT_DATE) as revenue_today,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('week', NOW())) as revenue_this_week,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('month', NOW())) as revenue_this_month,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active') as active_subscriptions,
    (SELECT COUNT(*) FROM public.videos WHERE is_deleted = false) as total_videos,
    (SELECT COUNT(*) FROM public.videos WHERE is_deleted = false AND DATE(created_at) = CURRENT_DATE) as videos_today,
    (SELECT COALESCE(COUNT(*), 0) FROM public.support_tickets WHERE status IN ('open', 'in_progress')) as pending_tickets,
    (SELECT COUNT(*) FROM public.profiles WHERE is_banned = true) as banned_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. 用户注册趋势函数
-- ============================================
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
  GROUP BY DATE(created_at), registration_country
  ORDER BY registration_date DESC, user_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 销售趋势函数
-- ============================================
CREATE OR REPLACE FUNCTION get_sales_trends(
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  payment_date DATE,
  daily_revenue DECIMAL,
  payment_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as payment_date,
    SUM(amount) as daily_revenue,
    COUNT(*) as payment_count
  FROM public.payments
  WHERE status = 'succeeded' 
    AND created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY payment_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 视频生成趋势函数
-- ============================================
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
    DATE(created_at) as video_date,
    COUNT(*) as video_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count
  FROM public.videos
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND is_deleted = false
  GROUP BY DATE(created_at)
  ORDER BY video_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. 国家分布统计函数
-- ============================================
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
  WHERE registration_country IS NOT NULL
  GROUP BY registration_country
  ORDER BY user_count DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. 订阅分布统计函数
-- ============================================
CREATE OR REPLACE FUNCTION get_subscription_distribution()
RETURNS TABLE (
  tier TEXT,
  user_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(s.tier::TEXT, 'free') as tier,
    COUNT(*) as user_count
  FROM public.profiles p
  LEFT JOIN public.subscriptions s ON s.user_id = p.id AND s.status = 'active'
  GROUP BY s.tier
  ORDER BY user_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 完成
-- ============================================