-- ============================================
-- 用户设置系统迁移
-- Version: 016
-- Description: 扩展 profiles 表以支持完整的用户设置管理
-- ============================================

-- 扩展 profiles 表，添加用户设置字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS theme VARCHAR(10) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY' CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')),
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email_notifications": true,
  "push_notifications": true,
  "marketing_emails": false,
  "video_completion": true,
  "template_likes": true,
  "referral_rewards": true
}'::jsonb;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_theme ON public.profiles(theme);
CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON public.profiles(timezone);

-- 添加注释
COMMENT ON COLUMN public.profiles.theme IS '用户主题偏好设置：light/dark/system';
COMMENT ON COLUMN public.profiles.timezone IS '用户时区设置';
COMMENT ON COLUMN public.profiles.date_format IS '用户日期格式偏好';
COMMENT ON COLUMN public.profiles.notification_preferences IS '用户通知偏好设置（JSON格式）';

-- 创建更新设置的存储过程
CREATE OR REPLACE FUNCTION update_user_settings(
  p_user_id UUID,
  p_theme VARCHAR(10) DEFAULT NULL,
  p_timezone VARCHAR(50) DEFAULT NULL,
  p_date_format VARCHAR(20) DEFAULT NULL,
  p_notification_preferences JSONB DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  updated_profile JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_record public.profiles%ROWTYPE;
BEGIN
  -- 验证用户是否存在
  SELECT * INTO v_profile_record 
  FROM public.profiles 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, '用户不存在', NULL::JSONB;
    RETURN;
  END IF;
  
  -- 更新用户设置
  UPDATE public.profiles 
  SET 
    theme = COALESCE(p_theme, theme),
    timezone = COALESCE(p_timezone, timezone),
    date_format = COALESCE(p_date_format, date_format),
    notification_preferences = COALESCE(p_notification_preferences, notification_preferences),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_profile_record;
  
  -- 返回成功结果
  RETURN QUERY SELECT 
    TRUE,
    '设置更新成功',
    jsonb_build_object(
      'id', v_profile_record.id,
      'theme', v_profile_record.theme,
      'timezone', v_profile_record.timezone,
      'date_format', v_profile_record.date_format,
      'notification_preferences', v_profile_record.notification_preferences,
      'language', v_profile_record.language,
      'updated_at', v_profile_record.updated_at
    );
END;
$$;

-- 创建获取用户设置的存储过程
CREATE OR REPLACE FUNCTION get_user_settings(p_user_id UUID)
RETURNS TABLE (
  theme VARCHAR(10),
  timezone VARCHAR(50),
  date_format VARCHAR(20),
  notification_preferences JSONB,
  language VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    p.theme,
    p.timezone,
    p.date_format,
    p.notification_preferences,
    p.language
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- 设置行级安全策略
-- 用户只能查看和更新自己的设置
CREATE POLICY "用户可以查看自己的设置" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "用户可以更新自己的设置" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 创建触发器来自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- 添加数据验证约束
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_timezone CHECK (
  timezone IS NULL OR 
  timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$' OR 
  timezone = 'UTC'
);

-- 为现有用户设置默认值（如果字段为空）
UPDATE public.profiles 
SET 
  theme = COALESCE(theme, 'system'),
  timezone = COALESCE(timezone, 'UTC'),
  date_format = COALESCE(date_format, 'MM/DD/YYYY'),
  notification_preferences = COALESCE(notification_preferences, '{
    "email_notifications": true,
    "push_notifications": true,
    "marketing_emails": false,
    "video_completion": true,
    "template_likes": true,
    "referral_rewards": true
  }'::jsonb)
WHERE 
  theme IS NULL OR 
  timezone IS NULL OR 
  date_format IS NULL OR 
  notification_preferences IS NULL;