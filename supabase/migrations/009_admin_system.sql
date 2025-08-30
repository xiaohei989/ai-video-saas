-- ============================================
-- 管理员系统数据库迁移
-- Version: 009
-- Description: 管理员权限、工单系统、模板管理扩展
-- ============================================

-- ============================================
-- 1. 管理员权限系统
-- ============================================

-- 添加用户角色枚举类型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
    END IF;
END $$;

-- 为profiles表添加角色字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user',
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS banned_reason TEXT,
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS last_login_ip INET,
ADD COLUMN IF NOT EXISTS last_login_country VARCHAR(2),
ADD COLUMN IF NOT EXISTS registration_ip INET,
ADD COLUMN IF NOT EXISTS registration_country VARCHAR(2);

-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS public.admin_operations_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL, -- 'ban_user', 'unban_user', 'update_settings', 'delete_template' etc.
  target_type VARCHAR(50), -- 'user', 'template', 'system' etc.
  target_id UUID,
  operation_details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 系统配置表
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

-- ============================================
-- 2. 客服工单系统
-- ============================================

-- 工单状态枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_user', 'resolved', 'closed');
    END IF;
END $$;

-- 工单优先级枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
        CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
    END IF;
END $$;

-- 工单分类枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_category') THEN
        CREATE TYPE ticket_category AS ENUM ('technical', 'billing', 'account', 'feature_request', 'bug_report', 'other');
    END IF;
END $$;

-- 支持工单表
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

-- 工单消息表
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'attachment', 'system'
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false, -- 内部备注，用户看不到
  is_system_message BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 常见问题表
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

-- FAQ反馈表
CREATE TABLE IF NOT EXISTS public.faq_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faq_id UUID NOT NULL REFERENCES public.faq_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_helpful BOOLEAN NOT NULL,
  feedback_comment TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 模板管理扩展
-- ============================================

-- 模板审核状态枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_audit_status') THEN
        CREATE TYPE template_audit_status AS ENUM ('pending', 'approved', 'rejected', 'needs_revision');
    END IF;
END $$;

-- 为templates表添加管理字段
ALTER TABLE public.templates 
ADD COLUMN IF NOT EXISTS audit_status template_audit_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS file_checksum VARCHAR(64),
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- 模板导入导出记录表
CREATE TABLE IF NOT EXISTS public.template_import_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_type VARCHAR(20) NOT NULL, -- 'import', 'export'
  file_name TEXT NOT NULL,
  file_size BIGINT,
  templates_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  error_message TEXT,
  file_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 4. 索引优化
-- ============================================

-- 管理员操作日志索引
CREATE INDEX IF NOT EXISTS idx_admin_operations_log_admin_id ON public.admin_operations_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_operations_log_operation_type ON public.admin_operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_admin_operations_log_created_at ON public.admin_operations_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_operations_log_target ON public.admin_operations_log(target_type, target_id);

-- 系统配置索引
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);

-- 工单系统索引
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_admin ON public.support_tickets(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON public.support_tickets(ticket_number);

-- 工单消息索引
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id ON public.ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON public.ticket_messages(created_at);

-- FAQ索引
CREATE INDEX IF NOT EXISTS idx_faq_items_category ON public.faq_items(category);
CREATE INDEX IF NOT EXISTS idx_faq_items_language ON public.faq_items(language);
CREATE INDEX IF NOT EXISTS idx_faq_items_active ON public.faq_items(is_active);
CREATE INDEX IF NOT EXISTS idx_faq_items_sort_order ON public.faq_items(sort_order);

-- FAQ反馈索引
CREATE INDEX IF NOT EXISTS idx_faq_feedback_faq_id ON public.faq_feedback(faq_id);
CREATE INDEX IF NOT EXISTS idx_faq_feedback_user_id ON public.faq_feedback(user_id);

-- profiles表新字段索引
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);
CREATE INDEX IF NOT EXISTS idx_profiles_registration_ip ON public.profiles(registration_ip);
CREATE INDEX IF NOT EXISTS idx_profiles_registration_country ON public.profiles(registration_country);

