-- ============================================
-- 添加缺失的 share_count 列
-- Version: 003
-- Description: 为 videos 表添加 share_count 列以支持分享统计
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

-- ============================================
-- 完成
-- ============================================