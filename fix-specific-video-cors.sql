-- 修复特定视频的CORS问题，添加时间戳版本参数
-- 针对视频ID: e4fd0cc9-2f91-4dae-b806-199685c2bc10

BEGIN;

-- 查看当前状态
SELECT 
  '=== 修复前状态 ===' as info,
  id, 
  video_url, 
  r2_url,
  migration_status,
  title,
  created_at,
  updated_at
FROM videos 
WHERE id = 'e4fd0cc9-2f91-4dae-b806-199685c2bc10';

-- 更新URL，添加时间戳参数来绕过缓存
UPDATE videos 
SET 
  video_url = CASE 
    WHEN video_url IS NOT NULL AND video_url NOT LIKE '%?v=%' 
    THEN video_url || '?v=' || EXTRACT(EPOCH FROM NOW())::bigint::text 
    ELSE video_url 
  END,
  r2_url = CASE 
    WHEN r2_url IS NOT NULL AND r2_url NOT LIKE '%?v=%' 
    THEN r2_url || '?v=' || EXTRACT(EPOCH FROM NOW())::bigint::text 
    ELSE r2_url 
  END,
  updated_at = NOW()
WHERE id = 'e4fd0cc9-2f91-4dae-b806-199685c2bc10';

-- 验证更新结果
SELECT 
  '=== 修复后状态 ===' as info,
  id, 
  video_url, 
  r2_url,
  migration_status,
  title,
  updated_at
FROM videos 
WHERE id = 'e4fd0cc9-2f91-4dae-b806-199685c2bc10';

-- 检查更新是否成功
SELECT 
  '=== 更新统计 ===' as info,
  COUNT(*) as updated_count
FROM videos 
WHERE id = 'e4fd0cc9-2f91-4dae-b806-199685c2bc10'
  AND (video_url LIKE '%?v=%' OR r2_url LIKE '%?v=%');

COMMIT;