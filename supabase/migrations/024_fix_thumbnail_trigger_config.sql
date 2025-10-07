-- ========================================
-- 修复缩略图触发器配置问题
-- 统一使用 system_config 表（与迁移触发器保持一致）
-- ========================================

-- 更新触发器函数：从 system_config 表读取配置
CREATE OR REPLACE FUNCTION trigger_auto_generate_thumbnail()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- 仅在视频刚完成且缺少缩略图时触发
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN

    -- 从 system_config 读取配置（与迁移触发器保持一致）
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

    -- 验证配置是否存在
    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE WARNING '[AutoThumbnail Trigger] 配置缺失: supabase_url=%, service_role_key=%',
        v_supabase_url IS NOT NULL, v_service_role_key IS NOT NULL;
      RETURN NEW;
    END IF;

    edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

    RAISE LOG '[AutoThumbnail Trigger] 视频完成，触发缩略图生成: videoId=%, url=%', NEW.id, edge_function_url;

    -- 异步调用 Edge Function（使用 pg_net.http_post）
    BEGIN
      SELECT net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'videoId', NEW.id,
          'videoUrl', NEW.video_url
        )
      ) INTO response_id;

      RAISE LOG '[AutoThumbnail Trigger] HTTP 请求已发送: response_id=%', response_id;

    EXCEPTION WHEN OTHERS THEN
      -- 即使触发器失败也不影响视频状态更新
      RAISE WARNING '[AutoThumbnail Trigger] 触发器调用失败，但不影响视频更新: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_auto_generate_thumbnail() IS '视频完成时自动调用 Edge Function 生成缩略图（使用 system_config）';

-- 更新手动触发函数
CREATE OR REPLACE FUNCTION manually_trigger_thumbnail_generation(
  p_video_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_video RECORD;
  v_edge_function_url TEXT;
  v_response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
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

  -- 从 system_config 读取配置
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Missing configuration in system_config'
    );
  END IF;

  v_edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

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

COMMENT ON FUNCTION manually_trigger_thumbnail_generation(UUID) IS '手动触发单个视频的缩略图生成（使用 system_config）';

-- 输出信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '缩略图触发器配置已修复';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 统一使用 system_config 表读取配置';
  RAISE NOTICE '✅ 与迁移触发器配置方式一致';
  RAISE NOTICE ' ';
  RAISE NOTICE '📋 system_config 必需配置:';
  RAISE NOTICE '- supabase_url';
  RAISE NOTICE '- service_role_key';
  RAISE NOTICE '- auto_thumbnail_enabled (可选，默认 true)';
  RAISE NOTICE '========================================';
END $$;
