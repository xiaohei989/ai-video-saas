-- 创建安全事件记录表
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN (
    'brute_force',
    'sql_injection', 
    'xss',
    'csrf',
    'ddos',
    'malicious_upload',
    'suspicious_pattern',
    'rate_limit_exceeded'
  )),
  level TEXT NOT NULL CHECK (level IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  blocked BOOLEAN DEFAULT false,
  action TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_level ON public.security_events(level);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON public.security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON public.security_events(ip_address);

-- 创建文件上传记录表
CREATE TABLE IF NOT EXISTS public.file_upload_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  blocked BOOLEAN DEFAULT false,
  threat_detected BOOLEAN DEFAULT false,
  upload_path TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文件上传记录索引
CREATE INDEX IF NOT EXISTS idx_file_upload_logs_user_id ON public.file_upload_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_upload_logs_blocked ON public.file_upload_logs(blocked);
CREATE INDEX IF NOT EXISTS idx_file_upload_logs_threat_detected ON public.file_upload_logs(threat_detected);
CREATE INDEX IF NOT EXISTS idx_file_upload_logs_created_at ON public.file_upload_logs(created_at);

-- 设置RLS策略
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_upload_logs ENABLE ROW LEVEL SECURITY;

-- 安全事件表的RLS策略（仅管理员可查看）
CREATE POLICY "security_events_admin_only" ON public.security_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 文件上传记录策略（用户只能查看自己的记录，管理员可查看所有）
CREATE POLICY "file_upload_logs_own_or_admin" ON public.file_upload_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 创建清理旧记录的函数
CREATE OR REPLACE FUNCTION public.cleanup_security_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 删除90天前的低级别安全事件
  DELETE FROM public.security_events
  WHERE level = 'low' AND created_at < NOW() - INTERVAL '90 days';
  
  -- 删除180天前的中级别安全事件
  DELETE FROM public.security_events
  WHERE level = 'medium' AND created_at < NOW() - INTERVAL '180 days';
  
  -- 删除365天前的高级别安全事件
  DELETE FROM public.security_events
  WHERE level IN ('high', 'critical') AND created_at < NOW() - INTERVAL '365 days';
  
  -- 删除30天前的文件上传记录（成功的）
  DELETE FROM public.file_upload_logs
  WHERE success = true AND blocked = false AND threat_detected = false
  AND created_at < NOW() - INTERVAL '30 days';
  
  -- 删除180天前的威胁文件上传记录
  DELETE FROM public.file_upload_logs
  WHERE (blocked = true OR threat_detected = true)
  AND created_at < NOW() - INTERVAL '180 days';
END;
$$;

-- 创建定时清理任务（如果支持pg_cron扩展）
-- SELECT cron.schedule('cleanup-security-events', '0 2 * * *', 'SELECT public.cleanup_security_events();');

COMMENT ON TABLE public.security_events IS '安全事件记录表，用于记录各种安全相关事件';
COMMENT ON TABLE public.file_upload_logs IS '文件上传记录表，用于记录文件上传的安全相关信息';
COMMENT ON FUNCTION public.cleanup_security_events() IS '清理旧的安全事件和文件上传记录';