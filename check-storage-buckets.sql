-- 检查 Storage buckets 配置
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE name IN ('avatars', 'videos', 'thumbnails', 'templates');

-- 检查 avatars bucket 的 RLS 策略
SELECT 
  id,
  bucket_id,
  name as policy_name,
  definition,
  check_expression,
  using_expression
FROM storage.policies
WHERE bucket_id = 'avatars'
ORDER BY name;

-- 检查是否存在任何文件
SELECT 
  bucket_id,
  name,
  mime_type,
  size,
  created_at
FROM storage.objects
WHERE bucket_id = 'avatars'
LIMIT 5;