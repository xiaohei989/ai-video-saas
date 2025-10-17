-- ========================================
-- 修复限流函数的安全权限问题
-- 执行时间: 2025-10-15
-- 问题: check_rate_limit_v2 等函数缺少 SECURITY DEFINER
--       导致启用 RLS 后无法访问 rate_limit_records 表
-- 解决方案: 为所有限流函数添加 SECURITY DEFINER
-- ========================================

-- ============================================
-- 1. 修复 check_rate_limit_v2 函数
-- ============================================
-- 这是核心限流检查函数，必须有 SECURITY DEFINER 才能访问 rate_limit_records

CREATE OR REPLACE FUNCTION public.check_rate_limit_v2(
  p_key VARCHAR(255),
  p_max_requests INTEGER,
  p_window_seconds INTEGER,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS TABLE (
  allowed BOOLEAN,
  total_hits INTEGER,
  remaining INTEGER,
  reset_time TIMESTAMPTZ,
  retry_after INTEGER
) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_current_count INTEGER;
  v_record_id UUID;
  v_oldest_request TIMESTAMPTZ;
BEGIN
  -- 计算时间窗口
  v_window_start := date_trunc('second', NOW() - (p_window_seconds || ' seconds')::INTERVAL);
  v_window_end := date_trunc('second', NOW());

  -- 清理过期记录（性能优化）
  DELETE FROM public.rate_limit_records
  WHERE window_end < NOW() - INTERVAL '1 hour';

  -- 获取或创建限流记录
  SELECT id, request_count INTO v_record_id, v_current_count
  FROM public.rate_limit_records
  WHERE rate_limit_key = p_key
    AND window_start <= NOW()
    AND window_end >= NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_record_id IS NULL THEN
    -- 创建新的限流记录
    INSERT INTO public.rate_limit_records (
      rate_limit_key,
      request_count,
      window_start,
      window_end,
      ip_address,
      user_agent
    ) VALUES (
      p_key,
      1,
      v_window_start,
      v_window_end,
      p_ip_address,
      p_user_agent
    ) RETURNING id INTO v_record_id;

    v_current_count := 1;
  ELSE
    -- 更新现有记录
    UPDATE public.rate_limit_records
    SET
      request_count = request_count + 1,
      last_request_at = NOW(),
      updated_at = NOW()
    WHERE id = v_record_id;

    v_current_count := v_current_count + 1;
  END IF;

  -- 检查是否超过限制
  IF v_current_count > p_max_requests THEN
    -- 计算重试时间
    SELECT window_end INTO v_oldest_request
    FROM public.rate_limit_records
    WHERE id = v_record_id;

    RETURN QUERY SELECT
      false::BOOLEAN as allowed,
      v_current_count as total_hits,
      0 as remaining,
      v_oldest_request as reset_time,
      EXTRACT(EPOCH FROM (v_oldest_request - NOW()))::INTEGER as retry_after;
  ELSE
    RETURN QUERY SELECT
      true::BOOLEAN as allowed,
      v_current_count as total_hits,
      p_max_requests - v_current_count as remaining,
      v_window_end as reset_time,
      NULL::INTEGER as retry_after;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ✅ 添加 SECURITY DEFINER

COMMENT ON FUNCTION public.check_rate_limit_v2(VARCHAR, INTEGER, INTEGER, INET, TEXT)
IS '核心限流检查函数（SECURITY DEFINER - 可访问 rate_limit_records）';

-- ============================================
-- 2. 修复 is_ip_blocked 函数
-- ============================================
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip_address INET)
RETURNS BOOLEAN AS $$
DECLARE
  v_blocked BOOLEAN := false;
