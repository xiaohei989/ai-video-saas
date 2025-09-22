-- ============================================
-- AI Video SaaS 综合数据库初始化脚本
-- Version: Comprehensive
-- Description: 一个完整的数据库初始化脚本，包含所有表、函数、触发器和初始数据
-- Created: 2025-01-21
-- ============================================

-- ============================================
-- 1. 扩展和基础设置
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 2. 枚举类型定义
-- ============================================

-- 订阅等级
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
        CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');
    END IF;
END $$;

-- 订阅状态
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');
    END IF;
END $$;

-- 订阅操作类型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_action') THEN
        CREATE TYPE subscription_action AS ENUM ('new', 'upgrade', 'downgrade', 'renewal', 'cancel');
    END IF;
END $$;

-- 视频状态
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
        CREATE TYPE video_status AS ENUM ('pending', 'processing', 'completed', 'failed');
    END IF;
END $$;

-- 交易类型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM ('purchase', 'reward', 'consume', 'refund');
    END IF;
END $$;

-- 通知类型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('like', 'comment', 'follow', 'reply', 'mention', 'template_featured', 'system');
    END IF;
END $$;

-- 用户角色
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
    END IF;
END $$;

-- 工单状态
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_user', 'resolved', 'closed');
    END IF;
END $$;

-- 工单优先级
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
        CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
    END IF;
END $$;

-- 工单分类
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_category') THEN
        CREATE TYPE ticket_category AS ENUM ('technical', 'billing', 'account', 'feature_request', 'bug_report', 'other');
    END IF;
END $$;

-- 模板审核状态
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_audit_status') THEN
        CREATE TYPE template_audit_status AS ENUM ('pending', 'approved', 'rejected', 'needs_revision');
    END IF;
END $$;

-- ============================================
-- 3. 核心表结构定义
-- ============================================

