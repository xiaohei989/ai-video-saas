-- 支付记录表
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_checkout_session_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(20) DEFAULT 'pending',
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户积分表
CREATE TABLE IF NOT EXISTS public.user_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    balance INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 积分交易记录表
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- 正数为获得，负数为消费
    type VARCHAR(20) NOT NULL, -- 'reward', 'purchase', 'consume', 'refund'
    description TEXT,
    reference_id TEXT, -- 关联的订单ID、视频ID等
    reference_type VARCHAR(50), -- 'payment_intent', 'subscription', 'video', etc.
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference ON public.credit_transactions(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON public.user_credits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 积分操作函数
CREATE OR REPLACE FUNCTION add_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_type TEXT,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER := 0;
    new_balance INTEGER;
BEGIN
    -- 获取或创建用户积分记录
    INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
    VALUES (p_user_id, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- 获取当前余额
    SELECT balance INTO current_balance 
    FROM user_credits 
    WHERE user_id = p_user_id;
    
    -- 计算新余额
    new_balance := current_balance + p_amount;
    
    -- 更新用户积分
    UPDATE user_credits 
    SET 
        balance = new_balance,
        total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END,
        total_spent = CASE WHEN p_amount < 0 THEN total_spent + ABS(p_amount) ELSE total_spent END,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 记录交易
    INSERT INTO credit_transactions (
        user_id, amount, type, description, reference_id, reference_type,
        balance_before, balance_after
    ) VALUES (
        p_user_id, p_amount, p_type, p_description, p_reference_id, p_reference_type,
        current_balance, new_balance
    );
    
    -- 同步更新profiles表中的积分（保持兼容性）
    UPDATE profiles 
    SET 
        credits = new_balance,
        total_credits_earned = CASE WHEN p_amount > 0 THEN total_credits_earned + p_amount ELSE total_credits_earned END,
        total_credits_spent = CASE WHEN p_amount < 0 THEN total_credits_spent + ABS(p_amount) ELSE total_credits_spent END,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 从现有profiles表中迁移积分数据
INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
SELECT id, credits, total_credits_earned, total_credits_spent 
FROM profiles 
ON CONFLICT (user_id) DO UPDATE SET
    balance = EXCLUDED.balance,
    total_earned = EXCLUDED.total_earned,
    total_spent = EXCLUDED.total_spent;

-- RLS 策略
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的支付记录
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

-- 用户只能查看自己的积分
CREATE POLICY "Users can view own credits" ON public.user_credits
    FOR SELECT USING (auth.uid() = user_id);

-- 用户只能查看自己的积分交易记录
CREATE POLICY "Users can view own credit transactions" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- 服务角色可以插入和更新所有记录
CREATE POLICY "Service role can manage payments" ON public.payments
    FOR ALL USING (auth.role() = 'service_role');
    
CREATE POLICY "Service role can manage credits" ON public.user_credits
    FOR ALL USING (auth.role() = 'service_role');
    
CREATE POLICY "Service role can manage credit transactions" ON public.credit_transactions
    FOR ALL USING (auth.role() = 'service_role');

COMMIT;