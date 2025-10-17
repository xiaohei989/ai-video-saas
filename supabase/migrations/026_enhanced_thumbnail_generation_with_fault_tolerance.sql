-- ========================================
-- 增强缩略图生成系统 - 完整容错方案
-- Migration 026
-- ========================================
-- 功能：
-- 1. 增强触发器使用状态跟踪字段
-- 2. 配置缺失时记录错误而不是静默失败
-- 3. 支持最大重试次数限制
-- 4. 创建定时清理/重试函数
-- 5. 添加监控视图
-- ========================================

-- ========================================
-- Part 1: 确保 Migration 025 的字段存在
-- ========================================

DO $$
BEGIN
  -- 检查字段是否存在，如果不存在则添加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'videos'
                 AND column_name = 'thumbnail_generation_status') THEN

    ALTER TABLE videos
      ADD COLUMN thumbnail_generation_status TEXT DEFAULT NULL,
      ADD COLUMN thumbnail_generation_error TEXT DEFAULT NULL,
      ADD COLUMN thumbnail_generation_attempts INTEGER DEFAULT 0,
      ADD COLUMN thumbnail_generation_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      ADD COLUMN thumbnail_generation_last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

    ALTER TABLE videos
      ADD CONSTRAINT thumbnail_generation_status_check
      CHECK (thumbnail_generation_status IN (NULL, 'pending', 'processing', 'completed', 'failed'));

    RAISE NOTICE '✅ 状态跟踪字段已创建';
  ELSE
    RAISE NOTICE '✅ 状态跟踪字段已存在';
  END IF;
END $$;

-- ========================================
-- Part 2: 增强触发器函数 - 使用状态跟踪
-- ========================================

CREATE OR REPLACE FUNCTION trigger_auto_generate_thumbnail()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  migration_completed_at TIMESTAMP;
  time_since_migration INTEGER;
BEGIN
  -- 触发条件：迁移状态变为 completed 时触发
  IF NEW.migration_status = 'completed'
     AND (OLD.migration_status IS NULL OR OLD.migration_status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN

    -- 检查是否已经在处理或已完成
    IF NEW.thumbnail_generation_status IN ('processing', 'completed') THEN
      RAISE LOG '[AutoThumbnail] 跳过：状态为 %', NEW.thumbnail_generation_status;
      RETURN NEW;
    END IF;

    -- 检查重试次数
    IF COALESCE(NEW.thumbnail_generation_attempts, 0) >= 3 THEN
      RAISE WARNING '[AutoThumbnail] 已达到最大重试次数(3次)，停止重试: videoId=%', NEW.id;
      NEW.thumbnail_generation_status := 'failed';
      NEW.thumbnail_generation_error := '已达到最大重试次数(3次)';
      RETURN NEW;
    END IF;

    -- 计算迁移完成后经过的时间
    migration_completed_at := NEW.r2_uploaded_at;
    IF migration_completed_at IS NOT NULL THEN
      time_since_migration := EXTRACT(EPOCH FROM (NOW() - migration_completed_at));
    ELSE
      time_since_migration := 0;
    END IF;

    RAISE LOG '[AutoThumbnail] 迁移完成，触发缩略图生成: videoId=%, attempts=%',
      NEW.id, COALESCE(NEW.thumbnail_generation_attempts, 0);

    -- 从 system_config 读取配置
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

    -- 🆕 配置缺失时记录错误，不要静默失败
    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE WARNING '[AutoThumbnail] 配置缺失，标记为失败';

      NEW.thumbnail_generation_status := 'failed';
      NEW.thumbnail_generation_error := 'system_config 配置缺失：supabase_url 或 service_role_key';
      NEW.thumbnail_generation_attempts := COALESCE(NEW.thumbnail_generation_attempts, 0) + 1;
      NEW.thumbnail_generation_last_attempt_at := NOW();

      IF NEW.thumbnail_generation_started_at IS NULL THEN
        NEW.thumbnail_generation_started_at := NOW();
      END IF;

      RETURN NEW;
    END IF;

    -- 🆕 更新状态为 pending（将由 Edge Function 更新为 processing）
    NEW.thumbnail_generation_status := 'pending';
    NEW.thumbnail_generation_attempts := COALESCE(NEW.thumbnail_generation_attempts, 0) + 1;
    NEW.thumbnail_generation_last_attempt_at := NOW();

    IF NEW.thumbnail_generation_started_at IS NULL THEN
      NEW.thumbnail_generation_started_at := NOW();
    END IF;

    edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

    -- 异步调用 Edge Function
    BEGIN
      SELECT net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'videoId', NEW.id,
          'videoUrl', NEW.video_url,
          'migrationCompletedAt', migration_completed_at::TEXT,
          'timeSinceMigration', time_since_migration
        ),
        timeout_milliseconds := 90000
      ) INTO response_id;

      RAISE LOG '[AutoThumbnail] 请求已发送: response_id=%', response_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoThumbnail] HTTP调用失败: %', SQLERRM;
      NEW.thumbnail_generation_status := 'failed';
      NEW.thumbnail_generation_error := 'HTTP调用失败: ' || SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_auto_generate_thumbnail() IS '增强版触发器：使用状态跟踪，配置缺失时记录错误';

