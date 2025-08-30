-- ============================================
-- AI Video SaaS 完整数据库架构
-- Version: 001
-- Description: 包含基础表结构和社交功能的完整数据库架构
-- ============================================

-- ============================================
-- 启用必要的扩展
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 创建枚举类型
-- ============================================
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');
CREATE TYPE video_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE transaction_type AS ENUM ('purchase', 'reward', 'consume', 'refund');
CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'reply', 'mention', 'template_featured', 'system');

-- ============================================
-- 1. 用户资料表 (扩展 Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'en',
  credits INTEGER DEFAULT 100,
  total_credits_earned INTEGER DEFAULT 100,
  total_credits_spent INTEGER DEFAULT 0,
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  template_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  verification_date TIMESTAMPTZ,
  profile_views INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT bio_length_check CHECK (LENGTH(bio) <= 500),
  CONSTRAINT website_format_check CHECK (website IS NULL OR website ~ '^https?://.*')
);

-- ============================================
-- 2. 订阅表
-- ============================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, status)
);

-- ============================================
-- 3. 模板分类表
-- ============================================
CREATE TABLE public.template_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 模板表（含社交功能字段）
-- ============================================
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  preview_url TEXT,
  category VARCHAR(50),
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  credit_cost INTEGER DEFAULT 10,
  parameters JSONB NOT NULL DEFAULT '[]',
  prompt_template TEXT NOT NULL,
  veo3_settings JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  source_template_id UUID REFERENCES public.templates(id),
  version VARCHAR(20) DEFAULT '1.0.0',
  featured_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. 视频表
-- ============================================
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.templates(id),
  title TEXT,
  description TEXT,
  status video_status DEFAULT 'pending',
  veo3_job_id TEXT UNIQUE,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  resolution VARCHAR(20),
  file_size BIGINT,
  parameters JSONB DEFAULT '{}',
  prompt TEXT,
  credits_used INTEGER DEFAULT 0,
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. 积分交易表
-- ============================================
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 邀请表
-- ============================================
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES public.profiles(id),
  invitation_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  reward_credits INTEGER DEFAULT 50,
  invitee_email TEXT,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. 支付记录表
-- ============================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. API使用跟踪表
-- ============================================
CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_email TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  response_time INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 社交功能相关表
-- ============================================

-- 10. 模板点赞表
CREATE TABLE public.template_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- 11. 模板收藏表
CREATE TABLE public.template_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- 12. 评论表
CREATE TABLE public.template_comments (
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

-- 13. 评论点赞表
CREATE TABLE public.comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.template_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

-- 14. 用户关注表
CREATE TABLE public.user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- 15. 通知表
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  related_id UUID,
  related_type VARCHAR(50),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. 模板浏览记录表
CREATE TABLE public.template_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 创建索引优化查询性能
-- ============================================

-- profiles 表索引
CREATE INDEX idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_is_verified ON public.profiles(is_verified);
CREATE INDEX idx_profiles_follower_count ON public.profiles(follower_count DESC);
CREATE INDEX idx_profiles_template_count ON public.profiles(template_count DESC);

-- subscriptions 表索引
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- templates 表索引
CREATE INDEX idx_templates_slug ON public.templates(slug);
CREATE INDEX idx_templates_category ON public.templates(category);
CREATE INDEX idx_templates_author_id ON public.templates(author_id);
CREATE INDEX idx_templates_is_public ON public.templates(is_public);
CREATE INDEX idx_templates_is_featured ON public.templates(is_featured);
CREATE INDEX idx_templates_like_count ON public.templates(like_count DESC);
CREATE INDEX idx_templates_view_count ON public.templates(view_count DESC);
CREATE INDEX idx_templates_published_at ON public.templates(published_at DESC);
CREATE INDEX idx_templates_tags ON public.templates USING GIN(tags);

-- videos 表索引
CREATE INDEX idx_videos_user_id ON public.videos(user_id);
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_videos_template_id ON public.videos(template_id);

-- 其他表索引
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_invitations_inviter_id ON public.invitations(inviter_id);
CREATE INDEX idx_invitations_code ON public.invitations(invitation_code);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);

