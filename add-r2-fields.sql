-- 为videos表添加Cloudflare R2存储相关字段
-- 执行前请备份数据库

-- 添加R2存储相关字段
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS r2_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS r2_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS migration_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS original_video_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS r2_uploaded_at TIMESTAMP DEFAULT NULL;

-- 添加字段注释
COMMENT ON COLUMN videos.r2_url IS 'Cloudflare R2存储的视频URL';
COMMENT ON COLUMN videos.r2_key IS 'R2存储中的文件key';
COMMENT ON COLUMN videos.migration_status IS '迁移状态: pending, downloading, uploading, completed, failed';
COMMENT ON COLUMN videos.original_video_url IS '备份原始视频URL';
COMMENT ON COLUMN videos.r2_uploaded_at IS 'R2上传完成时间';

-- 创建迁移状态的检查约束
ALTER TABLE videos 
ADD CONSTRAINT check_migration_status 
CHECK (migration_status IN ('pending', 'downloading', 'uploading', 'completed', 'failed'));

-- 创建索引提高查询性能
CREATE INDEX IF NOT EXISTS idx_videos_migration_status ON videos(migration_status);
CREATE INDEX IF NOT EXISTS idx_videos_r2_key ON videos(r2_key) WHERE r2_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_r2_uploaded_at ON videos(r2_uploaded_at) WHERE r2_uploaded_at IS NOT NULL;

-- 备份现有视频URL到original_video_url字段
UPDATE videos 
SET original_video_url = video_url 
WHERE original_video_url IS NULL 
  AND video_url IS NOT NULL 
  AND video_url != '';

-- 查看添加结果
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    col_description(pgc.oid, a.attnum) as comment
FROM information_schema.columns a
JOIN pg_class pgc ON pgc.relname = a.table_name
WHERE table_name = 'videos' 
  AND column_name IN ('r2_url', 'r2_key', 'migration_status', 'original_video_url', 'r2_uploaded_at')
ORDER BY ordinal_position;