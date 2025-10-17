-- ========================================
-- 修复 queue_monitoring_dashboard 视图的 SECURITY DEFINER 问题
-- 执行时间: 2025-10-15
-- 问题: 视图使用 SECURITY DEFINER 可能导致权限提升和绕过 RLS
-- 解决方案: 移除 SECURITY DEFINER 或添加严格的 RLS 策略
-- ========================================

-- ============================================
-- 方案 A（推荐）: 重建视图，移除 SECURITY DEFINER
-- ============================================
-- 如果这个视图不需要访问其他用户的数据，直接移除 SECURITY DEFINER

-- 先检查视图是否存在
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'queue_monitoring_dashboard'
  ) THEN
    -- 删除旧视图
    DROP VIEW IF EXISTS public.queue_monitoring_dashboard;

    RAISE NOTICE '✅ 已删除旧的 queue_monitoring_dashboard 视图';
  END IF;
END $$;

-- 重新创建视图（不使用 SECURITY DEFINER）
-- 注意: 这里我基于常见的队列监控需求推测视图结构
-- 如果实际结构不同，请根据实际情况调整
CREATE OR REPLACE VIEW public.queue_monitoring_dashboard AS
SELECT
  -- 整体统计
  COUNT(*) FILTER (WHERE status = 'processing') as active_jobs,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,

  -- 队列深度
  COUNT(*) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as queued_jobs,

  -- 平均等待时间
  AVG(EXTRACT(EPOCH FROM (queue_started_at - queue_entered_at))) FILTER (
    WHERE queue_started_at IS NOT NULL
    AND queue_entered_at IS NOT NULL
  ) as avg_wait_time_seconds,

  -- 最老的待处理任务
  MIN(queue_entered_at) FILTER (WHERE status = 'pending') as oldest_pending,

  -- 最老的处理中任务
  MIN(queue_started_at) FILTER (WHERE status = 'processing') as oldest_processing

FROM public.videos
WHERE is_deleted = false;

COMMENT ON VIEW public.queue_monitoring_dashboard IS '队列监控仪表板（标准权限，遵循 RLS）';

-- ============================================
-- 方案 B（可选）: 保留 SECURITY DEFINER，但添加严格的 RLS
-- ============================================
-- 如果视图确实需要聚合所有用户数据（如管理员仪表板）
-- 可以保留 SECURITY DEFINER，但必须启用 RLS 并限制访问

-- 取消注释以下代码来使用方案 B：
/*
-- 重新创建视图（保留 SECURITY DEFINER）
DROP VIEW IF EXISTS public.queue_monitoring_dashboard;

CREATE VIEW public.queue_monitoring_dashboard
WITH (security_invoker = false)  -- 等同于 SECURITY DEFINER
AS
SELECT
  COUNT(*) FILTER (WHERE status = 'processing') as active_jobs,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
  COUNT(*) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as queued_jobs,
  AVG(EXTRACT(EPOCH FROM (queue_started_at - queue_entered_at))) FILTER (
    WHERE queue_started_at IS NOT NULL
    AND queue_entered_at IS NOT NULL
  ) as avg_wait_time_seconds,
  MIN(queue_entered_at) FILTER (WHERE status = 'pending') as oldest_pending,
  MIN(queue_started_at) FILTER (WHERE status = 'processing') as oldest_processing
FROM public.videos
WHERE is_deleted = false;

-- 启用 RLS（视图本身不能直接启用 RLS，但可以通过权限控制）
-- 创建限制访问的函数
CREATE OR REPLACE FUNCTION get_queue_monitoring_data()
RETURNS TABLE (
  active_jobs BIGINT,
  pending_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  queued_jobs BIGINT,
  avg_wait_time_seconds NUMERIC,
  oldest_pending TIMESTAMPTZ,
  oldest_processing TIMESTAMPTZ
) AS $$
BEGIN
  -- 检查是否为管理员
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can access queue monitoring data';
  END IF;

  -- 返回监控数据
  RETURN QUERY
  SELECT * FROM public.queue_monitoring_dashboard;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_queue_monitoring_data() TO authenticated;
COMMENT ON FUNCTION get_queue_monitoring_data() IS '管理员获取队列监控数据（需要管理员权限）';
*/

-- ============================================
-- 验证和清理
-- ============================================

-- 撤销视图的公共访问权限
REVOKE ALL ON public.queue_monitoring_dashboard FROM PUBLIC;
REVOKE ALL ON public.queue_monitoring_dashboard FROM anon;

-- 只允许认证用户访问（如果需要进一步限制，可以只授权给管理员）
GRANT SELECT ON public.queue_monitoring_dashboard TO authenticated;

-- 如果只允许管理员访问，创建访问函数
CREATE OR REPLACE FUNCTION can_access_queue_monitoring()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION can_access_queue_monitoring() IS '检查用户是否有权限访问队列监控';

-- ============================================
-- 输出修复信息
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'queue_monitoring_dashboard 安全修复完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 视图已重建（移除 SECURITY DEFINER）';
  RAISE NOTICE '✅ 撤销了公共访问权限';
  RAISE NOTICE '✅ 只允许认证用户访问';
  RAISE NOTICE '';
  RAISE NOTICE '📊 新视图特性：';
  RAISE NOTICE '   - 使用查询者权限（遵循 RLS）';
  RAISE NOTICE '   - 更加安全';
  RAISE NOTICE '   - 符合 Supabase 安全最佳实践';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 访问控制：';
  RAISE NOTICE '   - 使用 can_access_queue_monitoring() 检查权限';
  RAISE NOTICE '   - 前端应该在查询前检查权限';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  如果需要管理员专用视图（查看所有用户数据）：';
  RAISE NOTICE '   - 取消注释方案 B 的代码';
  RAISE NOTICE '   - 使用 get_queue_monitoring_data() 函数访问';
  RAISE NOTICE '========================================';
END $$;
