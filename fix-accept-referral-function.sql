-- 修复 accept_referral_code 函数中的变量覆盖错误
-- 问题：v_inviter_id 被 referred_by 字段覆盖，导致积分交易记录插入失败

CREATE OR REPLACE FUNCTION public.accept_referral_code(
  referral_code character varying, 
  invitee_id uuid, 
  invitee_email text, 
  ip_addr inet DEFAULT NULL::inet, 
  device_data text DEFAULT NULL::text
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_inviter_id UUID;
  v_inviter_email TEXT;
  v_existing_referrer UUID;  -- 新增：用于存储现有推荐人ID
  v_domain TEXT;
  v_is_blocked BOOLEAN;
  v_inviter_credits_before INTEGER;
  v_invitee_credits_before INTEGER;
  v_reward_credits INTEGER := 20;
BEGIN
  -- 1. 验证邮箱域名（临时邮箱检测）
  v_domain := split_part(invitee_email, '@', 2);
  
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_email_domains 
    WHERE domain = v_domain AND is_active = true
  ) INTO v_is_blocked;
  
  IF v_is_blocked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '不允许使用临时邮箱地址'
    );
  END IF;

  -- 2. 查找邀请人（通过referral_code）
  SELECT id, email INTO v_inviter_id, v_inviter_email
  FROM public.profiles
  WHERE profiles.referral_code = accept_referral_code.referral_code;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '邀请码无效'
    );
  END IF;

  -- 3. 检查是否自己邀请自己
  IF v_inviter_id = invitee_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '不能使用自己的邀请码'
    );
  END IF;

  -- 4. 检查被邀请人是否存在以及是否已有推荐人
  -- 🔧 关键修复：使用新变量 v_existing_referrer 避免覆盖 v_inviter_id
  SELECT credits, referred_by INTO v_invitee_credits_before, v_existing_referrer
  FROM public.profiles
  WHERE id = invitee_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '被邀请用户不存在，请先完成注册'
    );
  END IF;

  -- 检查是否已有推荐人
  IF v_existing_referrer IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '您已经使用过邀请码了'
    );
  END IF;

  -- 5. 获取邀请人当前积分余额
  SELECT credits INTO v_inviter_credits_before
  FROM public.profiles WHERE id = v_inviter_id;

  -- 6. 更新被邀请人的推荐关系
  UPDATE public.profiles
  SET 
    referred_by = v_inviter_id,
    updated_at = NOW()
  WHERE id = invitee_id;

  -- 7. 给邀请人添加20积分
  UPDATE public.profiles
  SET 
    credits = credits + v_reward_credits,
    total_credits_earned = total_credits_earned + v_reward_credits,
    updated_at = NOW()
  WHERE id = v_inviter_id;

  -- 8. 给被邀请人添加20积分
  UPDATE public.profiles
  SET 
    credits = credits + v_reward_credits,
    total_credits_earned = total_credits_earned + v_reward_credits,
    updated_at = NOW()
  WHERE id = invitee_id;

  -- 9. 记录邀请人的积分交易
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type
  ) VALUES (
    v_inviter_id,  -- 现在这个值不会被覆盖了
    'reward',
    v_reward_credits,
    v_inviter_credits_before,
    v_inviter_credits_before + v_reward_credits,
    '邀请新用户奖励',
    invitee_id::TEXT,
    'referral'
  );

  -- 10. 记录被邀请人的积分交易
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type
  ) VALUES (
    invitee_id,
    'reward',
    v_reward_credits,
    v_invitee_credits_before,
    v_invitee_credits_before + v_reward_credits,
    '新用户注册奖励',
    v_inviter_id::TEXT,
    'signup_bonus'
  );

  -- 11. 记录注册尝试（如果提供了IP地址）
  IF ip_addr IS NOT NULL THEN
    PERFORM record_registration_attempt(
      ip_addr,
      invitee_email,
      NULL, -- user_agent 在前端提供
      device_data::JSONB,
      true,
      invitee_id,
      NULL
    );
  END IF;

  -- 12. 返回成功结果
  RETURN jsonb_build_object(
    'success', true,
    'reward_credits', v_reward_credits,
    'inviter_id', v_inviter_id,
    'inviter_email', v_inviter_email,
    'message', '邀请码处理成功'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- 记录详细错误信息
    RAISE LOG 'accept_referral_code error: % %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', '处理邀请码时发生错误: ' || SQLERRM
    );
END;
$function$;