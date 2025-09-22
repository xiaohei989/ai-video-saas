-- ==========================================
-- 存储和模板相关配置
-- 包含Supabase存储桶和模板表设置
-- ==========================================

-- 1. 创建缩略图存储桶
-- 来源: create-thumbnail-bucket.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 创建缩略图存储桶的策略
CREATE POLICY IF NOT EXISTS "Allow public access to thumbnails" ON storage.objects
FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY IF NOT EXISTS "Allow authenticated upload to thumbnails" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'thumbnails' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY IF NOT EXISTS "Allow users to delete own thumbnails" ON storage.objects
FOR DELETE USING (
  bucket_id = 'thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. 设置模板存储
-- 来源: setup-template-storage.sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates',
  'templates',
  true,
  104857600, -- 100MB
  ARRAY['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 创建模板存储桶的策略
CREATE POLICY IF NOT EXISTS "Allow public access to templates" ON storage.objects
FOR SELECT USING (bucket_id = 'templates');

CREATE POLICY IF NOT EXISTS "Allow admin upload to templates" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'templates' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- 3. 创建模板表
-- 来源: create-templates-table.sql
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  credits_required INTEGER NOT NULL DEFAULT 5,
  thumbnail_url TEXT,
  preview_video_url TEXT,
  prompt_template TEXT NOT NULL,
  parameters JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}'::text[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  
  -- 约束
  CONSTRAINT templates_credits_positive CHECK (credits_required > 0),
  CONSTRAINT templates_rating_range CHECK (rating >= 0 AND rating <= 5)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_active ON public.templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_credits ON public.templates(credits_required);
CREATE INDEX IF NOT EXISTS idx_templates_rating ON public.templates(rating);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON public.templates(usage_count);

-- 4. 创建模板更新触发器
CREATE OR REPLACE FUNCTION update_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION update_template_updated_at();

-- 5. 模板管理函数
CREATE OR REPLACE FUNCTION get_popular_templates(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  credits_required INTEGER,
  thumbnail_url TEXT,
  usage_count INTEGER,
  rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.category,
    t.credits_required,
    t.thumbnail_url,
    t.usage_count,
    t.rating
  FROM public.templates t
  WHERE t.is_active = true
  ORDER BY t.usage_count DESC, t.rating DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 设置RLS策略
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are viewable by everyone" ON public.templates
FOR SELECT USING (is_active = true);

CREATE POLICY "Templates are manageable by admins" ON public.templates
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- 7. 授权
GRANT SELECT ON public.templates TO authenticated;
GRANT SELECT ON public.templates TO anon;
GRANT ALL ON public.templates TO service_role;