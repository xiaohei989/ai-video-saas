-- 修复 template_seo_guides 的 RLS 策略，支持 super_admin
-- 创建时间: 2025-10-12

-- 删除旧策略
DROP POLICY IF EXISTS "Admins can view all guides" ON public.template_seo_guides;
DROP POLICY IF EXISTS "Admins can create guides" ON public.template_seo_guides;
DROP POLICY IF EXISTS "Admins can update guides" ON public.template_seo_guides;
DROP POLICY IF EXISTS "Admins can delete guides" ON public.template_seo_guides;

-- 管理员（admin 和 super_admin）可以查看所有指南
CREATE POLICY "Admins can view all guides" ON public.template_seo_guides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 管理员可以创建指南
CREATE POLICY "Admins can create guides" ON public.template_seo_guides
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 管理员可以更新指南
CREATE POLICY "Admins can update guides" ON public.template_seo_guides
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 管理员可以删除指南
CREATE POLICY "Admins can delete guides" ON public.template_seo_guides
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );
