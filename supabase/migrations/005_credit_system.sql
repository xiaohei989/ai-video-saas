-- ============================================
-- 积分系统相关函数
-- Version: 005
-- Description: 添加积分系统的安全操作函数
-- ============================================

-- 消费用户积分的函数（原子操作）
CREATE OR REPLACE FUNCTION consume_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- 获取当前积分余额并锁定行
  SELECT credits INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- 检查余额是否充足
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF current_balance < p_amount THEN
    RETURN NULL; -- 余额不足
  END IF;
  
  -- 计算新余额
  new_balance := current_balance - p_amount;
  
  -- 更新用户积分
  UPDATE public.profiles 
  SET 
    credits = new_balance,
    total_credits_spent = total_credits_spent + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- 记录交易
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
    p_user_id,
    'consume',
    -p_amount, -- 负数表示消费
    current_balance,
    new_balance,
    p_description,
    p_reference_id,
    p_reference_type
  );
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加用户积分的函数（原子操作）
CREATE OR REPLACE FUNCTION add_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type VARCHAR(20),
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- 获取当前积分余额并锁定行
  SELECT credits INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- 计算新余额
  new_balance := current_balance + p_amount;
  
  -- 更新用户积分
  UPDATE public.profiles 
  SET 
    credits = new_balance,
    total_credits_earned = total_credits_earned + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- 记录交易
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
    p_user_id,
    p_type,
    p_amount, -- 正数表示增加
    current_balance,
    new_balance,
    p_description,
    p_reference_id,
    p_reference_type
  );
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 批量处理积分的函数（比如邀请奖励）
CREATE OR REPLACE FUNCTION process_referral_rewards(
  p_inviter_id UUID,
  p_invitee_id UUID,
  p_reward_amount INTEGER DEFAULT 50
) RETURNS BOOLEAN AS $$
BEGIN
  -- 给邀请者添加积分
  PERFORM add_user_credits(
    p_inviter_id,
    p_reward_amount,
    'reward',
    '邀请新用户奖励',
    p_invitee_id,
    'referral'
  );
  
  -- 给被邀请者也添加一些积分
  PERFORM add_user_credits(
    p_invitee_id,
    p_reward_amount / 2, -- 被邀请者获得一半积分
    'reward',
    '新用户注册奖励',
    p_inviter_id,
    'signup_bonus'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户积分排行榜
CREATE OR REPLACE FUNCTION get_credit_leaderboard(
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  total_credits_earned INTEGER,
  current_balance INTEGER,
  rank_position BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    p.avatar_url,
    p.total_credits_earned,
    p.credits as current_balance,
    ROW_NUMBER() OVER (ORDER BY p.total_credits_earned DESC) as rank_position
  FROM public.profiles p
  WHERE p.total_credits_earned > 0
  ORDER BY p.total_credits_earned DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户积分统计摘要
CREATE OR REPLACE FUNCTION get_user_credit_summary(
  p_user_id UUID
) RETURNS TABLE (
  current_balance INTEGER,
  total_earned INTEGER,
  total_spent INTEGER,
  transactions_count BIGINT,
  last_transaction_date TIMESTAMPTZ,
  monthly_spent INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.credits as current_balance,
    p.total_credits_earned as total_earned,
    p.total_credits_spent as total_spent,
    COUNT(ct.id) as transactions_count,
    MAX(ct.created_at) as last_transaction_date,
    COALESCE(SUM(
      CASE 
        WHEN ct.type = 'consume' AND ct.created_at >= date_trunc('month', CURRENT_DATE)
        THEN ABS(ct.amount)
        ELSE 0
      END
    ), 0)::INTEGER as monthly_spent
  FROM public.profiles p
  LEFT JOIN public.credit_transactions ct ON ct.user_id = p.id
  WHERE p.id = p_user_id
  GROUP BY p.credits, p.total_credits_earned, p.total_credits_spent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理旧的积分交易记录（保留最近6个月）
CREATE OR REPLACE FUNCTION cleanup_old_credit_transactions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.credit_transactions
  WHERE created_at < NOW() - INTERVAL '6 months';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 验证积分余额的函数（用于数据一致性检查）
CREATE OR REPLACE FUNCTION validate_credit_balances()
RETURNS TABLE (
  user_id UUID,
  profile_balance INTEGER,
  calculated_balance INTEGER,
  difference INTEGER
) AS $$
DECLARE
  v_default_credits INTEGER;
BEGIN
  -- 从系统配置表中获取默认积分
  SELECT COALESCE(setting_value::INTEGER, 50) INTO v_default_credits
  FROM public.system_settings 
  WHERE setting_key = 'default_user_credits';
  
  RETURN QUERY
  WITH transaction_sums AS (
    SELECT 
      ct.user_id,
      SUM(ct.amount) as calculated_balance
    FROM public.credit_transactions ct
    GROUP BY ct.user_id
  )
  SELECT 
    p.id as user_id,
    p.credits as profile_balance,
    COALESCE(ts.calculated_balance + v_default_credits, v_default_credits) as calculated_balance,
    (p.credits - COALESCE(ts.calculated_balance + v_default_credits, v_default_credits)) as difference
  FROM public.profiles p
  LEFT JOIN transaction_sums ts ON ts.user_id = p.id
  WHERE p.credits != COALESCE(ts.calculated_balance + v_default_credits, v_default_credits);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为 RPC 函数设置权限（只有认证用户可以调用某些函数）
GRANT EXECUTE ON FUNCTION consume_user_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_credits TO authenticated;
GRANT EXECUTE ON FUNCTION process_referral_rewards TO authenticated;
GRANT EXECUTE ON FUNCTION get_credit_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_credit_summary TO authenticated;

-- 管理员函数权限
GRANT EXECUTE ON FUNCTION cleanup_old_credit_transactions TO service_role;
GRANT EXECUTE ON FUNCTION validate_credit_balances TO service_role;