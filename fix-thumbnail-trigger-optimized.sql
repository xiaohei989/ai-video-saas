-- ========================================
-- 优化版智能延迟缩略图触发器
-- 延迟时间从 30 秒优化到 10 秒
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

    -- 计算迁移完成后经过的时间
    migration_completed_at := NEW.r2_uploaded_at;
    IF migration_completed_at IS NOT NULL THEN
      time_since_migration := EXTRACT(EPOCH FROM (NOW() - migration_completed_at));
      RAISE LOG '[AutoThumbnail] 迁移完成 % 秒前', time_since_migration;
    ELSE
      time_since_migration := 0;
    END IF;

    RAISE LOG '[AutoThumbnail] 迁移完成，触发缩略图生成: videoId=%', NEW.id;

    -- 从 system_config 读取配置
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE WARNING '[AutoThumbnail] 配置缺失';
      RETURN NEW;
    END IF;

    edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

    BEGIN
      -- 传递时间信息给 Edge Function,让它决定是否需要延迟
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
        timeout_milliseconds := 90000  -- 90 秒（延迟 10s + 重试 0s/30s/120s 中的前两次）
      ) INTO response_id;

      RAISE LOG '[AutoThumbnail] 缩略图生成请求已发送: response_id=%', response_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoThumbnail] 调用失败: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_auto_generate_thumbnail() IS '迁移完成后智能触发缩略图生成（延迟优化为10秒）';

-- 输出信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '缩略图触发器已更新（优化版）';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 智能延迟: 10 秒（从 30 秒优化）';
  RAISE NOTICE '✅ 不阻塞数据库连接';
  RAISE NOTICE '✅ 超时 90 秒（足够延迟 + 前两次重试）';
  RAISE NOTICE ' ';
  RAISE NOTICE '⏱️  预期时间线:';
  RAISE NOTICE '1. 迁移完成 → migration_status = completed';
  RAISE NOTICE '2. 触发器立即调用 Edge Function';
  RAISE NOTICE '3. Edge Function 检查时间，如需要则延迟至 10s';
  RAISE NOTICE '4. 生成缩略图（重试: 0s → 30s）';
  RAISE NOTICE '5. 总耗时: 10-40 秒';
  RAISE NOTICE '========================================';
END $$;
