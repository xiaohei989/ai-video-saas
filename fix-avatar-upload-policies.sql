-- 修复头像上传权限问题
-- 删除现有的不完整策略
DROP POLICY IF EXISTS "Public can view all avatar 1oj01fe_0" ON storage.objects;

-- 创建完整的Storage RLS策略
-- 1. 允许所有人查看头像（公开读取）
CREATE POLICY "avatar_public_read" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 2. 允许认证用户上传自己的头像
CREATE POLICY "avatar_auth_insert" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. 允许认证用户更新自己的头像
CREATE POLICY "avatar_auth_update" ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. 允许认证用户删除自己的头像
CREATE POLICY "avatar_auth_delete" ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 验证策略创建结果
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE 'avatar%'
ORDER BY policyname;