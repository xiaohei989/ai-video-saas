-- ========================================
-- 修复缩略图触发器：在迁移完成后触发
-- 解决问题：缩略图在迁移完成前就被调用导致失败
-- ========================================

-- 更新触发器函数：当迁移完成时才触发缩略图生成
CREATE OR REPLACE FUNCTION trigger_auto_generate_thumbnail()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- 新触发条件：迁移状态变为 completed 时触发
  -- 这样确保视频已经在 R2 上且 Cloudflare 有时间处理
  IF NEW.migration_status = 'completed'
     AND (OLD.migration_status IS NULL OR OLD.migration_status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN

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
      SELECT net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'videoId', NEW.id,
          'videoUrl', NEW.video_url
        ),
        timeout_milliseconds := 180000  -- 3分钟超时（包含重试时间）
      ) INTO response_id;

      RAISE LOG '[AutoThumbnail] 缩略图生成请求已发送: response_id=%', response_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoThumbnail] 调用失败: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_auto_generate_thumbnail() IS '迁移完成后自动生成缩略图（使用 system_config，监听 migration_status）';

-- 注意：触发器本身不需要重建，因为我们只修改了函数
-- 但为了确保，可以重建一次
DROP TRIGGER IF EXISTS on_video_completed_auto_thumbnail ON videos;

CREATE TRIGGER on_video_completed_auto_thumbnail
  AFTER UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_generate_thumbnail();

COMMENT ON TRIGGER on_video_completed_auto_thumbnail ON videos IS '视频迁移完成时自动触发缩略图生成';

-- 输出信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '缩略图触发器已修复';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 新触发条件: migration_status 变为 completed';
  RAISE NOTICE '✅ 确保视频已在 R2 上';
  RAISE NOTICE '✅ 给 Cloudflare 足够时间处理';
  RAISE NOTICE ' ';
  RAISE NOTICE '📝 触发流程:';
  RAISE NOTICE '1. 视频完成 → status = completed';
  RAISE NOTICE '2. 迁移触发器 → 下载OSS + 上传R2';
  RAISE NOTICE '3. 迁移完成 → migration_status = completed';
  RAISE NOTICE '4. 缩略图触发器 → 生成缩略图 ✅';
  RAISE NOTICE ' ';
  RAISE NOTICE '⏱️  预期时间线:';
  RAISE NOTICE '- 迁移耗时: 30-60秒';
  RAISE NOTICE '- 缩略图生成: 3-8秒（迁移后立即可用）';
  RAISE NOTICE '- 总耗时: 约 1 分钟';
  RAISE NOTICE '========================================';
END $$;
