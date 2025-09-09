-- ============================================
-- 迁移脚本：将premium统一改为enterprise
-- ============================================

-- 1. 首先备份现有数据（可选）
-- CREATE TABLE subscriptions_backup AS SELECT * FROM subscriptions;

-- 2. 更新enum类型以支持enterprise
DO $$
BEGIN
    -- 添加enterprise值到枚举（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_tier') 
        AND enumlabel = 'enterprise'
    ) THEN
        ALTER TYPE subscription_tier ADD VALUE 'enterprise';
        RAISE NOTICE 'Added enterprise to subscription_tier enum';
    END IF;
END $$;

-- 3. 更新现有的premium记录为enterprise
UPDATE public.subscriptions 
SET tier = 'enterprise'::subscription_tier 
WHERE tier = 'premium'::subscription_tier;

-- 4. 显示更新结果
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count 
    FROM public.subscriptions 
    WHERE tier = 'enterprise'::subscription_tier;
    
    RAISE NOTICE '已将premium记录更新为enterprise，共影响 % 条记录', updated_count;
END $$;

-- 5. 验证更新结果
SELECT 
    tier,
    COUNT(*) as count,
    status
FROM public.subscriptions 
GROUP BY tier, status
ORDER BY tier, status;