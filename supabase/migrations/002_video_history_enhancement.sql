-- ============================================
-- 视频历史记录功能增强
-- Version: 002
-- Description: 增强视频管理功能，添加历史记录、软删除、分享等功能
-- ============================================

-- ============================================
-- 1. 增强 videos 表结构
-- ============================================
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_video_id UUID REFERENCES public.videos(id),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_videos_is_deleted ON public.videos(is_deleted);
CREATE INDEX IF NOT EXISTS idx_videos_is_public ON public.videos(is_public);
CREATE INDEX IF NOT EXISTS idx_videos_share_code ON public.videos(share_code);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_view_count ON public.videos(view_count DESC);

-- ============================================
-- 2. 创建视频操作类型枚举
-- ============================================
DO $$ BEGIN
  CREATE TYPE video_action AS ENUM (
    'created',
    'edited',
    'deleted',
    'restored',
    'shared',
    'downloaded',
    'viewed',
    'liked',
    'commented',
    'regenerated',
    'published',
    'unpublished'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 3. 创建视频历史记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action video_action NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_video_history_video_id ON public.video_history(video_id);
CREATE INDEX IF NOT EXISTS idx_video_history_user_id ON public.video_history(user_id);
CREATE INDEX IF NOT EXISTS idx_video_history_action ON public.video_history(action);
CREATE INDEX IF NOT EXISTS idx_video_history_created_at ON public.video_history(created_at DESC);

-- ============================================
-- 4. 创建视频观看记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id VARCHAR(100),
  watch_duration INTEGER, -- 观看时长（秒）
  total_duration INTEGER, -- 视频总时长（秒）
  completion_rate DECIMAL(5,2), -- 完成率（百分比）
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON public.video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_user_id ON public.video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_created_at ON public.video_views(created_at DESC);

-- ============================================
-- 5. 创建视频分享记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_platform VARCHAR(50), -- link, whatsapp, twitter, facebook, instagram, tiktok, etc
  share_code VARCHAR(20) UNIQUE NOT NULL,
  access_count INTEGER DEFAULT 0,
  max_access_count INTEGER, -- 最大访问次数限制
  password VARCHAR(100), -- 可选的访问密码
  expires_at TIMESTAMPTZ, -- 过期时间
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_video_shares_video_id ON public.video_shares(video_id);
CREATE INDEX IF NOT EXISTS idx_video_shares_user_id ON public.video_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_video_shares_share_code ON public.video_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_video_shares_is_active ON public.video_shares(is_active);

-- ============================================
-- 6. 创建视频版本管理表
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  resolution VARCHAR(20),
  file_size BIGINT,
  parameters JSONB DEFAULT '{}',
  prompt TEXT,
  veo3_job_id TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(video_id, version_number)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_video_versions_video_id ON public.video_versions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_versions_is_current ON public.video_versions(is_current);

-- ============================================
-- 7. 创建视频点赞表
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_video_likes_video_id ON public.video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_user_id ON public.video_likes(user_id);

-- ============================================
-- 8. 创建视频评论表
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.video_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_owner_reply BOOLEAN DEFAULT false,
  like_count INTEGER DEFAULT 0,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT video_comment_content_length CHECK (LENGTH(content) <= 1000)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_video_comments_video_id ON public.video_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_comments_user_id ON public.video_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_video_comments_parent_id ON public.video_comments(parent_comment_id);

-- ============================================
-- 9. 创建视频收藏表
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_name VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_video_favorites_video_id ON public.video_favorites(video_id);
CREATE INDEX IF NOT EXISTS idx_video_favorites_user_id ON public.video_favorites(user_id);

-- ============================================
-- 10. 辅助函数
-- ============================================

-- 生成唯一分享码
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 软删除视频
CREATE OR REPLACE FUNCTION soft_delete_video(
  p_video_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- 检查视频所有者
  SELECT user_id INTO v_owner_id FROM public.videos WHERE id = p_video_id;
  
  IF v_owner_id != p_user_id THEN
    RETURN false;
  END IF;
  
  -- 更新视频状态
  UPDATE public.videos 
  SET 
    is_deleted = true,
    deleted_at = NOW(),
    deleted_by = p_user_id
  WHERE id = p_video_id;
  
  -- 记录历史
  INSERT INTO public.video_history (video_id, user_id, action, details)
  VALUES (p_video_id, p_user_id, 'deleted', '{"soft_delete": true}');
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 恢复已删除视频
CREATE OR REPLACE FUNCTION restore_video(
  p_video_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- 检查视频所有者
  SELECT user_id INTO v_owner_id FROM public.videos WHERE id = p_video_id;
  
  IF v_owner_id != p_user_id THEN
    RETURN false;
  END IF;
  
  -- 恢复视频
  UPDATE public.videos 
  SET 
    is_deleted = false,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = p_video_id;
  
  -- 记录历史
  INSERT INTO public.video_history (video_id, user_id, action, details)
  VALUES (p_video_id, p_user_id, 'restored', '{}');
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 永久删除视频
CREATE OR REPLACE FUNCTION permanently_delete_video(
  p_video_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_owner_id UUID;
  v_is_deleted BOOLEAN;
BEGIN
  -- 检查视频所有者和删除状态
  SELECT user_id, is_deleted INTO v_owner_id, v_is_deleted 
  FROM public.videos WHERE id = p_video_id;
  
  IF v_owner_id != p_user_id OR NOT v_is_deleted THEN
    RETURN false;
  END IF;
  
  -- 删除视频（会级联删除相关记录）
  DELETE FROM public.videos WHERE id = p_video_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 记录视频观看
CREATE OR REPLACE FUNCTION record_video_view(
  p_video_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_session_id VARCHAR(100) DEFAULT NULL,
  p_watch_duration INTEGER DEFAULT 0,
  p_total_duration INTEGER DEFAULT 0,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
  v_completion_rate DECIMAL(5,2);
BEGIN
  -- 计算完成率
  IF p_total_duration > 0 THEN
    v_completion_rate := (p_watch_duration::DECIMAL / p_total_duration::DECIMAL) * 100;
  ELSE
    v_completion_rate := 0;
  END IF;
  
  -- 插入观看记录
  INSERT INTO public.video_views (
    video_id, user_id, session_id, watch_duration, 
    total_duration, completion_rate, ip_address, user_agent
  ) VALUES (
    p_video_id, p_user_id, p_session_id, p_watch_duration,
    p_total_duration, v_completion_rate, p_ip_address, p_user_agent
  ) RETURNING id INTO v_view_id;
  
  -- 更新视频观看次数和最后观看时间
  UPDATE public.videos 
  SET 
    view_count = view_count + 1,
    last_viewed_at = NOW()
  WHERE id = p_video_id;
  
  -- 记录历史（可选，避免过多记录）
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.video_history (video_id, user_id, action, details)
    VALUES (p_video_id, p_user_id, 'viewed', jsonb_build_object(
      'duration', p_watch_duration,
      'completion_rate', v_completion_rate
    ));
  END IF;
  
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql;

-- 创建视频分享链接
CREATE OR REPLACE FUNCTION create_video_share(
  p_video_id UUID,
  p_user_id UUID,
  p_platform VARCHAR(50) DEFAULT 'link',
  p_expires_days INTEGER DEFAULT NULL,
  p_max_access INTEGER DEFAULT NULL,
  p_password VARCHAR(100) DEFAULT NULL
) RETURNS TABLE (
  share_code VARCHAR(20),
  share_url TEXT
) AS $$
DECLARE
  v_share_code VARCHAR(20);
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 生成唯一分享码
  LOOP
    v_share_code := generate_share_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.video_shares WHERE share_code = v_share_code);
  END LOOP;
  
  -- 计算过期时间
  IF p_expires_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_days || ' days')::INTERVAL;
  END IF;
  
  -- 创建分享记录
  INSERT INTO public.video_shares (
    video_id, user_id, share_platform, share_code,
    max_access_count, password, expires_at
  ) VALUES (
    p_video_id, p_user_id, p_platform, v_share_code,
    p_max_access, p_password, v_expires_at
  );
  
  -- 更新视频分享码（主分享码）
  UPDATE public.videos 
  SET share_code = v_share_code 
  WHERE id = p_video_id AND share_code IS NULL;
  
  -- 记录历史
  INSERT INTO public.video_history (video_id, user_id, action, details)
  VALUES (p_video_id, p_user_id, 'shared', jsonb_build_object(
    'platform', p_platform,
    'share_code', v_share_code
  ));
  
  -- 返回分享信息
  RETURN QUERY
  SELECT 
    v_share_code as share_code,
    'https://app.example.com/share/' || v_share_code as share_url;
END;
$$ LANGUAGE plpgsql;

-- 获取视频历史记录
CREATE OR REPLACE FUNCTION get_video_history(
  p_video_id UUID,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  action video_action,
  user_name TEXT,
  user_avatar TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vh.action,
    p.username as user_name,
    p.avatar_url as user_avatar,
    vh.details,
    vh.created_at
  FROM public.video_history vh
  LEFT JOIN public.profiles p ON vh.user_id = p.id
  WHERE vh.video_id = p_video_id
  ORDER BY vh.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 清理过期的分享链接
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS void AS $$
BEGIN
  UPDATE public.video_shares
  SET is_active = false
  WHERE is_active = true
    AND (
      (expires_at IS NOT NULL AND expires_at < NOW())
      OR (max_access_count IS NOT NULL AND access_count >= max_access_count)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. 触发器
-- ============================================

-- 自动记录视频创建历史
CREATE OR REPLACE FUNCTION record_video_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.video_history (video_id, user_id, action, details)
  VALUES (NEW.id, NEW.user_id, 'created', jsonb_build_object(
    'template_id', NEW.template_id,
    'title', NEW.title
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_video_creation
AFTER INSERT ON public.videos
FOR EACH ROW 
WHEN (NEW.is_deleted = false)
EXECUTE FUNCTION record_video_creation();

-- 自动生成分享码
CREATE OR REPLACE FUNCTION auto_generate_share_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_public = true AND NEW.share_code IS NULL THEN
    LOOP
      NEW.share_code := generate_share_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.videos WHERE share_code = NEW.share_code);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_share_code
BEFORE INSERT OR UPDATE OF is_public ON public.videos
FOR EACH ROW
EXECUTE FUNCTION auto_generate_share_code();

-- 更新视频点赞数
CREATE OR REPLACE FUNCTION update_video_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos 
    SET like_count = like_count + 1 
    WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_video_like_count
AFTER INSERT OR DELETE ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION update_video_like_count();

-- 更新视频评论数
CREATE OR REPLACE FUNCTION update_video_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_deleted = true AND OLD.is_deleted = false) THEN
    UPDATE public.videos 
    SET comment_count = GREATEST(0, comment_count - 1) 
    WHERE id = COALESCE(NEW.video_id, OLD.video_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_video_comment_count
AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION update_video_comment_count();

-- 标记视频所有者回复
CREATE OR REPLACE FUNCTION mark_owner_reply()
RETURNS TRIGGER AS $$
DECLARE
  video_owner_id UUID;
BEGIN
  SELECT user_id INTO video_owner_id 
  FROM public.videos 
  WHERE id = NEW.video_id;
  
  IF NEW.user_id = video_owner_id THEN
    NEW.is_owner_reply := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_owner_reply
BEFORE INSERT ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION mark_owner_reply();

-- ============================================
-- 12. RLS 策略
-- ============================================

-- 启用 RLS
ALTER TABLE public.video_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_favorites ENABLE ROW LEVEL SECURITY;

-- 更新 videos 表的 RLS 策略
DROP POLICY IF EXISTS "Users can view own videos" ON public.videos;
DROP POLICY IF EXISTS "Users can create own videos" ON public.videos;
DROP POLICY IF EXISTS "Users can update own videos" ON public.videos;
DROP POLICY IF EXISTS "Users can delete own videos" ON public.videos;

-- 新的 videos 策略
CREATE POLICY "Users can view own and public videos" ON public.videos
  FOR SELECT USING (
    auth.uid() = user_id 
    OR is_public = true 
    OR EXISTS (
      SELECT 1 FROM public.video_shares 
      WHERE video_id = videos.id AND is_active = true
    )
  );

CREATE POLICY "Users can create own videos" ON public.videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos" ON public.videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can soft delete own videos" ON public.videos
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (is_deleted = true);

-- video_history 策略
CREATE POLICY "Users can view own video history" ON public.video_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.videos 
      WHERE id = video_history.video_id 
      AND (user_id = auth.uid() OR is_public = true)
    )
  );

CREATE POLICY "System can insert video history" ON public.video_history
  FOR INSERT WITH CHECK (true);

-- video_views 策略
CREATE POLICY "Anyone can create video views" ON public.video_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view video views for own videos" ON public.video_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.videos 
      WHERE id = video_views.video_id 
      AND user_id = auth.uid()
    )
  );

-- video_shares 策略
CREATE POLICY "Users can view own shares" ON public.video_shares
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create shares for own videos" ON public.video_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.videos 
      WHERE id = video_shares.video_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own shares" ON public.video_shares
  FOR UPDATE USING (user_id = auth.uid());

-- video_versions 策略
CREATE POLICY "Users can view versions of own videos" ON public.video_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.videos 
      WHERE id = video_versions.video_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create versions for own videos" ON public.video_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.videos 
      WHERE id = video_versions.video_id 
      AND user_id = auth.uid()
    )
  );

