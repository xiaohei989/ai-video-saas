-- 修复缩略图触发器：统一使用 system_config 表
CREATE OR REPLACE FUNCTION trigger_auto_generate_thumbnail()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN

    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE WARNING '[AutoThumbnail] 配置缺失';
      RETURN NEW;
    END IF;

    edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

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

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoThumbnail] 调用失败: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
