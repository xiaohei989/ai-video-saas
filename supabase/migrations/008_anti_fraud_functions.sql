-- ============================================
-- 防刷系统核心函数
-- Version: 008
-- Description: 实现IP限制、速率限制、设备指纹等防刷功能
-- ============================================

-- ============================================
-- 1. IP注册次数检查函数
-- ============================================
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
  v_current_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_blocked_until TIMESTAMPTZ;
BEGIN
  -- 计算时间窗口开始时间
  v_window_start := NOW() - (p_time_window_hours || ' hours')::INTERVAL;
  
  -- 统计指定时间窗口内的注册次数
  SELECT COUNT(*) INTO v_current_count
  FROM public.ip_registration_attempts
  WHERE ip_address = p_ip_address
    AND created_at >= v_window_start
    AND success = true;
  
  -- 检查是否超过限制
  IF v_current_count >= p_max_registrations THEN
    -- 计算阻止到什么时候
    SELECT MAX(created_at) + (p_time_window_hours || ' hours')::INTERVAL 
    INTO v_blocked_until
    FROM public.ip_registration_attempts
    WHERE ip_address = p_ip_address
      AND created_at >= v_window_start
      AND success = true;
    
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_current_count,
      v_blocked_until,
      format('IP地址在%s小时内已注册%s个账户，超过%s个限制', p_time_window_hours, v_current_count, p_max_registrations);
  ELSE
    RETURN QUERY SELECT 
      true::BOOLEAN,
      v_current_count,
      NULL::TIMESTAMPTZ,
      'IP注册次数检查通过'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. 设备指纹检查函数
