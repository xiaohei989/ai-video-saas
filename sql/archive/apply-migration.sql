-- ============================================
-- 应用迁移脚本
-- 请在 Supabase Dashboard 的 SQL Editor 中执行此脚本
-- ============================================

-- 添加 share_count 列到 videos 表
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

-- 添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_videos_share_count ON public.videos(share_count DESC);

-- 更新现有记录的 share_count 为 0（如果有记录的话）
UPDATE public.videos 
SET share_count = 0 
WHERE share_count IS NULL;

-- 验证列是否已添加
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'videos'
  AND column_name = 'share_count';

-- 显示 videos 表的所有列
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'videos'
ORDER BY ordinal_position;