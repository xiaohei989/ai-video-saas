-- ========================================
-- 修复卡在"Generating thumbnail..."的视频
-- ========================================
-- 问题分析：
-- 1. 触发器依赖system_config表的supabase_url和service_role_key
-- 2. 如果system_config配置缺失，触发器会静默失败
-- 3. 视频状态已完成，但缩略图永远不会生成
-- ========================================

-- 步骤1: 检查system_config表是否存在必要配置
SELECT
  '1. 检查system_config配置' as step,
  key,
  CASE
    WHEN key = 'service_role_key' THEN LEFT(value, 30) || '...'
    ELSE value
  END as value_preview,
  LENGTH(value) as value_length
FROM system_config
WHERE key IN ('supabase_url', 'service_role_key', 'auto_thumbnail_enabled');

-- 步骤2: 如果配置缺失，插入正确的配置
INSERT INTO system_config (key, value, description)
VALUES
  ('supabase_url', 'https://hvkzwrnvxsleeonqqrzq.supabase.co', 'Supabase项目URL'),
  ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI', 'Supabase Service Role Key'),
  ('auto_thumbnail_enabled', 'true', '是否启用自动缩略图生成')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- 步骤3: 验证配置是否正确
DO $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

  RAISE NOTICE '========================================';
  RAISE NOTICE '2. 验证配置';
  RAISE NOTICE '========================================';

  IF v_supabase_url IS NULL THEN
    RAISE NOTICE '❌ supabase_url 配置缺失';
  ELSE
    RAISE NOTICE '✅ supabase_url: %', v_supabase_url;
  END IF;

  IF v_service_role_key IS NULL THEN
    RAISE NOTICE '❌ service_role_key 配置缺失';
  ELSIF LENGTH(v_service_role_key) < 100 THEN
    RAISE NOTICE '❌ service_role_key 太短: % 字符', LENGTH(v_service_role_key);
  ELSE
    RAISE NOTICE '✅ service_role_key: %... (% 字符)', LEFT(v_service_role_key, 30), LENGTH(v_service_role_key);
  END IF;
END $$;

-- 步骤4: 检查卡住的视频
SELECT
  '3. 卡住的视频列表' as step,
  id,
  title,
  status,
  migration_status,
  thumbnail_url IS NULL as no_thumbnail,
  thumbnail_url LIKE 'data:image/svg%' as is_svg_placeholder,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_since_creation
FROM videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
  AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
ORDER BY created_at DESC
LIMIT 10;

-- 步骤5: 手动触发缩略图生成（针对卡住的视频）
-- 创建一个临时函数来批量处理
DO $$
DECLARE
  v_video RECORD;
  v_count INTEGER := 0;
  v_edge_function_url TEXT;
  v_response_id BIGINT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- 读取配置
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '4. 无法手动触发：配置缺失';
    RAISE NOTICE '========================================';
    RETURN;
  END IF;

  v_edge_function_url := v_supabase_url || '/functions/v1/auto-generate-thumbnail';

  RAISE NOTICE '========================================';
  RAISE NOTICE '4. 开始手动触发缩略图生成';
  RAISE NOTICE '========================================';

  -- 查找所有卡住的视频
  FOR v_video IN
    SELECT id, title, video_url
    FROM videos
    WHERE status = 'completed'
      AND video_url IS NOT NULL
      AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
    ORDER BY created_at DESC
    LIMIT 10  -- 限制一次处理10个
  LOOP
    BEGIN
      -- 调用Edge Function
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

      v_count := v_count + 1;
      RAISE NOTICE '✅ [%/10] 已触发: % (response_id=%)', v_count, LEFT(v_video.title, 50), v_response_id;

      -- 避免过于频繁的请求
      PERFORM pg_sleep(0.5);

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ 触发失败: % - 错误: %', LEFT(v_video.title, 50), SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 完成！共触发 % 个视频的缩略图生成', v_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '⏰ 请等待3-5分钟让Edge Function处理';
  RAISE NOTICE '🔄 之后刷新我的视频页面查看结果';
  RAISE NOTICE '========================================';
END $$;
