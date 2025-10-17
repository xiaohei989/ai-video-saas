-- ========================================
-- 修复缩略图生成逻辑：不等待R2迁移完成
-- 添加pending超时机制
-- ========================================

-- 1. 修改缩略图触发器：当视频完成时立即生成，不等待R2迁移
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
    BEGIN
      SELECT net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'videoId', NEW.id
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

-- 重新创建触发器（确保在R2迁移触发器之后执行）
DROP TRIGGER IF EXISTS on_video_completed_auto_thumbnail ON videos;

CREATE TRIGGER on_video_completed_auto_thumbnail
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_generate_thumbnail();

COMMENT ON TRIGGER on_video_completed_auto_thumbnail ON videos IS '视频完成时立即生成缩略图，不等待R2迁移';

-- ========================================
-- 2. 添加pending超时机制
-- ========================================

-- 创建函数：检测并修复超时的pending视频
CREATE OR REPLACE FUNCTION fix_stuck_pending_migrations()
RETURNS JSON AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_video RECORD;
  v_timeout_minutes INTEGER := 10;  -- 超时时间：10分钟
BEGIN
  RAISE LOG '[FixStuckPending] 开始检查卡住的pending视频...';

  -- 查找卡在 pending/downloading/uploading 超过10分钟的视频
  FOR v_video IN
    SELECT
      id,
      title,
      migration_status,
      updated_at,
      EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as stuck_minutes
    FROM videos
    WHERE migration_status IN ('pending', 'downloading', 'uploading')
      AND status = 'completed'
      AND EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 > v_timeout_minutes
    ORDER BY updated_at ASC
    LIMIT 50
  LOOP
    RAISE LOG '[FixStuckPending] 发现超时视频: id=%, title=%, status=%, 卡住时长=%分钟',
      v_video.id, v_video.title, v_video.migration_status, v_video.stuck_minutes;

    -- 标记为 failed，以便自动重试系统接管
    UPDATE videos
    SET
      migration_status = 'failed',
      migration_error = format('超时：卡在 %s 状态 %s 分钟', v_video.migration_status, ROUND(v_video.stuck_minutes::numeric, 1)),
      migration_attempts = COALESCE(migration_attempts, 0) + 1,
      migration_last_attempt_at = NOW()
    WHERE id = v_video.id;

    v_fixed_count := v_fixed_count + 1;
  END LOOP;

  RAISE LOG '[FixStuckPending] 完成！已修复 % 个超时视频', v_fixed_count;

  RETURN json_build_object(
    'success', true,
    'fixedCount', v_fixed_count,
    'timeoutMinutes', v_timeout_minutes,
    'message', format('已将 %s 个超时视频标记为 failed，将由自动重试系统接管', v_fixed_count),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fix_stuck_pending_migrations() IS '检测并修复卡在 pending/downloading/uploading 超过10分钟的视频';

-- ========================================
-- 3. 创建监控视图：卡住的视频
-- ========================================

CREATE OR REPLACE VIEW stuck_videos AS
SELECT
  id,
  title,
  status,
  migration_status,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as stuck_minutes,
  created_at,
  updated_at,
  migration_attempts,
  migration_error,
  video_url IS NOT NULL as has_video,
  r2_url IS NOT NULL as has_r2
FROM videos
WHERE migration_status IN ('pending', 'downloading', 'uploading')
  AND status = 'completed'
  AND EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 > 5  -- 超过5分钟就显示
ORDER BY updated_at ASC;

COMMENT ON VIEW stuck_videos IS '显示所有卡在迁移过程中的视频';

-- ========================================
-- 4. 立即执行一次修复
-- ========================================

DO $$
DECLARE
  v_result JSON;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '缩略图触发器已修复！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 新逻辑: 视频完成时立即生成缩略图';
  RAISE NOTICE '✅ 不再等待 R2 迁移完成';
  RAISE NOTICE '✅ Pending 超时机制已添加（10分钟）';
  RAISE NOTICE '';

  -- 立即执行一次pending修复
  SELECT fix_stuck_pending_migrations() INTO v_result;

  RAISE NOTICE '🔧 立即修复结果:';
  RAISE NOTICE '%', v_result::text;
  RAISE NOTICE '';

  RAISE NOTICE '📊 监控命令:';
  RAISE NOTICE '-- 查看卡住的视频:';
  RAISE NOTICE 'SELECT * FROM stuck_videos;';
  RAISE NOTICE '';
  RAISE NOTICE '-- 手动修复超时视频:';
  RAISE NOTICE 'SELECT fix_stuck_pending_migrations();';
  RAISE NOTICE '';
  RAISE NOTICE '-- 为失败视频手动触发缩略图:';
  RAISE NOTICE 'SELECT manually_trigger_thumbnails_for_failed_migrations();';
  RAISE NOTICE '========================================';
END $$;
