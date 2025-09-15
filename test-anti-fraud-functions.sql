-- 测试防刷功能完整性

-- 1. 测试邮箱黑名单功能
SELECT 'Testing email blacklist...' as test_name;
SELECT is_blocked_email_domain('test@guerrillamail.com') as blocked_temp_email;
SELECT is_blocked_email_domain('test@gmail.com') as blocked_normal_email;

-- 2. 测试IP注册限制检查
SELECT 'Testing IP registration limit...' as test_name;
SELECT * FROM check_ip_registration_limit('192.168.1.100'::INET, 24, 5);

-- 3. 测试设备指纹限制检查
SELECT 'Testing device fingerprint limit...' as test_name;
SELECT * FROM check_device_fingerprint_limit('test_fingerprint_hash_123', 3);

-- 4. 测试邀请速率限制（需要一个真实的用户ID）
SELECT 'Testing invitation rate limit...' as test_name;
SELECT COUNT(*) as user_count FROM public.profiles LIMIT 1;

-- 如果有用户，测试邀请限制
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM public.profiles LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- 测试邀请速率限制
        PERFORM check_invitation_rate_limit(test_user_id);
        RAISE NOTICE 'Invitation rate limit test completed for user: %', test_user_id;
    ELSE
        RAISE NOTICE 'No users found for invitation rate limit test';
    END IF;
END
$$;

-- 5. 测试限流函数
SELECT 'Testing rate limiting...' as test_name;
SELECT * FROM check_rate_limit_v2('test_key', 10, 60, '192.168.1.100'::INET, 'Test User Agent');

-- 6. 测试IP阻断检查
SELECT 'Testing IP auth block check...' as test_name;
SELECT * FROM check_ip_auth_block('192.168.1.100'::INET, 'login');

-- 7. 检查所有防刷相关表的数据
SELECT 'Checking anti-fraud tables...' as test_name;
SELECT 'blocked_email_domains' as table_name, COUNT(*) as record_count FROM public.blocked_email_domains
UNION ALL
SELECT 'ip_registration_attempts', COUNT(*) FROM public.ip_registration_attempts
UNION ALL
SELECT 'device_fingerprints', COUNT(*) FROM public.device_fingerprints
UNION ALL
SELECT 'auth_failure_attempts', COUNT(*) FROM public.auth_failure_attempts
UNION ALL
SELECT 'rate_limit_records', COUNT(*) FROM public.rate_limit_records
UNION ALL
SELECT 'rate_limit_events', COUNT(*) FROM public.rate_limit_events
UNION ALL
SELECT 'ip_blacklist', COUNT(*) FROM public.ip_blacklist;

-- 8. 检查所有防刷函数
SELECT 'Checking anti-fraud functions...' as test_name;
SELECT 
    routine_name as function_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'check_ip_registration_limit',
    'check_device_fingerprint_limit',
    'check_invitation_rate_limit',
    'is_blocked_email_domain',
    'record_registration_attempt',
    'accept_invitation_with_limits',
    'record_auth_failure',
    'check_ip_auth_block',
    'check_rate_limit_v2'
  )
ORDER BY routine_name;

SELECT 'Anti-fraud system test completed!' as status;