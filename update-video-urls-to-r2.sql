-- 批量更新已迁移完成的视频URL为R2 URL
-- 这将确保所有完成迁移的视频使用R2链接而不是第三方链接

BEGIN;

-- 首先检查当前状态
SELECT 
  'Before Update' as phase,
  migration_status,
  COUNT(*) as count,
  CASE 
    WHEN video_url LIKE '%cdn.veo3video.me%' THEN 'R2'
    WHEN video_url LIKE '%r2.dev%' THEN 'R2_OLD'
    WHEN video_url LIKE '%heyoo.oss%' THEN 'Heyoo'
    WHEN video_url LIKE '%filesystem.site%' THEN 'Filesystem'
    ELSE 'Other'
  END as url_type
FROM videos 
WHERE status = 'completed'
GROUP BY migration_status, 
  CASE 
    WHEN video_url LIKE '%cdn.veo3video.me%' THEN 'R2'
    WHEN video_url LIKE '%r2.dev%' THEN 'R2_OLD'
    WHEN video_url LIKE '%heyoo.oss%' THEN 'Heyoo'
    WHEN video_url LIKE '%filesystem.site%' THEN 'Filesystem'
    ELSE 'Other'
  END
ORDER BY migration_status, count DESC;

-- 更新所有迁移完成的视频，将video_url设置为r2_url
UPDATE videos 
SET video_url = r2_url,
    updated_at = NOW()
WHERE status = 'completed' 
  AND migration_status = 'completed' 
  AND r2_url IS NOT NULL 
  AND video_url != r2_url;

-- 显示更新结果
SELECT 
  'After Update' as phase,
  migration_status,
  COUNT(*) as count,
  CASE 
    WHEN video_url LIKE '%cdn.veo3video.me%' THEN 'R2'
    WHEN video_url LIKE '%r2.dev%' THEN 'R2_OLD'
    WHEN video_url LIKE '%heyoo.oss%' THEN 'Heyoo'
    WHEN video_url LIKE '%filesystem.site%' THEN 'Filesystem'
    ELSE 'Other'
  END as url_type
FROM videos 
WHERE status = 'completed'
GROUP BY migration_status, 
  CASE 
    WHEN video_url LIKE '%cdn.veo3video.me%' THEN 'R2'
    WHEN video_url LIKE '%r2.dev%' THEN 'R2_OLD'
    WHEN video_url LIKE '%heyoo.oss%' THEN 'Heyoo'
    WHEN video_url LIKE '%filesystem.site%' THEN 'Filesystem'
    ELSE 'Other'
  END
ORDER BY migration_status, count DESC;

-- 检查几个更新后的样本
SELECT 
  'Sample Updated Records' as info,
  id,
  LEFT(video_url, 50) as video_url_preview,
  LEFT(r2_url, 50) as r2_url_preview,
  migration_status
FROM videos 
WHERE status = 'completed' 
  AND migration_status = 'completed' 
  AND video_url LIKE '%cdn.veo3video.me%'
LIMIT 5;

COMMIT;