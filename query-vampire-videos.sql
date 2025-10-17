-- 查询所有吸血鬼相关视频的详细信息
SELECT
  id,
  title,
  status,
  video_url,
  thumbnail_url,
  thumbnail_blur_url,
  thumbnail_generated_at,
  thumbnail_generation_status,
  thumbnail_generation_error,
  thumbnail_generation_attempts,
  thumbnail_generation_last_attempt_at,
  migration_status,
  r2_uploaded_at,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_since_creation
FROM videos
WHERE title LIKE '%吸血鬼%'
ORDER BY created_at DESC
LIMIT 5;