-- ========================================
-- Part 3: 创建定时清理/重试函数
-- ========================================

-- 函数：自动重试卡住或失败的缩略图
CREATE OR REPLACE FUNCTION auto_retry_stuck_thumbnails()
RETURNS JSON AS $$
DECLARE
  v_video RECORD;
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_edge_function_url TEXT;
  v_response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
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

  v_edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

  -- 查找需要重试的视频
  FOR v_video IN
    SELECT id, video_url, thumbnail_generation_status, thumbnail_generation_attempts
    FROM videos
    WHERE status = 'completed'
      AND migration_status = 'completed'
      AND video_url IS NOT NULL
      AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
      AND (
        -- 情况1：processing 超过30分钟（可能卡住）
        (thumbnail_generation_status = 'processing'
         AND thumbnail_generation_last_attempt_at < NOW() - INTERVAL '30 minutes')
        OR
        -- 情况2：failed 且重试次数 < 3 次，且距离上次尝试超过10分钟
        (thumbnail_generation_status = 'failed'
         AND COALESCE(thumbnail_generation_attempts, 0) < 3
         AND (thumbnail_generation_last_attempt_at IS NULL
              OR thumbnail_generation_last_attempt_at < NOW() - INTERVAL '10 minutes'))
        OR
        -- 情况3：pending 或 NULL 状态超过10分钟
        ((thumbnail_generation_status IS NULL OR thumbnail_generation_status = 'pending')
         AND created_at < NOW() - INTERVAL '10 minutes')
      )
    ORDER BY thumbnail_generation_attempts ASC, created_at DESC
    LIMIT 20  -- 每次处理20个
  LOOP
    -- 检查重试次数
    IF COALESCE(v_video.thumbnail_generation_attempts, 0) >= 3 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      -- 更新状态为 pending，等待 Edge Function 处理
      UPDATE videos
      SET thumbnail_generation_status = 'pending',
          thumbnail_generation_attempts = COALESCE(thumbnail_generation_attempts, 0) + 1,
          thumbnail_generation_last_attempt_at = NOW()
      WHERE id = v_video.id;

      -- 调用 Edge Function
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'videoId', v_video.id,
          'videoUrl', v_video.video_url
        ),
        timeout_milliseconds := 90000
      ) INTO v_response_id;

      v_count := v_count + 1;

      -- 避免过于频繁
      PERFORM pg_sleep(0.5);

    EXCEPTION WHEN OTHERS THEN
      -- 记录失败
      UPDATE videos
      SET thumbnail_generation_status = 'failed',
          thumbnail_generation_error = 'auto_retry失败: ' || SQLERRM
      WHERE id = v_video.id;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'retriedCount', v_count,
    'skippedCount', v_skipped,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_retry_stuck_thumbnails() IS '定时任务：自动重试卡住或失败的缩略图生成（每小时执行）';

