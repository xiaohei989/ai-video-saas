# Supabase Storage Buckets 设置指南

## 需要创建的Storage Buckets

### 1. avatars bucket（用户头像）

**在Supabase Dashboard中操作：**

1. 进入 **Storage** 页面
2. 点击 **New bucket**
3. 配置如下：
   - **Name**: `avatars`
   - **Public bucket**: ✅ 勾选
   - **File size limit**: 5 MB
   - **Allowed MIME types**: `image/jpeg,image/png,image/gif,image/webp`

4. 创建后，点击 **Policies** 标签
5. 点击 **New Policy** → **For full customization**
6. 创建以下策略：

**允许所有人查看头像：**
```sql
-- Policy name: Public can view avatars
-- Allowed operation: SELECT
-- Target roles: anon, authenticated
-- USING expression:
true
```

**允许用户上传自己的头像：**
```sql
-- Policy name: Users can upload own avatar
-- Allowed operation: INSERT
-- Target roles: authenticated
-- WITH CHECK expression:
auth.uid()::text = (storage.foldername(name))[1]
```

**允许用户更新自己的头像：**
```sql
-- Policy name: Users can update own avatar
-- Allowed operation: UPDATE
-- Target roles: authenticated
-- USING expression:
auth.uid()::text = (storage.foldername(name))[1]
```

**允许用户删除自己的头像：**
```sql
-- Policy name: Users can delete own avatar
-- Allowed operation: DELETE
-- Target roles: authenticated
-- USING expression:
auth.uid()::text = (storage.foldername(name))[1]
```

### 2. videos bucket（视频文件）

1. 创建bucket：
   - **Name**: `videos`
   - **Public bucket**: ✅ 勾选
   - **File size limit**: 100 MB
   - **Allowed MIME types**: `video/mp4,video/webm,video/ogg`

2. 设置策略（类似avatars）

### 3. thumbnails bucket（缩略图）

1. 创建bucket：
   - **Name**: `thumbnails`
   - **Public bucket**: ✅ 勾选
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/jpeg,image/png,image/webp`

2. 设置策略（类似avatars）

### 4. templates bucket（模板资源）

1. 创建bucket：
   - **Name**: `templates`
   - **Public bucket**: ✅ 勾选
   - **File size limit**: 50 MB
   - **Allowed MIME types**: 留空（允许所有类型）

2. 设置策略（类似avatars，但可能需要更宽松的权限）

## 快速设置方法

如果你想快速设置，可以在SQL Editor中运行以下SQL创建bucket策略：

```sql
-- 注意：Buckets本身需要在UI中创建，这里只是策略

-- 为avatars bucket创建策略
INSERT INTO storage.policies (bucket_id, name, definition, check_expression, using_expression)
VALUES 
  ('avatars', 'Public read', 'SELECT', NULL, 'true'),
  ('avatars', 'Auth insert', 'INSERT', 'auth.uid()::text = (storage.foldername(name))[1]', NULL),
  ('avatars', 'Auth update', 'UPDATE', NULL, 'auth.uid()::text = (storage.foldername(name))[1]'),
  ('avatars', 'Auth delete', 'DELETE', NULL, 'auth.uid()::text = (storage.foldername(name))[1]');
```

## 验证设置

创建完成后，可以通过以下方式验证：

1. 在应用中尝试上传头像
2. 检查是否能正常显示
3. 查看Storage使用统计

## 常见问题

1. **"Bucket not found"错误**
   - 确保bucket名称正确
   - 确保bucket已创建

2. **权限错误**
   - 检查RLS策略是否正确配置
   - 确保用户已登录（authenticated）

3. **文件大小限制**
   - 调整bucket的文件大小限制
   - 在前端添加文件大小验证