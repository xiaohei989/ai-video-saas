-- 修复security_events表的RLS策略
-- 解决网站部署中的401权限错误

-- 首先检查现有策略
DO $$
BEGIN
  -- 删除可能存在的旧策略
  DROP POLICY IF EXISTS "允许认证用户插入安全事件" ON security_events;
  DROP POLICY IF EXISTS "允许所有用户插入安全事件" ON security_events;
  DROP POLICY IF EXISTS "Allow insert security events" ON security_events;
  DROP POLICY IF EXISTS "Allow authenticated users to insert security events" ON security_events;
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON security_events;
  
  RAISE NOTICE '旧的RLS策略已清理完成';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '清理旧策略时出现错误: %', SQLERRM;
END $$;

-- 创建新的RLS策略 - 允许所有用户插入安全事件（用于安全监控）
CREATE POLICY "security_events_insert_policy" ON security_events
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 创建查询策略 - 只允许认证用户查询自己的安全事件
CREATE POLICY "security_events_select_policy" ON security_events
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

-- 确保RLS已启用
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- 验证策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'security_events';

COMMENT ON POLICY "security_events_insert_policy" ON security_events IS 
'允许所有用户（包括匿名用户）插入安全事件，用于安全监控';

COMMENT ON POLICY "security_events_select_policy" ON security_events IS 
'只允许认证用户查询自己的安全事件或服务角色查询所有事件';