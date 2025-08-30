-- ============================================
-- 社交功能数据库架构升级
-- Version: 003
-- Description: 添加社交功能支持（点赞、评论、关注、通知等）
-- ============================================

-- ============================================
-- 1. 扩展 profiles 表
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS template_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- 添加约束
ALTER TABLE public.profiles
ADD CONSTRAINT bio_length_check CHECK (LENGTH(bio) <= 500),
ADD CONSTRAINT website_format_check CHECK (website IS NULL OR website ~ '^https?://.*');

-- ============================================
-- 2. 扩展 templates 表
-- ============================================
ALTER TABLE public.templates 
ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS favorite_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.templates(id),
ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- ============================================
-- 3. 创建模板点赞表
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- ============================================
-- 4. 创建模板收藏表（替代原有的 user_favorites）
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- 如果存在旧表，迁移数据
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_favorites') THEN
    INSERT INTO public.template_favorites (id, user_id, template_id, created_at)
    SELECT id, user_id, template_id, created_at FROM public.user_favorites
    ON CONFLICT (user_id, template_id) DO NOTHING;
    
    DROP TABLE IF EXISTS public.user_favorites;
  END IF;
END $$;

-- ============================================
-- 5. 创建评论表
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.template_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_author_reply BOOLEAN DEFAULT false,
  like_count INTEGER DEFAULT 0,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT content_length_check CHECK (LENGTH(content) <= 1000)
);

-- ============================================
-- 6. 创建评论点赞表
-- ============================================
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.template_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

