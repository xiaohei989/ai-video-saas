-- ==========================================
-- 数据迁移和维护脚本集合
-- 包含数据更新、URL迁移等维护操作
-- ==========================================

-- 1. 将Premium订阅迁移到Enterprise
-- 来源: migrate-premium-to-enterprise.sql
UPDATE subscriptions 
SET tier = 'enterprise' 
WHERE tier = 'premium' AND status = 'active';

-- 更新相关的支付记录
UPDATE payment_records 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{subscription_tier}',
  '"enterprise"'
)
WHERE metadata->>'subscription_tier' = 'premium';

-- 2. 更新视频URL到R2存储
-- 来源: update-video-urls-to-r2.sql
-- 注：实际迁移需要在应用层完成，这里只是标记
UPDATE videos 
SET migration_status = 'pending'
WHERE video_url IS NOT NULL 
  AND (r2_url IS NULL OR r2_url = '')
  AND migration_status IS NULL;

-- 3. 更新数据库错误代码
-- 来源: update-database-error-codes.sql
INSERT INTO system_settings (key, value, description) VALUES
('db_error_retry_limit', '3', '数据库错误重试次数限制'),
('db_connection_timeout', '30', '数据库连接超时时间(秒)'),
('db_query_timeout', '60', '数据库查询超时时间(秒)')
ON CONFLICT (key) DO UPDATE SET 
value = EXCLUDED.value,
description = EXCLUDED.description;

-- 4. 更新管理统计收入分配
-- 来源: update-admin-stats-revenue-split.sql
CREATE OR REPLACE FUNCTION calculate_revenue_split(
  total_amount NUMERIC,
  tier TEXT
) RETURNS TABLE(
  platform_share NUMERIC,
  creator_share NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN tier = 'basic' THEN total_amount * 0.3
      WHEN tier = 'pro' THEN total_amount * 0.2
      WHEN tier = 'enterprise' THEN total_amount * 0.1
      ELSE total_amount * 0.3
    END as platform_share,
    CASE 
      WHEN tier = 'basic' THEN total_amount * 0.7
      WHEN tier = 'pro' THEN total_amount * 0.8
      WHEN tier = 'enterprise' THEN total_amount * 0.9
      ELSE total_amount * 0.7
    END as creator_share;
END;
$$ LANGUAGE plpgsql;

-- 5. 完善被封域名列表
-- 来源: complete-blocked-domains.sql
INSERT INTO blocked_email_domains (domain, category, reason) VALUES
-- 临时邮箱服务
('10minutemail.com', 'temporary', '临时邮箱服务'),
('guerrillamail.com', 'temporary', '临时邮箱服务'),
('mailinator.com', 'temporary', '临时邮箱服务'),
('tempmail.org', 'temporary', '临时邮箱服务'),
('temp-mail.org', 'temporary', '临时邮箱服务'),
('throwaway.email', 'temporary', '临时邮箱服务'),
-- 一次性邮箱
('mohmal.com', 'disposable', '一次性邮箱'),
('sharklasers.com', 'disposable', '一次性邮箱'),
('maildrop.cc', 'disposable', '一次性邮箱'),
-- 垃圾邮箱
('spamcowboys.org', 'spam', '垃圾邮箱服务'),
('spamgourmet.com', 'spam', '垃圾邮箱服务')
ON CONFLICT (domain) DO UPDATE SET
category = EXCLUDED.category,
reason = EXCLUDED.reason,
updated_at = NOW();

-- 6. 清理和优化数据
-- 删除超过30天的失败视频记录
DELETE FROM videos 
WHERE status = 'failed' 
  AND created_at < NOW() - INTERVAL '30 days';

-- 清理超过90天的已完成信用卡交易临时数据
DELETE FROM credit_transactions 
WHERE transaction_type = 'temp_hold'
  AND created_at < NOW() - INTERVAL '90 days';

-- 更新统计信息
ANALYZE videos;
ANALYZE credit_transactions;
ANALYZE payment_records;
ANALYZE subscriptions;

-- 创建维护视图
CREATE OR REPLACE VIEW v_system_health AS
SELECT 
  'videos' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_records,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_records
FROM videos
UNION ALL
SELECT 
  'users' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_records,
  COUNT(CASE WHEN is_banned = true THEN 1 END) as failed_records
FROM profiles
UNION ALL
SELECT 
  'subscriptions' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_records,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as failed_records
FROM subscriptions;