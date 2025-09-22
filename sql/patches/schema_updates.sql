-- ==========================================
-- 数据库架构更新补丁集合
-- 包含字段添加、约束添加等架构变更
-- ==========================================

-- 1. 添加AI标题状态字段
-- 来源: add-ai-title-status-field.sql
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS ai_title_status VARCHAR(20) DEFAULT 'pending' 
CHECK (ai_title_status IN ('pending', 'generating', 'completed', 'failed'));

-- 2. 添加默认积分设置
-- 来源: add-default-credits-setting.sql
INSERT INTO public.system_settings (key, value, description) 
VALUES ('default_user_credits', '10', '新用户默认积分数量')
ON CONFLICT (key) DO UPDATE SET 
value = EXCLUDED.value,
description = EXCLUDED.description;

-- 3. 添加R2存储相关字段
-- 来源: add-r2-fields.sql
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS r2_url TEXT,
ADD COLUMN IF NOT EXISTS r2_uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS migration_status VARCHAR(20) DEFAULT 'pending' 
CHECK (migration_status IN ('pending', 'processing', 'completed', 'failed'));

-- 4. 添加订阅约束
-- 来源: add-subscription-constraints.sql
ALTER TABLE public.subscriptions 
ADD CONSTRAINT IF NOT EXISTS unique_active_subscription_per_user 
UNIQUE (user_id, status) DEFERRABLE INITIALLY DEFERRED;

-- 5. 添加缩略图来源字段
-- 来源: add-thumbnail-source-field.sql
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS thumbnail_source VARCHAR(10) DEFAULT 'auto' 
CHECK (thumbnail_source IN ('auto', 'manual', 'ai'));

-- 更新索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_videos_ai_title_status ON public.videos(ai_title_status);
CREATE INDEX IF NOT EXISTS idx_videos_migration_status ON public.videos(migration_status);
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_source ON public.videos(thumbnail_source);

COMMENT ON COLUMN public.videos.ai_title_status IS 'AI标题生成状态';
COMMENT ON COLUMN public.videos.r2_url IS 'R2存储的视频URL';
COMMENT ON COLUMN public.videos.r2_uploaded_at IS 'R2上传完成时间';
COMMENT ON COLUMN public.videos.migration_status IS '迁移到R2的状态';
COMMENT ON COLUMN public.videos.thumbnail_source IS '缩略图来源：auto自动生成、manual手动上传、ai AI生成';