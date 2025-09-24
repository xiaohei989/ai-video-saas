-- 原子化切换模板点赞的RPC函数与策略优化
-- 创建于: 2025-09-23

-- 1) 原子化切换点赞状态
-- 说明：
-- - 在单个事务中根据当前状态执行删除或插入
-- - 返回最终的 is_liked 与 like_count（以数据库触发器更新后的计数为准）
-- - 依赖现有触发器 trigger_update_template_like_count 维护 templates.like_count
CREATE OR REPLACE FUNCTION public.toggle_template_like(
  p_template_id UUID
) RETURNS TABLE (
  is_liked BOOLEAN,
  like_count INTEGER
) AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted_count INT := 0;
  v_template_exists BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 模板存在性校验（避免无效ID）
  SELECT EXISTS(SELECT 1 FROM public.templates WHERE id = p_template_id) INTO v_template_exists;
  IF NOT v_template_exists THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- 先尝试删除（如果本来已点赞则会删除1行）
  DELETE FROM public.template_likes
  WHERE user_id = v_user_id AND template_id = p_template_id
  RETURNING 1 INTO v_deleted_count;

  IF v_deleted_count = 0 THEN
    -- 未删除到记录，说明之前未点赞，尝试插入（避免并发冲突）
    INSERT INTO public.template_likes(user_id, template_id)
    VALUES (v_user_id, p_template_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 返回最终点赞状态
  is_liked := EXISTS(
    SELECT 1 FROM public.template_likes
    WHERE user_id = v_user_id AND template_id = p_template_id
  );

  -- 返回最终点赞计数（由触发器维护，事务内可见）
  SELECT COALESCE(t.like_count, 0) INTO like_count
  FROM public.templates t
  WHERE t.id = p_template_id;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2) RLS 策略明确化（如已存在将忽略或并存）
-- 插入策略：仅允许本人
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'template_likes' 
      AND policyname = 'Users can insert own likes'
  ) THEN
    CREATE POLICY "Users can insert own likes" ON public.template_likes
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 删除策略：仅允许本人
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'template_likes' 
      AND policyname = 'Users can delete own likes'
  ) THEN
    CREATE POLICY "Users can delete own likes" ON public.template_likes
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

