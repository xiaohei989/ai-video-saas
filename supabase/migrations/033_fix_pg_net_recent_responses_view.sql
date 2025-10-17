-- ========================================
-- 修复 pg_net_recent_responses 视图的 SECURITY DEFINER 问题
-- 执行时间: 2025-10-15
-- 问题: pg_net_recent_responses 视图仍使用 SECURITY DEFINER
-- 解决方案: 重建为 SECURITY INVOKER，并限制只有管理员可访问
-- ========================================

-- ============================================
-- 删除旧视图并重建
-- ============================================

DROP VIEW IF EXISTS public.pg_net_recent_responses CASCADE;

-- 重建视图，显式指定 security_invoker = true
CREATE VIEW public.pg_net_recent_responses
WITH (security_invoker = true)  -- ✅ 使用调用者权限
AS
SELECT
  id,
  status_code,
  error_msg,
  created,
  timed_out,
  CASE
    WHEN status_code IS NULL AND error_msg IS NOT NULL THEN '请求失败'
    WHEN status_code >= 200 AND status_code < 300 THEN '成功'
    WHEN status_code >= 400 THEN '错误'
    WHEN timed_out THEN '超时'
    ELSE '未知'
  END as status_summary,
  LEFT(content::text, 200) as content_preview
FROM net._http_response
ORDER BY created DESC
LIMIT 100;  -- 只显示最近 100 条记录

COMMENT ON VIEW public.pg_net_recent_responses IS 'pg_net HTTP 响应记录（最近100条，仅管理员可访问）';

-- ============================================
-- 访问控制：只允许管理员访问
-- ============================================

-- 撤销所有默认权限
REVOKE ALL ON public.pg_net_recent_responses FROM PUBLIC;
REVOKE ALL ON public.pg_net_recent_responses FROM anon;
REVOKE ALL ON public.pg_net_recent_responses FROM authenticated;

-- 创建管理员安全访问函数
CREATE OR REPLACE FUNCTION get_pg_net_responses(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id BIGINT,
  status_code INTEGER,
  error_msg TEXT,
  created TIMESTAMPTZ,
  timed_out BOOLEAN,
  status_summary TEXT,
  content_preview TEXT
) AS $$
BEGIN
  -- 检查是否为管理员
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can access pg_net responses';
  END IF;

  -- 返回响应记录
  RETURN QUERY
  SELECT
    r.id,
    r.status_code,
    r.error_msg,
    r.created,
    r.timed_out,
    r.status_summary,
    r.content_preview
  FROM public.pg_net_recent_responses r
  ORDER BY r.created DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pg_net_responses(INTEGER) TO authenticated;

COMMENT ON FUNCTION get_pg_net_responses(INTEGER) IS '管理员获取 pg_net HTTP 响应记录（需要管理员权限）';

-- ============================================
-- 验证视图安全设置
-- ============================================
DO $$
DECLARE
  v_security_type TEXT;
  v_owner TEXT;
BEGIN
  -- 检查视图的所有者和安全设置
  SELECT
    pg_get_userbyid(c.relowner) as owner,
    CASE
      WHEN pg_catalog.pg_get_viewdef(c.oid, true) LIKE '%security_invoker%' THEN 'SECURITY INVOKER'
      ELSE 'SECURITY DEFINER (默认)'
    END
  INTO v_owner, v_security_type
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'v'
    AND n.nspname = 'public'
    AND c.relname = 'pg_net_recent_responses';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'pg_net_recent_responses 视图修复完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '视图名称: pg_net_recent_responses';
  RAISE NOTICE '所有者: %', v_owner;
  RAISE NOTICE '安全模式: %', v_security_type;
  RAISE NOTICE '';

  IF v_security_type = 'SECURITY INVOKER' THEN
    RAISE NOTICE '✅ 视图已正确配置为 SECURITY INVOKER';
  ELSE
    RAISE NOTICE '⚠️  视图仍在使用 SECURITY DEFINER';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🔒 访问控制：';
  RAISE NOTICE '  - 撤销了所有公共访问权限';
  RAISE NOTICE '  - 只能通过 get_pg_net_responses() 函数访问';
  RAISE NOTICE '  - 需要管理员权限';
  RAISE NOTICE '';
  RAISE NOTICE '📊 用法示例（管理员）：';
  RAISE NOTICE '  SELECT * FROM get_pg_net_responses(50);';
  RAISE NOTICE '========================================';
END $$;
