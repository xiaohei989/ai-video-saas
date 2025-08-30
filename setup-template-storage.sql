-- ============================================
-- 模板文件存储设置
-- 用于存储模板的缩略图和预览视频
-- ============================================

-- 创建templates存储桶（如果不存在）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates',
  'templates', 
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- 设置存储策略
CREATE POLICY "Public template files are accessible by everyone" ON storage.objects
  FOR SELECT USING (bucket_id = 'templates');

CREATE POLICY "Admins can upload template files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'templates' AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update template files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'templates' AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete template files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'templates' AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 创建目录结构示例
-- templates/
-- ├── thumbnails/     (模板缩略图)
-- ├── videos/         (模板预览视频) 
-- └── configs/        (模板JSON配置文件备份)

-- 完成