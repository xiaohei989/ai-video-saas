-- 修复限流系统的RLS策略

-- 删除有问题的策略
DROP POLICY IF EXISTS "Admin can view rate limit events" ON public.rate_limit_events;
DROP POLICY IF EXISTS "Admin can manage IP blacklist" ON public.ip_blacklist;

-- 重新创建正确的策略

-- 只有管理员可以查看限流记录
CREATE POLICY "Admin can view rate limit events" ON public.rate_limit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 只有管理员可以管理IP黑名单
CREATE POLICY "Admin can manage IP blacklist" ON public.ip_blacklist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 验证策略
SELECT 'Rate limit policies fixed successfully' as status;