-- 社交表索引
CREATE INDEX idx_template_likes_user_id ON public.template_likes(user_id);
CREATE INDEX idx_template_likes_template_id ON public.template_likes(template_id);
CREATE INDEX idx_template_favorites_user_id ON public.template_favorites(user_id);
CREATE INDEX idx_template_favorites_template_id ON public.template_favorites(template_id);
CREATE INDEX idx_template_comments_template_id ON public.template_comments(template_id);
CREATE INDEX idx_template_comments_user_id ON public.template_comments(user_id);
CREATE INDEX idx_template_comments_parent_id ON public.template_comments(parent_comment_id);
CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX idx_user_follows_follower_id ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following_id ON public.user_follows(following_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_template_views_template_id ON public.template_views(template_id);

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_views ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Subscriptions 策略
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Templates 策略
CREATE POLICY "Public templates are viewable by everyone" ON public.templates
  FOR SELECT USING (is_public = true OR auth.uid() = author_id);

CREATE POLICY "Users can create templates" ON public.templates
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own templates" ON public.templates
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own templates" ON public.templates
  FOR DELETE USING (auth.uid() = author_id);

-- Videos 策略
CREATE POLICY "Users can view own videos" ON public.videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own videos" ON public.videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos" ON public.videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos" ON public.videos
  FOR DELETE USING (auth.uid() = user_id);

-- Credit Transactions 策略
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Invitations 策略
CREATE POLICY "Users can view own invitations" ON public.invitations
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can create invitations" ON public.invitations
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

-- Payments 策略
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Template Likes 策略
CREATE POLICY "Public can view template likes" ON public.template_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own likes" ON public.template_likes
  FOR ALL USING (auth.uid() = user_id);

-- Template Favorites 策略
CREATE POLICY "Users can view own favorites" ON public.template_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON public.template_favorites
  FOR ALL USING (auth.uid() = user_id);

-- Template Comments 策略
CREATE POLICY "Public can view non-deleted comments" ON public.template_comments
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "Users can create comments" ON public.template_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.template_comments
  FOR UPDATE USING (auth.uid() = user_id AND is_deleted = false);

CREATE POLICY "Users can soft delete own comments" ON public.template_comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (is_deleted = true);

-- Comment Likes 策略
CREATE POLICY "Public can view comment likes" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own comment likes" ON public.comment_likes
  FOR ALL USING (auth.uid() = user_id);

-- User Follows 策略
CREATE POLICY "Public can view follows" ON public.user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own follows" ON public.user_follows
  FOR ALL USING (auth.uid() = follower_id);

-- Notifications 策略
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Template Views 策略
CREATE POLICY "Anyone can create views" ON public.template_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view template views" ON public.template_views
  FOR SELECT USING (true);

-- ============================================
-- 函数和触发器
-- ============================================

-- 更新 updated_at 字段的触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 添加 updated_at 触发器
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.template_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 生成邀请码
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.referral_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_user_referral_code BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- 处理新用户注册
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 增加模板使用次数
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- 处理过期订阅
CREATE OR REPLACE FUNCTION process_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND current_period_end < NOW();
END;
$$ LANGUAGE plpgsql;

-- 获取用户统计
CREATE OR REPLACE FUNCTION get_user_stats(user_id UUID)
RETURNS TABLE (
  total_videos INTEGER,
  completed_videos INTEGER,
  total_credits_used INTEGER,
  active_subscription TEXT,
  invitation_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.videos WHERE videos.user_id = $1) as total_videos,
    (SELECT COUNT(*)::INTEGER FROM public.videos WHERE videos.user_id = $1 AND status = 'completed') as completed_videos,
    (SELECT COALESCE(SUM(credits_used), 0)::INTEGER FROM public.videos WHERE videos.user_id = $1) as total_credits_used,
    (SELECT tier::TEXT FROM public.subscriptions WHERE subscriptions.user_id = $1 AND status = 'active' LIMIT 1) as active_subscription,
    (SELECT COUNT(*)::INTEGER FROM public.invitations WHERE inviter_id = $1 AND status = 'accepted') as invitation_count;
END;
$$ LANGUAGE plpgsql;

-- 清理旧的API使用记录
CREATE OR REPLACE FUNCTION cleanup_old_api_usage()
RETURNS void AS $$
BEGIN
  DELETE FROM public.api_usage
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 社交功能触发器
-- ============================================

-- 更新点赞数
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

-- 更新收藏数
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

-- 更新评论数
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

-- 更新评论点赞数
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

-- 更新关注数
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

-- 更新用户模板数
CREATE OR REPLACE FUNCTION update_user_template_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_public = true THEN
    UPDATE public.profiles 
    SET template_count = template_count + 1 
    WHERE id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' AND OLD.is_public = true THEN
    UPDATE public.profiles 
    SET template_count = GREATEST(0, template_count - 1) 
    WHERE id = OLD.author_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.author_id != OLD.author_id THEN
      UPDATE public.profiles 
      SET template_count = GREATEST(0, template_count - 1) 
      WHERE id = OLD.author_id;
      
      UPDATE public.profiles 
      SET template_count = template_count + 1 
      WHERE id = NEW.author_id;
    END IF;
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
  SELECT author_id INTO template_author_id 
  FROM public.templates 
  WHERE id = NEW.template_id;
  
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
-- 通知系统函数
-- ============================================

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
  SELECT t.author_id, t.name, p.username 
  INTO template_author_id, template_name, liker_name
  FROM public.templates t
  LEFT JOIN public.profiles p ON p.id = NEW.user_id
  WHERE t.id = NEW.template_id;
  
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
  SELECT username INTO commenter_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
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
  
  -- 通知模板作者
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
  SELECT username INTO follower_name
  FROM public.profiles
  WHERE id = NEW.follower_id;
  
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
-- 辅助函数
-- ============================================

-- 检查用户是否点赞了模板
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

-- 检查用户是否收藏了模板
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

-- 检查用户是否关注了另一个用户
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

-- ============================================
-- 数据统计视图
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
-- 初始化数据（可选）
-- ============================================

-- 插入默认模板分类
INSERT INTO public.template_categories (name, display_name, description, sort_order) VALUES
('asmr', 'ASMR', 'Autonomous Sensory Meridian Response videos', 1),
('art', 'Art & Design', 'Artistic and creative visual content', 2),
('nature', 'Nature', 'Natural scenery and wildlife', 3),
('tech', 'Technology', 'Tech demos and futuristic content', 4),
('lifestyle', 'Lifestyle', 'Daily life and personal content', 5),
('entertainment', 'Entertainment', 'Fun and entertaining content', 6)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 完成
-- ============================================