-- templates表新字段索引
CREATE INDEX IF NOT EXISTS idx_templates_audit_status ON public.templates(audit_status);
CREATE INDEX IF NOT EXISTS idx_templates_reviewed_by ON public.templates(reviewed_by);

-- 模板导入导出索引
CREATE INDEX IF NOT EXISTS idx_template_import_exports_admin_id ON public.template_import_exports(admin_id);
CREATE INDEX IF NOT EXISTS idx_template_import_exports_operation_type ON public.template_import_exports(operation_type);
CREATE INDEX IF NOT EXISTS idx_template_import_exports_status ON public.template_import_exports(status);

-- ============================================
-- 5. RLS策略
-- ============================================

-- 启用RLS
ALTER TABLE public.admin_operations_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_import_exports ENABLE ROW LEVEL SECURITY;

-- 管理员操作日志策略
CREATE POLICY "Admins can view all operation logs" ON public.admin_operations_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Service role can manage operation logs" ON public.admin_operations_log
  FOR ALL USING (auth.role() = 'service_role');

-- 系统配置策略
CREATE POLICY "Admins can view all settings" ON public.system_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can modify settings" ON public.system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 工单系统策略
CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 工单消息策略
CREATE POLICY "Ticket participants can view messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id AND (
        st.user_id = auth.uid() OR 
        st.assigned_admin_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Ticket participants can send messages" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id AND (
        st.user_id = auth.uid() OR 
        st.assigned_admin_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
      )
    )
  );

-- FAQ策略
CREATE POLICY "Anyone can view active FAQs" ON public.faq_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage FAQs" ON public.faq_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- FAQ反馈策略
CREATE POLICY "Anyone can submit FAQ feedback" ON public.faq_feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view FAQ feedback" ON public.faq_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 模板导入导出策略
CREATE POLICY "Admins can manage template imports/exports" ON public.template_import_exports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 6. 触发器和函数
-- ============================================

-- 更新系统配置updated_at字段
CREATE TRIGGER update_system_settings_updated_at 
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 更新工单updated_at字段
CREATE TRIGGER update_support_tickets_updated_at 
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 更新FAQ updated_at字段
CREATE TRIGGER update_faq_items_updated_at 
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 生成工单编号
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  ticket_count INTEGER;
  new_number VARCHAR(20);
BEGIN
  SELECT COUNT(*) INTO ticket_count FROM public.support_tickets 
  WHERE DATE(created_at) = DATE(NOW());
  
  new_number := 'TK' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD((ticket_count + 1)::TEXT, 4, '0');
  NEW.ticket_number := new_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_support_ticket_number 
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

-- 工单状态更新时自动设置时间戳
CREATE OR REPLACE FUNCTION update_ticket_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- 首次分配管理员时设置first_response_at
  IF OLD.assigned_admin_id IS NULL AND NEW.assigned_admin_id IS NOT NULL THEN
    NEW.first_response_at := NOW();
  END IF;
  
  -- 状态变为resolved时设置resolved_at
  IF OLD.status != 'resolved' AND NEW.status = 'resolved' THEN
    NEW.resolved_at := NOW();
  END IF;
  
  -- 任何状态更新都设置last_response_at
  NEW.last_response_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_ticket_timestamps 
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_ticket_timestamps();

-- 更新FAQ统计数据
CREATE OR REPLACE FUNCTION update_faq_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_helpful THEN
      UPDATE public.faq_items 
      SET helpful_count = helpful_count + 1 
      WHERE id = NEW.faq_id;
    ELSE
      UPDATE public.faq_items 
      SET not_helpful_count = not_helpful_count + 1 
      WHERE id = NEW.faq_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_faq_stats
AFTER INSERT ON public.faq_feedback
FOR EACH ROW EXECUTE FUNCTION update_faq_stats();

-- ============================================
-- 7. 管理员功能函数
-- ============================================

