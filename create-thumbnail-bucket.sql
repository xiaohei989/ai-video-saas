-- 创建video-thumbnails存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-thumbnails',
  'video-thumbnails', 
  true,  -- 公开访问
  5242880, -- 5MB文件大小限制
  array['image/jpeg', 'image/jpg', 'image/png']
);

-- 设置存储桶策略，允许任何人读取
CREATE POLICY "Anyone can view video thumbnails" ON storage.objects
FOR SELECT USING (bucket_id = 'video-thumbnails');

-- 允许service role上传文件
CREATE POLICY "Service role can upload thumbnails" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'video-thumbnails');

-- 允许service role更新文件
CREATE POLICY "Service role can update thumbnails" ON storage.objects
FOR UPDATE USING (bucket_id = 'video-thumbnails');

-- 允许service role删除文件  
CREATE POLICY "Service role can delete thumbnails" ON storage.objects
FOR DELETE USING (bucket_id = 'video-thumbnails');