-- ========================================
-- 修复缩略图触发器：传递 videoUrl 参数
-- ========================================

CREATE OR REPLACE FUNCTION trigger_auto_generate_thumbnail()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  should_trigger BOOLEAN := FALSE;
BEGIN
  -- ✅ 新逻辑：当视频完成时立即生成缩略图，不等待R2迁移
  -- 触发条件：status = 'completed' AND video_url 存在 AND 还没有缩略图
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN
    should_trigger := TRUE;
    RAISE LOG '[AutoThumbnail] 视频完成，立即触发缩略图生成（不等待R2迁移）: videoId=%', NEW.id;
  END IF;

  -- 备用条件：如果之前没触发，但迁移完成了，也触发
  IF NOT should_trigger
     AND NEW.migration_status = 'completed'
     AND (OLD.migration_status IS NULL OR OLD.migration_status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN
    should_trigger := TRUE;
    RAISE LOG '[AutoThumbnail] R2迁移完成，触发缩略图生成: videoId=%', NEW.id;
  END IF;

  -- 如果需要触发缩略图生成
  IF should_trigger THEN
    -- 从 system_config 读取配置
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

    -- 验证配置是否存在
    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE WARNING '[AutoThumbnail] 配置缺失';
      RETURN NEW;
    END IF;

    edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

    -- 更新缩略图生成状态为 pending
    NEW.thumbnail_generation_status := 'pending';

    -- 使用 pg_net.http_post 调用缩略图生成服务
    -- ✅ 修复：传递 videoUrl 参数
    BEGIN
      SELECT net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'videoId', NEW.id,
          'videoUrl', NEW.video_url  -- ✅ 新增：传递 videoUrl
        ),
        timeout_milliseconds := 60000  -- 1分钟超时
      ) INTO response_id;

      RAISE LOG '[AutoThumbnail] 缩略图生成请求已排队: response_id=%', response_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoThumbnail] pg_net 调用失败: %', SQLERRM;
      NEW.thumbnail_generation_status := 'failed';
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 输出确认信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 缩略图触发器已修复';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 现在会传递 videoUrl 参数给 Edge Function';
  RAISE NOTICE '✅ 触发器已更新完成';
  RAISE NOTICE '========================================';
END $$;
