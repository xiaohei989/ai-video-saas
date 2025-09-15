-- 检查videos表的缩略图相关字段
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name IN ('thumbnail_url', 'thumbnail_source', 'thumbnail_generation_status')
ORDER BY column_name;