-- 修复并发限制问题的SQL脚本
-- 该脚本用于清理僵尸任务和修正数据状态

-- 1. 查看当前所有处理中的任务
SELECT 
    id,
    user_id,
    status,
    title,
    processing_started_at,
    EXTRACT(EPOCH FROM (NOW() - processing_started_at)) / 60 as minutes_running,
    veo3_job_id,
    video_url
FROM videos 
WHERE status = 'processing' 
    AND is_deleted = false
ORDER BY processing_started_at ASC;

-- 2. 查找超时的僵尸任务（运行超过30分钟）
WITH zombie_tasks AS (
    SELECT 
        id,
        user_id,
        title,
        processing_started_at,
        EXTRACT(EPOCH FROM (NOW() - processing_started_at)) / 60 as minutes_running,
        veo3_job_id
    FROM videos 
    WHERE status = 'processing' 
        AND is_deleted = false
        AND processing_started_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (NOW() - processing_started_at)) > 1800 -- 30分钟 = 1800秒
)
SELECT 
    '发现 ' || COUNT(*) || ' 个僵尸任务需要清理' as summary,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'id', id,
            'user_id', user_id,
            'title', title,
            'minutes_running', ROUND(minutes_running::numeric, 1),
            'veo3_job_id', veo3_job_id
        )
    ) as zombie_tasks
FROM zombie_tasks;

-- 3. 清理僵尸任务（将超时任务标记为失败）
-- 注意：这个操作会修改数据，请在确认后再执行
/*
UPDATE videos 
SET 
    status = 'failed',
    error_message = '任务处理超时，已自动清理 (SQL修复)',
    processing_completed_at = NOW(),
    updated_at = NOW()
WHERE status = 'processing' 
    AND is_deleted = false
    AND processing_started_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - processing_started_at)) > 1800; -- 30分钟
*/

-- 4. 检查每个用户的处理中任务数量
SELECT 
    user_id,
    COUNT(*) as processing_tasks,
    ARRAY_AGG(id) as video_ids,
    ARRAY_AGG(ROUND(EXTRACT(EPOCH FROM (NOW() - processing_started_at)) / 60)) as minutes_running
FROM videos 
WHERE status = 'processing' 
    AND is_deleted = false
GROUP BY user_id
HAVING COUNT(*) > 0
ORDER BY COUNT(*) DESC;

-- 5. 查看用户订阅情况（如果subscriptions表存在）
/*
SELECT 
    s.user_id,
    s.tier,
    s.status as subscription_status,
    v.processing_count
FROM subscriptions s
JOIN (
    SELECT 
        user_id, 
        COUNT(*) as processing_count
    FROM videos 
    WHERE status = 'processing' AND is_deleted = false
    GROUP BY user_id
) v ON s.user_id = v.user_id
WHERE s.status = 'active'
ORDER BY v.processing_count DESC;
*/

-- 使用说明：
-- 1. 首先运行查询1和2来查看当前状态
-- 2. 如果发现僵尸任务，取消注释查询3来清理它们
-- 3. 运行查询4来验证每个用户的任务状态
-- 4. 如果需要，运行查询5来检查订阅状态

-- 安全提示：
-- - 查询3会修改数据，请先备份或在测试环境中运行
-- - 建议分批清理，而不是一次性清理所有任务
-- - 清理后重启应用程序以重新初始化队列服务