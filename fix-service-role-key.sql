-- 验证并修复 service_role_key 配置

-- 1. 检查当前配置
SELECT key,
       CASE
         WHEN key = 'service_role_key' THEN LEFT(value, 30) || '...'
         ELSE value
       END as value_preview,
       description
FROM system_config
WHERE key IN ('supabase_url', 'service_role_key', 'project_ref');

-- 2. 更新正确的 service_role_key（从 .env.local 获取）
UPDATE system_config
SET value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI'
WHERE key = 'service_role_key';

-- 3. 验证更新
SELECT
  key,
  LEFT(value, 30) || '...' as value_preview,
  LENGTH(value) as value_length
FROM system_config
WHERE key = 'service_role_key';

-- 4. 测试触发器函数是否能正确读取
DO $$
DECLARE
  v_service_role_key TEXT;
BEGIN
  SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

  IF v_service_role_key IS NULL THEN
    RAISE NOTICE '❌ service_role_key 为空';
  ELSIF LENGTH(v_service_role_key) < 100 THEN
    RAISE NOTICE '❌ service_role_key 太短: % 字符', LENGTH(v_service_role_key);
  ELSE
    RAISE NOTICE '✅ service_role_key 已正确配置: % 字符', LENGTH(v_service_role_key);
    RAISE NOTICE '   预览: %...', LEFT(v_service_role_key, 30);
  END IF;
END $$;
