-- ==========================================
-- 数据库修复补丁集合
-- 包含各种功能修复和数据修正
-- ==========================================

-- 1. 修复邀请推荐功能
-- 来源: fix-accept-referral-function.sql
CREATE OR REPLACE FUNCTION accept_referral(
  referrer_code TEXT,
  new_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  referrer_user_id UUID;
  credit_reward INTEGER := 10; -- 推荐奖励积分
BEGIN
  -- 查找推荐人
  SELECT id INTO referrer_user_id 
  FROM profiles 
  WHERE referral_code = referrer_code;
  
  IF referrer_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 防止自己推荐自己
  IF referrer_user_id = new_user_id THEN
    RETURN FALSE;
  END IF;
  
  -- 检查是否已经使用过推荐码
  IF EXISTS (
    SELECT 1 FROM user_referrals 
    WHERE referred_user_id = new_user_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- 记录推荐关系
  INSERT INTO user_referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status,
    created_at
  ) VALUES (
    referrer_user_id,
    new_user_id,
    referrer_code,
    'completed',
    NOW()
  );
  
  -- 给推荐人奖励积分
  UPDATE profiles 
  SET 
    credits = credits + credit_reward,
    total_credits_earned = total_credits_earned + credit_reward
  WHERE id = referrer_user_id;
  
  -- 记录积分交易
  INSERT INTO credit_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_id
  ) VALUES (
    referrer_user_id,
    credit_reward,
    'referral_reward',
    '邀请新用户奖励',
    new_user_id::TEXT
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 2. 修复支付表结构
-- 来源: fix-payment-table.sql
ALTER TABLE IF EXISTS payment_records 
ALTER COLUMN amount_total TYPE INTEGER USING amount_total::INTEGER;

-- 3. 修复订阅分配问题
-- 来源: fix-subscription-distribution.sql
CREATE OR REPLACE FUNCTION ensure_unique_active_subscription(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  -- 如果用户有多个活跃订阅，只保留最新的一个
  WITH ranked_subscriptions AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
    FROM subscriptions 
    WHERE user_id = user_id_param AND status = 'active'
  )
  UPDATE subscriptions 
  SET status = 'cancelled'
  WHERE id IN (
    SELECT id FROM ranked_subscriptions WHERE rn > 1
  );
END;
$$ LANGUAGE plpgsql;

-- 4. 修复推荐缓存问题
-- 来源: fix-referral-cache-issue.sql
CREATE OR REPLACE FUNCTION refresh_referral_stats(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles 
  SET referral_count = (
    SELECT COUNT(*) 
    FROM user_referrals 
    WHERE referrer_user_id = user_id_param 
    AND status = 'completed'
  )
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- 5. 修复订单函数
-- 来源: fix-orders-functions.sql
CREATE OR REPLACE FUNCTION get_user_orders(user_id_param UUID)
RETURNS TABLE(
  id UUID,
  stripe_payment_intent_id TEXT,
  amount_total INTEGER,
  currency TEXT,
  status TEXT,
  subscription_tier TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.stripe_payment_intent_id,
    pr.amount_total,
    pr.currency,
    pr.status,
    pr.metadata->>'subscription_tier' as subscription_tier,
    pr.created_at
  FROM payment_records pr
  WHERE pr.user_id = user_id_param
  ORDER BY pr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. 修复CORS相关问题
-- 来源: fix-specific-video-cors.sql
-- 注：这个修复主要在应用层处理，数据库层面添加标记字段
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS cors_enabled BOOLEAN DEFAULT true;

-- 设置权限
GRANT EXECUTE ON FUNCTION accept_referral(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_unique_active_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_referral_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_orders(UUID) TO authenticated;

-- 创建索引优化性能
CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON user_referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_referred ON user_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON credit_transactions(user_id, transaction_type);