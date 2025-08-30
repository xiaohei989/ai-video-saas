-- ============================================
-- 修复 RLS 策略 - 解决 406 错误
-- Version: 005
-- Description: 修复模板点赞系统的权限策略问题
-- ============================================

-- ============================================
-- 1. 修复 template_likes 表的 RLS 策略
-- ============================================

-- 删除现有策略
DROP POLICY IF EXISTS "Public can view template likes" ON public.template_likes;
DROP POLICY IF EXISTS "Users can manage own likes" ON public.template_likes;

-- 允许所有人查看点赞记录（包括匿名用户）
CREATE POLICY "Anyone can view template likes" ON public.template_likes
  FOR SELECT USING (true);

-- 只有认证用户可以管理自己的点赞
CREATE POLICY "Authenticated users can manage own likes" ON public.template_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own likes" ON public.template_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 2. 修复 template_favorites 表的 RLS 策略
-- ============================================

-- 删除现有策略
DROP POLICY IF EXISTS "Users can view own favorites" ON public.template_favorites;
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.template_favorites;

-- 允许所有认证用户查看收藏（但不允许匿名用户）
CREATE POLICY "Authenticated users can view favorites" ON public.template_favorites
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 用户可以管理自己的收藏
CREATE POLICY "Users can manage own favorites" ON public.template_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON public.template_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. 修复 templates 表的 RLS 策略
-- ============================================

-- 删除现有策略
DROP POLICY IF EXISTS "Public templates are viewable by everyone" ON public.templates;
DROP POLICY IF EXISTS "Users can view own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can manage own templates" ON public.templates;

-- 允许所有人查看公开模板（包括匿名用户）
CREATE POLICY "Anyone can view public templates" ON public.templates
  FOR SELECT USING (is_public = true OR auth.uid() = author_id);

-- 用户可以管理自己的模板
CREATE POLICY "Users can manage own templates" ON public.templates
  FOR ALL USING (auth.uid() = author_id);

-- 允许系统插入模板（用于同步）
CREATE POLICY "System can insert templates" ON public.templates
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 4. 确保匿名用户权限
-- ============================================

-- 为匿名角色授予基本权限
GRANT SELECT ON public.templates TO anon;
GRANT SELECT ON public.template_likes TO anon;

-- 为认证用户授予完整权限  
GRANT ALL ON public.templates TO authenticated;
GRANT ALL ON public.template_likes TO authenticated;
GRANT ALL ON public.template_favorites TO authenticated;

-- ============================================
-- 5. 更新辅助函数的安全性
-- ============================================

-- 删除并重新创建辅助函数，确保正确的安全设置
DROP FUNCTION IF EXISTS has_user_liked_template(UUID, UUID);
DROP FUNCTION IF EXISTS has_user_favorited_template(UUID, UUID);

-- 重新创建点赞检查函数
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 重新创建收藏检查函数
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为所有用户授予执行权限（包括匿名用户）
GRANT EXECUTE ON FUNCTION has_user_liked_template(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION has_user_favorited_template(UUID, UUID) TO anon, authenticated;

-- ============================================
-- 6. 测试策略
-- ============================================

-- 插入测试数据来验证策略（如果表为空）
DO $$
BEGIN
  -- 如果没有点赞记录，这是正常的，策略应该允许查询
  IF NOT EXISTS (SELECT 1 FROM public.template_likes LIMIT 1) THEN
    RAISE NOTICE '模板点赞表为空，这是正常的初始状态';
  END IF;
END $$;

-- ============================================
-- 修复完成
-- ============================================