-- ============================================
-- 修复管理员统计函数 - 移除 payment_type 字段引用
-- ============================================

DROP FUNCTION IF EXISTS get_admin_dashboard_stats();

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

    -- 总收入（所有支付）
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded') as total_revenue,

    -- 订阅收入（从 subscriptions 表关联的支付）
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.subscriptions s ON p.user_id = s.user_id
     WHERE p.status = 'succeeded'
       AND p.description ILIKE '%subscription%'
    ) as subscription_revenue,

    -- 积分购买收入（其他支付）
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     WHERE p.status = 'succeeded'
       AND (p.description NOT ILIKE '%subscription%' OR p.description IS NULL)
    ) as credit_purchase_revenue,

    -- 今日收入
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND DATE(created_at) = CURRENT_DATE) as revenue_today,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.subscriptions s ON p.user_id = s.user_id
     WHERE p.status = 'succeeded'
       AND p.description ILIKE '%subscription%'
       AND DATE(p.created_at) = CURRENT_DATE
    ) as subscription_revenue_today,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     WHERE p.status = 'succeeded'
       AND (p.description NOT ILIKE '%subscription%' OR p.description IS NULL)
       AND DATE(p.created_at) = CURRENT_DATE
    ) as credit_purchase_revenue_today,

    -- 本周收入
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('week', NOW())) as revenue_this_week,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.subscriptions s ON p.user_id = s.user_id
     WHERE p.status = 'succeeded'
       AND p.description ILIKE '%subscription%'
       AND p.created_at >= DATE_TRUNC('week', NOW())
    ) as subscription_revenue_this_week,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     WHERE p.status = 'succeeded'
       AND (p.description NOT ILIKE '%subscription%' OR p.description IS NULL)
       AND p.created_at >= DATE_TRUNC('week', NOW())
    ) as credit_purchase_revenue_this_week,

    -- 本月收入
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('month', NOW())) as revenue_this_month,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.subscriptions s ON p.user_id = s.user_id
     WHERE p.status = 'succeeded'
       AND p.description ILIKE '%subscription%'
       AND p.created_at >= DATE_TRUNC('month', NOW())
    ) as subscription_revenue_this_month,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     WHERE p.status = 'succeeded'
       AND (p.description NOT ILIKE '%subscription%' OR p.description IS NULL)
       AND p.created_at >= DATE_TRUNC('month', NOW())
    ) as credit_purchase_revenue_this_month,

    -- 其他统计
    (SELECT COUNT(*) FROM public.subscriptions s JOIN public.profiles p ON s.user_id = p.id WHERE s.status = 'active' AND p.role NOT IN ('admin', 'super_admin')) as active_subscriptions,
    (SELECT COUNT(*) FROM public.videos v JOIN public.profiles p ON v.user_id = p.id WHERE v.is_deleted = false AND p.role NOT IN ('admin', 'super_admin')) as total_videos,
    (SELECT COUNT(*) FROM public.videos v JOIN public.profiles p ON v.user_id = p.id WHERE v.is_deleted = false AND p.role NOT IN ('admin', 'super_admin') AND DATE(v.created_at) = CURRENT_DATE) as videos_today,
    (SELECT COALESCE(COUNT(*), 0) FROM public.support_tickets WHERE status IN ('open', 'in_progress')) as pending_tickets,
    (SELECT COUNT(*) FROM public.profiles WHERE is_banned = true AND role NOT IN ('admin', 'super_admin')) as banned_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
