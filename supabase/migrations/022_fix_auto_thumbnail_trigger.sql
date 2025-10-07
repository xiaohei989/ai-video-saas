-- ========================================
-- 修复自动缩略图生成触发器
-- 问题：pg_net HTTP 请求可能未正确发送
-- 解决：使用 pg_cron 或改进触发器逻辑
-- ========================================

-- 1. 改进触发器函数，添加更多日志和错误处理
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

    -- 从 system_config 读取配置
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

    -- 验证配置是否存在
    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE WARNING '[AutoThumbnail Trigger] 配置缺失: supabase_url=%, service_role_key=%',
        v_supabase_url IS NOT NULL, v_service_role_key IS NOT NULL;
      RETURN NEW;
    END IF;

    edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

    RAISE LOG '[AutoThumbnail Trigger] 准备调用: videoId=%, url=%', NEW.id, edge_function_url;

    -- 使用 pg_net.http_post 发送异步请求
    -- 注意：请求会在事务提交后才真正发送
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
        timeout_milliseconds := 30000  -- 30秒超时
      ) INTO response_id;

      RAISE LOG '[AutoThumbnail Trigger] HTTP 请求已排队: response_id=%', response_id;

      -- 在视频记录中标记触发状态（可选）
      NEW.thumbnail_metadata := jsonb_build_object(
        'auto_trigger_attempted', true,
        'pg_net_response_id', response_id,
        'triggered_at', NOW()
      );

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoThumbnail Trigger] pg_net 调用失败: %', SQLERRM;
      -- 失败也不影响视频状态更新
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建一个测试函数，验证 pg_net 是否工作
CREATE OR REPLACE FUNCTION test_pgnet_connection()
RETURNS JSON AS $$
DECLARE
  v_response_id BIGINT;
  v_test_url TEXT := 'https://postman-echo.com/post';
BEGIN
  -- 使用 Postman Echo 测试 pg_net
  SELECT net.http_post(
    url := v_test_url,
    body := jsonb_build_object(
      'test', 'pg_net_test',
      'timestamp', NOW()
    )
  ) INTO v_response_id;

  RETURN json_build_object(
    'success', true,
    'response_id', v_response_id,
    'message', '请在几秒钟后查询 net._http_response 表查看结果'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION test_pgnet_connection() IS '测试 pg_net 是否正常工作';

-- 3. 创建一个查看 pg_net 响应的便捷视图
CREATE OR REPLACE VIEW pg_net_recent_responses AS
SELECT
  id,
  status_code,
  error_msg,
  created,
  timed_out,
  CASE
    WHEN status_code IS NULL AND error_msg IS NOT NULL THEN '请求失败'
    WHEN status_code >= 200 AND status_code < 300 THEN '成功'
    WHEN status_code >= 400 THEN '错误'
    WHEN timed_out THEN '超时'
    ELSE '未知'
  END as status_summary,
  LEFT(content::text, 200) as content_preview
FROM net._http_response
WHERE created > NOW() - INTERVAL '1 day'
ORDER BY created DESC;

COMMENT ON VIEW pg_net_recent_responses IS '查看最近 24 小时的 pg_net HTTP 响应';

-- 4. 授权
GRANT SELECT ON pg_net_recent_responses TO authenticated;
GRANT EXECUTE ON FUNCTION test_pgnet_connection() TO authenticated;

-- 5. 输出信息
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '自动缩略图触发器已更新';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 触发器函数已改进，增加了日志和错误处理';
  RAISE NOTICE '✅ 创建测试函数: test_pgnet_connection()';
  RAISE NOTICE '✅ 创建便捷视图: pg_net_recent_responses';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 测试步骤:';
  RAISE NOTICE '1. 测试 pg_net: SELECT test_pgnet_connection();';
  RAISE NOTICE '2. 查看响应: SELECT * FROM pg_net_recent_responses;';
  RAISE NOTICE '3. 触发缩略图生成: SELECT manually_trigger_thumbnail_generation(''video-id'');';
  RAISE NOTICE '========================================';
END $$;
