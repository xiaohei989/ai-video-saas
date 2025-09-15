-- 添加默认用户积分设置
INSERT INTO public.system_settings (setting_key, setting_value, description, category, is_public) 
VALUES ('default_user_credits', '50', 'Default credits given to new users', 'credits', false)
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description;