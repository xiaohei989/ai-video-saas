-- ============================================
-- 检查和修复 Storage 设置
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查 avatars bucket 是否存在
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE name = 'avatars';

-- 2. 如果不存在，创建 avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 3. 删除旧的策略（如果存在）
DELETE FROM storage.policies WHERE bucket_id = 'avatars';

-- 4. 创建新的简化策略

-- 允许所有人查看头像
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 允许认证用户上传到自己的文件夹
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户更新自己的头像
CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户删除自己的头像
CREATE POLICY "Users can delete own avatars" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. 验证策略
SELECT * FROM storage.policies WHERE bucket_id = 'avatars';

-- 6. 测试查询（替换 YOUR_USER_ID 为实际用户ID）
-- SELECT * FROM storage.objects 
-- WHERE bucket_id = 'avatars' 
-- AND name LIKE 'YOUR_USER_ID/%';