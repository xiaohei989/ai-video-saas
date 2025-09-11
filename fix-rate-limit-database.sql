-- ============================================
-- 优化限流数据库存储过程
-- 修复时间窗口计算和记录清理问题
-- ============================================

-- 1. 创建改进的限流检查函数
CREATE OR REPLACE FUNCTION public.check_rate_limit_v3(
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
  v_current_count INTEGER := 0;
  v_record_id UUID;
  v_reset_time TIMESTAMPTZ;
  v_user_id UUID;
  v_custom_limit INTEGER;
BEGIN
  -- 使用滑动窗口而不是固定窗口
  v_window_end := NOW();
  v_window_start := v_window_end - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- 提取用户ID（如果键包含用户ID）
  IF p_key ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' THEN
    v_user_id := (regexp_matches(p_key, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'))[1]::UUID;
    
    -- 检查用户是否有自定义限流配置
    SELECT max_requests INTO v_custom_limit
    FROM public.user_rate_limit_config
    WHERE user_id = v_user_id 
      AND action = 'video_generation'
      AND is_active = true;
    
    IF v_custom_limit IS NOT NULL AND v_custom_limit > p_max_requests THEN
      p_max_requests := v_custom_limit;
    END IF;
  END IF;

  -- 清理过期记录（更激进的清理策略）
  DELETE FROM public.rate_limit_records 
  WHERE window_end < v_window_start 
    OR created_at < NOW() - INTERVAL '2 hours';

  -- 计算当前时间窗口内的请求数（使用滑动窗口）
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM public.rate_limit_records
  WHERE rate_limit_key = p_key
    AND window_start < v_window_end
    AND window_end > v_window_start;

  -- 添加当前请求
  v_current_count := v_current_count + 1;

  -- 插入或更新当前请求记录
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
  );

  -- 计算重置时间（下一个完整窗口的开始时间）
  v_reset_time := v_window_end + (p_window_seconds || ' seconds')::INTERVAL;

  -- 检查是否超过限制
  IF v_current_count > p_max_requests THEN
    RETURN QUERY SELECT
      false::BOOLEAN as allowed,
      v_current_count as total_hits,
      0 as remaining,
      v_reset_time as reset_time,
      p_window_seconds as retry_after;
  ELSE
    RETURN QUERY SELECT
      true::BOOLEAN as allowed,
      v_current_count as total_hits,
      p_max_requests - v_current_count as remaining,
      v_reset_time as reset_time,
      NULL::INTEGER as retry_after;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建批量重置用户限流的函数
CREATE OR REPLACE FUNCTION public.batch_reset_rate_limits(
  p_user_ids UUID[] DEFAULT NULL,
  p_actions VARCHAR[] DEFAULT ARRAY['video_generation'],
  p_hours_back INTEGER DEFAULT 1
) RETURNS TABLE (
  action_taken TEXT,
  affected_records INTEGER
) AS $$
DECLARE
  v_user_id UUID;
  v_action VARCHAR;
  v_deleted_count INTEGER;
  v_total_deleted INTEGER := 0;
BEGIN
  -- 如果没有指定用户，重置所有用户的指定动作
  IF p_user_ids IS NULL THEN
    FOREACH v_action IN ARRAY p_actions LOOP
      DELETE FROM public.rate_limit_records 
      WHERE rate_limit_key LIKE '%' || v_action || '%'
        AND created_at > NOW() - (p_hours_back || ' hours')::INTERVAL;
      
      GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
      v_total_deleted := v_total_deleted + v_deleted_count;
      
      RETURN QUERY SELECT
        'Reset action: ' || v_action as action_taken,
        v_deleted_count as affected_records;
    END LOOP;
  ELSE
    -- 重置指定用户的限流
    FOREACH v_user_id IN ARRAY p_user_ids LOOP
      FOREACH v_action IN ARRAY p_actions LOOP
        DELETE FROM public.rate_limit_records 
        WHERE rate_limit_key LIKE '%' || v_user_id || '%'
          AND rate_limit_key LIKE '%' || v_action || '%'
          AND created_at > NOW() - (p_hours_back || ' hours')::INTERVAL;
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_total_deleted := v_total_deleted + v_deleted_count;
        
        RETURN QUERY SELECT
          'Reset user: ' || v_user_id || ', action: ' || v_action as action_taken,
          v_deleted_count as affected_records;
      END LOOP;
    END LOOP;
  END IF;
  
  -- 记录批量重置事件
  INSERT INTO public.rate_limit_events (
    path,
    method,
    rate_limit_key,
    total_hits,
    limit_exceeded,
    timestamp
  ) VALUES (
    '/admin/batch-reset',
    'ADMIN',
    'batch_reset_' || array_length(COALESCE(p_user_ids, ARRAY[]::UUID[]), 1),
    v_total_deleted,
    false,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- 3. 创建限流状态查询函数
CREATE OR REPLACE FUNCTION public.get_rate_limit_status(
  p_user_id UUID DEFAULT NULL,
  p_action VARCHAR DEFAULT 'video_generation'
) RETURNS TABLE (
  rate_limit_key VARCHAR,
  current_count INTEGER,
  max_allowed INTEGER,
  remaining INTEGER,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  reset_time TIMESTAMPTZ
) AS $$
DECLARE
  v_key_pattern VARCHAR;
  v_window_seconds INTEGER := 3600; -- 默认1小时
BEGIN
  -- 构建查询模式
  IF p_user_id IS NOT NULL THEN
    v_key_pattern := '%' || p_user_id || '%' || p_action || '%';
  ELSE
    v_key_pattern := '%' || p_action || '%';
  END IF;
  
  RETURN QUERY
  SELECT 
    r.rate_limit_key,
    SUM(r.request_count)::INTEGER as current_count,
    COALESCE(c.max_requests, 100) as max_allowed,
    GREATEST(0, COALESCE(c.max_requests, 100) - SUM(r.request_count)::INTEGER) as remaining,
    MIN(r.window_start) as window_start,
    MAX(r.window_end) as window_end,
    MAX(r.window_end) + (v_window_seconds || ' seconds')::INTERVAL as reset_time
  FROM public.rate_limit_records r
  LEFT JOIN public.user_rate_limit_config c ON (
    c.user_id = p_user_id AND c.action = p_action AND c.is_active = true
  )
  WHERE r.rate_limit_key LIKE v_key_pattern
    AND r.window_end > NOW() - (v_window_seconds || ' seconds')::INTERVAL
  GROUP BY r.rate_limit_key, c.max_requests
  ORDER BY MAX(r.window_end) DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建限流配置管理函数
CREATE OR REPLACE FUNCTION public.set_user_rate_limit(
  p_user_id UUID,
  p_action VARCHAR,
  p_max_requests INTEGER,
  p_window_seconds INTEGER DEFAULT 3600
) RETURNS TEXT AS $$
BEGIN
  INSERT INTO public.user_rate_limit_config (
    user_id,
    action,
    max_requests,
    window_seconds,
    is_active
  ) VALUES (
    p_user_id,
    p_action,
    p_max_requests,
    p_window_seconds,
    true
  )
  ON CONFLICT (user_id, action)
  DO UPDATE SET
    max_requests = p_max_requests,
    window_seconds = p_window_seconds,
    is_active = true,
    updated_at = NOW();
  
  RETURN 'Successfully set rate limit for user ' || p_user_id || 
         ': ' || p_max_requests || ' requests per ' || p_window_seconds || ' seconds';
END;
$$ LANGUAGE plpgsql;

-- 5. 创建自动化清理改进函数
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_data_v2()
RETURNS TABLE (
  cleanup_action TEXT,
  records_affected INTEGER
) AS $$
DECLARE
  v_deleted_records INTEGER;
  v_deleted_events INTEGER;
  v_deleted_blacklist INTEGER;
BEGIN
  -- 清理超过6小时的限流记录
  DELETE FROM public.rate_limit_records 
  WHERE created_at < NOW() - INTERVAL '6 hours'
    OR window_end < NOW() - INTERVAL '2 hours';
  
  GET DIAGNOSTICS v_deleted_records = ROW_COUNT;
  
  RETURN QUERY SELECT
    'Cleaned old rate limit records' as cleanup_action,
    v_deleted_records as records_affected;
  
  -- 清理超过7天的限流事件日志
  DELETE FROM public.rate_limit_events 
  WHERE timestamp < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_deleted_events = ROW_COUNT;
  
  RETURN QUERY SELECT
    'Cleaned old rate limit events' as cleanup_action,
    v_deleted_events as records_affected;
  
  -- 清理过期的IP黑名单记录
  DELETE FROM public.ip_blacklist 
  WHERE blocked_until < NOW() AND is_permanent = false;
  
  GET DIAGNOSTICS v_deleted_blacklist = ROW_COUNT;
  
  RETURN QUERY SELECT
    'Cleaned expired IP blacklist entries' as cleanup_action,
    v_deleted_blacklist as records_affected;
  
  -- 记录清理统计
  INSERT INTO public.rate_limit_events (
    path,
    method,
    total_hits,
    limit_exceeded,
    timestamp
  ) VALUES (
    '/system/cleanup-v2',
    'SYSTEM',
    v_deleted_records + v_deleted_events + v_deleted_blacklist,
    false,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- 6. 更新现有的限流检查函数使用新版本
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
BEGIN
  -- 重定向到新的改进版本
  RETURN QUERY SELECT * FROM public.check_rate_limit_v3(
    p_key, p_max_requests, p_window_seconds, p_ip_address, p_user_agent
  );
END;
$$ LANGUAGE plpgsql;

-- 7. 创建限流监控视图
CREATE OR REPLACE VIEW public.rate_limit_monitor AS
SELECT 
  rate_limit_key,
  SUM(request_count) as total_requests,
  COUNT(*) as record_count,
  MIN(window_start) as earliest_request,
  MAX(window_end) as latest_request,
  MAX(updated_at) as last_activity,
  CASE 
    WHEN rate_limit_key LIKE '%video%' THEN 100
    WHEN rate_limit_key LIKE '%api%' THEN 1000
    ELSE 50
  END as default_limit,
  CASE 
    WHEN SUM(request_count) > CASE 
      WHEN rate_limit_key LIKE '%video%' THEN 100
      WHEN rate_limit_key LIKE '%api%' THEN 1000
      ELSE 50
    END THEN 'EXCEEDED'
    WHEN SUM(request_count) > CASE 
      WHEN rate_limit_key LIKE '%video%' THEN 80
      WHEN rate_limit_key LIKE '%api%' THEN 800
      ELSE 40
    END THEN 'WARNING'
    ELSE 'OK'
  END as status
FROM public.rate_limit_records
WHERE window_end > NOW() - INTERVAL '1 hour'
GROUP BY rate_limit_key
ORDER BY total_requests DESC;

-- 8. 授予必要的权限
GRANT EXECUTE ON FUNCTION public.check_rate_limit_v3 TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_rate_limit_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_rate_limit TO authenticated;
GRANT SELECT ON public.rate_limit_monitor TO authenticated;

-- 只有服务角色可以执行管理函数
GRANT EXECUTE ON FUNCTION public.batch_reset_rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_data_v2 TO service_role;