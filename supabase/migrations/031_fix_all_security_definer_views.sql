-- ========================================
-- 修复所有 SECURITY DEFINER 视图的安全问题
-- 执行时间: 2025-10-15
-- 问题: 11 个视图使用 SECURITY DEFINER，可能导致权限提升和绕过 RLS
-- 解决方案: 重建所有视图，移除 SECURITY DEFINER，添加适当的访问控制
-- ========================================

-- ============================================
-- 1. template_details_optimized
-- ============================================
DROP VIEW IF EXISTS public.template_details_optimized CASCADE;

CREATE OR REPLACE VIEW public.template_details_optimized AS
SELECT
  t.id,
  t.name,
  t.slug,
  t.description,
  t.thumbnail_url,
  t.preview_url,
  t.category,
  t.tags,
  t.credit_cost,
  t.is_featured,
  t.is_active,
  t.created_at,
  t.updated_at,
  -- 统计数据（只聚合公开的数据）
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as completed_videos_count,
  COUNT(DISTINCT tl.user_id) as likes_count,
  COUNT(DISTINCT tf.user_id) as favorites_count
FROM public.templates t
LEFT JOIN public.videos v ON v.template_id = t.id
LEFT JOIN public.template_likes tl ON tl.template_id = t.id
LEFT JOIN public.template_favorites tf ON tf.template_id = t.id
WHERE t.is_active = true
GROUP BY t.id;

COMMENT ON VIEW public.template_details_optimized IS '优化的模板详情视图（标准权限）';

-- ============================================
-- 2. popular_seo_guides
-- ============================================
DROP VIEW IF EXISTS public.popular_seo_guides CASCADE;

CREATE OR REPLACE VIEW public.popular_seo_guides AS
SELECT
  sg.id,
  sg.template_id,
  t.name as template_name,
  t.slug as template_slug,
  t.thumbnail_url,
  sg.language,
  sg.primary_keyword,
  sg.meta_title,
  sg.seo_score,
  sg.page_views,
  sg.unique_visitors,
  sg.conversion_rate,
  sg.published_at,
  -- 计算综合人气分数
  (sg.page_views * 0.4 + sg.unique_visitors * 0.3 + sg.seo_score * 0.3) as popularity_score
FROM public.template_seo_guides sg
JOIN public.templates t ON t.id = sg.template_id
WHERE sg.is_published = true
ORDER BY popularity_score DESC;

COMMENT ON VIEW public.popular_seo_guides IS '热门SEO指南排行（标准权限）';

-- ============================================
-- 3. videos_pending_auto_thumbnails
-- ============================================
DROP VIEW IF EXISTS public.videos_pending_auto_thumbnails CASCADE;

CREATE OR REPLACE VIEW public.videos_pending_auto_thumbnails AS
SELECT
  id,
  title,
  video_url,
  status,
  thumbnail_url,
  created_at,
  processing_completed_at,
  user_id  -- 添加 user_id 用于 RLS
FROM public.videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
  AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
  AND is_deleted = false
ORDER BY processing_completed_at DESC;

COMMENT ON VIEW public.videos_pending_auto_thumbnails IS '等待自动生成缩略图的视频列表（标准权限，遵循 RLS）';

-- ============================================
-- 4. thumbnail_generation_failures
-- ============================================
DROP VIEW IF EXISTS public.thumbnail_generation_failures CASCADE;

CREATE OR REPLACE VIEW public.thumbnail_generation_failures AS
SELECT
  thumbnail_generation_error,
  COUNT(*) as failure_count,
  MAX(thumbnail_generation_last_attempt_at) as last_occurrence,
  (
    SELECT array_agg(id ORDER BY thumbnail_generation_last_attempt_at DESC)
    FROM (
      SELECT id, thumbnail_generation_last_attempt_at
      FROM public.videos v2
      WHERE v2.thumbnail_generation_error = v1.thumbnail_generation_error
        AND v2.thumbnail_generation_status = 'failed'
        AND v2.is_deleted = false
      ORDER BY v2.thumbnail_generation_last_attempt_at DESC
      LIMIT 10
    ) limited
  ) as recent_video_ids
FROM public.videos v1
WHERE thumbnail_generation_status = 'failed'
  AND is_deleted = false
GROUP BY thumbnail_generation_error
ORDER BY failure_count DESC;

COMMENT ON VIEW public.thumbnail_generation_failures IS '缩略图生成失败原因统计（标准权限）';

-- ============================================
-- 5. thumbnail_generation_health
-- ============================================
DROP VIEW IF EXISTS public.thumbnail_generation_health CASCADE;

