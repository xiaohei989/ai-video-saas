-- ============================================
-- 邀请系统相关函数
-- Version: 006
-- Description: 添加邀请系统的数据库函数
-- ============================================

-- 接受邀请的函数（原子操作）
CREATE OR REPLACE FUNCTION accept_invitation(
  p_invitation_code VARCHAR(20),
  p_invitee_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_invitation RECORD;
  v_inviter_id UUID;
  v_reward_credits INTEGER;
BEGIN
  -- 查找并锁定邀请记录
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE invitation_code = p_invitation_code
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;
  
  -- 检查是否为自己邀请自己
  IF v_invitation.inviter_id = p_invitee_id THEN
    RAISE EXCEPTION 'Cannot use own invitation code';
  END IF;
  
  -- 检查被邀请者是否已经被邀请过
  PERFORM 1 FROM public.profiles 
  WHERE id = p_invitee_id AND referred_by IS NOT NULL;
  
  IF FOUND THEN
    RAISE EXCEPTION 'User already has a referrer';
  END IF;
  
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
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户邀请统计
CREATE OR REPLACE FUNCTION get_referral_stats(
  p_user_id UUID
) RETURNS TABLE (
  total_invitations INTEGER,
  successful_invitations INTEGER,
  pending_invitations INTEGER,
  total_rewards_earned INTEGER,
  success_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_invitations,
    SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END)::INTEGER as successful_invitations,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::INTEGER as pending_invitations,
    COALESCE(SUM(
      CASE WHEN status = 'accepted' 
      THEN reward_credits 
      ELSE 0 END
    ), 0)::INTEGER as total_rewards_earned,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND(
          (SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
          2
        )
      ELSE 0
    END as success_rate
  FROM public.invitations
  WHERE inviter_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取邀请排行榜
CREATE OR REPLACE FUNCTION get_referral_leaderboard(
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  successful_invitations BIGINT,
  total_rewards INTEGER,
  rank_position BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH referral_stats AS (
    SELECT 
      i.inviter_id,
      COUNT(CASE WHEN i.status = 'accepted' THEN 1 END) as successful_count,
      SUM(CASE WHEN i.status = 'accepted' THEN i.reward_credits ELSE 0 END) as total_rewards
    FROM public.invitations i
    GROUP BY i.inviter_id
    HAVING COUNT(CASE WHEN i.status = 'accepted' THEN 1 END) > 0
  )
  SELECT 
    p.id as user_id,
    p.username,
    p.avatar_url,
    rs.successful_count as successful_invitations,
    rs.total_rewards::INTEGER,
    ROW_NUMBER() OVER (ORDER BY rs.successful_count DESC, rs.total_rewards DESC) as rank_position
  FROM referral_stats rs
  JOIN public.profiles p ON p.id = rs.inviter_id
  ORDER BY rs.successful_count DESC, rs.total_rewards DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理过期邀请的函数
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取邀请详情（包含邀请者信息）
CREATE OR REPLACE FUNCTION get_invitation_details(
  p_invitation_code VARCHAR(20)
) RETURNS TABLE (
  invitation_id UUID,
  inviter_id UUID,
  inviter_username TEXT,
  inviter_avatar_url TEXT,
  reward_credits INTEGER,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id as invitation_id,
    i.inviter_id,
    p.username as inviter_username,
    p.avatar_url as inviter_avatar_url,
    i.reward_credits,
    i.expires_at,
    i.status
  FROM public.invitations i
  JOIN public.profiles p ON p.id = i.inviter_id
  WHERE i.invitation_code = p_invitation_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 批量生成邀请码（用于活动等场景）
CREATE OR REPLACE FUNCTION generate_bulk_invitations(
  p_inviter_id UUID,
  p_count INTEGER,
  p_reward_credits INTEGER DEFAULT 50,
  p_expiry_days INTEGER DEFAULT 30
) RETURNS TABLE (
  invitation_code VARCHAR(20),
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  i INTEGER;
  v_code VARCHAR(20);
  v_expires_at TIMESTAMPTZ;
BEGIN
  FOR i IN 1..p_count LOOP
    -- 生成唯一邀请码
    LOOP
      v_code := UPPER(
        SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8)
      );
      
      -- 检查是否已存在
      PERFORM 1 FROM public.invitations WHERE invitation_code = v_code;
      EXIT WHEN NOT FOUND;
    END LOOP;
    
    v_expires_at := NOW() + (p_expiry_days || ' days')::INTERVAL;
    
    -- 插入邀请记录
    INSERT INTO public.invitations (
      inviter_id,
      invitation_code,
      reward_credits,
      expires_at
    ) VALUES (
      p_inviter_id,
      v_code,
      p_reward_credits,
      v_expires_at
    );
    
    -- 返回生成的邀请码
    invitation_code := v_code;
    expires_at := v_expires_at;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户被邀请信息
CREATE OR REPLACE FUNCTION get_user_referrer_info(
  p_user_id UUID
) RETURNS TABLE (
  referrer_id UUID,
  referrer_username TEXT,
  referrer_avatar_url TEXT,
  invitation_date TIMESTAMPTZ,
  bonus_received INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as referrer_id,
    p.username as referrer_username,
    p.avatar_url as referrer_avatar_url,
    i.accepted_at as invitation_date,
    i.reward_credits / 2 as bonus_received  -- 被邀请者获得一半积分
  FROM public.profiles target
  LEFT JOIN public.profiles p ON p.id = target.referred_by
  LEFT JOIN public.invitations i ON i.inviter_id = target.referred_by 
    AND i.invitee_id = target.id 
    AND i.status = 'accepted'
  WHERE target.id = p_user_id
    AND target.referred_by IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 设置函数权限
GRANT EXECUTE ON FUNCTION accept_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_invitation_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_referrer_info TO authenticated;

-- 管理员函数权限
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations TO service_role;
GRANT EXECUTE ON FUNCTION generate_bulk_invitations TO service_role;

-- 创建定期清理过期邀请的定时任务（需要pg_cron扩展）
-- SELECT cron.schedule('cleanup-expired-invitations', '0 2 * * *', 'SELECT cleanup_expired_invitations();');