-- 3.1 用户资料表 (扩展 Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'en',
  credits INTEGER DEFAULT 50,
  total_credits_earned INTEGER DEFAULT 50,
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
  role user_role DEFAULT 'user',
  is_banned BOOLEAN DEFAULT false,
  banned_at TIMESTAMPTZ,
  banned_reason TEXT,
  banned_by UUID REFERENCES public.profiles(id),
  last_login_ip INET,
  last_login_country VARCHAR(2),
  registration_ip INET,
  registration_country VARCHAR(2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT bio_length_check CHECK (LENGTH(bio) <= 500),
  CONSTRAINT website_format_check CHECK (website IS NULL OR website ~ '^https?://.*')
);

-- 3.2 订阅表
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  previous_tier subscription_tier,
  action subscription_action DEFAULT 'new',
  upgraded_from UUID REFERENCES public.subscriptions(id),
  days_remaining INTEGER DEFAULT 30,
  credits_change INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 模板分类表
CREATE TABLE IF NOT EXISTS public.template_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 模板表
CREATE TABLE IF NOT EXISTS public.templates (
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
  audit_status template_audit_status DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  file_checksum VARCHAR(64),
  file_size BIGINT,
  original_filename TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 视频表
CREATE TABLE IF NOT EXISTS public.videos (
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
  queue_position INTEGER,
  queue_entered_at TIMESTAMPTZ,
  queue_started_at TIMESTAMPTZ,
  queue_priority INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT queue_position_positive CHECK (queue_position IS NULL OR queue_position > 0)
);

-- 3.6 积分交易表
CREATE TABLE IF NOT EXISTS public.credit_transactions (
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

-- 3.7 积分变更审计表
CREATE TABLE IF NOT EXISTS public.credit_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.credit_transactions(id),
  subscription_change_id UUID,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.8 邀请表
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES public.profiles(id),
  invitation_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  reward_credits INTEGER DEFAULT 20,
  invitee_email TEXT,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.9 支付记录表
CREATE TABLE IF NOT EXISTS public.payments (
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

-- 3.10 API使用跟踪表
CREATE TABLE IF NOT EXISTS public.api_usage (
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
-- 4. 社交功能相关表
-- ============================================

-- 4.1 模板点赞表
CREATE TABLE IF NOT EXISTS public.template_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- 4.2 模板收藏表
CREATE TABLE IF NOT EXISTS public.template_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- 4.3 评论表
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

-- 4.4 评论点赞表
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.template_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

-- 4.5 用户关注表
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- 4.6 通知表
CREATE TABLE IF NOT EXISTS public.notifications (
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

-- 4.7 模板浏览记录表
CREATE TABLE IF NOT EXISTS public.template_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. 安全防护系统表
-- ============================================

-- 5.1 IP注册尝试记录表
CREATE TABLE IF NOT EXISTS public.ip_registration_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  failure_reason TEXT,
  device_fingerprint JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.2 邀请速率限制记录表
CREATE TABLE IF NOT EXISTS public.invitation_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address INET,
  invitations_created INTEGER DEFAULT 1,
  last_invitation_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, DATE(created_at))
);

-- 5.3 认证失败尝试记录表
CREATE TABLE IF NOT EXISTS public.auth_failure_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET NOT NULL,
  email TEXT,
  attempt_type VARCHAR(20) NOT NULL,
  failure_reason TEXT,
  user_agent TEXT,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.4 设备指纹记录表
CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint_hash VARCHAR(64) NOT NULL,
  fingerprint_data JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  registration_count INTEGER DEFAULT 0,
  is_suspicious BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.5 临时邮箱域名黑名单表
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  reason TEXT DEFAULT 'temporary_email',
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. 管理员系统表
-- ============================================

-- 6.1 管理员操作日志表
CREATE TABLE IF NOT EXISTS public.admin_operations_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  operation_details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.2 系统配置表
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.3 支持工单表
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_admin_id UUID REFERENCES public.profiles(id),
  subject TEXT NOT NULL,
  category ticket_category NOT NULL DEFAULT 'other',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  status ticket_status NOT NULL DEFAULT 'open',
  tags TEXT[] DEFAULT '{}',
  user_email TEXT,
  user_name TEXT,
  ip_address INET,
  user_agent TEXT,
  first_response_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  satisfaction_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.4 工单消息表
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_type VARCHAR(20) DEFAULT 'text',
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  is_system_message BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.5 常见问题表
CREATE TABLE IF NOT EXISTS public.faq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.6 FAQ反馈表
CREATE TABLE IF NOT EXISTS public.faq_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faq_id UUID NOT NULL REFERENCES public.faq_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_helpful BOOLEAN NOT NULL,
  feedback_comment TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.7 模板导入导出记录表
CREATE TABLE IF NOT EXISTS public.template_import_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_type VARCHAR(20) NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  templates_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'processing',
  error_message TEXT,
  file_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 6.8 订阅变更记录表
CREATE TABLE IF NOT EXISTS public.subscription_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action subscription_action NOT NULL,
  from_tier subscription_tier,
  to_tier subscription_tier NOT NULL,
  from_subscription_id TEXT,
  to_subscription_id TEXT NOT NULL,
  credits_change INTEGER DEFAULT 0,
  days_remaining INTEGER,
  calculation_details JSONB DEFAULT '{}',
  reason TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 索引创建
-- ============================================

-- profiles 表索引
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON public.profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_follower_count ON public.profiles(follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_template_count ON public.profiles(template_count DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);
CREATE INDEX IF NOT EXISTS idx_profiles_registration_ip ON public.profiles(registration_ip);
CREATE INDEX IF NOT EXISTS idx_profiles_registration_country ON public.profiles(registration_country);

-- subscriptions 表索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_action ON public.subscriptions(action);
CREATE INDEX IF NOT EXISTS idx_subscriptions_previous_tier ON public.subscriptions(previous_tier);

-- templates 表索引
CREATE INDEX IF NOT EXISTS idx_templates_slug ON public.templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_author_id ON public.templates(author_id);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON public.templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_is_featured ON public.templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_templates_like_count ON public.templates(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_view_count ON public.templates(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_published_at ON public.templates(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON public.templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_audit_status ON public.templates(audit_status);
CREATE INDEX IF NOT EXISTS idx_templates_reviewed_by ON public.templates(reviewed_by);

-- videos 表索引
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_template_id ON public.videos(template_id);
CREATE INDEX IF NOT EXISTS idx_videos_queue_status ON public.videos(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_videos_queue_position ON public.videos(queue_position) WHERE queue_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_user_status ON public.videos(user_id, status) WHERE status = 'processing';

-- 其他表索引
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_user_id ON public.credit_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_source ON public.credit_audit_log(source);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_created_at ON public.credit_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_inviter_id ON public.invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON public.invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

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

-- 安全表索引
CREATE INDEX IF NOT EXISTS idx_ip_registration_attempts_ip ON public.ip_registration_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_registration_attempts_created_at ON public.ip_registration_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_ip_registration_attempts_success ON public.ip_registration_attempts(success);
CREATE INDEX IF NOT EXISTS idx_ip_registration_attempts_ip_success_time ON public.ip_registration_attempts(ip_address, success, created_at);
CREATE INDEX IF NOT EXISTS idx_invitation_rate_limits_user_id ON public.invitation_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_rate_limits_ip ON public.invitation_rate_limits(ip_address);
CREATE INDEX IF NOT EXISTS idx_invitation_rate_limits_created_at ON public.invitation_rate_limits(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_failure_attempts_ip ON public.auth_failure_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_failure_attempts_email ON public.auth_failure_attempts(email);
CREATE INDEX IF NOT EXISTS idx_auth_failure_attempts_created_at ON public.auth_failure_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_failure_attempts_ip_type_time ON public.auth_failure_attempts(ip_address, attempt_type, created_at);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_hash ON public.device_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id ON public.device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_ip ON public.device_fingerprints(ip_address);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_suspicious ON public.device_fingerprints(is_suspicious);
CREATE INDEX IF NOT EXISTS idx_blocked_email_domains_domain ON public.blocked_email_domains(domain);
CREATE INDEX IF NOT EXISTS idx_blocked_email_domains_active ON public.blocked_email_domains(is_active);

-- 管理员表索引
CREATE INDEX IF NOT EXISTS idx_admin_operations_log_admin_id ON public.admin_operations_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_operations_log_operation_type ON public.admin_operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_admin_operations_log_created_at ON public.admin_operations_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_operations_log_target ON public.admin_operations_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_admin ON public.support_tickets(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON public.support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id ON public.ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON public.ticket_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_faq_items_category ON public.faq_items(category);
CREATE INDEX IF NOT EXISTS idx_faq_items_language ON public.faq_items(language);
CREATE INDEX IF NOT EXISTS idx_faq_items_active ON public.faq_items(is_active);
CREATE INDEX IF NOT EXISTS idx_faq_items_sort_order ON public.faq_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_faq_feedback_faq_id ON public.faq_feedback(faq_id);
CREATE INDEX IF NOT EXISTS idx_faq_feedback_user_id ON public.faq_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_template_import_exports_admin_id ON public.template_import_exports(admin_id);
CREATE INDEX IF NOT EXISTS idx_template_import_exports_operation_type ON public.template_import_exports(operation_type);
CREATE INDEX IF NOT EXISTS idx_template_import_exports_status ON public.template_import_exports(status);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_user_id ON public.subscription_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_action ON public.subscription_changes(action);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_created_at ON public.subscription_changes(created_at DESC);

-- ============================================
-- 8. 函数定义
-- ============================================

-- 更新 updated_at 字段的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 生成邀请码函数
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.referral_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 处理新用户注册函数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 增加模板使用次数函数
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- 处理过期订阅函数
CREATE OR REPLACE FUNCTION process_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND current_period_end < NOW();
END;
$$ LANGUAGE plpgsql;

-- 获取用户统计函数
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

-- 清理旧的API使用记录函数
CREATE OR REPLACE FUNCTION cleanup_old_api_usage()
RETURNS void AS $$
BEGIN
  DELETE FROM public.api_usage
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 获取用户当前处理中的视频数量函数
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

-- 获取队列中的下一个位置函数
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(queue_position) + 1 FROM public.videos WHERE queue_position IS NOT NULL),
    1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 消费用户积分函数（原子操作）
CREATE OR REPLACE FUNCTION consume_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- 获取当前积分余额并锁定行
  SELECT credits INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- 检查余额是否充足
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF current_balance < p_amount THEN
    RETURN NULL; -- 余额不足
  END IF;
  
  -- 计算新余额
  new_balance := current_balance - p_amount;
  
  -- 更新用户积分
  UPDATE public.profiles 
  SET 
    credits = new_balance,
    total_credits_spent = total_credits_spent + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- 记录交易
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    'consume',
    -p_amount,
    current_balance,
    new_balance,
    p_description,
    p_reference_id,
    p_reference_type
  );
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加用户积分函数（原子操作）
CREATE OR REPLACE FUNCTION add_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- 获取当前积分余额并锁定行
  SELECT credits INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- 检查用户是否存在
  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- 计算新余额
  new_balance := current_balance + p_amount;
  
  -- 更新用户积分
  UPDATE public.profiles 
  SET 
    credits = new_balance,
    total_credits_earned = total_credits_earned + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- 记录交易
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    'reward',
    p_amount,
    current_balance,
    new_balance,
    p_description,
    p_reference_id,
    p_reference_type
  );
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 接受邀请函数（原子操作）
CREATE OR REPLACE FUNCTION accept_invitation(
  p_invitation_code VARCHAR(20),
  p_invitee_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_invitation RECORD;
  v_inviter_id UUID;
  v_reward_credits INTEGER;
BEGIN
  -- 查找并锁定邀请记录
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE invitation_code = p_invitation_code
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;
  
  -- 检查是否为自己邀请自己
  IF v_invitation.inviter_id = p_invitee_id THEN
    RAISE EXCEPTION 'Cannot use own invitation code';
  END IF;
  
  -- 检查被邀请者是否已经被邀请过
  PERFORM 1 FROM public.profiles 
  WHERE id = p_invitee_id AND referred_by IS NOT NULL;
  
  IF FOUND THEN
    RAISE EXCEPTION 'User already has a referrer';
  END IF;
  
  v_inviter_id := v_invitation.inviter_id;
  v_reward_credits := v_invitation.reward_credits;
  
  -- 更新邀请状态
  UPDATE public.invitations
  SET 
    status = 'accepted',
    invitee_id = p_invitee_id,
    accepted_at = NOW()
  WHERE id = v_invitation.id;
  
  -- 更新被邀请者的推荐关系
  UPDATE public.profiles
  SET referred_by = v_inviter_id
  WHERE id = p_invitee_id;
  
  -- 给邀请者发放积分奖励
  PERFORM add_user_credits(
    v_inviter_id,
    v_reward_credits,
    'Referral reward for inviting user',
    v_invitation.id,
    'invitation'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户当前活跃订阅函数
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  stripe_subscription_id TEXT,
  tier subscription_tier,
  status subscription_status,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  action subscription_action,
  days_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.stripe_subscription_id,
    s.tier,
    s.status,
    s.current_period_start,
    s.current_period_end,
    s.action,
    s.days_remaining
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id 
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建通知函数
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

-- 检查用户是否点赞了模板函数
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

-- 检查用户是否收藏了模板函数
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

-- 检查用户是否关注了另一个用户函数
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
-- 9. 触发器定义
-- ============================================

-- 更新 updated_at 触发器
CREATE TRIGGER IF NOT EXISTS update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_subscriptions_updated_at 
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_templates_updated_at 
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_videos_updated_at 
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_comments_updated_at 
  BEFORE UPDATE ON public.template_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_system_settings_updated_at 
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_support_tickets_updated_at 
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_faq_items_updated_at 
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_invitation_rate_limits_updated_at 
  BEFORE UPDATE ON public.invitation_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_device_fingerprints_updated_at 
  BEFORE UPDATE ON public.device_fingerprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 生成邀请码触发器
CREATE TRIGGER IF NOT EXISTS generate_user_referral_code 
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- 处理新用户注册触发器
CREATE TRIGGER IF NOT EXISTS on_auth_user_created 
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 社交功能计数器触发器函数
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

-- 创建社交功能触发器
CREATE TRIGGER IF NOT EXISTS trigger_update_template_like_count
  AFTER INSERT OR DELETE ON public.template_likes
  FOR EACH ROW EXECUTE FUNCTION update_template_like_count();

CREATE TRIGGER IF NOT EXISTS trigger_update_template_favorite_count
  AFTER INSERT OR DELETE ON public.template_favorites
  FOR EACH ROW EXECUTE FUNCTION update_template_favorite_count();

CREATE TRIGGER IF NOT EXISTS trigger_update_template_comment_count
  AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON public.template_comments
  FOR EACH ROW EXECUTE FUNCTION update_template_comment_count();

CREATE TRIGGER IF NOT EXISTS trigger_update_comment_like_count
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();

CREATE TRIGGER IF NOT EXISTS trigger_update_follow_counts
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

CREATE TRIGGER IF NOT EXISTS trigger_update_user_template_count
  AFTER INSERT OR DELETE OR UPDATE OF author_id ON public.templates
  FOR EACH ROW 
  WHEN (NEW.is_public = true OR OLD.is_public = true)
  EXECUTE FUNCTION update_user_template_count();

-- 自动标记作者回复函数
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

CREATE TRIGGER IF NOT EXISTS trigger_mark_author_reply
  BEFORE INSERT ON public.template_comments
  FOR EACH ROW EXECUTE FUNCTION mark_author_reply();

-- 通知系统触发器函数
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

-- 创建通知触发器
CREATE TRIGGER IF NOT EXISTS trigger_create_like_notification
  AFTER INSERT ON public.template_likes
  FOR EACH ROW EXECUTE FUNCTION create_like_notification();

CREATE TRIGGER IF NOT EXISTS trigger_create_comment_notification
  AFTER INSERT ON public.template_comments
  FOR EACH ROW 
  WHEN (NEW.is_deleted = false)
  EXECUTE FUNCTION create_comment_notification();

CREATE TRIGGER IF NOT EXISTS trigger_create_follow_notification
  AFTER INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION create_follow_notification();

-- ============================================
-- 10. 启用行级安全策略 (RLS)
-- ============================================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.ip_registration_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_failure_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_operations_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_import_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. RLS 策略定义
-- ============================================

-- Profiles 策略
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Subscriptions 策略
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Templates 策略
DROP POLICY IF EXISTS "Public templates are viewable by everyone" ON public.templates;
CREATE POLICY "Public templates are viewable by everyone" ON public.templates
  FOR SELECT USING (is_public = true OR auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can create templates" ON public.templates;
CREATE POLICY "Users can create templates" ON public.templates
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can update own templates" ON public.templates;
CREATE POLICY "Users can update own templates" ON public.templates
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own templates" ON public.templates;
CREATE POLICY "Users can delete own templates" ON public.templates
  FOR DELETE USING (auth.uid() = author_id);

-- Videos 策略
DROP POLICY IF EXISTS "Users can view own videos" ON public.videos;
CREATE POLICY "Users can view own videos" ON public.videos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own videos" ON public.videos;
CREATE POLICY "Users can create own videos" ON public.videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own videos" ON public.videos;
CREATE POLICY "Users can update own videos" ON public.videos
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own videos" ON public.videos;
CREATE POLICY "Users can delete own videos" ON public.videos
  FOR DELETE USING (auth.uid() = user_id);

-- Credit Transactions 策略
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Invitations 策略
DROP POLICY IF EXISTS "Users can view own invitations" ON public.invitations;
CREATE POLICY "Users can view own invitations" ON public.invitations
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

DROP POLICY IF EXISTS "Users can create invitations" ON public.invitations;
CREATE POLICY "Users can create invitations" ON public.invitations
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

-- Payments 策略
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Template Likes 策略
DROP POLICY IF EXISTS "Public can view template likes" ON public.template_likes;
CREATE POLICY "Public can view template likes" ON public.template_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own likes" ON public.template_likes;
CREATE POLICY "Users can manage own likes" ON public.template_likes
  FOR ALL USING (auth.uid() = user_id);

-- Template Favorites 策略
DROP POLICY IF EXISTS "Users can view own favorites" ON public.template_favorites;
CREATE POLICY "Users can view own favorites" ON public.template_favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own favorites" ON public.template_favorites;
CREATE POLICY "Users can manage own favorites" ON public.template_favorites
  FOR ALL USING (auth.uid() = user_id);

-- Template Comments 策略
DROP POLICY IF EXISTS "Public can view non-deleted comments" ON public.template_comments;
CREATE POLICY "Public can view non-deleted comments" ON public.template_comments
  FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "Users can create comments" ON public.template_comments;
CREATE POLICY "Users can create comments" ON public.template_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON public.template_comments;
CREATE POLICY "Users can update own comments" ON public.template_comments
  FOR UPDATE USING (auth.uid() = user_id AND is_deleted = false);

-- Comment Likes 策略
DROP POLICY IF EXISTS "Public can view comment likes" ON public.comment_likes;
CREATE POLICY "Public can view comment likes" ON public.comment_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own comment likes" ON public.comment_likes;
CREATE POLICY "Users can manage own comment likes" ON public.comment_likes
  FOR ALL USING (auth.uid() = user_id);

-- User Follows 策略
DROP POLICY IF EXISTS "Public can view follows" ON public.user_follows;
CREATE POLICY "Public can view follows" ON public.user_follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own follows" ON public.user_follows;
CREATE POLICY "Users can manage own follows" ON public.user_follows
  FOR ALL USING (auth.uid() = follower_id);

-- Notifications 策略
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Template Views 策略
DROP POLICY IF EXISTS "Anyone can create views" ON public.template_views;
CREATE POLICY "Anyone can create views" ON public.template_views
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view template views" ON public.template_views;
CREATE POLICY "Public can view template views" ON public.template_views
  FOR SELECT USING (true);

-- 其他安全相关策略...
DROP POLICY IF EXISTS "Service role can manage all ip attempts" ON public.ip_registration_attempts;
CREATE POLICY "Service role can manage all ip attempts" ON public.ip_registration_attempts
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view own ip attempts" ON public.ip_registration_attempts;
CREATE POLICY "Users can view own ip attempts" ON public.ip_registration_attempts
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 12. 视图定义
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
-- 13. 初始化数据
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

-- 插入黑名单邮箱域名（部分常见的临时邮箱）
INSERT INTO public.blocked_email_domains (domain, reason) VALUES
('10minutemail.com', 'temporary_email'),
('guerrillamail.com', 'temporary_email'),
('mailinator.com', 'temporary_email'),
('temp-mail.org', 'temporary_email'),
('throwaway.email', 'temporary_email'),
('yopmail.com', 'temporary_email'),
('maildrop.cc', 'temporary_email'),
('mintemail.com', 'temporary_email'),
('sharklasers.com', 'temporary_email')
ON CONFLICT (domain) DO NOTHING;

-- 插入基本系统配置
INSERT INTO public.system_settings (setting_key, setting_value, description, category, is_public) VALUES
('max_concurrent_videos_per_user', '3', 'Maximum number of concurrent video processing jobs per user', 'limits', false),
('default_user_credits', '50', 'Default credits given to new users', 'credits', false),
('referral_reward_credits', '20', 'Credits awarded for successful referrals', 'referrals', false),
('max_video_queue_size', '1000', 'Maximum size of the video processing queue', 'limits', false),
('site_maintenance_mode', 'false', 'Enable maintenance mode', 'system', true),
('registration_enabled', 'true', 'Enable user registration', 'system', true)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- 完成
-- ============================================

-- 输出完成信息
SELECT 'Database initialization completed successfully!' as status;