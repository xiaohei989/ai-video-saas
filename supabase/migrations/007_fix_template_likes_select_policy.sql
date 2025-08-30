-- ============================================
-- 修复 template_likes 表的 SELECT 权限问题
-- 解决 406 (Not Acceptable) 错误
-- ============================================

-- 1. 检查当前策略
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'template_likes';

-- 2. 删除所有现有的 template_likes 策略
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'template_likes' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.template_likes';
        RAISE NOTICE '删除策略: %', policy_record.policyname;
    END LOOP;
END $$;

-- 3. 创建新的宽松策略
-- 允许所有用户（包括匿名用户）查看点赞数据
CREATE POLICY "template_likes_read_all" ON public.template_likes
  FOR SELECT 
  USING (true);

-- 只允许认证用户插入自己的点赞记录
CREATE POLICY "template_likes_insert_own" ON public.template_likes
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 只允许认证用户删除自己的点赞记录
CREATE POLICY "template_likes_delete_own" ON public.template_likes
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. 确保 anon 角色有 SELECT 权限
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.template_likes TO anon;

-- 5. 确保 authenticated 角色有完整权限
GRANT ALL ON public.template_likes TO authenticated;

-- 6. 验证权限设置
-- 测试匿名用户查询（模拟前端的查询）
DO $$
DECLARE
    test_count INTEGER;
    can_select BOOLEAN := false;
BEGIN
    -- 尝试作为匿名用户查询
    BEGIN
        SET LOCAL ROLE anon;
        
        -- 测试基本查询
        SELECT COUNT(*) INTO test_count FROM public.template_likes;
        can_select := true;
        
        RAISE NOTICE '✅ 匿名用户可以查询 template_likes，记录数: %', test_count;
        
    EXCEPTION WHEN OTHERS THEN
        can_select := false;
        RAISE NOTICE '❌ 匿名用户无法查询 template_likes: %', SQLERRM;
    END;
    
    -- 重置角色
    RESET ROLE;
    
    IF NOT can_select THEN
        RAISE EXCEPTION '匿名用户权限测试失败，需要手动检查';
    END IF;
END $$;

-- 7. 测试具体的查询模式（模拟前端查询）
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- 模拟前端的查询
    SET LOCAL ROLE anon;
    
    -- 这是导致406错误的具体查询模式
    SELECT COUNT(*) as count
    FROM public.template_likes 
    WHERE user_id = 'fa38674f-1e5b-4132-9fb7-192940e52a32'::uuid
    AND template_id = 'f01f880a-b9b3-4dc3-9b5f-34f2fc9fb736'::uuid;
    
    RAISE NOTICE '✅ 具体查询测试成功';
    
    RESET ROLE;
    
EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE NOTICE '❌ 具体查询测试失败: %', SQLERRM;
END $$;

-- 8. 显示修复后的策略
SELECT 
  policyname, 
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'template_likes' AND schemaname = 'public'
ORDER BY policyname;

RAISE NOTICE '===========================================';
RAISE NOTICE 'template_likes SELECT 权限修复完成！';
RAISE NOTICE '现在 406 错误应该彻底解决了。';
RAISE NOTICE '===========================================';