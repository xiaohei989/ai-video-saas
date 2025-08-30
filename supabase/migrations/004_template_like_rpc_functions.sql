-- ============================================
-- Template Like RPC Functions
-- Version: 004
-- Description: 优化模板点赞功能的RPC函数
-- ============================================

-- ============================================
-- 1. 切换模板点赞状态函数
-- ============================================
CREATE OR REPLACE FUNCTION toggle_template_like(
  p_template_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
  is_liked BOOLEAN,
  like_count INTEGER,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_existing_like UUID;
  v_current_count INTEGER;
  v_is_liked BOOLEAN;
BEGIN
  -- 验证用户权限
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, FALSE, '用户未认证'::TEXT;
    RETURN;
  END IF;

  -- 验证模板是否存在
  IF NOT EXISTS (SELECT 1 FROM public.templates WHERE id = p_template_id) THEN
    RETURN QUERY SELECT FALSE, 0, FALSE, '模板不存在'::TEXT;
    RETURN;
  END IF;

  -- 检查是否已点赞
  SELECT id INTO v_existing_like 
  FROM public.template_likes 
  WHERE user_id = p_user_id AND template_id = p_template_id;

  IF v_existing_like IS NOT NULL THEN
    -- 取消点赞
    DELETE FROM public.template_likes 
    WHERE id = v_existing_like;
    
    v_is_liked := FALSE;
  ELSE
    -- 添加点赞
    INSERT INTO public.template_likes (user_id, template_id)
    VALUES (p_user_id, p_template_id);
    
    v_is_liked := TRUE;
  END IF;

  -- 获取更新后的点赞数
  SELECT COALESCE(t.like_count, 0) INTO v_current_count
  FROM public.templates t
  WHERE t.id = p_template_id;

  RETURN QUERY SELECT v_is_liked, v_current_count, TRUE, '操作成功'::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 0, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. 批量检查模板点赞状态函数
-- ============================================
CREATE OR REPLACE FUNCTION check_templates_like_status(
  p_template_ids UUID[],
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
  template_id UUID,
  is_liked BOOLEAN,
  like_count INTEGER
) AS $$
BEGIN
  IF p_user_id IS NULL THEN
    -- 未登录用户只返回点赞数，不返回点赞状态
    RETURN QUERY
    SELECT 
      t.id as template_id,
      FALSE as is_liked,
      COALESCE(t.like_count, 0) as like_count
    FROM public.templates t
    WHERE t.id = ANY(p_template_ids);
  ELSE
    -- 已登录用户返回完整信息
    RETURN QUERY
    SELECT 
      t.id as template_id,
      CASE WHEN tl.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked,
      COALESCE(t.like_count, 0) as like_count
    FROM public.templates t
    LEFT JOIN public.template_likes tl ON (
      t.id = tl.template_id AND tl.user_id = p_user_id
    )
    WHERE t.id = ANY(p_template_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. 获取用户点赞的模板列表函数
-- ============================================
CREATE OR REPLACE FUNCTION get_user_liked_templates(
  p_user_id UUID DEFAULT auth.uid(),
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
  template_id UUID,
  template_name TEXT,
  template_description TEXT,
  template_thumbnail_url TEXT,
  template_author_id UUID,
  like_count INTEGER,
  liked_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_offset INTEGER;
  v_total_count BIGINT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 计算偏移量
  v_offset := (p_page - 1) * p_page_size;

  -- 获取总数
  SELECT COUNT(*) INTO v_total_count
  FROM public.template_likes tl
  INNER JOIN public.templates t ON t.id = tl.template_id
  WHERE tl.user_id = p_user_id AND t.is_public = TRUE;

  -- 返回分页数据
  RETURN QUERY
  SELECT 
    t.id as template_id,
    t.name as template_name,
    t.description as template_description,
    t.thumbnail_url as template_thumbnail_url,
    t.author_id as template_author_id,
    COALESCE(t.like_count, 0) as like_count,
    tl.created_at as liked_at,
    v_total_count as total_count
  FROM public.template_likes tl
  INNER JOIN public.templates t ON t.id = tl.template_id
  WHERE tl.user_id = p_user_id AND t.is_public = TRUE
  ORDER BY tl.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. 获取热门模板函数
-- ============================================
CREATE OR REPLACE FUNCTION get_popular_templates(
  p_limit INTEGER DEFAULT 10,
  p_timeframe TEXT DEFAULT 'all',
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
  template_id UUID,
  template_name TEXT,
  template_description TEXT,
  template_thumbnail_url TEXT,
  template_author_id UUID,
  like_count INTEGER,
  is_liked BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
BEGIN
  -- 确定时间范围
  CASE p_timeframe
    WHEN 'day' THEN v_start_date := NOW() - INTERVAL '1 day';
    WHEN 'week' THEN v_start_date := NOW() - INTERVAL '1 week';
    WHEN 'month' THEN v_start_date := NOW() - INTERVAL '1 month';
    ELSE v_start_date := '1970-01-01'::TIMESTAMPTZ;
  END CASE;

  -- 返回热门模板
  RETURN QUERY
  SELECT 
    t.id as template_id,
    t.name as template_name,
    t.description as template_description,
    t.thumbnail_url as template_thumbnail_url,
    t.author_id as template_author_id,
    COALESCE(t.like_count, 0) as like_count,
    CASE 
      WHEN p_user_id IS NOT NULL AND tl.user_id IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END as is_liked,
    t.created_at
  FROM public.templates t
  LEFT JOIN public.template_likes tl ON (
    t.id = tl.template_id AND tl.user_id = p_user_id
  )
  WHERE 
    t.is_public = TRUE 
    AND t.created_at >= v_start_date
  ORDER BY COALESCE(t.like_count, 0) DESC, t.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 获取模板点赞用户列表函数
-- ============================================
CREATE OR REPLACE FUNCTION get_template_likers(
  p_template_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN,
  liked_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_offset INTEGER;
  v_total_count BIGINT;
BEGIN
  -- 验证模板是否存在
  IF NOT EXISTS (SELECT 1 FROM public.templates WHERE id = p_template_id) THEN
    RETURN;
  END IF;

  -- 计算偏移量
  v_offset := (p_page - 1) * p_page_size;

  -- 获取总数
  SELECT COUNT(*) INTO v_total_count
  FROM public.template_likes tl
  WHERE tl.template_id = p_template_id;

  -- 返回点赞用户列表
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_url,
    COALESCE(p.is_verified, FALSE) as is_verified,
    tl.created_at as liked_at,
    v_total_count as total_count
  FROM public.template_likes tl
  INNER JOIN public.profiles p ON p.id = tl.user_id
  WHERE tl.template_id = p_template_id
  ORDER BY tl.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 获取用户点赞统计函数
-- ============================================
CREATE OR REPLACE FUNCTION get_user_like_stats(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
  total_liked INTEGER,
  total_received INTEGER,
  recent_likes INTEGER,
  recent_received INTEGER
) AS $$
DECLARE
  v_total_liked INTEGER := 0;
  v_total_received INTEGER := 0;
  v_recent_likes INTEGER := 0;
  v_recent_received INTEGER := 0;
  v_seven_days_ago TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0;
    RETURN;
  END IF;

  v_seven_days_ago := NOW() - INTERVAL '7 days';

  -- 用户点赞总数
  SELECT COUNT(*) INTO v_total_liked
  FROM public.template_likes tl
  WHERE tl.user_id = p_user_id;

  -- 用户创建的模板收到的点赞总数
  SELECT COALESCE(SUM(t.like_count), 0) INTO v_total_received
  FROM public.templates t
  WHERE t.author_id = p_user_id;

  -- 最近7天用户的点赞数
  SELECT COUNT(*) INTO v_recent_likes
  FROM public.template_likes tl
  WHERE tl.user_id = p_user_id AND tl.created_at >= v_seven_days_ago;

  -- 最近7天用户创建的模板收到的点赞数
  SELECT COUNT(*) INTO v_recent_received
  FROM public.template_likes tl
  INNER JOIN public.templates t ON t.id = tl.template_id
  WHERE t.author_id = p_user_id AND tl.created_at >= v_seven_days_ago;

  RETURN QUERY SELECT v_total_liked, v_total_received, v_recent_likes, v_recent_received;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. 创建索引优化查询性能
-- ============================================

-- 如果索引不存在则创建
CREATE INDEX IF NOT EXISTS idx_template_likes_user_template 
ON public.template_likes(user_id, template_id);

CREATE INDEX IF NOT EXISTS idx_template_likes_template_created 
ON public.template_likes(template_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_templates_public_like_count 
ON public.templates(is_public, like_count DESC) 
WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_templates_author_public 
ON public.templates(author_id, is_public) 
WHERE is_public = true;

-- ============================================
-- 8. 授予必要的权限
-- ============================================

-- 授予执行RPC函数的权限
GRANT EXECUTE ON FUNCTION toggle_template_like TO authenticated;
GRANT EXECUTE ON FUNCTION check_templates_like_status TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_liked_templates TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_templates TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_template_likers TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_like_stats TO authenticated;

-- ============================================
-- 迁移完成
-- ============================================