-- ============================================
-- 7. 创建用户关注表
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- ============================================
-- 8. 创建通知表
-- ============================================
CREATE TYPE notification_type AS ENUM (
  'like', 
  'comment', 
  'follow', 
  'reply', 
  'mention',
  'template_featured',
  'system'
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  related_id UUID, -- 相关内容ID（模板、评论、用户等）
  related_type VARCHAR(50), -- 相关内容类型
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. 创建模板浏览记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. 创建索引优化查询性能
-- ============================================

-- profiles 表索引
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON public.profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_follower_count ON public.profiles(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_template_count ON public.profiles(template_count DESC);

-- templates 表索引
CREATE INDEX IF NOT EXISTS idx_templates_author_id ON public.templates(author_id);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON public.templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_is_featured ON public.templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_templates_like_count ON public.templates(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_view_count ON public.templates(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_published_at ON public.templates(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON public.templates USING GIN(tags);

-- 社交表索引
CREATE INDEX IF NOT EXISTS idx_template_likes_user_id ON public.template_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_template_likes_template_id ON public.template_likes(template_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_user_id ON public.template_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_template_id ON public.template_favorites(template_id);
CREATE INDEX IF NOT EXISTS idx_template_comments_template_id ON public.template_comments(template_id);
CREATE INDEX IF NOT EXISTS idx_template_comments_user_id ON public.template_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_template_comments_parent_id ON public.template_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_views_template_id ON public.template_views(template_id);

-- ============================================
-- 11. 创建触发器函数
-- ============================================

-- 更新点赞数触发器
CREATE OR REPLACE FUNCTION update_template_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.templates 
    SET like_count = like_count + 1 
    WHERE id = NEW.template_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.templates 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.template_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_like_count
AFTER INSERT OR DELETE ON public.template_likes
FOR EACH ROW EXECUTE FUNCTION update_template_like_count();

-- 更新收藏数触发器
CREATE OR REPLACE FUNCTION update_template_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.templates 
    SET favorite_count = favorite_count + 1 
    WHERE id = NEW.template_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.templates 
    SET favorite_count = GREATEST(0, favorite_count - 1) 
    WHERE id = OLD.template_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_favorite_count
AFTER INSERT OR DELETE ON public.template_favorites
FOR EACH ROW EXECUTE FUNCTION update_template_favorite_count();

-- 更新评论数触发器
CREATE OR REPLACE FUNCTION update_template_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.templates 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.template_id;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_deleted = true AND OLD.is_deleted = false) THEN
    UPDATE public.templates 
    SET comment_count = GREATEST(0, comment_count - 1) 
    WHERE id = COALESCE(NEW.template_id, OLD.template_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_comment_count
AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON public.template_comments
FOR EACH ROW EXECUTE FUNCTION update_template_comment_count();

-- 更新评论点赞数触发器
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.template_comments 
    SET like_count = like_count + 1 
    WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.template_comments 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_like_count
AFTER INSERT OR DELETE ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();

-- 更新关注数触发器
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles 
    SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
    
    UPDATE public.profiles 
    SET follower_count = follower_count + 1 
    WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles 
    SET following_count = GREATEST(0, following_count - 1) 
    WHERE id = OLD.follower_id;
    
    UPDATE public.profiles 
    SET follower_count = GREATEST(0, follower_count - 1) 
    WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_counts
AFTER INSERT OR DELETE ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- 更新用户模板数触发器
CREATE OR REPLACE FUNCTION update_user_template_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles 
    SET template_count = template_count + 1 
    WHERE id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles 
    SET template_count = GREATEST(0, template_count - 1) 
    WHERE id = OLD.author_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.author_id != OLD.author_id THEN
    UPDATE public.profiles 
    SET template_count = GREATEST(0, template_count - 1) 
    WHERE id = OLD.author_id;
    
    UPDATE public.profiles 
    SET template_count = template_count + 1 
    WHERE id = NEW.author_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_template_count
AFTER INSERT OR DELETE OR UPDATE OF author_id ON public.templates
FOR EACH ROW 
WHEN (NEW.is_public = true OR OLD.is_public = true)
EXECUTE FUNCTION update_user_template_count();

-- 自动标记作者回复
CREATE OR REPLACE FUNCTION mark_author_reply()
RETURNS TRIGGER AS $$
DECLARE
  template_author_id UUID;
BEGIN
  -- 获取模板作者ID
  SELECT author_id INTO template_author_id 
  FROM public.templates 
  WHERE id = NEW.template_id;
  
  -- 如果评论者是模板作者，标记为作者回复
  IF NEW.user_id = template_author_id THEN
    NEW.is_author_reply := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_author_reply
BEFORE INSERT ON public.template_comments
FOR EACH ROW EXECUTE FUNCTION mark_author_reply();

-- ============================================
-- 12. RLS (Row Level Security) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE public.template_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_views ENABLE ROW LEVEL SECURITY;

-- template_likes 策略
CREATE POLICY "Public can view template likes" ON public.template_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own likes" ON public.template_likes
  FOR ALL USING (auth.uid() = user_id);

-- template_favorites 策略
CREATE POLICY "Users can view own favorites" ON public.template_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON public.template_favorites
  FOR ALL USING (auth.uid() = user_id);

-- template_comments 策略
CREATE POLICY "Public can view non-deleted comments" ON public.template_comments
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "Users can create comments" ON public.template_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.template_comments
  FOR UPDATE USING (auth.uid() = user_id AND is_deleted = false);

CREATE POLICY "Users can soft delete own comments" ON public.template_comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (is_deleted = true);

-- comment_likes 策略
CREATE POLICY "Public can view comment likes" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own comment likes" ON public.comment_likes
  FOR ALL USING (auth.uid() = user_id);

-- user_follows 策略
CREATE POLICY "Public can view follows" ON public.user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own follows" ON public.user_follows
  FOR ALL USING (auth.uid() = follower_id);

-- notifications 策略
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- template_views 策略
CREATE POLICY "Anyone can create views" ON public.template_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view template views" ON public.template_views
  FOR SELECT USING (true);

-- ============================================
-- 13. 辅助函数
-- ============================================

-- 获取用户是否点赞了某个模板
CREATE OR REPLACE FUNCTION has_user_liked_template(
  p_user_id UUID,
  p_template_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.template_likes
    WHERE user_id = p_user_id AND template_id = p_template_id
  );
END;
$$ LANGUAGE plpgsql;

-- 获取用户是否收藏了某个模板
CREATE OR REPLACE FUNCTION has_user_favorited_template(
  p_user_id UUID,
  p_template_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.template_favorites
    WHERE user_id = p_user_id AND template_id = p_template_id
  );
END;
$$ LANGUAGE plpgsql;

-- 获取用户是否关注了某个用户
CREATE OR REPLACE FUNCTION is_user_following(
  p_follower_id UUID,
  p_following_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_follows
    WHERE follower_id = p_follower_id AND following_id = p_following_id
  );
END;
$$ LANGUAGE plpgsql;

-- 创建通知
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_content TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type VARCHAR(50) DEFAULT NULL,
  p_sender_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, type, title, content, related_id, related_type, sender_id
  ) VALUES (
    p_user_id, p_type, p_title, p_content, p_related_id, p_related_type, p_sender_id
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- 自动创建点赞通知
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  template_author_id UUID;
  liker_name TEXT;
  template_name TEXT;
BEGIN
  -- 获取模板作者和模板信息
  SELECT t.author_id, t.name, p.username 
  INTO template_author_id, template_name, liker_name
  FROM public.templates t
  LEFT JOIN public.profiles p ON p.id = NEW.user_id
  WHERE t.id = NEW.template_id;
  
  -- 如果点赞者不是作者本人，创建通知
  IF template_author_id IS NOT NULL AND template_author_id != NEW.user_id THEN
    PERFORM create_notification(
      template_author_id,
      'like'::notification_type,
      liker_name || ' liked your template',
      'Your template "' || template_name || '" received a new like',
      NEW.template_id,
      'template',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_like_notification
AFTER INSERT ON public.template_likes
FOR EACH ROW EXECUTE FUNCTION create_like_notification();

-- 自动创建评论通知
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  template_author_id UUID;
  parent_comment_author_id UUID;
  commenter_name TEXT;
  template_name TEXT;
BEGIN
  -- 获取评论者名称
  SELECT username INTO commenter_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- 获取模板作者和模板信息
  SELECT t.author_id, t.name 
  INTO template_author_id, template_name
  FROM public.templates t
  WHERE t.id = NEW.template_id;
  
  -- 如果是回复，通知被回复的用户
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO parent_comment_author_id
    FROM public.template_comments
    WHERE id = NEW.parent_comment_id;
    
    IF parent_comment_author_id != NEW.user_id THEN
      PERFORM create_notification(
        parent_comment_author_id,
        'reply'::notification_type,
        commenter_name || ' replied to your comment',
        LEFT(NEW.content, 100),
        NEW.id,
        'comment',
        NEW.user_id
      );
    END IF;
  END IF;
  
  -- 通知模板作者（如果不是自己评论自己的模板）
  IF template_author_id IS NOT NULL AND template_author_id != NEW.user_id THEN
    PERFORM create_notification(
      template_author_id,
      'comment'::notification_type,
      commenter_name || ' commented on your template',
      'New comment on "' || template_name || '": ' || LEFT(NEW.content, 100),
      NEW.id,
      'comment',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_comment_notification
AFTER INSERT ON public.template_comments
FOR EACH ROW 
WHEN (NEW.is_deleted = false)
EXECUTE FUNCTION create_comment_notification();

-- 自动创建关注通知
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
DECLARE
  follower_name TEXT;
BEGIN
  -- 获取关注者名称
  SELECT username INTO follower_name
  FROM public.profiles
  WHERE id = NEW.follower_id;
  
  -- 创建通知
  PERFORM create_notification(
    NEW.following_id,
    'follow'::notification_type,
    follower_name || ' started following you',
    NULL,
    NEW.follower_id,
    'user',
    NEW.follower_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_follow_notification
AFTER INSERT ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION create_follow_notification();

-- ============================================
-- 14. 数据统计视图
-- ============================================

-- 热门模板视图
CREATE OR REPLACE VIEW popular_templates AS
SELECT 
  t.*,
  p.username as author_name,
  p.avatar_url as author_avatar,
  p.is_verified as author_verified,
  COALESCE(t.like_count, 0) + COALESCE(t.view_count / 100, 0) + COALESCE(t.comment_count * 2, 0) as popularity_score
FROM public.templates t
LEFT JOIN public.profiles p ON t.author_id = p.id
WHERE t.is_public = true
ORDER BY popularity_score DESC;

-- 用户统计视图
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
  p.id,
  p.username,
  p.follower_count,
  p.following_count,
  p.template_count,
  COALESCE(SUM(t.like_count), 0) as total_likes_received,
  COALESCE(SUM(t.view_count), 0) as total_views_received,
  COALESCE(SUM(t.comment_count), 0) as total_comments_received
FROM public.profiles p
LEFT JOIN public.templates t ON t.author_id = p.id AND t.is_public = true
GROUP BY p.id, p.username, p.follower_count, p.following_count, p.template_count;

-- ============================================
-- 迁移完成
-- ============================================