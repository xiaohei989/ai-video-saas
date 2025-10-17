-- ========================================
-- 修复所有表的 RLS 安全问题
-- 执行时间: 2025-10-15
-- 问题: 多个表未启用 RLS，导致安全隐患
-- ========================================

-- ============================================
-- 1. rate_limit_records 表
-- ============================================
-- 用途：限流记录表，存储请求计数和时间窗口
-- 策略：只允许系统函数访问，禁止前端直接访问

ALTER TABLE IF EXISTS public.rate_limit_records ENABLE ROW LEVEL SECURITY;

-- 不创建任何策略，完全禁止 PostgREST 访问
-- 只能通过 SECURITY DEFINER 函数访问（如 check_rate_limit_v2）

COMMENT ON TABLE public.rate_limit_records IS '限流记录表（RLS 已启用，仅系统函数可访问）';

-- ============================================
-- 2. deleted_videos_backup 表（如果存在）
-- ============================================
-- 用途：删除视频的备份表
-- 策略：只允许管理员访问

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'deleted_videos_backup'
  ) THEN
    -- 启用 RLS
    ALTER TABLE public.deleted_videos_backup ENABLE ROW LEVEL SECURITY;

    -- 只允许管理员查看
    DROP POLICY IF EXISTS "Admin can view deleted videos backup" ON public.deleted_videos_backup;
    CREATE POLICY "Admin can view deleted videos backup" ON public.deleted_videos_backup
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );

    -- 只允许管理员插入（用于备份）
    DROP POLICY IF EXISTS "Admin can insert deleted videos backup" ON public.deleted_videos_backup;
    CREATE POLICY "Admin can insert deleted videos backup" ON public.deleted_videos_backup
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );

    RAISE NOTICE '✅ deleted_videos_backup: RLS 已启用';
  ELSE
    RAISE NOTICE '⚠️  deleted_videos_backup: 表不存在，跳过';
  END IF;
END $$;

-- ============================================
-- 3. thumbnail_backup 表（如果存在）
-- ============================================
-- 用途：缩略图备份表
-- 策略：只允许管理员访问

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'thumbnail_backup'
  ) THEN
    -- 启用 RLS
    ALTER TABLE public.thumbnail_backup ENABLE ROW LEVEL SECURITY;

    -- 只允许管理员查看
    DROP POLICY IF EXISTS "Admin can view thumbnail backup" ON public.thumbnail_backup;
    CREATE POLICY "Admin can view thumbnail backup" ON public.thumbnail_backup
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );

    -- 只允许管理员插入（用于备份）
    DROP POLICY IF EXISTS "Admin can insert thumbnail backup" ON public.thumbnail_backup;
    CREATE POLICY "Admin can insert thumbnail backup" ON public.thumbnail_backup
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );

    RAISE NOTICE '✅ thumbnail_backup: RLS 已启用';
  ELSE
    RAISE NOTICE '⚠️  thumbnail_backup: 表不存在，跳过';
  END IF;
END $$;

-- ============================================
-- 4. admin_users 表（如果存在）
-- ============================================
-- 用途：管理员用户表
-- 策略：只允许超级管理员访问

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'admin_users'
  ) THEN
    -- 启用 RLS
    ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

    -- 只允许管理员查看
    DROP POLICY IF EXISTS "Admin can view admin users" ON public.admin_users;
    CREATE POLICY "Admin can view admin users" ON public.admin_users
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );

    -- 只允许管理员管理
    DROP POLICY IF EXISTS "Admin can manage admin users" ON public.admin_users;
    CREATE POLICY "Admin can manage admin users" ON public.admin_users
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );

    RAISE NOTICE '✅ admin_users: RLS 已启用';
  ELSE
    RAISE NOTICE '⚠️  admin_users: 表不存在，跳过';
  END IF;
END $$;

-- ============================================
-- 5. 验证 page_views 和 user_sessions 的 RLS
-- ============================================
-- 这两个表应该在 017_website_analytics.sql 中已启用 RLS
-- 但如果策略有问题，这里重新创建

DO $$
BEGIN
  -- 检查 page_views 的 RLS
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'page_views'
    AND rowsecurity = false
  ) THEN
    ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ page_views: RLS 已启用';
  ELSE
    RAISE NOTICE 'ℹ️  page_views: RLS 已经启用';
  END IF;

  -- 检查 user_sessions 的 RLS
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'user_sessions'
    AND rowsecurity = false
  ) THEN
    ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ user_sessions: RLS 已启用';
  ELSE
    RAISE NOTICE 'ℹ️  user_sessions: RLS 已经启用';
  END IF;
END $$;

-- ============================================
-- 6. 创建管理函数：查看限流记录（安全）
-- ============================================
CREATE OR REPLACE FUNCTION get_rate_limit_records(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  rate_limit_key VARCHAR,
  request_count INTEGER,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- 检查是否为管理员
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only administrators can view rate limit records';
  END IF;

  -- 返回限流记录
  RETURN QUERY
  SELECT
    r.id,
    r.rate_limit_key,
    r.request_count,
    r.window_start,
    r.window_end,
    r.ip_address,
    r.created_at
  FROM public.rate_limit_records r
  ORDER BY r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_rate_limit_records(INTEGER, INTEGER) TO authenticated;
COMMENT ON FUNCTION get_rate_limit_records(INTEGER, INTEGER) IS '管理员查看限流记录（安全函数）';

-- ============================================
-- 7. 创建管理函数：清理限流记录
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_rate_limit_records(
  p_older_than_hours INTEGER DEFAULT 24
)
RETURNS JSON AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_deleted_count INTEGER;
BEGIN
  -- 检查是否为管理员
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only administrators can cleanup rate limit records'
    );
  END IF;

  -- 删除过期记录
  WITH deleted AS (
    DELETE FROM public.rate_limit_records
    WHERE window_end < NOW() - (p_older_than_hours || ' hours')::INTERVAL
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'older_than_hours', p_older_than_hours
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_rate_limit_records(INTEGER) TO authenticated;
COMMENT ON FUNCTION cleanup_rate_limit_records(INTEGER) IS '管理员清理过期限流记录';

-- ============================================
-- 8. 验证所有 RLS 状态
-- ============================================
DO $$
DECLARE
  v_table_name TEXT;
  v_rls_enabled BOOLEAN;
  v_message TEXT := E'\n========================================\n';
BEGIN
  v_message := v_message || 'RLS 状态检查报告' || E'\n';
  v_message := v_message || '========================================' || E'\n\n';

  -- 检查所有相关表的 RLS 状态
  FOR v_table_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'system_config',
      'rate_limit_records',
      'deleted_videos_backup',
      'thumbnail_backup',
      'admin_users',
      'page_views',
      'user_sessions'
    )
  LOOP
    SELECT rowsecurity INTO v_rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = v_table_name;

    IF v_rls_enabled THEN
      v_message := v_message || '✅ ' || v_table_name || ': RLS 已启用' || E'\n';
    ELSE
      v_message := v_message || '❌ ' || v_table_name || ': RLS 未启用' || E'\n';
    END IF;
  END LOOP;

  v_message := v_message || E'\n========================================\n';
  v_message := v_message || '修复完成！' || E'\n';
  v_message := v_message || '========================================';

  RAISE NOTICE '%', v_message;
END $$;