-- ========================================
-- Part 4: 创建监控视图
-- ========================================

-- 视图：缩略图生成健康状况
CREATE OR REPLACE VIEW thumbnail_generation_health AS
SELECT
  COUNT(*) FILTER (WHERE thumbnail_generation_status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE thumbnail_generation_status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE thumbnail_generation_status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE thumbnail_generation_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE thumbnail_generation_status IS NULL
                   AND status = 'completed'
                   AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')) as needs_generation_count,
  ROUND(
    COUNT(*) FILTER (WHERE thumbnail_generation_status = 'completed')::NUMERIC * 100 /
    NULLIF(COUNT(*) FILTER (WHERE thumbnail_generation_status IS NOT NULL), 0),
    2
  ) as success_rate_percent,
  AVG(
    EXTRACT(EPOCH FROM (thumbnail_generated_at - thumbnail_generation_started_at))
  ) FILTER (WHERE thumbnail_generation_status = 'completed'
            AND thumbnail_generated_at IS NOT NULL
            AND thumbnail_generation_started_at IS NOT NULL) as avg_generation_time_seconds
FROM videos
WHERE status = 'completed';

COMMENT ON VIEW thumbnail_generation_health IS '缩略图生成系统健康状况：成功率、平均时间、各状态数量';

-- 视图：失败原因统计
CREATE OR REPLACE VIEW thumbnail_generation_failures AS
SELECT
  thumbnail_generation_error,
  COUNT(*) as failure_count,
  MAX(thumbnail_generation_last_attempt_at) as last_occurrence,
  array_agg(id ORDER BY thumbnail_generation_last_attempt_at DESC) as recent_video_ids
FROM videos
WHERE thumbnail_generation_status = 'failed'
GROUP BY thumbnail_generation_error
ORDER BY failure_count DESC;

COMMENT ON VIEW thumbnail_generation_failures IS '缩略图生成失败原因统计';

-- ========================================
-- Part 5: 输出部署信息
-- ========================================

DO $$
DECLARE
  v_health RECORD;
BEGIN
  SELECT * INTO v_health FROM thumbnail_generation_health;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 缩略图生成容错系统部署完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 当前系统状态:';
  RAISE NOTICE '  - 已完成: % 个', COALESCE(v_health.completed_count, 0);
  RAISE NOTICE '  - 处理中: % 个', COALESCE(v_health.processing_count, 0);
  RAISE NOTICE '  - 待处理: % 个', COALESCE(v_health.pending_count, 0);
  RAISE NOTICE '  - 已失败: % 个', COALESCE(v_health.failed_count, 0);
  RAISE NOTICE '  - 需要生成: % 个', COALESCE(v_health.needs_generation_count, 0);

  IF v_health.success_rate_percent IS NOT NULL THEN
    RAISE NOTICE '  - 成功率: %%%', v_health.success_rate_percent;
  END IF;

  IF v_health.avg_generation_time_seconds IS NOT NULL THEN
    RAISE NOTICE '  - 平均耗时: % 秒', ROUND(v_health.avg_generation_time_seconds::NUMERIC, 1);
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🔧 可用功能:';
  RAISE NOTICE '  1. 自动重试: SELECT auto_retry_stuck_thumbnails();';
  RAISE NOTICE '  2. 查看健康: SELECT * FROM thumbnail_generation_health;';
  RAISE NOTICE '  3. 查看失败: SELECT * FROM thumbnail_generation_failures;';
  RAISE NOTICE '';
  RAISE NOTICE '⏰ 建议设置定时任务:';
  RAISE NOTICE '  - 使用 pg_cron 或 Supabase Edge Function + Vercel Cron';
  RAISE NOTICE '  - 每小时执行一次 auto_retry_stuck_thumbnails()';
  RAISE NOTICE '========================================';
END $$;
