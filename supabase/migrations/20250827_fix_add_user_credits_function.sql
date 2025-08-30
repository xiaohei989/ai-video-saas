-- ============================================
-- 修复add_user_credits函数的reference_id参数类型问题
-- Version: 20250827
-- Description: 统一函数定义，使用TEXT类型支持Stripe ID格式
-- ============================================

-- 删除所有旧版本的函数定义
DROP FUNCTION IF EXISTS add_user_credits(UUID, INTEGER, VARCHAR, TEXT, UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS add_user_credits(UUID, INTEGER, TEXT, TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS add_user_credits CASCADE;

-- 创建统一的add_user_credits函数
CREATE OR REPLACE FUNCTION add_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_type TEXT,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL,  -- 使用TEXT类型支持Stripe ID
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
    
    -- 获取当前余额并锁定行（防止并发问题）
    SELECT balance INTO current_balance 
    FROM user_credits 
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF current_balance IS NULL THEN
        RAISE EXCEPTION 'User credits record not found for user_id: %', p_user_id;
    END IF;
    
    -- 计算新余额
    new_balance := current_balance + p_amount;
    
    -- 确保余额不会变为负数（仅对消费操作）
    IF new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient credits. Current: %, Requested: %', current_balance, p_amount;
    END IF;
    
    -- 更新用户积分
    UPDATE user_credits 
    SET 
        balance = new_balance,
        total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END,
        total_spent = CASE WHEN p_amount < 0 THEN total_spent + ABS(p_amount) ELSE total_spent END,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- 记录积分交易
    INSERT INTO credit_transactions (
        user_id, 
        amount, 
        type, 
        description, 
        reference_id, 
        reference_type,
        balance_before, 
        balance_after
    ) VALUES (
        p_user_id, 
        p_amount, 
        p_type, 
        p_description, 
        p_reference_id, 
        p_reference_type,
        current_balance, 
        new_balance
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
EXCEPTION
    WHEN OTHERS THEN
        -- 记录错误日志并重新抛出
        RAISE EXCEPTION 'Failed to add credits: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加函数注释
COMMENT ON FUNCTION add_user_credits IS 'Atomic function to add/subtract user credits with transaction logging. Supports Stripe payment intent IDs as reference_id.';