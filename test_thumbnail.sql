-- 获取最新完成的视频
SELECT id, title, video_url,
       CASE
         WHEN thumbnail_url IS NULL THEN 'NULL'
         WHEN thumbnail_url LIKE 'data:image/svg%' THEN 'SVG_PLACEHOLDER'
         ELSE LEFT(thumbnail_url, 50) || '...'
       END as thumbnail_status,
       status, created_at
FROM videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
