-- 检查 Storage RLS 策略
SELECT 
  schemaname,
  tablename,
  policyname as policy_name,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%avatar%'
ORDER BY policyname;

-- 检查当前用户权限
SELECT 
  bucket_id,
  name,
  metadata,
  created_at
FROM storage.objects
WHERE bucket_id = 'avatars'
LIMIT 5;

-- 测试上传权限 - 检查当前用户是否可以访问avatars bucket
SELECT 
  auth.uid() as current_user_id,
  'avatars'::text as bucket_name;