-- 添加 ai_title_status 字段到 videos 表
-- 用于跟踪AI生成标题的状态

ALTER TABLE videos 
ADD COLUMN ai_title_status TEXT DEFAULT 'pending' 
CHECK (ai_title_status IN ('pending', 'ai_generated', 'timeout_default', 'user_provided'));

-- 添加索引以提高查询效率
CREATE INDEX idx_videos_ai_title_status ON videos(ai_title_status) 
WHERE ai_title_status = 'timeout_default';

-- 更新现有记录的状态
-- 将已有的记录标记为用户提供（因为我们无法确定原来的生成方式）
UPDATE videos 
SET ai_title_status = 'user_provided' 
WHERE title IS NOT NULL;

-- 添加注释
COMMENT ON COLUMN videos.ai_title_status IS 'AI生成标题状态: pending(等待生成), ai_generated(AI成功生成), timeout_default(超时使用默认值), user_provided(用户提供)';