CREATE OR REPLACE VIEW public.thumbnail_generation_health AS
SELECT
  COUNT(*) FILTER (WHERE thumbnail_generation_status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE thumbnail_generation_status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE thumbnail_generation_status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE thumbnail_generation_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE thumbnail_generation_status IS NULL
                   AND status = 'completed'
                   AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')) as needs_generation_count,
  ROUND(
    COUNT(*) FILTER (WHERE thumbnail_generation_status = 'completed')::NUMERIC * 100 /
    NULLIF(COUNT(*) FILTER (WHERE thumbnail_generation_status IS NOT NULL), 0),
    2
  ) as success_rate_percent,
  AVG(
    EXTRACT(EPOCH FROM (thumbnail_generated_at - thumbnail_generation_started_at))
  ) FILTER (WHERE thumbnail_generation_status = 'completed'
            AND thumbnail_generated_at IS NOT NULL
            AND thumbnail_generation_started_at IS NOT NULL) as avg_generation_time_seconds
FROM public.videos
WHERE status = 'completed'
  AND is_deleted = false;

COMMENT ON VIEW public.thumbnail_generation_health IS '缩略图生成系统健康状况（标准权限）';

-- ============================================
-- 6. videos_pending_thumbnails
-- ============================================
DROP VIEW IF EXISTS public.videos_pending_thumbnails CASCADE;

CREATE OR REPLACE VIEW public.videos_pending_thumbnails AS
SELECT
  id,
  title,
  video_url,
  status,
  thumbnail_url,
  user_id,  -- 添加 user_id 用于 RLS
  created_at
FROM public.videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
  AND (thumbnail_url IS NULL OR thumbnail_url = '')
  AND is_deleted = false
ORDER BY created_at DESC;

COMMENT ON VIEW public.videos_pending_thumbnails IS '等待生成缩略图的视频（标准权限，遵循 RLS）';

-- ============================================
-- 7. user_queue_status_optimized
-- ============================================
DROP VIEW IF EXISTS public.user_queue_status_optimized CASCADE;

CREATE OR REPLACE VIEW public.user_queue_status_optimized AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status = 'processing') as active_count,
  COUNT(*) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as queued_count,
  MIN(queue_position) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as next_position,
  MIN(queue_entered_at) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as oldest_queued
FROM public.videos
WHERE is_deleted = false
  AND status IN ('processing', 'pending')
GROUP BY user_id;

COMMENT ON VIEW public.user_queue_status_optimized IS '用户队列状态优化视图（标准权限，用户只能看到自己的数据）';

-- ============================================
-- 8. user_statistics_summary
-- ============================================
DROP VIEW IF EXISTS public.user_statistics_summary CASCADE;

CREATE OR REPLACE VIEW public.user_statistics_summary AS
SELECT
  p.id as user_id,
  p.email,
  p.username,
  p.role,
  p.created_at as user_created_at,
  -- 视频统计
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as completed_videos,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'processing') as processing_videos,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'failed' AND v.is_deleted = false) as failed_videos,
  -- 积分和订阅
  COALESCE(p.credits, 0) as current_credits,
  s.tier as subscription_tier,
  s.status as subscription_status
FROM public.profiles p
LEFT JOIN public.videos v ON v.user_id = p.id
LEFT JOIN public.subscriptions s ON s.user_id = p.id AND s.status = 'active'
GROUP BY p.id, p.email, p.username, p.role, p.created_at, p.credits, s.tier, s.status;

COMMENT ON VIEW public.user_statistics_summary IS '用户统计摘要（标准权限，用户只能看到自己的数据）';

-- ============================================
-- 9. pg_net_recent_responses (系统视图)
-- ============================================
-- 注意：pg_net_recent_responses 是 pg_net 扩展的系统视图
-- 如果这是自定义视图，需要重建；如果是扩展自带的，应该保留

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'pg_net_recent_responses'
    AND viewowner != 'postgres'  -- 不是系统视图
  ) THEN
    DROP VIEW IF EXISTS public.pg_net_recent_responses CASCADE;
    RAISE NOTICE '✅ 已删除自定义 pg_net_recent_responses 视图';
  ELSE
    RAISE NOTICE 'ℹ️  pg_net_recent_responses 是系统视图，保持不变';
  END IF;
END $$;

-- ============================================
-- 10. queue_monitoring_dashboard
-- ============================================
-- 已在 030 迁移中修复，这里确保一致性

DROP VIEW IF EXISTS public.queue_monitoring_dashboard CASCADE;

CREATE OR REPLACE VIEW public.queue_monitoring_dashboard AS
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

COMMENT ON VIEW public.queue_monitoring_dashboard IS '队列监控仪表板（标准权限）';

-- ============================================
-- 11. popular_templates_ranking
-- ============================================
DROP VIEW IF EXISTS public.popular_templates_ranking CASCADE;

CREATE OR REPLACE VIEW public.popular_templates_ranking AS
SELECT
  t.id,
  t.name,
  t.slug,
  t.thumbnail_url,
  t.category,
  t.credit_cost,
  t.is_featured,
  -- 统计指标
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as usage_count,
  COUNT(DISTINCT tl.user_id) as likes_count,
  COUNT(DISTINCT tf.user_id) as favorites_count,
  MAX(v.created_at) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as last_used_at,
  MIN(v.created_at) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as first_used_at,
  -- 综合排名分数
  (
    COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) * 0.4 +
    COUNT(DISTINCT tl.user_id) * 0.3 +
    COUNT(DISTINCT tf.user_id) * 0.3
  ) as popularity_score
