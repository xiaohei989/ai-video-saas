-- 检查system_settings表是否存在
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'system_settings';

-- 如果表存在，查看所有设置
SELECT * FROM public.system_settings WHERE setting_key LIKE '%credit%';