-- ============================================
-- 订阅系统重构迁移
-- Version: 002
-- Description: 重构订阅系统，支持升级降级和积分管理
-- ============================================

-- ============================================
-- 1. 创建新的枚举类型
-- ============================================

-- 订阅操作类型
CREATE TYPE subscription_action AS ENUM (
  'new',        -- 新订阅
  'upgrade',    -- 升级
  'downgrade',  -- 降级
  'renewal',    -- 续费
  'cancel'      -- 取消
);

-- ============================================
-- 2. 修改subscriptions表结构
-- ============================================

-- 移除UNIQUE(user_id, status)约束（如果存在）
ALTER TABLE public.subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_user_id_status_key;

-- 添加新字段
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS previous_tier subscription_tier,
ADD COLUMN IF NOT EXISTS action subscription_action DEFAULT 'new',
ADD COLUMN IF NOT EXISTS upgraded_from UUID REFERENCES public.subscriptions(id),
ADD COLUMN IF NOT EXISTS days_remaining INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS credits_change INTEGER DEFAULT 0;

-- ============================================
-- 3. 创建订阅变更记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscription_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action subscription_action NOT NULL,
  from_tier subscription_tier,
  to_tier subscription_tier NOT NULL,
  from_subscription_id TEXT,
  to_subscription_id TEXT NOT NULL,
  credits_change INTEGER DEFAULT 0,
  days_remaining INTEGER,
  calculation_details JSONB DEFAULT '{}',
  reason TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 创建积分变更审计表
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.credit_transactions(id),
  subscription_change_id UUID REFERENCES public.subscription_changes(id),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- 'add', 'subtract', 'reset'
  source VARCHAR(50) NOT NULL, -- 'subscription', 'purchase', 'upgrade', 'renewal'
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. 创建索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscription_changes_user_id ON public.subscription_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_action ON public.subscription_changes(action);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_created_at ON public.subscription_changes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_audit_log_user_id ON public.credit_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_source ON public.credit_audit_log(source);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_created_at ON public.credit_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_action ON public.subscriptions(action);
CREATE INDEX IF NOT EXISTS idx_subscriptions_previous_tier ON public.subscriptions(previous_tier);

-- ============================================
-- 6. 创建辅助函数
-- ============================================

-- 获取用户当前活跃订阅
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  stripe_subscription_id TEXT,
  tier subscription_tier,
  status subscription_status,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  action subscription_action,
  previous_tier subscription_tier
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.stripe_subscription_id,
    s.tier,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.action,
    s.previous_tier
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id 
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 记录订阅变更
CREATE OR REPLACE FUNCTION record_subscription_change(
  p_subscription_id UUID,
  p_user_id UUID,
  p_action subscription_action,
  p_from_tier subscription_tier DEFAULT NULL,
  p_to_tier subscription_tier DEFAULT NULL,
  p_from_subscription_id TEXT DEFAULT NULL,
  p_to_subscription_id TEXT DEFAULT NULL,
  p_credits_change INTEGER DEFAULT 0,
  p_days_remaining INTEGER DEFAULT NULL,
  p_calculation_details JSONB DEFAULT '{}',
  p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  change_id UUID;
BEGIN
  INSERT INTO public.subscription_changes (
    subscription_id,
    user_id,
    action,
    from_tier,
    to_tier,
    from_subscription_id,
    to_subscription_id,
    credits_change,
    days_remaining,
    calculation_details,
    reason
  ) VALUES (
    p_subscription_id,
    p_user_id,
    p_action,
    p_from_tier,
    p_to_tier,
    p_from_subscription_id,
    p_to_subscription_id,
    p_credits_change,
    p_days_remaining,
    p_calculation_details,
    p_reason
  ) RETURNING id INTO change_id;
  
  RETURN change_id;
END;
$$ LANGUAGE plpgsql;

-- 记录积分审计日志
CREATE OR REPLACE FUNCTION record_credit_audit(
  p_user_id UUID,
  p_transaction_id UUID DEFAULT NULL,
  p_subscription_change_id UUID DEFAULT NULL,
  p_amount INTEGER DEFAULT 0,
  p_balance_before INTEGER DEFAULT 0,
  p_balance_after INTEGER DEFAULT 0,
  p_operation_type VARCHAR(50) DEFAULT 'add',
  p_source VARCHAR(50) DEFAULT 'system',
  p_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.credit_audit_log (
    user_id,
    transaction_id,
    subscription_change_id,
    amount,
    balance_before,
    balance_after,
    operation_type,
    source,
    details
  ) VALUES (
    p_user_id,
    p_transaction_id,
    p_subscription_change_id,
    p_amount,
    p_balance_before,
    p_balance_after,
    p_operation_type,
    p_source,
    p_details
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- 计算剩余天数
CREATE OR REPLACE FUNCTION calculate_days_remaining(
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ
) RETURNS INTEGER AS $$
DECLARE
  total_days INTEGER;
  remaining_days INTEGER;
BEGIN
  -- 计算总天数和剩余天数
  total_days := EXTRACT(DAY FROM (p_current_period_end - p_current_period_start));
  remaining_days := EXTRACT(DAY FROM (p_current_period_end - NOW()));
  
  -- 确保返回值在合理范围内
  IF remaining_days < 0 THEN
    remaining_days := 0;
  ELSIF remaining_days > total_days THEN
    remaining_days := total_days;
  END IF;
  
  RETURN remaining_days;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. RLS策略
-- ============================================

-- 启用RLS
ALTER TABLE public.subscription_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_audit_log ENABLE ROW LEVEL SECURITY;

-- subscription_changes策略
CREATE POLICY "Users can view own subscription changes" ON public.subscription_changes
  FOR SELECT USING (auth.uid() = user_id);

-- credit_audit_log策略
CREATE POLICY "Users can view own credit audit log" ON public.credit_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 8. 更新现有数据（可选）
-- ============================================

-- 为现有订阅设置默认action
UPDATE public.subscriptions 
SET action = 'new' 
WHERE action IS NULL;

-- ============================================
-- 完成
-- ============================================

COMMENT ON TABLE public.subscription_changes IS '订阅变更记录表，追踪所有升级降级操作';
COMMENT ON TABLE public.credit_audit_log IS '积分审计日志，记录所有积分变更操作';
COMMENT ON FUNCTION get_active_subscription(UUID) IS '获取用户当前活跃订阅信息';
COMMENT ON FUNCTION record_subscription_change IS '记录订阅变更操作';
COMMENT ON FUNCTION record_credit_audit IS '记录积分变更审计日志';
COMMENT ON FUNCTION calculate_days_remaining IS '计算订阅剩余天数';