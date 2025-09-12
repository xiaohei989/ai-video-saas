-- 修复 security_events 表的 RLS 策略
-- 允许匿名用户插入安全事件（用于安全监控）

BEGIN;

-- 删除现有的限制性插入策略
DROP POLICY IF EXISTS security_events_insert_authenticated ON security_events;

-- 创建新的插入策略，允许匿名用户插入（但有限制）
CREATE POLICY security_events_insert_public ON security_events
    FOR INSERT
    WITH CHECK (
        -- 允许插入但限制某些字段
        type IN ('suspicious_activity', 'rate_limit_exceeded', 'login_attempt', 'api_abuse', 'content_violation')
        AND level IN ('low', 'medium', 'high', 'critical')
        AND blocked IS NOT NULL
        AND action IS NOT NULL
    );

-- 确保 service_role 仍然可以完全访问
-- （这个策略应该已经存在）

COMMIT;

-- 验证策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'security_events'
ORDER BY policyname;