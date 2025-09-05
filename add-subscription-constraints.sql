-- 添加数据库约束防止未来出现多个active订阅的问题
-- 创建唯一约束：每个用户只能有一个active状态的订阅

-- 检查当前是否还有多个active订阅的用户
SELECT 'Users with multiple active subscriptions:' as info;
SELECT user_id, COUNT(*) as active_count
FROM subscriptions 
WHERE status = 'active'
GROUP BY user_id
HAVING COUNT(*) > 1;

-- 创建唯一索引，确保每个用户只能有一个active订阅
-- 注意：这个约束只对active状态生效，cancelled/expired可以有多个
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_active_subscription_per_user 
ON subscriptions (user_id) 
WHERE status = 'active';

-- 验证约束是否创建成功
SELECT 'Unique constraint created:' as info;
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'subscriptions' 
AND indexname = 'unique_active_subscription_per_user';

-- 测试约束是否工作（这个查询应该失败如果尝试插入重复active记录）
-- 我们不会真正执行这个，只是展示测试方法
/*
-- 这个插入应该失败：
-- INSERT INTO subscriptions (user_id, tier, status, stripe_subscription_id)
-- VALUES ('fa38674f-1e5b-4132-9fb7-192940e52a32', 'pro', 'active', 'test_duplicate');
*/

SELECT 'Constraint validation complete!' as result;