BEGIN
  SELECT true INTO v_blocked
  FROM public.ip_blacklist
  WHERE ip_address = p_ip_address
    AND (is_permanent = true OR blocked_until > NOW());

  RETURN COALESCE(v_blocked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ✅ 添加 SECURITY DEFINER

COMMENT ON FUNCTION public.is_ip_blocked(INET)
IS 'IP黑名单检查函数（SECURITY DEFINER）';

-- ============================================
-- 3. 修复 auto_block_abusive_ip 函数
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_block_abusive_ip()
RETURNS void AS $$
DECLARE
  v_threshold INTEGER := 1000; -- 1小时内超过1000次限流
  v_block_duration INTEGER := 86400; -- 阻断24小时
  abusive_ip INET;
BEGIN
  -- 查找滥用IP
  FOR abusive_ip IN
    SELECT ip_address
    FROM public.rate_limit_events
    WHERE limit_exceeded = true
      AND timestamp > NOW() - INTERVAL '1 hour'
      AND ip_address IS NOT NULL
    GROUP BY ip_address
    HAVING COUNT(*) > v_threshold
  LOOP
    -- 添加到黑名单
    INSERT INTO public.ip_blacklist (
      ip_address,
      reason,
      blocked_until,
      is_permanent
    ) VALUES (
      abusive_ip,
      'Auto-blocked for rate limit abuse',
      NOW() + (v_block_duration || ' seconds')::INTERVAL,
      false
    )
    ON CONFLICT (ip_address)
    DO UPDATE SET
      blocked_until = NOW() + (v_block_duration || ' seconds')::INTERVAL,
      reason = 'Auto-blocked for repeated rate limit abuse',
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ✅ 添加 SECURITY DEFINER

COMMENT ON FUNCTION public.auto_block_abusive_ip()
IS '自动IP阻断函数（SECURITY DEFINER）';

-- ============================================
-- 4. 修复 get_user_rate_limit 函数
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_rate_limit(
  p_user_id UUID,
  p_action VARCHAR(100)
) RETURNS TABLE (
  max_requests INTEGER,
  window_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    config.max_requests,
    config.window_seconds
  FROM public.user_rate_limit_config config
  WHERE config.user_id = p_user_id
    AND config.action = p_action
    AND config.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ✅ 添加 SECURITY DEFINER

COMMENT ON FUNCTION public.get_user_rate_limit(UUID, VARCHAR)
IS '用户特定限流配置函数（SECURITY DEFINER）';

-- ============================================
-- 5. 修复 get_rate_limit_stats 函数
-- ============================================
CREATE OR REPLACE FUNCTION public.get_rate_limit_stats(
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE (
  total_requests BIGINT,
  blocked_requests BIGINT,
  unique_ips BIGINT,
  top_paths JSON
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE limit_exceeded = true) as blocked_requests,
    COUNT(DISTINCT ip_address) as unique_ips,
    json_agg(
      json_build_object(
        'path', path,
        'count', path_count
      ) ORDER BY path_count DESC
    ) FILTER (WHERE path_rank <= 10) as top_paths
  FROM (
    SELECT
      path,
      COUNT(*) as path_count,
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as path_rank
    FROM public.rate_limit_events
    WHERE timestamp BETWEEN p_start_time AND p_end_time
    GROUP BY path
  ) path_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ✅ 添加 SECURITY DEFINER

COMMENT ON FUNCTION public.get_rate_limit_stats(TIMESTAMPTZ, TIMESTAMPTZ)
IS '限流统计函数（SECURITY DEFINER）';

-- ============================================
-- 6. 修复 cleanup_rate_limit_data 函数
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_data()
RETURNS void AS $$
BEGIN
  -- 清理7天前的限流记录
  DELETE FROM public.rate_limit_records
  WHERE created_at < NOW() - INTERVAL '7 days';

  -- 清理30天前的限流事件日志
  DELETE FROM public.rate_limit_events
  WHERE timestamp < NOW() - INTERVAL '30 days';

  -- 清理过期的IP黑名单记录
  DELETE FROM public.ip_blacklist
  WHERE blocked_until < NOW() AND is_permanent = false;

  -- 记录清理统计
  INSERT INTO public.rate_limit_events (
    path,
    method,
    total_hits,
    limit_exceeded,
    timestamp
  ) VALUES (
    '/system/cleanup',
    'SYSTEM',
    0,
    false,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ✅ 添加 SECURITY DEFINER

COMMENT ON FUNCTION public.cleanup_rate_limit_data()
IS '清理过期记录函数（SECURITY DEFINER）';

-- ============================================
-- 7. 修复 trigger_auto_cleanup 触发器函数
-- ============================================
CREATE OR REPLACE FUNCTION trigger_auto_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  -- 每插入100条记录时清理一次
  IF (SELECT COUNT(*) FROM public.rate_limit_events) % 100 = 0 THEN
    PERFORM public.cleanup_rate_limit_data();
  END IF;

  -- 检查是否需要自动阻断IP
  IF NEW.limit_exceeded = true THEN
    PERFORM public.auto_block_abusive_ip();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ✅ 添加 SECURITY DEFINER

COMMENT ON FUNCTION trigger_auto_cleanup()
IS '自动清理触发器函数（SECURITY DEFINER）';

-- ============================================
-- 8. 输出修复信息
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '限流函数安全权限修复完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ check_rate_limit_v2: 已添加 SECURITY DEFINER';
  RAISE NOTICE '✅ is_ip_blocked: 已添加 SECURITY DEFINER';
  RAISE NOTICE '✅ auto_block_abusive_ip: 已添加 SECURITY DEFINER';
  RAISE NOTICE '✅ get_user_rate_limit: 已添加 SECURITY DEFINER';
  RAISE NOTICE '✅ get_rate_limit_stats: 已添加 SECURITY DEFINER';
  RAISE NOTICE '✅ cleanup_rate_limit_data: 已添加 SECURITY DEFINER';
  RAISE NOTICE '✅ trigger_auto_cleanup: 已添加 SECURITY DEFINER';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ 现在所有函数都可以正常访问 rate_limit_records 表';
  RAISE NOTICE '🔒 RLS 策略不会影响函数执行';
  RAISE NOTICE '========================================';
END $$;