-- video_likes 策略
CREATE POLICY "Anyone can view video likes" ON public.video_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own video likes" ON public.video_likes
  FOR ALL USING (auth.uid() = user_id);

-- video_comments 策略
CREATE POLICY "Anyone can view non-deleted video comments" ON public.video_comments
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "Users can create video comments" ON public.video_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video comments" ON public.video_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- video_favorites 策略
CREATE POLICY "Users can view own video favorites" ON public.video_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own video favorites" ON public.video_favorites
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 13. 统计视图
-- ============================================

-- 视频统计视图
CREATE OR REPLACE VIEW video_statistics AS
SELECT 
  v.id,
  v.title,
  v.user_id,
  p.username as owner_name,
  p.avatar_url as owner_avatar,
  v.view_count,
  v.like_count,
  v.comment_count,
  v.download_count,
  v.share_count,
  v.is_public,
  v.is_deleted,
  v.created_at,
  v.last_viewed_at,
  COUNT(DISTINCT vv.id) as unique_viewers,
  AVG(vv.completion_rate) as avg_completion_rate
FROM public.videos v
LEFT JOIN public.profiles p ON v.user_id = p.id
LEFT JOIN public.video_views vv ON v.id = vv.video_id
GROUP BY v.id, p.username, p.avatar_url;