-- 封禁用户函数
CREATE OR REPLACE FUNCTION ban_user(
  p_user_id UUID,
  p_admin_id UUID,
  p_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- 检查管理员权限
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_id AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- 封禁用户
  UPDATE public.profiles 
  SET 
    is_banned = true,
    banned_at = NOW(),
    banned_reason = p_reason,
    banned_by = p_admin_id
  WHERE id = p_user_id;
  
  -- 记录操作日志
  INSERT INTO public.admin_operations_log (
    admin_id, operation_type, target_type, target_id, operation_details
  ) VALUES (
    p_admin_id, 'ban_user', 'user', p_user_id, 
    jsonb_build_object('reason', p_reason)
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 解封用户函数
CREATE OR REPLACE FUNCTION unban_user(
  p_user_id UUID,
  p_admin_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- 检查管理员权限
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_id AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- 解封用户
  UPDATE public.profiles 
  SET 
    is_banned = false,
    banned_at = NULL,
    banned_reason = NULL,
    banned_by = NULL
  WHERE id = p_user_id;
  
  -- 记录操作日志
  INSERT INTO public.admin_operations_log (
    admin_id, operation_type, target_type, target_id
  ) VALUES (
    p_admin_id, 'unban_user', 'user', p_user_id
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取管理员统计数据
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_users BIGINT,
  new_users_today BIGINT,
  new_users_this_week BIGINT,
  new_users_this_month BIGINT,
  total_revenue DECIMAL,
  revenue_today DECIMAL,
  revenue_this_week DECIMAL,
  revenue_this_month DECIMAL,
  active_subscriptions BIGINT,
  total_videos BIGINT,
  videos_today BIGINT,
  pending_tickets BIGINT,
  banned_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles) as total_users,
    (SELECT COUNT(*) FROM public.profiles WHERE DATE(created_at) = CURRENT_DATE) as new_users_today,
    (SELECT COUNT(*) FROM public.profiles WHERE created_at >= DATE_TRUNC('week', NOW())) as new_users_this_week,
    (SELECT COUNT(*) FROM public.profiles WHERE created_at >= DATE_TRUNC('month', NOW())) as new_users_this_month,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded') as total_revenue,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND DATE(created_at) = CURRENT_DATE) as revenue_today,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('week', NOW())) as revenue_this_week,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('month', NOW())) as revenue_this_month,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active') as active_subscriptions,
    (SELECT COUNT(*) FROM public.videos) as total_videos,
    (SELECT COUNT(*) FROM public.videos WHERE DATE(created_at) = CURRENT_DATE) as videos_today,
    (SELECT COUNT(*) FROM public.support_tickets WHERE status IN ('open', 'in_progress')) as pending_tickets,
    (SELECT COUNT(*) FROM public.profiles WHERE is_banned = true) as banned_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. 初始化数据
-- ============================================

-- 插入默认系统配置
INSERT INTO public.system_settings (setting_key, setting_value, description, category) VALUES
('max_concurrent_videos', '50', '最大并发视频生成数量', 'performance'),
('max_daily_videos_per_user', '20', '单用户每日最大视频生成数量', 'limits'),
('max_registration_per_ip', '5', '单IP每日最大注册数量', 'security'),
('enable_new_registrations', 'true', '是否允许新用户注册', 'general'),
('maintenance_mode', 'false', '维护模式开关', 'general'),
('min_credit_balance_alert', '10', '积分余额不足警告阈值', 'credits')
ON CONFLICT (setting_key) DO NOTHING;

-- 插入默认FAQ分类
INSERT INTO public.faq_items (question, answer, category, language) VALUES
('如何购买积分？', '您可以在个人中心的积分页面选择合适的积分包进行购买。', 'billing', 'zh'),
('视频生成需要多长时间？', '通常需要3-5分钟，具体时间取决于视频复杂度和当前系统负载。', 'technical', 'zh'),
('如何联系客服？', '您可以通过工单系统提交问题，我们会在24小时内回复。', 'account', 'zh'),
('What payment methods do you accept?', 'We accept all major credit cards through Stripe payment processing.', 'billing', 'en'),
('How to create a video?', 'Select a template, customize the parameters, and click generate.', 'technical', 'en')
ON CONFLICT DO NOTHING;

-- ============================================
-- 完成
-- ============================================