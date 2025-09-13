-- 添加视频缩略图相关字段
-- 执行时间: 2025-01-23

-- 为 videos 表添加缩略图相关字段
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_blur_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS thumbnail_generation_status TEXT DEFAULT 'pending' CHECK (thumbnail_generation_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS thumbnail_metadata JSONB DEFAULT '{}';

-- 为缩略图字段添加注释
COMMENT ON COLUMN videos.thumbnail_url IS '视频缩略图URL（正常版本）';
COMMENT ON COLUMN videos.thumbnail_blur_url IS '视频缩略图URL（模糊版本，用于懒加载占位）';
COMMENT ON COLUMN videos.thumbnail_generated_at IS '缩略图生成完成时间';
COMMENT ON COLUMN videos.thumbnail_generation_status IS '缩略图生成状态';
COMMENT ON COLUMN videos.thumbnail_metadata IS '缩略图元数据（尺寸、质量、生成方式等）';

-- 为缩略图状态创建索引，便于查询需要重新生成的视频
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_status 
ON videos(thumbnail_generation_status) 
WHERE thumbnail_generation_status IN ('pending', 'failed');

-- 为已完成视频但缺少缩略图的记录创建索引
CREATE INDEX IF NOT EXISTS idx_videos_missing_thumbnails 
ON videos(status, thumbnail_url) 
WHERE status = 'completed' AND thumbnail_url IS NULL;

-- 为缩略图生成时间创建索引，便于监控和统计
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_generated_at 
ON videos(thumbnail_generated_at) 
WHERE thumbnail_generated_at IS NOT NULL;

-- 创建函数：自动更新缩略图生成时间
CREATE OR REPLACE FUNCTION update_thumbnail_generated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- 当缩略图状态变为 completed 时，自动设置生成时间
  IF NEW.thumbnail_generation_status = 'completed' AND OLD.thumbnail_generation_status != 'completed' THEN
    NEW.thumbnail_generated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_thumbnail_generated_at ON videos;
CREATE TRIGGER trigger_update_thumbnail_generated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_thumbnail_generated_at();

-- 为现有已完成的视频设置默认的缩略图生成状态
UPDATE videos 
SET thumbnail_generation_status = 'pending'
WHERE status = 'completed' 
  AND thumbnail_url IS NULL 
  AND thumbnail_generation_status = 'pending';

-- 为已有缩略图的视频设置状态为完成
UPDATE videos 
SET thumbnail_generation_status = 'completed',
    thumbnail_generated_at = COALESCE(processing_completed_at, updated_at)
WHERE thumbnail_url IS NOT NULL 
  AND thumbnail_generation_status = 'pending';

-- 创建用于批量查询需要生成缩略图的视频的视图
CREATE OR REPLACE VIEW videos_pending_thumbnails AS
SELECT 
  id,
  video_url,
  status,
  thumbnail_generation_status,
  created_at,
  processing_completed_at
FROM videos 
WHERE status = 'completed' 
  AND video_url IS NOT NULL 
  AND (thumbnail_url IS NULL OR thumbnail_generation_status IN ('pending', 'failed'))
ORDER BY processing_completed_at DESC;

-- 添加 RLS 策略确保缩略图相关字段的安全性
-- 用户只能查看自己的视频缩略图信息
-- 系统可以更新缩略图状态和URL