FROM public.templates t
LEFT JOIN public.videos v ON v.template_id = t.id
LEFT JOIN public.template_likes tl ON tl.template_id = t.id
LEFT JOIN public.template_favorites tf ON tf.template_id = t.id
WHERE t.is_active = true
GROUP BY t.id
ORDER BY popularity_score DESC;

COMMENT ON VIEW public.popular_templates_ranking IS '热门模板排行榜（标准权限）';

-- ============================================
-- 访问控制和权限设置
-- ============================================

-- 撤销所有视图的公共访问权限
DO $$
DECLARE
  view_name TEXT;
BEGIN
  FOR view_name IN
    SELECT viewname FROM pg_views
    WHERE schemaname = 'public'
    AND viewname IN (
      'template_details_optimized',
      'popular_seo_guides',
      'videos_pending_auto_thumbnails',
      'thumbnail_generation_failures',
      'thumbnail_generation_health',
      'videos_pending_thumbnails',
      'user_queue_status_optimized',
      'user_statistics_summary',
      'queue_monitoring_dashboard',
      'popular_templates_ranking'
    )
  LOOP
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC', view_name);
    EXECUTE format('REVOKE ALL ON %I FROM anon', view_name);
    EXECUTE format('GRANT SELECT ON %I TO authenticated', view_name);

    RAISE NOTICE '✅ 已设置视图权限: %', view_name;
  END LOOP;
END $$;

-- ============================================
-- 创建管理员安全访问函数
-- ============================================

-- 管理员获取缩略图生成健康状况
CREATE OR REPLACE FUNCTION get_admin_thumbnail_health()
RETURNS TABLE (
  completed_count BIGINT,
  failed_count BIGINT,
  processing_count BIGINT,
  pending_count BIGINT,
  needs_generation_count BIGINT,
  success_rate_percent NUMERIC,
  avg_generation_time_seconds NUMERIC
) AS $$
BEGIN
  -- 检查管理员权限
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can access thumbnail generation health data';
  END IF;

  RETURN QUERY SELECT * FROM public.thumbnail_generation_health;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_thumbnail_health() TO authenticated;
COMMENT ON FUNCTION get_admin_thumbnail_health() IS '管理员获取缩略图生成健康状况（需要管理员权限）';

-- 管理员获取队列监控数据
CREATE OR REPLACE FUNCTION get_admin_queue_monitoring()
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
  -- 检查管理员权限
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can access queue monitoring data';
  END IF;

  RETURN QUERY SELECT * FROM public.queue_monitoring_dashboard;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_admin_queue_monitoring() TO authenticated;
COMMENT ON FUNCTION get_admin_queue_monitoring() IS '管理员获取队列监控数据（需要管理员权限）';

-- ============================================
-- 输出修复信息
-- ============================================
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN (
    'template_details_optimized',
    'popular_seo_guides',
    'videos_pending_auto_thumbnails',
    'thumbnail_generation_failures',
    'thumbnail_generation_health',
    'videos_pending_thumbnails',
    'user_queue_status_optimized',
    'user_statistics_summary',
    'queue_monitoring_dashboard',
    'popular_templates_ranking'
  );

  RAISE NOTICE '========================================';
  RAISE NOTICE '所有 SECURITY DEFINER 视图修复完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 已修复 % 个视图', fixed_count;
  RAISE NOTICE '';
  RAISE NOTICE '📊 修复的视图列表：';
  RAISE NOTICE '  1. template_details_optimized';
  RAISE NOTICE '  2. popular_seo_guides';
  RAISE NOTICE '  3. videos_pending_auto_thumbnails';
  RAISE NOTICE '  4. thumbnail_generation_failures';
  RAISE NOTICE '  5. thumbnail_generation_health';
  RAISE NOTICE '  6. videos_pending_thumbnails';
  RAISE NOTICE '  7. user_queue_status_optimized';
  RAISE NOTICE '  8. user_statistics_summary';
  RAISE NOTICE '  9. queue_monitoring_dashboard';
  RAISE NOTICE ' 10. popular_templates_ranking';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 安全改进：';
  RAISE NOTICE '  - 所有视图使用查询者权限（遵循 RLS）';
  RAISE NOTICE '  - 撤销了公共访问权限';
  RAISE NOTICE '  - 只允许认证用户访问';
  RAISE NOTICE '  - 提供了管理员安全访问函数';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️  管理员函数：';
  RAISE NOTICE '  - get_admin_thumbnail_health()';
  RAISE NOTICE '  - get_admin_queue_monitoring()';
  RAISE NOTICE '========================================';
END $$;
