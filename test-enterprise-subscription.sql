-- ============================================
-- 测试企业级订阅创建和验证
-- ============================================

-- 1. 查找当前用户ID (使用manghe989@gmail.com)
DO $$
DECLARE
    user_uuid UUID;
    sub_id UUID;
BEGIN
    -- 查找用户
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'manghe989@gmail.com'
    LIMIT 1;
    
    IF user_uuid IS NULL THEN
        RAISE NOTICE 'User not found with email: manghe989@gmail.com';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found user ID: %', user_uuid;
    
    -- 删除现有的活跃订阅
    UPDATE public.subscriptions 
    SET status = 'cancelled'::subscription_status
    WHERE user_id = user_uuid AND status = 'active'::subscription_status;
    
    -- 创建新的企业级订阅
    INSERT INTO public.subscriptions (
        user_id,
        tier,
        status,
        stripe_subscription_id,
        current_period_start,
        current_period_end,
        cancel_at_period_end
    ) VALUES (
        user_uuid,
        'enterprise'::subscription_tier,
        'active'::subscription_status,
        'sub_test_enterprise_' || extract(epoch from now())::text,
        NOW(),
        NOW() + INTERVAL '1 month',
        false
    ) RETURNING id INTO sub_id;
    
    RAISE NOTICE 'Created enterprise subscription with ID: %', sub_id;
    
    -- 添加企业级积分
    INSERT INTO public.credit_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        reference_type
    ) 
    SELECT 
        user_uuid,
        'reward'::transaction_type,
        6000,
        p.credits,
        p.credits + 6000,
        'Enterprise subscription initial credits',
        'subscription_initial'
    FROM public.profiles p 
    WHERE p.id = user_uuid;
    
    -- 更新用户积分余额
    UPDATE public.profiles 
    SET 
        credits = credits + 6000,
        total_credits_earned = total_credits_earned + 6000
    WHERE id = user_uuid;
    
    RAISE NOTICE 'Added 6000 enterprise credits to user account';
    
END $$;

-- 验证结果
SELECT 
    p.email,
    p.credits,
    s.tier,
    s.status,
    s.current_period_start,
    s.current_period_end
FROM public.profiles p
LEFT JOIN public.subscriptions s ON p.id = s.user_id AND s.status = 'active'
WHERE p.id = (SELECT id FROM auth.users WHERE email = 'manghe989@gmail.com' LIMIT 1);