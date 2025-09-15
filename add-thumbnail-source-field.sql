-- 添加thumbnail_source字段，用于追踪缩略图来源
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS thumbnail_source TEXT DEFAULT NULL;

-- 添加comment说明
COMMENT ON COLUMN videos.thumbnail_source IS '缩略图来源：server（服务端生成）, client（客户端生成）';

-- 检查添加结果
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name = 'thumbnail_source';