-- 用户视频统计视图
CREATE OR REPLACE VIEW user_video_statistics AS
SELECT 
  p.id as user_id,
  p.username,
  COUNT(DISTINCT v.id) as total_videos,
  COUNT(DISTINCT v.id) FILTER (WHERE v.is_deleted = false) as active_videos,
  COUNT(DISTINCT v.id) FILTER (WHERE v.is_public = true) as public_videos,
  COALESCE(SUM(v.view_count), 0) as total_views,
  COALESCE(SUM(v.like_count), 0) as total_likes,
  COALESCE(SUM(v.comment_count), 0) as total_comments,
  COALESCE(SUM(v.download_count), 0) as total_downloads
FROM public.profiles p
LEFT JOIN public.videos v ON p.id = v.user_id
GROUP BY p.id, p.username;

-- ============================================
-- 14. 定期维护任务（可选）
-- ============================================

-- 清理30天前的软删除视频
CREATE OR REPLACE FUNCTION cleanup_old_deleted_videos()
RETURNS void AS $$
BEGIN
  DELETE FROM public.videos
  WHERE is_deleted = true
    AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 清理90天前的视频历史记录
CREATE OR REPLACE FUNCTION cleanup_old_video_history()
RETURNS void AS $$
BEGIN
  DELETE FROM public.video_history
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND action IN ('viewed', 'downloaded');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 迁移完成
-- ============================================