-- 强制清理用户订阅数据
-- 使用Supabase SQL编辑器中的admin权限执行

-- 1. 找到用户ID
SELECT id, email FROM profiles WHERE email = 'manghe989@gmail.com';

-- 2. 查看该用户的所有订阅
SELECT * FROM subscriptions WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'manghe989@gmail.com'
);

-- 3. 强制删除所有订阅记录
DELETE FROM subscriptions WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'manghe989@gmail.com'
);

-- 4. 验证清理结果
SELECT COUNT(*) as remaining_subscriptions FROM subscriptions WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'manghe989@gmail.com'
);