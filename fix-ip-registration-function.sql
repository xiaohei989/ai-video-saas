-- 修复IP注册限制检查函数，增强错误处理和边缘情况处理
CREATE OR REPLACE FUNCTION check_ip_registration_limit(
  p_ip_address INET,
  p_time_window_hours INTEGER DEFAULT 24,
  p_max_registrations INTEGER DEFAULT 5
) RETURNS TABLE (
  can_register BOOLEAN,
  current_count INTEGER,
  blocked_until TIMESTAMPTZ,
  reason TEXT
) AS $$
DECLARE
  v_current_count INTEGER := 0;
  v_window_start TIMESTAMPTZ;
  v_blocked_until TIMESTAMPTZ;
BEGIN
  -- 输入验证
  IF p_ip_address IS NULL THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      0::INTEGER,
      NULL::TIMESTAMPTZ,
      'IP地址为空，跳过检查'::TEXT;
    RETURN;
  END IF;
  
  IF p_time_window_hours <= 0 OR p_max_registrations <= 0 THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      0::INTEGER,
      NULL::TIMESTAMPTZ,
      '无效的限制参数，跳过检查'::TEXT;
    RETURN;
  END IF;
  
  -- 计算时间窗口开始时间
  v_window_start := NOW() - (p_time_window_hours || ' hours')::INTERVAL;
  
  -- 安全地统计指定时间窗口内的注册次数
  BEGIN
    SELECT COALESCE(COUNT(*), 0) INTO v_current_count
    FROM public.ip_registration_attempts
    WHERE ip_address = p_ip_address
      AND created_at >= v_window_start
      AND success = true;
  EXCEPTION 
    WHEN OTHERS THEN
      -- 如果表不存在或权限问题，记录警告但允许注册
      RAISE WARNING 'IP registration check failed: %, allowing registration', SQLERRM;
      RETURN QUERY SELECT 
        true::BOOLEAN,
        0::INTEGER,
        NULL::TIMESTAMPTZ,
        'IP检查失败，允许注册继续'::TEXT;
      RETURN;
  END;
  
  -- 检查是否超过限制
  IF v_current_count >= p_max_registrations THEN
    -- 安全地计算阻止到什么时候
    BEGIN
      SELECT COALESCE(MAX(created_at), NOW()) + (p_time_window_hours || ' hours')::INTERVAL 
      INTO v_blocked_until
      FROM public.ip_registration_attempts
      WHERE ip_address = p_ip_address
        AND created_at >= v_window_start
        AND success = true;
    EXCEPTION 
      WHEN OTHERS THEN
        -- 如果计算失败，使用默认时间
        v_blocked_until := NOW() + (p_time_window_hours || ' hours')::INTERVAL;
    END;
    
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_current_count,
      v_blocked_until,
      format('IP地址在%s小时内已注册%s个账户，超过%s个限制', 
             p_time_window_hours, v_current_count, p_max_registrations)::TEXT;
  ELSE
    RETURN QUERY SELECT 
      true::BOOLEAN,
      v_current_count,
      NULL::TIMESTAMPTZ,
      format('IP注册次数检查通过（%s/%s）', v_current_count, p_max_registrations)::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 同样修复设备指纹检查函数
CREATE OR REPLACE FUNCTION check_device_fingerprint_limit(
  p_fingerprint_hash VARCHAR(64),
  p_max_registrations INTEGER DEFAULT 3
) RETURNS TABLE (
  can_register BOOLEAN,
  current_count INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_current_count INTEGER := 0;
BEGIN
  -- 输入验证
  IF p_fingerprint_hash IS NULL OR p_fingerprint_hash = '' THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      0::INTEGER,
      '设备指纹为空，跳过检查'::TEXT;
    RETURN;
  END IF;
  
  IF p_max_registrations <= 0 THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      0::INTEGER,
      '无效的限制参数，跳过检查'::TEXT;
    RETURN;
  END IF;
  
  -- 安全地统计设备指纹注册次数
  BEGIN
    SELECT COALESCE(COUNT(*), 0) INTO v_current_count
    FROM public.device_fingerprints
    WHERE fingerprint_hash = p_fingerprint_hash;
  EXCEPTION 
    WHEN OTHERS THEN
      -- 如果表不存在或权限问题，记录警告但允许注册
      RAISE WARNING 'Device fingerprint check failed: %, allowing registration', SQLERRM;
      RETURN QUERY SELECT 
        true::BOOLEAN,
        0::INTEGER,
        '设备指纹检查失败，允许注册继续'::TEXT;
      RETURN;
  END;
  
  -- 检查是否超过限制
  IF v_current_count >= p_max_registrations THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_current_count,
      format('设备已注册%s个账户，超过%s个限制', v_current_count, p_max_registrations)::TEXT;
  ELSE
    RETURN QUERY SELECT 
      true::BOOLEAN,
      v_current_count,
      CASE 
        WHEN v_current_count = 0 THEN '新设备，允许注册'
        ELSE format('设备注册检查通过（%s/%s）', v_current_count, p_max_registrations)
      END::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 确保函数权限正确
GRANT EXECUTE ON FUNCTION check_ip_registration_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_ip_registration_limit TO anon;
GRANT EXECUTE ON FUNCTION check_device_fingerprint_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_device_fingerprint_limit TO anon;

SELECT 'IP registration limit function fixed successfully' as status;