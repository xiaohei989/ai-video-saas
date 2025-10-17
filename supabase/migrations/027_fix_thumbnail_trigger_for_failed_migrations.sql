-- ========================================
-- 修复缩略图生成触发器
-- 解决问题：迁移失败的视频永远不会生成缩略图
-- ========================================
--
-- 问题分析：
-- 1. 当前触发器只监听 migration_status = 'completed'
-- 2. 但75%的视频迁移失败 (migration_status = 'failed')
-- 3. 这些视频永远不会触发缩略图生成
--
-- 解决方案：
-- 添加备用触发条件，当视频完成但迁移失败时也生成缩略图
-- ========================================

-- 1. 替换触发器函数，增加对 status = 'completed' 的监听
CREATE OR REPLACE FUNCTION trigger_auto_generate_thumbnail()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  migration_completed_at TIMESTAMP;
  time_since_migration INTEGER;
  should_trigger BOOLEAN := FALSE;
BEGIN

  -- ============================================
  -- 触发条件 1: 迁移成功完成时触发（原有逻辑）
  -- ============================================
  IF NEW.migration_status = 'completed'
     AND (OLD.migration_status IS NULL OR OLD.migration_status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN
    should_trigger := TRUE;
    RAISE LOG '[AutoThumbnail] 触发原因: migration_status = completed';
  END IF;

  -- ============================================
  -- 触发条件 2: 视频完成且迁移失败时触发（新增逻辑）
  -- ============================================
  IF NOT should_trigger
     AND NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%')
     AND (NEW.migration_status IS NULL
          OR NEW.migration_status = 'failed'
          OR NEW.migration_status = 'pending') THEN
    should_trigger := TRUE;
    RAISE LOG '[AutoThumbnail] 触发原因: status = completed (migration_status = %)', NEW.migration_status;
  END IF;

  -- ============================================
  -- 触发条件 3: 迁移状态变为 failed 时触发（新增逻辑）
  -- ============================================
  IF NOT should_trigger
     AND NEW.migration_status = 'failed'
     AND (OLD.migration_status IS NULL
          OR OLD.migration_status NOT IN ('failed', 'completed'))
     AND NEW.status = 'completed'
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN
    should_trigger := TRUE;
    RAISE LOG '[AutoThumbnail] 触发原因: migration_status = failed (备用机制)';
  END IF;

  -- 如果不满足任何触发条件，直接返回
  IF NOT should_trigger THEN
    RETURN NEW;
  END IF;

  -- ============================================
  -- 执行缩略图生成逻辑
  -- ============================================

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

  -- 计算完成后经过的时间
  migration_completed_at := COALESCE(NEW.r2_uploaded_at, NEW.processing_completed_at);
  IF migration_completed_at IS NOT NULL THEN
    time_since_migration := EXTRACT(EPOCH FROM (NOW() - migration_completed_at));
  ELSE
    time_since_migration := 0;
  END IF;

  RAISE LOG '[AutoThumbnail] 触发缩略图生成: videoId=%, attempts=%',
    NEW.id, COALESCE(NEW.thumbnail_generation_attempts, 0);

  -- 从 system_config 读取配置
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

  -- 配置缺失时记录错误
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

  -- 更新状态为 pending
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
        'migrationStatus', NEW.migration_status,
        'completedAt', migration_completed_at::TEXT,
        'timeSinceCompletion', time_since_migration
      ),
      timeout_milliseconds := 90000
    ) INTO response_id;

    RAISE LOG '[AutoThumbnail] 请求已发送: response_id=%', response_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[AutoThumbnail] HTTP调用失败: %', SQLERRM;
    NEW.thumbnail_generation_status := 'failed';
    NEW.thumbnail_generation_error := 'HTTP调用失败: ' || SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_auto_generate_thumbnail() IS
'增强版触发器：监听 migration_status=completed 或 status=completed (迁移失败时的备用机制)';

-- 2. 重新创建触发器
DROP TRIGGER IF EXISTS on_video_migration_completed_auto_thumbnail ON videos;

CREATE TRIGGER on_video_migration_completed_auto_thumbnail
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_generate_thumbnail();

COMMENT ON TRIGGER on_video_migration_completed_auto_thumbnail ON videos IS
'自动生成缩略图触发器：监听 migration_status 或 status 变化';

-- 3. 创建手动重试函数，为现有的迁移失败视频生成缩略图
CREATE OR REPLACE FUNCTION manually_trigger_thumbnails_for_failed_migrations()
RETURNS JSON AS $$
DECLARE
  v_count INTEGER := 0;
  v_video RECORD;
BEGIN
  -- 查找迁移失败但需要生成缩略图的视频
  FOR v_video IN
    SELECT id, migration_status
    FROM videos
    WHERE status = 'completed'
      AND video_url IS NOT NULL
      AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
      AND (migration_status IS NULL OR migration_status IN ('failed', 'pending'))
      AND (thumbnail_generation_status IS NULL
           OR thumbnail_generation_status IN ('pending', 'failed'))
      AND COALESCE(thumbnail_generation_attempts, 0) < 3
    ORDER BY created_at DESC
    LIMIT 50
  LOOP
    -- 更新 migration_status 为 NULL，然后更新为 failed，触发触发器
    UPDATE videos
    SET
      updated_at = NOW(),
      migration_status = CASE
        WHEN migration_status = 'failed' THEN 'failed'  -- 保持 failed
        ELSE COALESCE(migration_status, 'failed')       -- NULL 变成 failed
      END
    WHERE id = v_video.id;

    v_count := v_count + 1;

    -- 避免过于频繁
    PERFORM pg_sleep(0.3);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'processedCount', v_count,
    'message', format('已为 %s 个迁移失败的视频触发缩略图生成', v_count),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION manually_trigger_thumbnails_for_failed_migrations() IS
'手动为迁移失败的视频触发缩略图生成';

-- 4. 输出部署信息
DO $$
DECLARE
  v_need_generation INTEGER;
  v_failed_migrations INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_need_generation
  FROM videos
  WHERE status = 'completed'
    AND video_url IS NOT NULL
    AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
    AND COALESCE(thumbnail_generation_attempts, 0) < 3;

  SELECT COUNT(*) INTO v_failed_migrations
  FROM videos
  WHERE status = 'completed'
    AND migration_status = 'failed'
    AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%');

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 缩略图触发器修复完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 当前状态:';
  RAISE NOTICE '  - 需要生成缩略图: % 个', v_need_generation;
  RAISE NOTICE '  - 迁移失败的视频: % 个', v_failed_migrations;
  RAISE NOTICE '';
  RAISE NOTICE '🔧 新增功能:';
  RAISE NOTICE '  1. 触发器现在会监听 status = completed (不再只依赖 migration_status)';
  RAISE NOTICE '  2. 迁移失败的视频也会自动生成缩略图';
  RAISE NOTICE '  3. 新增手动重试函数';
  RAISE NOTICE '';
  RAISE NOTICE '💡 立即修复现有视频:';
  RAISE NOTICE '  执行: SELECT manually_trigger_thumbnails_for_failed_migrations();';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  注意: 新触发器会在下次视频更新时自动生效';
  RAISE NOTICE '========================================';
END $$;
