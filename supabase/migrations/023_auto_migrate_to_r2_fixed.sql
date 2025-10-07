-- ========================================
-- 自动迁移视频到 Cloudflare R2
-- 当视频完成时，如果不在 R2，自动触发迁移
-- ========================================

-- 1. 创建触发器函数，在视频完成时检查并触发迁移
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
    -- 条件：video_url 不包含 cdn.veo3video.me 且迁移状态不是 completed
    needs_migration := (
      NEW.video_url NOT LIKE '%cdn.veo3video.me%'
      AND NEW.video_url NOT LIKE '%r2.cloudflarestorage.com%'
      AND (NEW.migration_status IS NULL OR NEW.migration_status != 'completed')
      AND NEW.r2_url IS NULL
    );

    -- 如果需要迁移
    IF needs_migration THEN
      RAISE LOG '[AutoMigrate Trigger] 检测到需要迁移: videoId=%, url=%', NEW.id, NEW.video_url;

      -- 从 system_config 读取配置
      SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
      SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

      -- 验证配置是否存在
      IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
        RAISE WARNING '[AutoMigrate Trigger] 配置缺失: supabase_url=%, service_role_key=%',
          v_supabase_url IS NOT NULL, v_service_role_key IS NOT NULL;
        RETURN NEW;
      END IF;

      edge_function_url := v_supabase_url || '/functions/v1/migrate-video';

      RAISE LOG '[AutoMigrate Trigger] 准备调用迁移服务: videoId=%, url=%', NEW.id, edge_function_url;

      -- 更新迁移状态为 pending（表示即将开始迁移）
      NEW.migration_status := 'pending';

      -- 使用 pg_net.http_post 发送异步请求调用迁移服务
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
          timeout_milliseconds := 180000  -- 3分钟超时（下载+上传需要时间）
        ) INTO response_id;

        RAISE LOG '[AutoMigrate Trigger] 迁移请求已排队: response_id=%', response_id;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[AutoMigrate Trigger] pg_net 调用失败: %', SQLERRM;
        NEW.migration_status := 'failed';
        -- 失败也不影响视频状态更新
      END;

    ELSE
      RAISE LOG '[AutoMigrate Trigger] 视频无需迁移: videoId=%, url=%', NEW.id, NEW.video_url;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建触发器（在缩略图触发器之前执行）
DROP TRIGGER IF EXISTS on_video_completed_auto_migrate ON videos;

CREATE TRIGGER on_video_completed_auto_migrate
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_migrate_to_r2();

COMMENT ON TRIGGER on_video_completed_auto_migrate ON videos IS '视频完成时自动触发迁移到 Cloudflare R2';

-- 3. 创建手动触发迁移的函数（用于测试和补救）
CREATE OR REPLACE FUNCTION manually_trigger_migration(p_video_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_video RECORD;
BEGIN
  -- 获取视频信息
  SELECT id, video_url, r2_url, migration_status
  INTO v_video
  FROM videos
  WHERE id = p_video_id;

  IF v_video.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', '视频不存在'
    );
  END IF;

  -- 触发迁移：通过更新 status 来触发触发器
  UPDATE videos
  SET status = 'processing'
  WHERE id = p_video_id;

  UPDATE videos
  SET status = 'completed'
  WHERE id = p_video_id;

  RETURN json_build_object(
    'success', true,
    'videoId', p_video_id,
    'message', '迁移已触发，请稍后查看结果'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION manually_trigger_migration(UUID) IS '手动触发视频迁移到 R2';

-- 4. 创建批量触发迁移的函数
CREATE OR REPLACE FUNCTION batch_trigger_migration(p_limit INTEGER DEFAULT 10)
RETURNS JSON AS $$
DECLARE
  v_count INTEGER := 0;
  v_video RECORD;
BEGIN
  -- 查找需要迁移的视频
  FOR v_video IN
    SELECT id, video_url
    FROM videos
    WHERE status = 'completed'
      AND video_url IS NOT NULL
      AND video_url NOT LIKE '%cdn.veo3video.me%'
      AND video_url NOT LIKE '%r2.cloudflarestorage.com%'
      AND (migration_status IS NULL OR migration_status != 'completed')
      AND r2_url IS NULL
    LIMIT p_limit
  LOOP
    -- 触发迁移
    PERFORM manually_trigger_migration(v_video.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'count', v_count,
    'message', format('已触发 %s 个视频的迁移', v_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION batch_trigger_migration(INTEGER) IS '批量触发视频迁移到 R2';

-- 5. 授权
GRANT EXECUTE ON FUNCTION manually_trigger_migration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_trigger_migration(INTEGER) TO authenticated;

-- 6. 输出信息（修复 RAISE NOTICE 语法）
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '自动迁移到 R2 触发器已创建';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 触发器: on_video_completed_auto_migrate';
  RAISE NOTICE '✅ 函数: trigger_auto_migrate_to_r2()';
  RAISE NOTICE '✅ 手动触发: manually_trigger_migration(video_id)';
  RAISE NOTICE '✅ 批量触发: batch_trigger_migration(limit)';
  RAISE NOTICE ' ';
  RAISE NOTICE '🎯 触发条件:';
  RAISE NOTICE '- 视频状态变为 completed';
  RAISE NOTICE '- video_url 不在 R2 (不包含 cdn.veo3video.me)';
  RAISE NOTICE '- migration_status 不是 completed';
  RAISE NOTICE '- r2_url 为空';
  RAISE NOTICE ' ';
  RAISE NOTICE '🧪 测试命令:';
  RAISE NOTICE '-- 手动触发单个视频迁移:';
  RAISE NOTICE 'SELECT manually_trigger_migration(''your-video-id'');';
  RAISE NOTICE ' ';
  RAISE NOTICE '-- 批量触发 10 个视频迁移:';
  RAISE NOTICE 'SELECT batch_trigger_migration(10);';
  RAISE NOTICE ' ';
  RAISE NOTICE '-- 查看迁移状态:';
  RAISE NOTICE 'SELECT id, title, migration_status, video_url, r2_url';
  RAISE NOTICE 'FROM videos';
  RAISE NOTICE 'WHERE video_url NOT LIKE ''%%cdn.veo3video.me%%''';
  RAISE NOTICE 'ORDER BY created_at DESC;';
  RAISE NOTICE '========================================';
END $$;
