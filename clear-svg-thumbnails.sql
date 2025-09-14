-- 清理数据库中的SVG占位符数据
-- 执行时间: 2025-01-14
-- 目的: 移除所有SVG占位符，强制使用纯客户端缓存系统

-- 查看当前SVG占位符数据统计
SELECT 
  COUNT(*) as total_videos,
  COUNT(thumbnail_url) as videos_with_thumbnails,
  COUNT(CASE WHEN thumbnail_url LIKE 'data:image/svg+xml%' THEN 1 END) as svg_placeholders,
  COUNT(CASE WHEN thumbnail_url NOT LIKE 'data:image/svg+xml%' AND thumbnail_url IS NOT NULL THEN 1 END) as real_thumbnails
FROM videos;

-- 备份现有的缩略图数据（可选）
CREATE TABLE IF NOT EXISTS thumbnail_backup AS
SELECT id, thumbnail_url, thumbnail_blur_url, thumbnail_generated_at, thumbnail_generation_status
FROM videos 
WHERE thumbnail_url IS NOT NULL;

-- 清除所有SVG占位符数据
UPDATE videos 
SET 
  thumbnail_url = NULL,
  thumbnail_blur_url = NULL,
  thumbnail_generation_status = 'pending',
  thumbnail_generated_at = NULL,
  thumbnail_metadata = '{}'::jsonb
WHERE thumbnail_url LIKE 'data:image/svg+xml%';

-- 查看清理后的统计
SELECT 
  COUNT(*) as total_videos,
  COUNT(thumbnail_url) as videos_with_thumbnails_after,
  COUNT(CASE WHEN thumbnail_url LIKE 'data:image/svg+xml%' THEN 1 END) as svg_placeholders_remaining,
  COUNT(CASE WHEN thumbnail_url NOT LIKE 'data:image/svg+xml%' AND thumbnail_url IS NOT NULL THEN 1 END) as real_thumbnails_remaining
FROM videos;

-- 显示清理完成的消息
SELECT 'SVG占位符清理完成，系统将使用纯客户端缓存' as cleanup_status;