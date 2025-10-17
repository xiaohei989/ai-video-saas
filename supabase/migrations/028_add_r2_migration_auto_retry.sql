-- ========================================
-- 添加R2迁移自动重试机制
-- 解决问题：75%的视频迁移失败后无法自动恢复
-- ========================================
--
-- 重试策略：
-- - 第1次失败后等待 2 分钟重试
-- - 第2次失败后等待 5 分钟重试
-- - 第3次失败后等待 10 分钟重试
-- - 最多重试 3 次
-- ========================================

-- 1. 添加迁移重试追踪字段
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'videos' AND column_name = 'migration_attempts') THEN

    ALTER TABLE videos
      ADD COLUMN migration_attempts INTEGER DEFAULT 0,
      ADD COLUMN migration_error TEXT DEFAULT NULL,
      ADD COLUMN migration_last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

    RAISE NOTICE '✅ 迁移重试字段已创建';
  ELSE
    RAISE NOTICE '✅ 迁移重试字段已存在';
  END IF;
END $$;

-- 2. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_videos_failed_migrations
  ON videos(migration_status, migration_attempts)
  WHERE migration_status = 'failed' AND migration_attempts < 3;

-- 3. 增强迁移触发器，记录重试次数和错误
CREATE OR REPLACE FUNCTION trigger_auto_migrate_to_r2()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  needs_migration BOOLEAN;
BEGIN
  -- 仅在视频刚完成时触发
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.video_url IS NOT NULL THEN

    -- 检查是否需要迁移
    needs_migration := (
      NEW.video_url NOT LIKE '%cdn.veo3video.me%'
      AND NEW.video_url NOT LIKE '%r2.cloudflarestorage.com%'
      AND (NEW.migration_status IS NULL OR NEW.migration_status != 'completed')
      AND NEW.r2_url IS NULL
    );

    IF needs_migration THEN
      RAISE LOG '[AutoMigrate] 检测到需要迁移: videoId=%', NEW.id;

      -- 从 system_config 读取配置
      SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
      SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

      IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
        RAISE WARNING '[AutoMigrate] 配置缺失';
        RETURN NEW;
      END IF;

      edge_function_url := v_supabase_url || '/functions/v1/migrate-video';

      -- 🆕 更新迁移状态和计数
      NEW.migration_status := 'pending';
      NEW.migration_attempts := COALESCE(NEW.migration_attempts, 0) + 1;
      NEW.migration_last_attempt_at := NOW();

      -- 调用迁移服务
      BEGIN
        SELECT net.http_post(
          url := edge_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'videoId', NEW.id,
            'forceRemigrate', false
          ),
          timeout_milliseconds := 300000  -- 5分钟超时
        ) INTO response_id;

        RAISE LOG '[AutoMigrate] 迁移请求已排队: response_id=%', response_id;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[AutoMigrate] pg_net 调用失败: %', SQLERRM;
        NEW.migration_status := 'failed';
        NEW.migration_error := 'pg_net调用失败: ' || SQLERRM;
      END;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 创建自动重试函数（智能间隔）
CREATE OR REPLACE FUNCTION auto_retry_failed_migrations()
RETURNS JSON AS $$
DECLARE
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_video RECORD;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_edge_function_url TEXT;
  v_response_id BIGINT;
  v_retry_interval INTERVAL;
BEGIN
  -- 读取配置
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'system_config 配置缺失'
    );
  END IF;

  v_edge_function_url := v_supabase_url || '/functions/v1/migrate-video';

  -- 查找失败的视频并根据重试次数应用不同的等待时间
  FOR v_video IN
    SELECT
      id,
      video_url,
      migration_status,
      migration_attempts,
      migration_last_attempt_at,
      -- 根据重试次数计算需要等待的时间
      CASE
        WHEN migration_attempts = 1 THEN INTERVAL '2 minutes'   -- 第1次失败后等2分钟
        WHEN migration_attempts = 2 THEN INTERVAL '5 minutes'   -- 第2次失败后等5分钟
        WHEN migration_attempts >= 3 THEN INTERVAL '10 minutes' -- 第3次失败后等10分钟
        ELSE INTERVAL '2 minutes'
      END as required_wait_time
    FROM videos
    WHERE status = 'completed'
      AND migration_status = 'failed'
      AND video_url IS NOT NULL
      AND video_url NOT LIKE '%cdn.veo3video.me%'
      AND COALESCE(migration_attempts, 0) < 3
    ORDER BY migration_attempts ASC, created_at DESC
    LIMIT 30
  LOOP
    -- 检查是否已等待足够长的时间
    IF v_video.migration_last_attempt_at IS NOT NULL
       AND v_video.migration_last_attempt_at + v_video.required_wait_time > NOW() THEN
      v_skipped := v_skipped + 1;
      CONTINUE;  -- 跳过这个视频，等待时间还不够
    END IF;

    -- 更新重试状态
    UPDATE videos
    SET
      migration_status = 'pending',
      migration_attempts = COALESCE(migration_attempts, 0) + 1,
      migration_last_attempt_at = NOW(),
      migration_error = NULL  -- 清除旧错误
    WHERE id = v_video.id;

    -- 调用迁移服务
    BEGIN
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'videoId', v_video.id,
          'forceRemigrate', true
        ),
        timeout_milliseconds := 300000  -- 5分钟
      ) INTO v_response_id;

      RAISE LOG '[AutoRetryMigration] 重试已触发: videoId=%, attempts=%',
        v_video.id, v_video.migration_attempts + 1;

      v_count := v_count + 1;

      -- 避免过于频繁（每个请求间隔0.5秒）
      PERFORM pg_sleep(0.5);

    EXCEPTION WHEN OTHERS THEN
      UPDATE videos
      SET
        migration_status = 'failed',
        migration_error = 'auto_retry调用失败: ' || SQLERRM
      WHERE id = v_video.id;

      RAISE WARNING '[AutoRetryMigration] 重试失败: videoId=%, error=%',
        v_video.id, SQLERRM;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'retriedCount', v_count,
    'skippedCount', v_skipped,
    'message', format('已重试 %s 个视频，跳过 %s 个（等待时间不足）', v_count, v_skipped),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_retry_failed_migrations() IS
