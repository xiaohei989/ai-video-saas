-- 部署缺失的防刷RPC函数
-- 基于008_anti_fraud_functions.sql

-- ============================================
-- 带限制的邀请接受函数
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
-- 认证失败记录函数
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
-- 检查IP是否被阻止函数
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
-- 设置函数权限
-- ============================================

-- 核心防刷函数权限
GRANT EXECUTE ON FUNCTION accept_invitation_with_limits TO authenticated;
GRANT EXECUTE ON FUNCTION record_auth_failure TO authenticated;
GRANT EXECUTE ON FUNCTION check_ip_auth_block TO authenticated;

-- 完成
SELECT 'Missing anti-fraud functions deployed successfully' as status;