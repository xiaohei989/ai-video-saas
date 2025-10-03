-- ============================================
-- 修复收入统计 - 正确区分订阅和积分购买
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

    -- 总收入（排除管理员的支付）
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND pr.role NOT IN ('admin', 'super_admin')
    ) as total_revenue,

    -- 订阅收入（排除管理员）
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND p.description = '订阅支付'
       AND pr.role NOT IN ('admin', 'super_admin')
    ) as subscription_revenue,

    -- 积分购买收入（排除管理员）
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND p.description = '积分购买'
       AND pr.role NOT IN ('admin', 'super_admin')
    ) as credit_purchase_revenue,

    -- 今日收入（排除管理员）
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND pr.role NOT IN ('admin', 'super_admin')
       AND DATE(p.created_at) = CURRENT_DATE
    ) as revenue_today,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND p.description = '订阅支付'
       AND pr.role NOT IN ('admin', 'super_admin')
       AND DATE(p.created_at) = CURRENT_DATE
    ) as subscription_revenue_today,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND p.description = '积分购买'
       AND pr.role NOT IN ('admin', 'super_admin')
       AND DATE(p.created_at) = CURRENT_DATE
    ) as credit_purchase_revenue_today,

    -- 本周收入（排除管理员）
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND pr.role NOT IN ('admin', 'super_admin')
       AND p.created_at >= DATE_TRUNC('week', NOW())
    ) as revenue_this_week,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND p.description = '订阅支付'
       AND pr.role NOT IN ('admin', 'super_admin')
       AND p.created_at >= DATE_TRUNC('week', NOW())
    ) as subscription_revenue_this_week,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND p.description = '积分购买'
       AND pr.role NOT IN ('admin', 'super_admin')
       AND p.created_at >= DATE_TRUNC('week', NOW())
    ) as credit_purchase_revenue_this_week,

    -- 本月收入（排除管理员）
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND pr.role NOT IN ('admin', 'super_admin')
       AND p.created_at >= DATE_TRUNC('month', NOW())
    ) as revenue_this_month,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND p.description = '订阅支付'
       AND pr.role NOT IN ('admin', 'super_admin')
       AND p.created_at >= DATE_TRUNC('month', NOW())
    ) as subscription_revenue_this_month,
    (SELECT COALESCE(SUM(p.amount), 0)
     FROM public.payments p
     JOIN public.profiles pr ON p.user_id = pr.id
     WHERE p.status = 'succeeded'
       AND p.description = '积分购买'
       AND pr.role NOT IN ('admin', 'super_admin')
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