'自动重试失败的R2迁移（智能间隔：第1次2分钟，第2次5分钟，第3次10分钟）';

-- 5. 更新 migrate-video Edge Function 失败时记录错误
-- 注意：需要在 Edge Function 中更新数据库时同时更新 migration_error 字段

-- 6. 创建迁移健康监控视图
CREATE OR REPLACE VIEW migration_health AS
SELECT
  COUNT(*) FILTER (WHERE migration_status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE migration_status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE migration_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE migration_status = 'downloading') as downloading_count,
  COUNT(*) FILTER (WHERE migration_status = 'uploading') as uploading_count,
  COUNT(*) FILTER (WHERE migration_status IS NULL) as not_started_count,

  -- 成功率
  ROUND(
    COUNT(*) FILTER (WHERE migration_status = 'completed')::NUMERIC * 100 /
    NULLIF(COUNT(*) FILTER (WHERE migration_status IS NOT NULL), 0),
    2
  ) as success_rate_percent,

  -- 失败且可重试的视频数
  COUNT(*) FILTER (
    WHERE migration_status = 'failed'
    AND COALESCE(migration_attempts, 0) < 3
  ) as retriable_count,

  -- 失败且已达到最大重试次数的视频数
  COUNT(*) FILTER (
    WHERE migration_status = 'failed'
    AND COALESCE(migration_attempts, 0) >= 3
  ) as permanently_failed_count

FROM videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
  AND video_url NOT LIKE '%cdn.veo3video.me%';

COMMENT ON VIEW migration_health IS 'R2迁移系统健康状况监控';

-- 7. 创建迁移失败原因统计视图
CREATE OR REPLACE VIEW migration_failures AS
SELECT
  migration_error,
  migration_attempts,
  COUNT(*) as failure_count,
  MAX(migration_last_attempt_at) as last_occurrence,
  array_agg(id ORDER BY migration_last_attempt_at DESC) as recent_video_ids
FROM videos
WHERE migration_status = 'failed'
GROUP BY migration_error, migration_attempts
ORDER BY failure_count DESC;

COMMENT ON VIEW migration_failures IS 'R2迁移失败原因统计';

-- 8. 输出部署信息
DO $$
DECLARE
  v_health RECORD;
BEGIN
  SELECT * INTO v_health FROM migration_health;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ R2迁移自动重试机制已部署！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 当前系统状态:';
  RAISE NOTICE '  - 迁移成功: % 个', COALESCE(v_health.completed_count, 0);
  RAISE NOTICE '  - 迁移失败: % 个', COALESCE(v_health.failed_count, 0);
  RAISE NOTICE '  - 处理中: % 个', COALESCE(v_health.pending_count, 0);
  RAISE NOTICE '  - 可重试: % 个', COALESCE(v_health.retriable_count, 0);
  RAISE NOTICE '  - 永久失败: % 个', COALESCE(v_health.permanently_failed_count, 0);

  IF v_health.success_rate_percent IS NOT NULL THEN
    RAISE NOTICE '  - 成功率: %%%', v_health.success_rate_percent;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '⏱️  重试策略:';
  RAISE NOTICE '  - 第1次失败后等待 2 分钟重试';
  RAISE NOTICE '  - 第2次失败后等待 5 分钟重试';
  RAISE NOTICE '  - 第3次失败后等待 10 分钟重试';
  RAISE NOTICE '  - 最多重试 3 次';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 新增功能:';
  RAISE NOTICE '  1. 自动重试函数: auto_retry_failed_migrations()';
  RAISE NOTICE '  2. 监控视图: migration_health';
  RAISE NOTICE '  3. 失败统计: migration_failures';
  RAISE NOTICE '';
  RAISE NOTICE '💡 使用方法:';
  RAISE NOTICE '  -- 手动触发重试:';
  RAISE NOTICE '  SELECT auto_retry_failed_migrations();';
  RAISE NOTICE '';
  RAISE NOTICE '  -- 查看系统健康:';
  RAISE NOTICE '  SELECT * FROM migration_health;';
  RAISE NOTICE '';
  RAISE NOTICE '  -- 查看失败原因:';
  RAISE NOTICE '  SELECT * FROM migration_failures;';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  下一步:';
  RAISE NOTICE '  1. 部署 Edge Function: retry-failed-migrations';
  RAISE NOTICE '  2. 配置 Cron 定时任务（每5分钟执行一次）';
  RAISE NOTICE '  3. 更新 migrate-video Edge Function 记录错误';
  RAISE NOTICE '========================================';
END $$;