-- ============================================
CREATE OR REPLACE FUNCTION check_device_fingerprint_limit(
  p_fingerprint_hash VARCHAR(64),
  p_max_registrations INTEGER DEFAULT 3
) RETURNS TABLE (
  can_register BOOLEAN,
  current_count INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_current_count INTEGER;
  v_is_suspicious BOOLEAN;
BEGIN
  -- 查找现有的设备指纹记录
  SELECT registration_count, is_suspicious 
  INTO v_current_count, v_is_suspicious
  FROM public.device_fingerprints
  WHERE fingerprint_hash = p_fingerprint_hash;
  
  -- 如果没有记录，返回可以注册
  IF v_current_count IS NULL THEN
    RETURN QUERY SELECT 
      true::BOOLEAN,
      0::INTEGER,
      '新设备，允许注册'::TEXT;
    RETURN;
  END IF;
  
  -- 如果设备被标记为可疑，阻止注册
  IF v_is_suspicious THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_current_count,
      '设备已被标记为可疑，禁止注册'::TEXT;
    RETURN;
  END IF;
  
  -- 检查注册次数是否超过限制
  IF v_current_count >= p_max_registrations THEN
    -- 标记为可疑设备
    UPDATE public.device_fingerprints 
    SET is_suspicious = true, updated_at = NOW()
    WHERE fingerprint_hash = p_fingerprint_hash;
    
    RETURN QUERY SELECT 
      false::BOOLEAN,
      v_current_count,
      format('设备已注册%s个账户，超过%s个限制', v_current_count, p_max_registrations);
  ELSE
    RETURN QUERY SELECT 
      true::BOOLEAN,
      v_current_count,
      '设备注册次数检查通过'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. 邀请速率限制检查函数
-- ============================================
CREATE OR REPLACE FUNCTION check_invitation_rate_limit(
  p_user_id UUID
) RETURNS TABLE (
  can_invite BOOLEAN,
  reason TEXT,
  total_count INTEGER,
  hourly_count INTEGER,
  daily_count INTEGER,
  monthly_count INTEGER
) AS $$
DECLARE
  v_hourly_count INTEGER := 0;
  v_daily_count INTEGER := 0;
  v_monthly_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_hour_start TIMESTAMPTZ;
  v_day_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
  
  -- 限制配置
  v_max_hourly INTEGER := 3;
  v_max_daily INTEGER := 10;
  v_max_monthly INTEGER := 50;
  v_max_total INTEGER := 200;
BEGIN
  -- 计算时间窗口
  v_hour_start := date_trunc('hour', NOW());
  v_day_start := date_trunc('day', NOW());
  v_month_start := date_trunc('month', NOW());
  
  -- 统计各时间段的邀请数量
  SELECT 
    COUNT(*) FILTER (WHERE created_at >= v_hour_start),
    COUNT(*) FILTER (WHERE created_at >= v_day_start),
    COUNT(*) FILTER (WHERE created_at >= v_month_start),
    COUNT(*)
  INTO v_hourly_count, v_daily_count, v_monthly_count, v_total_count
  FROM public.invitations
  WHERE inviter_id = p_user_id;
  
  -- 检查各种限制
  IF v_hourly_count >= v_max_hourly THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('每小时最多创建%s个邀请，已创建%s个', v_max_hourly, v_hourly_count),
      v_total_count,
      v_hourly_count,
      v_daily_count,
      v_monthly_count;
    RETURN;
  END IF;
  
  IF v_daily_count >= v_max_daily THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('每日最多创建%s个邀请，已创建%s个', v_max_daily, v_daily_count),
      v_total_count,
      v_hourly_count,
      v_daily_count,
      v_monthly_count;
    RETURN;
  END IF;
  
  IF v_monthly_count >= v_max_monthly THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('每月最多创建%s个邀请，已创建%s个', v_max_monthly, v_monthly_count),
      v_total_count,
      v_hourly_count,
      v_daily_count,
      v_monthly_count;
    RETURN;
  END IF;
  
  IF v_total_count >= v_max_total THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('总共最多创建%s个邀请，已创建%s个', v_max_total, v_total_count),
      v_total_count,
      v_hourly_count,
      v_daily_count,
      v_monthly_count;
    RETURN;
  END IF;
  
  -- 所有检查通过
  RETURN QUERY SELECT 
    true::BOOLEAN,
    '邀请速率限制检查通过'::TEXT,
    v_total_count,
    v_hourly_count,
    v_daily_count,
    v_monthly_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. 记录注册尝试函数
-- ============================================
CREATE OR REPLACE FUNCTION record_registration_attempt(
  p_ip_address INET,
  p_email TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_device_fingerprint JSONB DEFAULT NULL,
  p_success BOOLEAN DEFAULT false,
  p_user_id UUID DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
  v_fingerprint_hash VARCHAR(64);
BEGIN
  -- 插入注册尝试记录
  INSERT INTO public.ip_registration_attempts (
    ip_address,
    email,
    user_agent,
    device_fingerprint,
    success,
    user_id,
    failure_reason
  ) VALUES (
    p_ip_address,
    p_email,
    p_user_agent,
    p_device_fingerprint,
    p_success,
    p_user_id,
    p_failure_reason
  ) RETURNING id INTO v_attempt_id;
  
  -- 如果有设备指纹，更新设备指纹表
  IF p_device_fingerprint IS NOT NULL THEN
    -- 生成指纹哈希
    v_fingerprint_hash := encode(sha256(p_device_fingerprint::TEXT::bytea), 'hex');
    
    -- 插入或更新设备指纹记录
    INSERT INTO public.device_fingerprints (
      user_id,
      fingerprint_hash,
      fingerprint_data,
      ip_address,
      user_agent,
      registration_count,
      last_seen_at
    ) VALUES (
      p_user_id,
      v_fingerprint_hash,
      p_device_fingerprint,
      p_ip_address,
      p_user_agent,
      CASE WHEN p_success THEN 1 ELSE 0 END,
      NOW()
    )
    ON CONFLICT (fingerprint_hash) DO UPDATE SET
      registration_count = CASE 
        WHEN p_success THEN device_fingerprints.registration_count + 1
        ELSE device_fingerprints.registration_count
      END,
      last_seen_at = NOW(),
      updated_at = NOW(),
      -- 如果注册成功且有user_id，更新user_id（处理多账户情况）
      user_id = CASE 
        WHEN p_success AND p_user_id IS NOT NULL THEN p_user_id
        ELSE device_fingerprints.user_id
      END;
  END IF;
  
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 带限制的邀请接受函数
-- ============================================
CREATE OR REPLACE FUNCTION accept_invitation_with_limits(
  p_invitation_code VARCHAR(20),
  p_invitee_id UUID,
  p_invitee_email TEXT,
  p_ip_address INET DEFAULT NULL,
  p_device_fingerprint JSONB DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  reward_credits INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_invitation RECORD;
  v_inviter_id UUID;
  v_reward_credits INTEGER;
  v_ip_check RECORD;
  v_device_check RECORD;
  v_fingerprint_hash VARCHAR(64);
  v_domain TEXT;
  v_is_blocked_domain BOOLEAN;
BEGIN
  -- 1. 验证邮箱域名（检查是否在黑名单中）
  IF p_invitee_email IS NOT NULL THEN
    v_domain := split_part(p_invitee_email, '@', 2);
    
    SELECT EXISTS (
      SELECT 1 FROM public.blocked_email_domains 
      WHERE domain = v_domain AND is_active = true
    ) INTO v_is_blocked_domain;
    
    IF v_is_blocked_domain THEN
      RETURN QUERY SELECT 
        false::BOOLEAN,
        0::INTEGER,
        '不允许使用临时邮箱地址'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- 2. IP地址注册次数检查
  IF p_ip_address IS NOT NULL THEN
    SELECT * INTO v_ip_check
    FROM check_ip_registration_limit(p_ip_address, 24, 5);
    
    IF NOT v_ip_check.can_register THEN
      RETURN QUERY SELECT 
        false::BOOLEAN,
        0::INTEGER,
        v_ip_check.reason;
      RETURN;
    END IF;
  END IF;
  
  -- 3. 设备指纹检查
  IF p_device_fingerprint IS NOT NULL THEN
    v_fingerprint_hash := encode(sha256(p_device_fingerprint::TEXT::bytea), 'hex');
    
    SELECT * INTO v_device_check
    FROM check_device_fingerprint_limit(v_fingerprint_hash, 3);
    
    IF NOT v_device_check.can_register THEN
      RETURN QUERY SELECT 
        false::BOOLEAN,
        0::INTEGER,
        v_device_check.reason;
      RETURN;
    END IF;
  END IF;
  
  -- 4. 查找并锁定邀请记录
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE invitation_code = p_invitation_code
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      0::INTEGER,
      '邀请码无效或已过期'::TEXT;
    RETURN;
  END IF;
  
  -- 5. 检查是否为自己邀请自己
  IF v_invitation.inviter_id = p_invitee_id THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      0::INTEGER,
      '不能使用自己的邀请码'::TEXT;
    RETURN;
  END IF;
  
  -- 6. 检查被邀请者是否已经被邀请过
  PERFORM 1 FROM public.profiles 
  WHERE id = p_invitee_id AND referred_by IS NOT NULL;
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      0::INTEGER,
      '您已经使用过邀请码了'::TEXT;
    RETURN;
  END IF;
  
  -- 7. 执行邀请接受逻辑
  v_inviter_id := v_invitation.inviter_id;
  v_reward_credits := v_invitation.reward_credits;
  
  -- 更新邀请状态
  UPDATE public.invitations
  SET 
    status = 'accepted',
    invitee_id = p_invitee_id,
    accepted_at = NOW()
  WHERE invitation_code = p_invitation_code;
  
  -- 更新被邀请者的推荐人
  UPDATE public.profiles
  SET referred_by = v_inviter_id
  WHERE id = p_invitee_id;
  
  -- 给邀请者添加奖励积分
  PERFORM add_user_credits(
    v_inviter_id,
    v_reward_credits,
    'reward',
    '邀请新用户奖励',
    p_invitee_id,
    'referral'
  );
  
  -- 给被邀请者添加欢迎积分（奖励的一半）
  PERFORM add_user_credits(
    p_invitee_id,
    v_reward_credits / 2,
    'reward',
    '新用户注册奖励',
    v_inviter_id,
    'signup_bonus'
  );
  
  -- 8. 记录成功的注册尝试
  IF p_ip_address IS NOT NULL THEN
    PERFORM record_registration_attempt(
      p_ip_address,
      p_invitee_email,
      NULL, -- user_agent 在前端调用时提供
      p_device_fingerprint,
      true,
      p_invitee_id,
      NULL
    );
  END IF;
  
  RETURN QUERY SELECT 
    true::BOOLEAN,
    v_reward_credits::INTEGER,
    '邀请接受成功'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 认证失败记录函数
-- ============================================
CREATE OR REPLACE FUNCTION record_auth_failure(
  p_ip_address INET,
  p_email TEXT DEFAULT NULL,
  p_attempt_type VARCHAR(20) DEFAULT 'login',
  p_failure_reason TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_failure_count INTEGER;
  v_block_duration INTERVAL;
  v_blocked_until TIMESTAMPTZ;
BEGIN
  -- 统计最近15分钟内的失败次数
  SELECT COUNT(*) INTO v_failure_count
  FROM public.auth_failure_attempts
  WHERE ip_address = p_ip_address
    AND attempt_type = p_attempt_type
    AND created_at >= NOW() - INTERVAL '15 minutes';
  
  -- 根据失败次数计算阻止时长
  IF v_failure_count >= 10 THEN
    v_block_duration := INTERVAL '1 hour';
  ELSIF v_failure_count >= 5 THEN
    v_block_duration := INTERVAL '15 minutes';
  ELSE
    v_block_duration := NULL;
  END IF;
  
  -- 计算阻止截止时间
  IF v_block_duration IS NOT NULL THEN
    v_blocked_until := NOW() + v_block_duration;
  END IF;
  
  -- 插入失败记录
  INSERT INTO public.auth_failure_attempts (
    ip_address,
    email,
    attempt_type,
    failure_reason,
    user_agent,
    blocked_until
  ) VALUES (
    p_ip_address,
    p_email,
    p_attempt_type,
    p_failure_reason,
    p_user_agent,
    v_blocked_until
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. 检查IP是否被阻止函数
-- ============================================
CREATE OR REPLACE FUNCTION check_ip_auth_block(
  p_ip_address INET,
  p_attempt_type VARCHAR(20) DEFAULT 'login'
) RETURNS TABLE (
  is_blocked BOOLEAN,
  blocked_until TIMESTAMPTZ,
  reason TEXT,
  failure_count INTEGER
) AS $$
DECLARE
  v_latest_block TIMESTAMPTZ;
  v_failure_count INTEGER;
BEGIN
  -- 查找最新的阻止时间
  SELECT MAX(blocked_until), COUNT(*)
  INTO v_latest_block, v_failure_count
  FROM public.auth_failure_attempts
  WHERE ip_address = p_ip_address
    AND attempt_type = p_attempt_type
    AND created_at >= NOW() - INTERVAL '1 hour' -- 只查看最近1小时
    AND blocked_until IS NOT NULL;
  
  -- 如果没有阻止记录或已过期
  IF v_latest_block IS NULL OR v_latest_block <= NOW() THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      NULL::TIMESTAMPTZ,
      'IP地址认证检查通过'::TEXT,
      COALESCE(v_failure_count, 0);
  ELSE
    RETURN QUERY SELECT 
      true::BOOLEAN,
      v_latest_block,
      format('IP地址因多次失败被临时阻止，解除时间：%s', v_latest_block::TEXT),
      v_failure_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. 增强版临时邮箱检测函数
-- ============================================
CREATE OR REPLACE FUNCTION is_blocked_email_domain(
  p_email TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_domain TEXT;
BEGIN
  -- 提取域名
  v_domain := split_part(p_email, '@', 2);
  
  -- 检查是否在黑名单中
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_email_domains
    WHERE domain = v_domain AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. 清理过期记录函数
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_security_records()
RETURNS TABLE (
  table_name TEXT,
  deleted_count INTEGER
) AS $$
DECLARE
  v_ip_attempts_deleted INTEGER;
  v_auth_failures_deleted INTEGER;
  v_rate_limits_deleted INTEGER;
BEGIN
  -- 清理7天前的IP注册尝试记录
  DELETE FROM public.ip_registration_attempts
  WHERE created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_ip_attempts_deleted = ROW_COUNT;
  
  -- 清理1天前的认证失败记录
  DELETE FROM public.auth_failure_attempts
  WHERE created_at < NOW() - INTERVAL '1 day';
  GET DIAGNOSTICS v_auth_failures_deleted = ROW_COUNT;
  
  -- 清理30天前的邀请速率限制记录
  DELETE FROM public.invitation_rate_limits
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_rate_limits_deleted = ROW_COUNT;
  
  -- 返回清理结果
  RETURN QUERY VALUES 
    ('ip_registration_attempts', v_ip_attempts_deleted),
    ('auth_failure_attempts', v_auth_failures_deleted),
    ('invitation_rate_limits', v_rate_limits_deleted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. 安全统计函数
-- ============================================
CREATE OR REPLACE FUNCTION get_security_stats(
  p_time_range_hours INTEGER DEFAULT 24
) RETURNS TABLE (
  metric_name TEXT,
  metric_value INTEGER,
  description TEXT
) AS $$
DECLARE
  v_time_start TIMESTAMPTZ;
BEGIN
  v_time_start := NOW() - (p_time_range_hours || ' hours')::INTERVAL;
  
  RETURN QUERY
  WITH stats AS (
    SELECT 
      'total_registration_attempts' as metric,
      COUNT(*)::INTEGER as value,
      format('最近%s小时总注册尝试次数', p_time_range_hours) as desc
    FROM public.ip_registration_attempts
    WHERE created_at >= v_time_start
    
    UNION ALL
    
    SELECT 
      'successful_registrations' as metric,
      COUNT(*)::INTEGER as value,
      format('最近%s小时成功注册次数', p_time_range_hours) as desc
    FROM public.ip_registration_attempts
    WHERE created_at >= v_time_start AND success = true
    
    UNION ALL
    
    SELECT 
      'failed_registrations' as metric,
      COUNT(*)::INTEGER as value,
      format('最近%s小时失败注册次数', p_time_range_hours) as desc
    FROM public.ip_registration_attempts
    WHERE created_at >= v_time_start AND success = false
    
    UNION ALL
    
    SELECT 
      'blocked_ips' as metric,
      COUNT(DISTINCT ip_address)::INTEGER as value,
      format('最近%s小时被阻止的IP数量', p_time_range_hours) as desc
    FROM public.auth_failure_attempts
    WHERE created_at >= v_time_start AND blocked_until > NOW()
    
    UNION ALL
    
    SELECT 
      'suspicious_devices' as metric,
      COUNT(*)::INTEGER as value,
      '被标记为可疑的设备数量' as desc
    FROM public.device_fingerprints
    WHERE is_suspicious = true
  )
  SELECT 
    stats.metric as metric_name,
    stats.value as metric_value,
    stats.desc as description
  FROM stats
  ORDER BY stats.metric;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 权限设置
-- ============================================

-- 核心防刷函数权限
GRANT EXECUTE ON FUNCTION check_ip_registration_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_device_fingerprint_limit TO authenticated;
GRANT EXECUTE ON FUNCTION check_invitation_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation_with_limits TO authenticated;
GRANT EXECUTE ON FUNCTION record_registration_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION record_auth_failure TO authenticated;
GRANT EXECUTE ON FUNCTION check_ip_auth_block TO authenticated;
GRANT EXECUTE ON FUNCTION is_blocked_email_domain TO authenticated;

-- 管理和维护函数权限
GRANT EXECUTE ON FUNCTION cleanup_security_records TO service_role;
GRANT EXECUTE ON FUNCTION get_security_stats TO service_role;

-- ============================================
-- 完成
-- ============================================