-- 移除 thumbnail_generation_status 字段
-- 用户要求简化缩略图生成逻辑，不再需要状态跟踪

BEGIN;

-- 先删除依赖的视图
DROP VIEW IF EXISTS videos_pending_thumbnails;

-- 删除 thumbnail_generation_status 字段
ALTER TABLE videos DROP COLUMN IF EXISTS thumbnail_generation_status;

-- 重新创建简化版本的视图（不包含thumbnail_generation_status）
CREATE VIEW videos_pending_thumbnails AS
SELECT id,
       video_url,
       status,
       created_at,
       processing_completed_at
FROM videos
WHERE status = 'completed' 
  AND video_url IS NOT NULL 
  AND thumbnail_url IS NULL
ORDER BY processing_completed_at DESC;

-- 迁移完成，thumbnail_generation_status字段已删除

COMMIT;