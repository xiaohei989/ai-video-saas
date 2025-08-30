-- ============================================
-- 视频队列系统 - 添加队列管理字段
-- Version: 004
-- Description: 为videos表添加队列相关字段，支持并发控制和任务调度
-- ============================================

-- 添加队列相关字段到videos表
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS queue_position INTEGER;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS queue_started_at TIMESTAMPTZ;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS queue_priority INTEGER DEFAULT 0;

-- 添加索引以优化队列查询性能
CREATE INDEX IF NOT EXISTS idx_videos_queue_status ON public.videos(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_videos_queue_position ON public.videos(queue_position) WHERE queue_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_user_status ON public.videos(user_id, status) WHERE status = 'processing';

-- 添加队列位置的约束（确保队列位置唯一且大于0）
ALTER TABLE public.videos ADD CONSTRAINT queue_position_positive CHECK (queue_position IS NULL OR queue_position > 0);

-- 创建函数：获取用户当前处理中的视频数量
CREATE OR REPLACE FUNCTION get_user_active_video_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM public.videos 
    WHERE user_id = p_user_id 
    AND status = 'processing' 
    AND is_deleted = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：获取队列中的下一个位置
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(queue_position) + 1 FROM public.videos WHERE queue_position IS NOT NULL),
    1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：更新队列位置（当有任务开始处理时重新排序）
CREATE OR REPLACE FUNCTION update_queue_positions()
RETURNS void AS $$
DECLARE
  video_record RECORD;
  new_position INTEGER := 1;
BEGIN
  -- 按优先级和时间重新排序队列
  FOR video_record IN 
    SELECT id 
    FROM public.videos 
    WHERE status = 'pending' 
    AND queue_position IS NOT NULL 
    AND is_deleted = false
    ORDER BY 
      COALESCE(queue_priority, 0) DESC, 
      queue_entered_at ASC
  LOOP
    UPDATE public.videos 
    SET queue_position = new_position 
    WHERE id = video_record.id;
    
    new_position := new_position + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：当视频状态从pending改变时，清理队列字段
CREATE OR REPLACE FUNCTION cleanup_queue_fields_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果状态从pending变为其他状态，清理队列字段
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.queue_position := NULL;
    NEW.queue_started_at := CASE 
      WHEN NEW.status = 'processing' THEN NOW() 
      ELSE NEW.queue_started_at 
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用触发器
DROP TRIGGER IF EXISTS trigger_cleanup_queue_fields ON public.videos;
CREATE TRIGGER trigger_cleanup_queue_fields
  BEFORE UPDATE OF status ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_queue_fields_on_status_change();

-- 创建视图：队列状态概览
CREATE OR REPLACE VIEW queue_status_overview AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'processing') as active_jobs,
  COUNT(*) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as queued_jobs,
  AVG(queue_priority) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as avg_priority,
  MIN(queue_entered_at) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as oldest_queued,
  MAX(queue_entered_at) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as newest_queued
FROM public.videos 
WHERE is_deleted = false;

-- 创建视图：用户队列状态
CREATE OR REPLACE VIEW user_queue_status AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE status = 'processing') as active_count,
  COUNT(*) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as queued_count,
  MIN(queue_position) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as next_position,
  MIN(queue_entered_at) FILTER (WHERE status = 'pending' AND queue_position IS NOT NULL) as oldest_queued
FROM public.videos 
WHERE is_deleted = false
GROUP BY user_id
HAVING COUNT(*) FILTER (WHERE status IN ('processing', 'pending')) > 0;

-- 为队列管理创建RLS策略
CREATE POLICY "Users can view own queue status" ON public.videos
  FOR SELECT USING (
    auth.uid() = user_id AND 
    (queue_position IS NOT NULL OR status IN ('processing', 'pending'))
  );

-- 插入一些示例配置数据（可选）
INSERT INTO public.api_usage (account_email, endpoint, status_code, metadata) 
VALUES ('system', 'queue_system_initialized', 200, '{"version": "004", "timestamp": "' || NOW() || '"}')
ON CONFLICT DO NOTHING;

-- 添加注释说明
COMMENT ON COLUMN public.videos.queue_position IS '队列中的位置，NULL表示不在队列中';
COMMENT ON COLUMN public.videos.queue_entered_at IS '进入队列的时间';
COMMENT ON COLUMN public.videos.queue_started_at IS '开始处理的时间（从队列移动到处理状态时）';
COMMENT ON COLUMN public.videos.queue_priority IS '队列优先级，数值越高优先级越高';

COMMENT ON FUNCTION get_user_active_video_count(UUID) IS '获取用户当前正在处理的视频数量';
COMMENT ON FUNCTION get_next_queue_position() IS '获取队列中的下一个可用位置';
COMMENT ON FUNCTION update_queue_positions() IS '重新计算并更新所有队列位置';

COMMENT ON VIEW queue_status_overview IS '队列系统整体状态概览';
COMMENT ON VIEW user_queue_status IS '每个用户的队列状态统计';

-- ============================================
-- 完成迁移
-- ============================================