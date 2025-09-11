-- ============================================
-- 紧急修复：重置视频生成限流计数器
-- ============================================

-- 1. 查看当前限流记录状态
SELECT 
  rate_limit_key,
  request_count,
  window_start,
  window_end,
  created_at,
  updated_at
FROM public.rate_limit_records 
WHERE rate_limit_key LIKE '%video%' 
ORDER BY updated_at DESC 
LIMIT 20;

-- 2. 查看限流事件日志
SELECT 
  path,
  total_hits,
  limit_exceeded,
  ip_address,
  user_id,
  timestamp
FROM public.rate_limit_events 
WHERE limit_exceeded = true 
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC 
LIMIT 20;

-- 3. 紧急重置：清理所有视频生成相关的限流记录
DELETE FROM public.rate_limit_records 
WHERE rate_limit_key LIKE '%video%' 
  OR rate_limit_key LIKE '%generate%'
  OR rate_limit_key LIKE '%create%';

-- 4. 清理过期的限流记录（超过24小时）
DELETE FROM public.rate_limit_records 
WHERE window_end < NOW() - INTERVAL '24 hours';

-- 5. 重置特定用户的限流记录（如果知道用户ID）
-- 如果你有特定的用户ID，请取消注释并替换 'your-user-id'
-- DELETE FROM public.rate_limit_records 
-- WHERE rate_limit_key LIKE '%your-user-id%';

-- 6. 创建临时重置函数（管理员使用）
CREATE OR REPLACE FUNCTION public.reset_user_rate_limit(
  p_user_id UUID DEFAULT NULL,
  p_action VARCHAR DEFAULT 'video_generation'
) RETURNS TEXT AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF p_user_id IS NOT NULL THEN
    -- 重置特定用户的限流
    DELETE FROM public.rate_limit_records 
    WHERE rate_limit_key LIKE '%' || p_user_id || '%' 
      AND rate_limit_key LIKE '%' || p_action || '%';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 记录重置事件
    INSERT INTO public.rate_limit_events (
      path,
      method,
      rate_limit_key,
      total_hits,
      limit_exceeded,
      user_id,
      timestamp
    ) VALUES (
      '/admin/reset-rate-limit',
      'ADMIN',
      p_user_id || ':' || p_action,
      0,
      false,
      p_user_id,
      NOW()
    );
    
    RETURN 'Reset ' || deleted_count || ' rate limit records for user ' || p_user_id;
  ELSE
    -- 重置所有相关限流
    DELETE FROM public.rate_limit_records 
    WHERE rate_limit_key LIKE '%' || p_action || '%';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN 'Reset ' || deleted_count || ' rate limit records for action ' || p_action;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. 验证重置结果
SELECT 
  COUNT(*) as remaining_records,
  MAX(updated_at) as latest_record
FROM public.rate_limit_records;

-- 8. 显示当前活跃的限流记录
SELECT 
  rate_limit_key,
  request_count,
  window_start,
  window_end
FROM public.rate_limit_records 
WHERE window_end > NOW()
ORDER BY updated_at DESC;

-- 9. 设置用户特定的限流配置（可选）
-- 为当前用户设置更高的限流配置
INSERT INTO public.user_rate_limit_config (
  user_id,
  action,
  max_requests,
  window_seconds,
  is_active
) 
SELECT 
  id,
  'video_generation',
  200, -- 临时提高到200次/小时
  3600,
  true
FROM public.profiles 
WHERE email = 'user@example.com' -- 替换为实际用户邮箱
ON CONFLICT (user_id, action) 
DO UPDATE SET 
  max_requests = 200,
  updated_at = NOW();