-- 查看最近注册的用户积分情况
SELECT id, email, credits, total_credits_earned, created_at 
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 10;