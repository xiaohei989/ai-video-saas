-- ============================================
-- Rate Limiting System Migration
-- 创建限流系统相关的表和函数
-- ============================================

-- ============================================
-- 1. 限流记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limit_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_limit_key VARCHAR(255) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_rate_limit_records_key_window 
  ON public.rate_limit_records(rate_limit_key, window_start, window_end);
  
CREATE INDEX IF NOT EXISTS idx_rate_limit_records_window_start 
  ON public.rate_limit_records(window_start);
  
CREATE INDEX IF NOT EXISTS idx_rate_limit_records_ip 
  ON public.rate_limit_records(ip_address);

-- ============================================
-- 2. 限流事件日志表
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET,
  user_agent TEXT,
  path VARCHAR(255),
  method VARCHAR(10),
  rate_limit_key VARCHAR(255),
  total_hits INTEGER,
  limit_exceeded BOOLEAN DEFAULT false,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_timestamp 
  ON public.rate_limit_events(timestamp DESC);
  
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ip 
  ON public.rate_limit_events(ip_address);
  
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_exceeded 
  ON public.rate_limit_events(limit_exceeded, timestamp DESC);

-- ============================================
-- 3. IP黑名单表
-- ============================================
CREATE TABLE IF NOT EXISTS public.ip_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET NOT NULL UNIQUE,
  reason TEXT,
  blocked_until TIMESTAMPTZ,
  is_permanent BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_ip ON public.ip_blacklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_blocked_until ON public.ip_blacklist(blocked_until);

-- ============================================
-- 4. 用户限流配置表
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_rate_limit_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_rate_limit_config_user_id 
  ON public.user_rate_limit_config(user_id);

-- ============================================
-- 5. 核心限流检查函数
-- ============================================
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. IP黑名单检查函数
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. 自动IP阻断函数
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. 用户特定限流配置函数
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. 限流统计函数
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. 清理过期记录函数
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
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. 触发器：自动清理和监控
-- ============================================

-- 创建自动清理触发器
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rate_limit_maintenance
  AFTER INSERT ON public.rate_limit_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_cleanup();

-- ============================================
-- 12. RLS 策略
-- ============================================

-- 启用行级安全
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rate_limit_config ENABLE ROW LEVEL SECURITY;

-- 只有管理员可以查看限流记录
CREATE POLICY "Admin can view rate limit events" ON public.rate_limit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email IN (
        SELECT value FROM public.system_settings WHERE key = 'admin_emails'
      )
    )
  );

-- 只有管理员可以管理IP黑名单
CREATE POLICY "Admin can manage IP blacklist" ON public.ip_blacklist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email IN (
        SELECT value FROM public.system_settings WHERE key = 'admin_emails'
      )
    )
  );

-- 用户只能查看自己的限流配置
CREATE POLICY "Users can view own rate limit config" ON public.user_rate_limit_config
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 13. 创建定期清理任务（使用pg_cron扩展）
-- ============================================

-- 如果有pg_cron扩展，创建定期清理任务
-- 每小时运行一次清理任务
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT public.cleanup_rate_limit_data();');

-- 每天运行一次IP阻断检查
-- SELECT cron.schedule('check-abusive-ips', '0 2 * * *', 'SELECT public.auto_block_abusive_ip();');

-- ============================================
-- 14. 插入默认用户限流配置
-- ============================================

-- 为高级用户提供更宽松的限流配置
INSERT INTO public.user_rate_limit_config (user_id, action, max_requests, window_seconds)
SELECT 
  p.id,
  'video_generation',
  CASE 
    WHEN s.tier = 'enterprise' THEN 100
    WHEN s.tier = 'pro' THEN 50  
    WHEN s.tier = 'basic' THEN 20
    ELSE 10
  END,
  3600 -- 1小时
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id AND s.status = 'active'
WHERE p.created_at > NOW() - INTERVAL '1 day'
ON CONFLICT (user_id, action) DO NOTHING;

-- ============================================
-- 完成迁移
-- ============================================

-- 记录迁移完成
INSERT INTO public.rate_limit_events (
  path,
  method,
  total_hits,
  limit_exceeded,
  timestamp
) VALUES (
  '/system/migration',
  'SYSTEM',
  0,
  false,
  NOW()
);