-- 清理测试用户的订阅记录，设置为免费用户
-- 在Supabase SQL编辑器中执行

-- 1. 查看当前用户的订阅状态
SELECT 
  id, 
  user_id, 
  tier, 
  status, 
  stripe_subscription_id,
  current_period_start,
  current_period_end,
  created_at
FROM subscriptions 
WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'manghe989@gmail.com'
) 
ORDER BY created_at DESC;

-- 2. 删除所有订阅记录（如果需要完全清理）
DELETE FROM subscriptions 
WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'manghe989@gmail.com'
);

-- 3. 或者将所有订阅设置为取消状态（保留历史记录）
UPDATE subscriptions 
SET 
  status = 'cancelled',
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'manghe989@gmail.com'
)
AND status = 'active';

-- 4. 验证清理结果
SELECT 
  COUNT(*) as active_subscriptions
FROM subscriptions 
WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'manghe989@gmail.com'
) 
AND status = 'active';