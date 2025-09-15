-- 更新数据库函数返回错误代码而非硬编码文字

-- 修改反欺诈检查函数返回错误代码
CREATE OR REPLACE FUNCTION public.validate_registration_security(
  p_email TEXT,
  p_ip_address INET DEFAULT NULL,
  p_device_fingerprint JSONB DEFAULT NULL
) RETURNS TABLE (
  can_register BOOLEAN,
  score INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_is_blocked_domain BOOLEAN := FALSE;
  v_ip_check RECORD;
  v_device_check RECORD;
BEGIN
  -- 1. 邮箱域名检查
  IF p_email IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.blocked_email_domains 
      WHERE domain = LOWER(SPLIT_PART(p_email, '@', 2)) 
        AND is_active = true
    ) INTO v_is_blocked_domain;
    
    IF v_is_blocked_domain THEN
      RETURN QUERY SELECT 
        false::BOOLEAN,
        0::INTEGER,
        'TEMPORARY_EMAIL_NOT_ALLOWED'::TEXT;
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
        'IP_REGISTRATION_LIMIT_EXCEEDED'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- 3. 设备指纹检查（如果提供）
  IF p_device_fingerprint IS NOT NULL THEN
    SELECT * INTO v_device_check
    FROM check_device_fingerprint_limit(
      (p_device_fingerprint->>'hash')::TEXT, 
      3
    );
    
    IF NOT v_device_check.can_register THEN
      RETURN QUERY SELECT 
        false::BOOLEAN,
        0::INTEGER,
        'DEVICE_REGISTRATION_LIMIT_EXCEEDED'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- 4. 通过所有检查
  RETURN QUERY SELECT 
    true::BOOLEAN,
    100::INTEGER,
    'REGISTRATION_ALLOWED'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 修改邀请处理函数返回错误代码
CREATE OR REPLACE FUNCTION public.process_invitation_with_anti_fraud(
  p_invitation_code TEXT,
  p_invitee_email TEXT,
  p_ip_address INET DEFAULT NULL,
  p_device_fingerprint JSONB DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  reward_amount INTEGER,
  message TEXT
) AS $$
DECLARE
  v_security_check RECORD;
  v_invitation RECORD;
  v_inviter_id UUID;
  v_current_user_id UUID;
BEGIN
  -- 获取当前用户ID
  v_current_user_id := auth.uid();
  
  -- 1. 安全检查
  SELECT * INTO v_security_check
  FROM validate_registration_security(p_invitee_email, p_ip_address, p_device_fingerprint);
  
  IF NOT v_security_check.can_register THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      0::INTEGER,
      v_security_check.reason::TEXT;
    RETURN;
  END IF;
  
  -- 2. 验证邀请码
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE invitation_code = p_invitation_code
    AND status = 'pending'
    AND expires_at > NOW();
  
  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      0::INTEGER,
      'INVITATION_INVALID_OR_EXPIRED'::TEXT;
    RETURN;
  END IF;
  
  v_inviter_id := v_invitation.inviter_id;
  
  -- 3. 检查是否是自己邀请自己
  IF v_inviter_id = v_current_user_id THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      0::INTEGER,
      'CANNOT_INVITE_YOURSELF'::TEXT;
    RETURN;
  END IF;
  
  -- 4. 检查用户是否已经有推荐人
  IF EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE id = v_current_user_id AND referred_by IS NOT NULL
  ) THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      0::INTEGER,
      'ALREADY_HAS_REFERRER'::TEXT;
    RETURN;
  END IF;
  
  -- 5. 更新邀请状态和用户信息
  UPDATE public.invitations
  SET 
    status = 'accepted',
    invitee_id = v_current_user_id,
    accepted_at = NOW()
  WHERE id = v_invitation.id;
  
  UPDATE public.profiles
  SET referred_by = v_inviter_id
  WHERE id = v_current_user_id;
  
  -- 6. 给邀请者和被邀请者发放奖励
  INSERT INTO public.credit_transactions (
    user_id, type, amount, description,
    reference_id, reference_type
  ) VALUES 
    (v_inviter_id, 'reward', 20, 'Invitation reward - inviter', v_invitation.id, 'invitation'),
    (v_current_user_id, 'reward', 20, 'Invitation reward - invitee', v_invitation.id, 'invitation');
  
  -- 7. 返回成功结果
  RETURN QUERY SELECT 
    true::BOOLEAN,
    20::INTEGER,
    'INVITATION_PROCESSED_SUCCESSFULLY'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;