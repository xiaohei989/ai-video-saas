-- ============================================
-- 修复视频删除RLS策略
-- Version: 005
-- Description: 恢复被误删除的DELETE策略，允许用户硬删除自己的视频
-- ============================================

-- 添加视频删除策略（在002迁移中被删除但未重新创建）
CREATE POLICY "Users can delete own videos" ON public.videos
  FOR DELETE USING (auth.uid() = user_id);

-- 验证策略创建
COMMENT ON POLICY "Users can delete own videos" ON public.videos IS '允许用户删除自己的视频记录';

-- 注意：移除了对不存在的api_usage表的引用
-- 如果需要记录操作日志，请确保api_usage表存在

-- ============================================
-- 完成迁移
-- ============================================