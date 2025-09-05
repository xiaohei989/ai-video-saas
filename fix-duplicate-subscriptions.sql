-- 修复用户重复订阅记录的SQL脚本
-- 保留最新的订阅记录，将旧的active记录状态改为cancelled

-- 查看当前状态
SELECT 'Current subscription records:' as info;
SELECT id, user_id, tier, status, stripe_subscription_id, action, created_at 
FROM subscriptions 
WHERE user_id = 'fa38674f-1e5b-4132-9fb7-192940e52a32' 
ORDER BY created_at DESC;

-- 将除了最新的active记录外，其他active记录状态改为cancelled
UPDATE subscriptions 
SET status = 'cancelled', 
    updated_at = NOW()
WHERE user_id = 'fa38674f-1e5b-4132-9fb7-192940e52a32' 
  AND status = 'active'
  AND id NOT IN (
    SELECT id FROM subscriptions 
    WHERE user_id = 'fa38674f-1e5b-4132-9fb7-192940e52a32' 
      AND status = 'active'
    ORDER BY created_at DESC 
    LIMIT 1
  );

-- 验证修复结果
SELECT 'After cleanup:' as info;
SELECT id, user_id, tier, status, stripe_subscription_id, action, created_at 
FROM subscriptions 
WHERE user_id = 'fa38674f-1e5b-4132-9fb7-192940e52a32' 
ORDER BY created_at DESC;

-- 检查active记录数量
SELECT 'Active subscription count:' as info;
SELECT COUNT(*) as active_count 
FROM subscriptions 
WHERE user_id = 'fa38674f-1e5b-4132-9fb7-192940e52a32' 
  AND status = 'active';