-- ========================================
-- 显式移除所有视图的 SECURITY DEFINER 属性
-- 执行时间: 2025-10-15
-- 问题: CREATE OR REPLACE VIEW 可能保留了原有的 security_definer 设置
-- 解决方案: 显式指定 WITH (security_invoker = true)
-- ========================================

-- ============================================
-- 重建所有视图，显式指定 security_invoker = true
-- ============================================

-- 1. template_details_optimized
DROP VIEW IF EXISTS public.template_details_optimized CASCADE;
CREATE VIEW public.template_details_optimized
WITH (security_invoker = true)  -- ✅ 显式指定使用调用者权限
AS
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
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as completed_videos_count,
  COUNT(DISTINCT tl.user_id) as likes_count,
  COUNT(DISTINCT tf.user_id) as favorites_count
FROM public.templates t
LEFT JOIN public.videos v ON v.template_id = t.id
LEFT JOIN public.template_likes tl ON tl.template_id = t.id
LEFT JOIN public.template_favorites tf ON tf.template_id = t.id
WHERE t.is_active = true
GROUP BY t.id;

-- 2. popular_seo_guides
DROP VIEW IF EXISTS public.popular_seo_guides CASCADE;
CREATE VIEW public.popular_seo_guides
WITH (security_invoker = true)
AS
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
  (sg.page_views * 0.4 + sg.unique_visitors * 0.3 + sg.seo_score * 0.3) as popularity_score
FROM public.template_seo_guides sg
JOIN public.templates t ON t.id = sg.template_id
WHERE sg.is_published = true
ORDER BY popularity_score DESC;

-- 3. videos_pending_auto_thumbnails
DROP VIEW IF EXISTS public.videos_pending_auto_thumbnails CASCADE;
CREATE VIEW public.videos_pending_auto_thumbnails
WITH (security_invoker = true)
AS
SELECT
  id,
  title,
  video_url,
  status,
  thumbnail_url,
  created_at,
  processing_completed_at,
  user_id
FROM public.videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
  AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
  AND is_deleted = false
ORDER BY processing_completed_at DESC;

-- 4. thumbnail_generation_failures
DROP VIEW IF EXISTS public.thumbnail_generation_failures CASCADE;
CREATE VIEW public.thumbnail_generation_failures
WITH (security_invoker = true)
AS
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

-- 5. thumbnail_generation_health
DROP VIEW IF EXISTS public.thumbnail_generation_health CASCADE;
CREATE VIEW public.thumbnail_generation_health
WITH (security_invoker = true)
AS
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

-- 6. videos_pending_thumbnails
DROP VIEW IF EXISTS public.videos_pending_thumbnails CASCADE;
CREATE VIEW public.videos_pending_thumbnails
WITH (security_invoker = true)
AS
SELECT
  id,
  title,
  video_url,
  status,
  thumbnail_url,
  user_id,
  created_at
FROM public.videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
  AND (thumbnail_url IS NULL OR thumbnail_url = '')
  AND is_deleted = false
ORDER BY created_at DESC;

-- 7. user_queue_status_optimized
DROP VIEW IF EXISTS public.user_queue_status_optimized CASCADE;
CREATE VIEW public.user_queue_status_optimized
WITH (security_invoker = true)
AS
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

-- 8. user_statistics_summary
DROP VIEW IF EXISTS public.user_statistics_summary CASCADE;
CREATE VIEW public.user_statistics_summary
WITH (security_invoker = true)
AS
SELECT
  p.id as user_id,
  p.email,
  p.username,
  p.role,
  p.created_at as user_created_at,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as completed_videos,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'processing') as processing_videos,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'failed' AND v.is_deleted = false) as failed_videos,
  COALESCE(p.credits, 0) as current_credits,
  s.tier as subscription_tier,
  s.status as subscription_status
FROM public.profiles p
LEFT JOIN public.videos v ON v.user_id = p.id
LEFT JOIN public.subscriptions s ON s.user_id = p.id AND s.status = 'active'
GROUP BY p.id, p.email, p.username, p.role, p.created_at, p.credits, s.tier, s.status;

-- 9. queue_monitoring_dashboard
DROP VIEW IF EXISTS public.queue_monitoring_dashboard CASCADE;
CREATE VIEW public.queue_monitoring_dashboard
WITH (security_invoker = true)
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

-- 10. popular_templates_ranking
DROP VIEW IF EXISTS public.popular_templates_ranking CASCADE;
CREATE VIEW public.popular_templates_ranking
WITH (security_invoker = true)
AS
SELECT
  t.id,
  t.name,
  t.slug,
  t.thumbnail_url,
  t.category,
  t.credit_cost,
  t.is_featured,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as usage_count,
  COUNT(DISTINCT tl.user_id) as likes_count,
  COUNT(DISTINCT tf.user_id) as favorites_count,
  MAX(v.created_at) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as last_used_at,
  MIN(v.created_at) FILTER (WHERE v.status = 'completed' AND v.is_deleted = false) as first_used_at,
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

-- ============================================
-- 验证所有视图的安全设置
-- ============================================
DO $$
DECLARE
  view_rec RECORD;
  definer_count INTEGER := 0;
  invoker_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '验证视图安全设置';
  RAISE NOTICE '========================================';

  FOR view_rec IN
    SELECT
      c.relname as viewname,
      CASE
        WHEN c.relkind = 'v' AND pg_catalog.pg_get_viewdef(c.oid, true) LIKE '%security_invoker%' THEN 'INVOKER'
        WHEN c.relkind = 'v' THEN 'DEFINER (默认)'
        ELSE 'UNKNOWN'
      END as security_type
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v'
      AND n.nspname = 'public'
      AND c.relname IN (
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
    ORDER BY c.relname
  LOOP
    IF view_rec.security_type = 'INVOKER' THEN
      invoker_count := invoker_count + 1;
      RAISE NOTICE '✅ %: %', view_rec.viewname, view_rec.security_type;
    ELSE
      definer_count := definer_count + 1;
      RAISE NOTICE '⚠️  %: %', view_rec.viewname, view_rec.security_type;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '统计结果';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SECURITY INVOKER (安全): % 个', invoker_count;
  RAISE NOTICE '⚠️  SECURITY DEFINER (警告): % 个', definer_count;
  RAISE NOTICE '========================================';

  IF definer_count = 0 THEN
    RAISE NOTICE '🎉 所有视图已正确配置为 SECURITY INVOKER！';
  ELSE
    RAISE NOTICE '⚠️  仍有 % 个视图使用 SECURITY DEFINER', definer_count;
  END IF;

  RAISE NOTICE '========================================';
END $$;
