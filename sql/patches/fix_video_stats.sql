-- ============================================
-- 修复视频统计函数 - 过滤已删除的视频
-- 问题：admin页面显示视频数量为0，因为没有过滤 is_deleted = true 的记录
-- ============================================

-- 1. 更新管理员统计函数 - 添加 is_deleted 过滤
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

-- 2. 更新视频生成趋势函数 - 添加 is_deleted 过滤
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
-- 完成
-- ============================================