-- ========================================
-- 添加缩略图生成状态跟踪
-- 解决：缩略图永久卡在 "Generating thumbnail..." 的问题
-- ========================================

-- 1. 添加状态跟踪字段
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS thumbnail_generation_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_generation_error TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_generation_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thumbnail_generation_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_generation_last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. 添加约束
ALTER TABLE videos
  ADD CONSTRAINT thumbnail_generation_status_check
  CHECK (thumbnail_generation_status IN (NULL, 'pending', 'processing', 'completed', 'failed'));

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_generation_status
  ON videos(thumbnail_generation_status)
  WHERE thumbnail_generation_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_videos_pending_thumbnails
  ON videos(status, migration_status, thumbnail_generation_status)
  WHERE status = 'completed'
    AND migration_status = 'completed'
    AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
    AND (thumbnail_generation_status IS NULL OR thumbnail_generation_status IN ('pending', 'failed'));

-- 4. 添加字段注释
COMMENT ON COLUMN videos.thumbnail_generation_status IS '缩略图生成状态: pending(待处理), processing(处理中), completed(完成), failed(失败)';
COMMENT ON COLUMN videos.thumbnail_generation_error IS '缩略图生成失败的错误信息';
COMMENT ON COLUMN videos.thumbnail_generation_attempts IS '缩略图生成尝试次数';
COMMENT ON COLUMN videos.thumbnail_generation_started_at IS '首次开始生成缩略图的时间';
COMMENT ON COLUMN videos.thumbnail_generation_last_attempt_at IS '最后一次尝试生成缩略图的时间';

-- 5. 更新现有数据：将已有缩略图的视频标记为completed
UPDATE videos
SET
  thumbnail_generation_status = 'completed',
  thumbnail_generation_attempts = 1,
  thumbnail_generation_started_at = thumbnail_generated_at,
  thumbnail_generation_last_attempt_at = thumbnail_generated_at
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url NOT LIKE 'data:image/svg%'
  AND thumbnail_generation_status IS NULL;

-- 6. 更新卡住的视频：标记为failed，以便重试
UPDATE videos
SET
  thumbnail_generation_status = 'failed',
  thumbnail_generation_error = '缩略图生成超时或失败（系统自动检测）',
  thumbnail_generation_attempts = 1,
  thumbnail_generation_last_attempt_at = COALESCE(r2_uploaded_at, created_at)
WHERE status = 'completed'
  AND migration_status = 'completed'
  AND video_url IS NOT NULL
  AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
  AND thumbnail_generation_status IS NULL
  AND created_at < NOW() - INTERVAL '10 minutes';  -- 10分钟前创建的视频

-- 7. 创建视图：查看需要生成缩略图的视频
CREATE OR REPLACE VIEW videos_need_thumbnail_generation AS
SELECT
  id,
  title,
  video_url,
  status,
  migration_status,
  thumbnail_url,
  thumbnail_generation_status,
  thumbnail_generation_error,
  thumbnail_generation_attempts,
  thumbnail_generation_last_attempt_at,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(thumbnail_generation_last_attempt_at, r2_uploaded_at, created_at))) / 60 as minutes_since_last_attempt,
  created_at
FROM videos
WHERE status = 'completed'
  AND migration_status = 'completed'
  AND video_url IS NOT NULL
  AND (thumbnail_url IS NULL OR thumbnail_url LIKE 'data:image/svg%')
  AND (
    thumbnail_generation_status IS NULL
    OR thumbnail_generation_status = 'pending'
    OR (thumbnail_generation_status = 'failed' AND thumbnail_generation_attempts < 3)
  )
ORDER BY
  CASE
    WHEN thumbnail_generation_status = 'failed' THEN thumbnail_generation_attempts
    ELSE 0
  END ASC,
  created_at DESC;

COMMENT ON VIEW videos_need_thumbnail_generation IS '需要生成缩略图的视频列表（包括失败但未超过3次重试的）';

-- 8. 输出信息
DO $$
DECLARE
  v_completed_count INTEGER;
  v_failed_count INTEGER;
  v_pending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_completed_count FROM videos WHERE thumbnail_generation_status = 'completed';
  SELECT COUNT(*) INTO v_failed_count FROM videos WHERE thumbnail_generation_status = 'failed';
  SELECT COUNT(*) INTO v_pending_count FROM videos_need_thumbnail_generation;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 缩略图状态跟踪字段已添加';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 数据统计:';
  RAISE NOTICE '  - 已有缩略图: % 个视频', v_completed_count;
  RAISE NOTICE '  - 标记为失败: % 个视频', v_failed_count;
  RAISE NOTICE '  - 待处理/重试: % 个视频', v_pending_count;
  RAISE NOTICE '';
  RAISE NOTICE '📋 新增字段:';
  RAISE NOTICE '  - thumbnail_generation_status (状态跟踪)';
  RAISE NOTICE '  - thumbnail_generation_error (错误信息)';
  RAISE NOTICE '  - thumbnail_generation_attempts (重试次数)';
  RAISE NOTICE '  - thumbnail_generation_started_at (开始时间)';
  RAISE NOTICE '  - thumbnail_generation_last_attempt_at (最后尝试时间)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 查看待处理视频:';
  RAISE NOTICE '  SELECT * FROM videos_need_thumbnail_generation;';
  RAISE NOTICE '========================================';
END $$;
