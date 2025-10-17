-- 更新 Google OAuth 配置，启用 skip_nonce_check
-- 这将允许 Google One Tap 登录正常工作

-- 注意：这个配置需要在 Supabase Dashboard 中手动设置
-- 或者使用 Management API

-- 临时解决方案：我们可以通过环境变量配置
SELECT 'Google OAuth 配置需要在 Supabase Dashboard 中手动设置' as message;
SELECT 'Authentication > Providers > Google > Skip nonce check = enabled' as instruction;
