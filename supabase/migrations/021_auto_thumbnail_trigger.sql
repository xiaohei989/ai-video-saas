-- ========================================
-- 自动缩略图生成触发器系统
-- 执行时间: 2025-10-07
-- 功能: 视频完成时自动调用 Edge Function 生成缩略图
-- ========================================

-- 1. 启用 pg_net 扩展（用于 HTTP 调用）
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. 创建触发器函数：R2迁移完成时自动生成缩略图（优化版：延迟10秒）
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

    -- 异步调用 Edge Function（使用 pg_net.http_post）
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
        timeout_milliseconds := 90000  -- 90 秒（延迟 10s + 重试 0s/30s）
      ) INTO response_id;

      RAISE LOG '[AutoThumbnail] 缩略图生成请求已发送: response_id=%', response_id;

    EXCEPTION WHEN OTHERS THEN
      -- 即使触发器失败也不影响视频状态更新
      RAISE WARNING '[AutoThumbnail] 调用失败: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 创建触发器（在 UPDATE 之后执行）
DROP TRIGGER IF EXISTS on_video_completed_auto_thumbnail ON videos;
CREATE TRIGGER on_video_completed_auto_thumbnail
  AFTER UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_generate_thumbnail();

-- 4. 添加注释
COMMENT ON FUNCTION trigger_auto_generate_thumbnail() IS 'R2迁移完成时自动调用 Edge Function 生成缩略图（智能延迟10秒）';
COMMENT ON TRIGGER on_video_completed_auto_thumbnail ON videos IS '视频迁移状态变为 completed 时自动触发缩略图生成';

-- 5. 创建用于存储配置的表（可选，用于灵活配置）
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO system_config (key, value, description)
VALUES
  ('auto_thumbnail_enabled', 'true', '是否启用自动缩略图生成'),
  ('edge_function_url', '', 'Edge Function URL（留空则自动构造）'),
  ('thumbnail_generation_method', 'cloudinary', '缩略图生成方法: cloudinary 或 cloudflare')
ON CONFLICT (key) DO NOTHING;

-- 6. 创建手动触发函数（用于批量补充历史视频）
CREATE OR REPLACE FUNCTION manually_trigger_thumbnail_generation(
  p_video_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_video RECORD;
  v_edge_function_url TEXT;
  v_response_id BIGINT;
  v_result JSON;
BEGIN
  -- 检查配置是否启用
  IF (SELECT value FROM system_config WHERE key = 'auto_thumbnail_enabled') != 'true' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Auto thumbnail generation is disabled'
    );
  END IF;

  -- 获取视频信息
  SELECT * INTO v_video FROM videos WHERE id = p_video_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Video not found'
    );
  END IF;

  -- 检查条件
  IF v_video.status != 'completed' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Video is not completed'
    );
  END IF;

  IF v_video.video_url IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Video URL is null'
    );
  END IF;

  IF v_video.thumbnail_url IS NOT NULL AND v_video.thumbnail_url NOT LIKE 'data:image/svg%' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Thumbnail already exists',
      'thumbnailUrl', v_video.thumbnail_url
    );
  END IF;

  -- 构造 URL
  v_edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/auto-generate-thumbnail';

  -- 调用 Edge Function
  SELECT net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'videoId', v_video.id,
      'videoUrl', v_video.video_url
    )
  ) INTO v_response_id;

  RETURN json_build_object(
    'success', true,
    'videoId', p_video_id,
    'responseId', v_response_id,
    'message', 'Thumbnail generation triggered'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释
COMMENT ON FUNCTION manually_trigger_thumbnail_generation(UUID) IS '手动触发单个视频的缩略图生成';

-- 7. 创建批量触发函数
CREATE OR REPLACE FUNCTION batch_trigger_thumbnail_generation(
  p_limit INTEGER DEFAULT 10
)
RETURNS JSON AS $$
DECLARE
  v_video RECORD;
  v_count INTEGER := 0;
  v_results JSON[] := ARRAY[]::JSON[];
  v_result JSON;
BEGIN
  -- 查找需要生成缩略图的视频
  FOR v_video IN
    SELECT id, video_url
    FROM videos
    WHERE status = 'completed'
      AND video_url IS NOT NULL
      AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
    ORDER BY created_at DESC
    LIMIT p_limit
  LOOP
    -- 调用手动触发函数
    SELECT manually_trigger_thumbnail_generation(v_video.id) INTO v_result;
    v_results := array_append(v_results, v_result);
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'processed', v_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION batch_trigger_thumbnail_generation(INTEGER) IS '批量触发缩略图生成（默认10个）';

-- 8. 授权（确保函数可以被调用）
GRANT EXECUTE ON FUNCTION trigger_auto_generate_thumbnail() TO authenticated;
GRANT EXECUTE ON FUNCTION manually_trigger_thumbnail_generation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_trigger_thumbnail_generation(INTEGER) TO authenticated;

-- 9. 创建视图：查看待处理的视频
CREATE OR REPLACE VIEW videos_pending_auto_thumbnails AS
SELECT
  id,
  title,
  video_url,
  status,
  thumbnail_url,
  created_at,
  processing_completed_at
FROM videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
  AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
ORDER BY processing_completed_at DESC;

COMMENT ON VIEW videos_pending_auto_thumbnails IS '等待自动生成缩略图的视频列表';

-- 10. 输出安装信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '自动缩略图触发器安装完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 触发器: on_video_completed_auto_thumbnail';
  RAISE NOTICE '✅ 函数: trigger_auto_generate_thumbnail()';
  RAISE NOTICE '✅ 手动触发: manually_trigger_thumbnail_generation(video_id)';
  RAISE NOTICE '✅ 批量触发: batch_trigger_thumbnail_generation(limit)';
  RAISE NOTICE '✅ 查看待处理: SELECT * FROM videos_pending_auto_thumbnails';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  重要：请在 Supabase Dashboard 配置以下环境变量：';
  RAISE NOTICE '   - CLOUDINARY_CLOUD_NAME（Cloudinary 云名称）';
  RAISE NOTICE '   - 或使用现有的 Cloudflare CDN';
  RAISE NOTICE '========================================';
END $$;
