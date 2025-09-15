-- 测试修复后的积分验证函数
SELECT * FROM validate_credit_balances() LIMIT 5;

-- 查看系统配置中的默认积分设置
SELECT setting_key, setting_value, description 
FROM public.system_settings 
WHERE setting_key = 'default_user_credits';