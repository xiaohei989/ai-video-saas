-- ========================================
-- 修复缩略图触发器：增加延迟确保 Cloudflare 准备好
-- 问题：迁移完成后立即触发导致 504 超时
-- 解决：使用 pg_cron 或 pg_net 的延迟功能
-- ========================================

-- 方案1: 修改触发器函数，添加一个小延迟(简单但会阻塞)
-- 方案2: 使用异步调度(推荐)

-- 这里我们使用方案1的变体：使用 pg_sleep 延迟30秒
CREATE OR REPLACE FUNCTION trigger_auto_generate_thumbnail()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- 新触发条件：迁移状态变为 completed 时触发
  IF NEW.migration_status = 'completed'
     AND (OLD.migration_status IS NULL OR OLD.migration_status != 'completed')
     AND NEW.video_url IS NOT NULL
     AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%') THEN

    RAISE LOG '[AutoThumbnail] 迁移完成，将在30秒后触发缩略图生成: videoId=%', NEW.id;

    -- 从 system_config 读取配置
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE WARNING '[AutoThumbnail] 配置缺失';
      RETURN NEW;
    END IF;

    edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

    BEGIN
      -- ⏰ 延迟 30 秒，给 Cloudflare 时间处理视频
      PERFORM pg_sleep(30);

      RAISE LOG '[AutoThumbnail] 延迟完成，现在发送缩略图生成请求';

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
        timeout_milliseconds := 90000  -- 减少到 90 秒（因为已经等了30秒）
      ) INTO response_id;

      RAISE LOG '[AutoThumbnail] 缩略图生成请求已发送: response_id=%', response_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoThumbnail] 调用失败: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_auto_generate_thumbnail() IS '迁移完成后延迟30秒自动生成缩略图（给 Cloudflare 处理时间）';

-- 输出信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '缩略图触发器已更新';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 新特性: 延迟 30 秒后触发';
  RAISE NOTICE '✅ 避免 Cloudflare 处理中的 504 错误';
  RAISE NOTICE '✅ Edge Function 超时改为 90 秒';
  RAISE NOTICE ' ';
  RAISE NOTICE '⏱️  预期时间线:';
  RAISE NOTICE '1. 迁移完成 → migration_status = completed';
  RAISE NOTICE '2. 等待 30 秒 → pg_sleep(30)';
  RAISE NOTICE '3. 触发缩略图生成 → timeout 90s';
  RAISE NOTICE '4. Edge Function 重试: 0s → 30s';
  RAISE NOTICE '5. 总耗时: 约 60-90 秒';
  RAISE NOTICE '========================================';
END $$;
